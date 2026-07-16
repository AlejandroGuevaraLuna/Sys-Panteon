import { getDb } from "../../lib/db";
import type {
  CamposEntidad, Gaveta, GavetaDetalle, Sepultacion, Exhumacion,
  MantenimientoPagado, CambioTitular,
} from "../../types";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function n(v: unknown, dflt = 0): number {
  const r = parseInt(String(v ?? ""));
  return Number.isFinite(r) ? r : dflt;
}

/** Gaveta con campos derivados para listas (ubicación + último mantenimiento). */
export interface GavetaListado extends Gaveta {
  seccion_codigo?: string;
  seccion_nombre?: string;
  linea_codigo?: string;
  linea_nombre?: string;
  panteon_nombre?: string;
  ultimo_mantenimiento_anio?: number | null;
}

/** Gaveta vecina devuelta por `vecinas()`: tiene contexto y sus sepultados. */
export interface GavetaVecina extends GavetaListado {
  seccion_id: number;
  panteon_id: number;
  /** Sepultados de esta gaveta, ordenados por fecha. */
  sepultaciones: Array<{ id: number; nombre: string; fecha_sepultacion: string }>;
}

export const gavetasService = {
  async listar(linea_id?: number): Promise<GavetaListado[]> {
    const db = await getDb();
    const filter = linea_id ? `WHERE g.linea_id = ${n(linea_id)}` : "";
    return db.select<GavetaListado[]>(
      `SELECT g.*,
              l.codigo AS linea_codigo, l.nombre AS linea_nombre,
              s.codigo AS seccion_codigo, s.nombre AS seccion_nombre,
              p.nombre AS panteon_nombre,
              (SELECT MAX(anio) FROM mantenimientos_pagados WHERE gaveta_id = g.id) AS ultimo_mantenimiento_anio
       FROM gavetas g
       JOIN lineas l ON l.id = g.linea_id
       JOIN secciones s ON s.id = l.seccion_id
       JOIN panteones p ON p.id = s.panteon_id
       ${filter}
       ORDER BY p.nombre, s.codigo, l.codigo, g.numero`
    );
  },

  async listarPorLinea(linea_id: number): Promise<GavetaListado[]> {
    return this.listar(linea_id);
  },

  async obtener(id: number): Promise<Gaveta | null> {
    const db = await getDb();
    try {
      const rows = await db.select<Gaveta[]>(
        `SELECT * FROM gavetas WHERE id = ${n(id)} LIMIT 1`
      );
      return rows?.[0] ?? null;
    } catch (e) {
      console.error(`[gavetasService.obtener(${id})] ERROR:`, e);
      return null;
    }
  },

  /**
   * Obtiene la gaveta con todas sus colecciones (sepultaciones, exhumaciones,
   * mantenimientos, cambios de titular) más el contexto de la ubicación.
   */
  async obtenerDetalle(id: number): Promise<GavetaDetalle | null> {
    console.log(`[gavetasService.obtenerDetalle] INICIO id=${id}`);
    const db = await getDb();
    const gavetaRows = await db.select<Gaveta[]>(
      `SELECT * FROM gavetas WHERE id = ${n(id)} LIMIT 1`
    );
    const gaveta = gavetaRows?.[0];
    if (!gaveta) {
      console.warn(`[gavetasService.obtenerDetalle] Gaveta ${id} no existe`);
      return null;
    }

    const sepultaciones = await cargarSepultaciones(db, n(id));
    const exhumaciones = await cargarExhumaciones(db, n(id));
    const mantenimientos = await cargarMantenimientos(db, n(id));
    const cambios_titular = await cargarCambios(db, n(id));

    return {
      ...gaveta,
      linea_codigo: "", linea_nombre: "",
      seccion_id: 0, seccion_codigo: "", seccion_nombre: "",
      panteon_id: 0, panteon_nombre: "",
      sepultaciones,
      exhumaciones,
      mantenimientos,
      cambios_titular,
    };
  },

  async crear(data: {
    linea_id: number;
    numero: number | string;
    libro?: string;
    registro?: string;
    notas?: string | null;
  } & Partial<CamposEntidad>): Promise<number> {
    const db = await getDb();
    if (!data.linea_id) throw new Error("linea_id requerido");
    const numero = n(data.numero, 1);
    const res = await db.execute(
      `INSERT INTO gavetas (
        linea_id, numero, notas, libro, registro,
        titular_id, titular_nombre, titular_domicilio, titular_telefono,
        numero_titulo, fecha_titulo, superficie_ancho, superficie_alto, beneficiario,
        observaciones, notas_libro
      ) VALUES (
        ${n(data.linea_id)},
        ${numero},
        ${esc(data.notas ?? null)},
        ${esc(data.libro ?? "")},
        ${esc(data.registro ?? "")},
        ${data.titular_id ?? "NULL"},
        ${esc(data.titular_nombre ?? "")},
        ${esc(data.titular_domicilio ?? "")},
        ${esc(data.titular_telefono ?? "")},
        ${esc(data.numero_titulo ?? "")},
        ${data.fecha_titulo ? esc(data.fecha_titulo) : "NULL"},
        ${esc(data.superficie_ancho ?? "")},
        ${esc(data.superficie_alto ?? "")},
        ${esc(data.beneficiario ?? "")},
        ${esc(data.observaciones ?? null)},
        ${esc(data.notas_libro ?? null)}
      )`
    );
    return (res && typeof res.lastInsertId === "number") ? res.lastInsertId : 0;
  },

  async actualizar(id: number, data: Partial<Gaveta>): Promise<void> {
    const db = await getDb();
    const campos = camposActualizables();
    const sets: string[] = [];
    for (const c of campos) {
      if (data[c] !== undefined) {
        const v = data[c];
        if (v === null) sets.push(`${c}=NULL`);
        else if (typeof v === "number") sets.push(`${c}=${v}`);
        else sets.push(`${c}=${esc(v)}`);
      }
    }
    if (!sets.length) return;
    await db.execute(`UPDATE gavetas SET ${sets.join(", ")} WHERE id = ${n(id)}`);
  },

  async eliminar(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(`DELETE FROM gavetas WHERE id = ${n(id)}`);
  },

  /**
   * Devuelve las gavetas "vecinas" de una gaveta: las que están en la
   * MISMA línea (y por lo tanto misma sección) y cuyo `numero` está
   * dentro de `rango` unidades (por defecto ±3) de la gaveta original.
   *
   * Soporta números ALFANUMÉRICOS como "14-M", "6-B", "15M", "3-A", etc:
   *  - Se parsean en prefijo numérico + sufijo de letra.
   *  - Las vecinas se buscan DENTRO del mismo sufijo: una "14-M" sólo
   *    matchea con otras "*-M", no con "*-B" ni con las de número solo.
   *  - El rango se aplica sobre la parte numérica.
   *
   * Por la estructura del panteón, misma línea implica misma sección
   * y mismo panteón, así que la validación de "misma sección" se cumple
   * automáticamente al filtrar por `linea_id`.
   *
   * Para cada vecina, también trae sus sepultados (con su fecha).
   */
  async vecinas(gavetaId: number, rango = 3): Promise<GavetaVecina[]> {
    const db = await getDb();
    const gaveta = await this.obtener(gavetaId);
    if (!gaveta) return [];
    const lineaId = gaveta.linea_id;

    // Parsear el número actual: puede ser entero puro (14) o alfanumérico
    // ("14-M", "6/B", "15M"). Si no se puede parsear, no hay vecinas.
    const actualParsed = parseNumeroGaveta(gaveta.numero);
    if (!Number.isFinite(actualParsed.num)) return [];

    // Traer TODAS las gavetas de la misma línea. No podemos filtrar por
    // BETWEEN en SQL porque el sufijo alfabético hace que la comparación
    // entera falle; lo hacemos client-side.
    const todas = await db.select<Array<GavetaListado & { seccion_id: number; panteon_id: number }>>(
      `SELECT g.*,
              l.codigo AS linea_codigo, l.nombre AS linea_nombre,
              s.id AS seccion_id, s.codigo AS seccion_codigo, s.nombre AS seccion_nombre,
              p.id AS panteon_id, p.nombre AS panteon_nombre
       FROM gavetas g
       JOIN lineas l ON l.id = g.linea_id
       JOIN secciones s ON s.id = l.seccion_id
       JOIN panteones p ON p.id = s.panteon_id
       WHERE g.linea_id = ${n(lineaId)}
         AND g.id != ${n(gavetaId)}`,
    );

    // Filtrar por mismo sufijo y rango numérico, y ordenar.
    const cercanas = todas
      .map((g) => ({ g, parsed: parseNumeroGaveta(g.numero) }))
      .filter(({ parsed }) =>
        Number.isFinite(parsed.num) &&
        parsed.sufijo === actualParsed.sufijo &&
        Math.abs(parsed.num - actualParsed.num) <= rango,
      )
      .sort((a, b) => a.parsed.num - b.parsed.num)
      .map(({ g }) => g);

    if (!cercanas.length) return [];

    // Traer todos los sepultados de las vecinas en una sola query.
    const ids = cercanas.map((c) => c.id).join(",");
    const seps = await db.select<Array<{
      id: number; nombre: string; fecha_sepultacion: string; gaveta_id: number;
    }>>(
      `SELECT id, nombre, fecha_sepultacion, gaveta_id
       FROM sepultaciones
       WHERE gaveta_id IN (${ids})
       ORDER BY fecha_sepultacion ASC`,
    ).catch(() => []);

    const sepsByGaveta = new Map<number, Array<{ id: number; nombre: string; fecha_sepultacion: string }>>();
    for (const s of seps) {
      const arr = sepsByGaveta.get(s.gaveta_id) ?? [];
      arr.push({ id: s.id, nombre: s.nombre, fecha_sepultacion: s.fecha_sepultacion });
      sepsByGaveta.set(s.gaveta_id, arr);
    }

    return cercanas.map((c) => ({
      ...c,
      sepultaciones: sepsByGaveta.get(c.id) ?? [],
    }));
  },

  // ----- Colecciones (sepultados, exhumaciones, mantenimiento, cambios titular) -----

  async agregarSepultacion(data: Omit<Sepultacion, "id" | "created_at"> & { _gaveta_id?: number; _fosa_id?: number }): Promise<number> {
    const db = await getDb();
    const fosaId = data._fosa_id;
    const gavetaId = data._gaveta_id;
    if (!fosaId && !gavetaId) throw new Error("fosa_id o gaveta_id requerido");
    const col = fosaId ? "fosa_id" : "gaveta_id";
    const val = fosaId ? n(fosaId) : n(gavetaId!);
    const res = await db.execute(
      `INSERT INTO sepultaciones (${col}, nombre, fecha_sepultacion, fecha_fallecimiento, edad, notas)
       VALUES (${val}, ${esc(data.nombre)}, ${esc(data.fecha_sepultacion)}, ${data.fecha_fallecimiento ? esc(data.fecha_fallecimiento) : "NULL"}, ${data.edad ?? "NULL"}, ${esc(data.notas)})`
    );
    return (res && typeof res.lastInsertId === "number") ? res.lastInsertId : 0;
  },
  async actualizarSepultacion(id: number, data: { nombre?: string; fecha_sepultacion?: string; fecha_fallecimiento?: string | null; edad?: number | null; notas?: string | null }): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    if (data.nombre !== undefined) sets.push(`nombre=${esc(data.nombre)}`);
    if (data.fecha_sepultacion !== undefined) sets.push(`fecha_sepultacion=${esc(data.fecha_sepultacion)}`);
    if (data.fecha_fallecimiento !== undefined) sets.push(`fecha_fallecimiento=${data.fecha_fallecimiento === null ? "NULL" : esc(data.fecha_fallecimiento)}`);
    if (data.edad !== undefined) sets.push(`edad=${data.edad ?? "NULL"}`);
    if (data.notas !== undefined) sets.push(`notas=${data.notas === null ? "NULL" : esc(data.notas)}`);
    if (!sets.length) return;
    await db.execute(`UPDATE sepultaciones SET ${sets.join(", ")} WHERE id = ${n(id)}`);
  },
  async eliminarSepultacion(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(`DELETE FROM sepultaciones WHERE id = ${n(id)}`);
  },
  async agregarExhumacion(data: Omit<Exhumacion, "id" | "created_at"> & { _gaveta_id?: number; _fosa_id?: number }): Promise<number> {
    const db = await getDb();
    const fosaId = data._fosa_id;
    const gavetaId = data._gaveta_id;
    if (!fosaId && !gavetaId) throw new Error("fosa_id o gaveta_id requerido");
    const col = fosaId ? "fosa_id" : "gaveta_id";
    const val = fosaId ? n(fosaId) : n(gavetaId!);
    const res = await db.execute(
      `INSERT INTO exhumaciones (${col}, nombre, fecha_exhumacion, destino, notas)
       VALUES (${val}, ${esc(data.nombre)}, ${esc(data.fecha_exhumacion)}, ${data.destino ? esc(data.destino) : "NULL"}, ${data.notas ? esc(data.notas) : "NULL"})`
    );
    return (res && typeof res.lastInsertId === "number") ? res.lastInsertId : 0;
  },
  async actualizarExhumacion(id: number, data: { nombre?: string; fecha_exhumacion?: string; destino?: string | null; notas?: string | null }): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    if (data.nombre !== undefined) sets.push(`nombre=${esc(data.nombre)}`);
    if (data.fecha_exhumacion !== undefined) sets.push(`fecha_exhumacion=${esc(data.fecha_exhumacion)}`);
    if (data.destino !== undefined) sets.push(`destino=${data.destino === null ? "NULL" : esc(data.destino)}`);
    if (data.notas !== undefined) sets.push(`notas=${data.notas === null ? "NULL" : esc(data.notas)}`);
    if (!sets.length) return;
    await db.execute(`UPDATE exhumaciones SET ${sets.join(", ")} WHERE id = ${n(id)}`);
  },
  async eliminarExhumacion(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(`DELETE FROM exhumaciones WHERE id = ${n(id)}`);
  },
  async registrarMantenimiento(data: Omit<MantenimientoPagado, "id"> & { _gaveta_id?: number; _fosa_id?: number }): Promise<number> {
    const db = await getDb();
    const fosaId = data._fosa_id;
    const gavetaId = data._gaveta_id;
    if (!fosaId && !gavetaId) throw new Error("fosa_id o gaveta_id requerido");
    const col = fosaId ? "fosa_id" : "gaveta_id";
    const val = fosaId ? n(fosaId) : n(gavetaId!);
    const res = await db.execute(
      `INSERT INTO mantenimientos_pagados (${col}, anio, fecha_pago, monto, notas) VALUES (${val}, ${n(data.anio)}, ${esc(data.fecha_pago)}, ${data.monto}, ${data.notas ? esc(data.notas) : "NULL"})`
    );
    return (res && typeof res.lastInsertId === "number") ? res.lastInsertId : 0;
  },
  async eliminarMantenimiento(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(`DELETE FROM mantenimientos_pagados WHERE id = ${n(id)}`);
  },
  async registrarCambioTitular(data: Omit<CambioTitular, "id"> & {
    _gaveta_id?: number; _fosa_id?: number;
    /** Si se envía (string no vacío), actualiza también `numero_titulo` de la ficha. */
    numero_titulo?: string | null;
    /** Si se envía (string no vacío), actualiza también `fecha_titulo` de la ficha. */
    fecha_titulo?: string | null;
    /** Si se envía (string no vacío), actualiza también `beneficiario` de la ficha. */
    beneficiario?: string | null;
  }): Promise<number> {
    const db = await getDb();
    const fosaId = data._fosa_id;
    const gavetaId = data._gaveta_id;
    if (!fosaId && !gavetaId) throw new Error("fosa_id o gaveta_id requerido");
    const col = fosaId ? "fosa_id" : "gaveta_id";
    const val = fosaId ? n(fosaId) : n(gavetaId!);
    const updateCol = fosaId ? "fosas" : "gavetas";

    // Snapshot del titular ANTERIOR: el frontend pasa los datos ACTUALES
    // de la ficha (que es lo que está hoy antes del cambio). Así la
    // historia queda preservada aunque la ficha se modifique después.
    const ant_dom = data.titular_anterior_domicilio ?? "";
    const ant_tel = data.titular_anterior_telefono ?? "";
    const ant_num = data.titular_anterior_numero_titulo ?? "";
    const ant_fec = data.titular_anterior_fecha_titulo ?? null;
    const ant_ben = data.titular_anterior_beneficiario ?? "";

    const rows = await db.select<{ id: number }[]>(
      `INSERT INTO cambios_titular (
        ${col},
        titular_anterior_id, titular_anterior_nombre,
        titular_anterior_domicilio, titular_anterior_telefono,
        titular_anterior_numero_titulo, titular_anterior_fecha_titulo,
        titular_anterior_beneficiario,
        titular_nuevo_id, titular_nuevo_nombre,
        fecha_cambio, motivo, memorandum_id
      ) VALUES (
        ${val},
        ${data.titular_anterior_id ?? "NULL"}, ${esc(data.titular_anterior_nombre ?? "")},
        ${esc(ant_dom)}, ${esc(ant_tel)},
        ${esc(ant_num)}, ${ant_fec ? esc(ant_fec) : "NULL"},
        ${esc(ant_ben)},
        ${data.titular_nuevo_id ?? "NULL"}, ${esc(data.titular_nuevo_nombre ?? "")},
        ${esc(data.fecha_cambio)}, ${data.motivo ? esc(data.motivo) : "NULL"},
        ${data.memorandum_id ?? "NULL"}
      ) RETURNING id`
    );
    const newId = rows?.[0]?.id ?? 0;

    // Construir el UPDATE sólo con los campos que vinieron con valor.
    // Un string VACÍO significa "no cambiar"; un string con valor significa
    // "actualizar a este valor".
    const sets: string[] = [
      `titular_id=${data.titular_nuevo_id ?? "NULL"}`,
      `titular_nombre=${esc(data.titular_nuevo_nombre ?? "")}`,
    ];
    if (data.numero_titulo !== undefined && data.numero_titulo !== "") {
      sets.push(`numero_titulo=${esc(data.numero_titulo)}`);
    }
    if (data.fecha_titulo !== undefined && data.fecha_titulo !== "") {
      sets.push(`fecha_titulo=${esc(data.fecha_titulo)}`);
    }
    if (data.beneficiario !== undefined && data.beneficiario !== "") {
      sets.push(`beneficiario=${esc(data.beneficiario)}`);
    }
    await db.execute(
      `UPDATE ${updateCol} SET ${sets.join(", ")} WHERE id = ${val}`
    );
    return newId;
  },
};

function camposActualizables(): (keyof Gaveta)[] {
  return [
    "numero", "notas", "libro", "registro",
    "titular_id", "titular_nombre", "titular_domicilio", "titular_telefono",
    "numero_titulo", "fecha_titulo", "superficie_ancho", "superficie_alto", "beneficiario",
    "observaciones", "notas_libro",
  ];
}

async function cargarSepultaciones(db: any, gaveta_id: number): Promise<Sepultacion[]> {
  try {
    const r = await db.select(
      `SELECT * FROM sepultaciones WHERE gaveta_id = ${gaveta_id} ORDER BY fecha_sepultacion ASC`
    );
    return (r || []) as Sepultacion[];
  } catch { return []; }
}
async function cargarExhumaciones(db: any, gaveta_id: number): Promise<Exhumacion[]> {
  try {
    const r = await db.select(
      `SELECT * FROM exhumaciones WHERE gaveta_id = ${gaveta_id} ORDER BY fecha_exhumacion ASC`
    );
    return (r || []) as Exhumacion[];
  } catch { return []; }
}
async function cargarMantenimientos(db: any, gaveta_id: number): Promise<MantenimientoPagado[]> {
  try {
    const r = await db.select(
      `SELECT * FROM mantenimientos_pagados WHERE gaveta_id = ${gaveta_id} ORDER BY anio DESC`
    );
    return (r || []) as MantenimientoPagado[];
  } catch { return []; }
}
async function cargarCambios(db: any, gaveta_id: number): Promise<CambioTitular[]> {
  try {
    const r = await db.select(
      `SELECT * FROM cambios_titular WHERE gaveta_id = ${gaveta_id} ORDER BY fecha_cambio DESC`
    );
    return (r || []) as CambioTitular[];
  } catch { return []; }
}

/**
 * Parsea el `numero` de una gaveta, que puede ser:
 *  - INTEGER puro: 14
 *  - TEXT con sufijo de letra: "14-M", "6/B", "15M", "3-A", " 7 B "
 *  - Texto raro que no se puede parsear → { num: NaN, sufijo: "" }
 *
 * El sufijo se usa para AGRUPAR gavetas de la misma "serie" (M, B, A...).
 * Las vecinas se buscan sólo dentro de la misma serie para que una "14-M"
 * no aparezca como vecina de una "14" a secas o de una "14-B".
 */
function parseNumeroGaveta(
  n: number | string | null | undefined,
): { num: number; sufijo: string } {
  if (n === null || n === undefined) return { num: NaN, sufijo: "" };
  const s = String(n).trim();
  if (s === "") return { num: NaN, sufijo: "" };

  // Acepta:
  //   "14"     → { num: 14, sufijo: "" }
  //   "14-M"   → { num: 14, sufijo: "M" }
  //   "14M"    → { num: 14, sufijo: "M" }
  //   "14/B"   → { num: 14, sufijo: "B" }
  //   " 7 B "  → { num: 7,  sufijo: "B" }
  //   "M-14"   → no matchea (letra primero); regresamos NaN
  const m = s.match(/^(\d+)\s*[-/]?\s*([A-Za-z]*)$/);
  if (!m) return { num: NaN, sufijo: "" };
  return {
    num: parseInt(m[1], 10),
    sufijo: (m[2] || "").toUpperCase(),
  };
}
