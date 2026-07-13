import { getDb } from "../../lib/db";
import type { Fosa, FosaDetalle, Linea, Seccion, Panteon, Gaveta, Sepultacion, Exhumacion, MantenimientoPagado, CambioTitular } from "../../types";

export interface FosaFiltros {
  linea_id?: number; seccion_id?: number; panteon_id?: number; busqueda?: string;
}

export interface FosaDetalleCompleta extends Fosa {
  linea_codigo: string;
  linea_nombre: string;
  seccion_id: number;
  seccion_codigo: string;
  seccion_nombre: string;
  panteon_id: number;
  panteon_nombre: string;
  sepultaciones: Sepultacion[];
  exhumaciones: Exhumacion[];
  mantenimientos: MantenimientoPagado[];
  cambios_titular: CambioTitular[];
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function n(v: unknown, dflt = 0): number {
  const r = parseInt(String(v ?? ""));
  return Number.isFinite(r) ? r : dflt;
}

/** Fosa con campos derivados para mostrar en listas (último mantenimiento, ubicación). */
export interface FosaListado extends Fosa {
  /** Código de sección y línea para mostrar la ubicación. */
  seccion_codigo?: string;
  seccion_nombre?: string;
  linea_codigo?: string;
  linea_nombre?: string;
  panteon_nombre?: string;
  /** Año del pago de mantenimiento más reciente (o null si no hay). */
  ultimo_mantenimiento_anio?: number | null;
}

export const fosasService = {
  async listar(filtros: FosaFiltros = {}): Promise<FosaListado[]> {
    const db = await getDb();
    const where: string[] = [];
    if (filtros.linea_id) where.push(`f.linea_id = ${n(filtros.linea_id)}`);
    else if (filtros.seccion_id) where.push(`l.seccion_id = ${n(filtros.seccion_id)}`);
    else if (filtros.panteon_id) where.push(`s.panteon_id = ${n(filtros.panteon_id)}`);
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase().replace(/'/g, "''");
      where.push(`(LOWER(f.numero) LIKE '%${q}%' OR LOWER(l.codigo) LIKE '%${q}%' OR LOWER(s.codigo) LIKE '%${q}%' OR LOWER(f.titular_nombre) LIKE '%${q}%')`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    return db.select<FosaListado[]>(
      `SELECT f.*,
              l.codigo AS linea_codigo, l.nombre AS linea_nombre,
              s.codigo AS seccion_codigo, s.nombre AS seccion_nombre,
              p.nombre AS panteon_nombre,
              (SELECT MAX(anio) FROM mantenimientos_pagados WHERE fosa_id = f.id) AS ultimo_mantenimiento_anio
       FROM fosas f
       JOIN lineas l ON l.id = f.linea_id
       JOIN secciones s ON s.id = l.seccion_id
       JOIN panteones p ON p.id = s.panteon_id
       ${whereSql}
       ORDER BY p.nombre, s.codigo, l.codigo, f.numero`
    );
  },

  async obtener(id: number): Promise<Fosa | null> {
    const db = await getDb();
    try {
      const rows = await db.select<Fosa[]>(
        `SELECT * FROM fosas WHERE id = ${n(id)} LIMIT 1`
      );
      return rows?.[0] ?? null;
    } catch (e) {
      console.error(`[fosasService.obtener(${id})]`, e);
      return null;
    }
  },

  /**
   * Detalle de fosa con: contexto (línea → sección → panteón), colecciones
   * (sepultados, exhumaciones, mantenimientos, cambios titular) y otras gavetas
   * que también estén en la misma línea (informativo).
   */
  async obtenerDetalle(id: number): Promise<FosaDetalleCompleta | null> {
    console.log(`[fosasService.obtenerDetalle] id=${id}`);
    const db = await getDb();
    const safe = n(id, 0);
    if (!safe) return null;

    const fosaRows = await db.select<Fosa[]>(
      `SELECT * FROM fosas WHERE id = ${safe} LIMIT 1`
    );
    const fosa = fosaRows?.[0];
    if (!fosa) {
      console.warn(`[fosasService.obtenerDetalle] Fosa ${safe} no existe`);
      return null;
    }

    let linea_codigo = "", linea_nombre = "", seccion_id = 0,
        seccion_codigo = "", seccion_nombre = "",
        panteon_id = 0, panteon_nombre = "";
    try {
      const lin = await db.select<Linea[]>(
        `SELECT * FROM lineas WHERE id = ${fosa.linea_id} LIMIT 1`
      );
      if (lin?.[0]) {
        linea_codigo = lin[0].codigo;
        linea_nombre = lin[0].nombre;
        const sec = await db.select<Seccion[]>(
          `SELECT * FROM secciones WHERE id = ${lin[0].seccion_id} LIMIT 1`
        );
        if (sec?.[0]) {
          seccion_id = sec[0].id;
          seccion_codigo = sec[0].codigo;
          seccion_nombre = sec[0].nombre;
          panteon_id = sec[0].panteon_id;
          const pan = await db.select<Panteon[]>(
            `SELECT * FROM panteones WHERE id = ${sec[0].panteon_id} LIMIT 1`
          );
          if (pan?.[0]) panteon_nombre = pan[0].nombre;
        }
      }
    } catch (e) {
      console.warn("[fosasService.obtenerDetalle] contexto:", e);
    }

    const sepultaciones = await safeCar<Sepultacion[]>(
      db.select(`SELECT * FROM sepultaciones WHERE fosa_id = ${safe} ORDER BY fecha_sepultacion ASC`), []);
    const exhumaciones = await safeCar<Exhumacion[]>(
      db.select(`SELECT * FROM exhumaciones WHERE fosa_id = ${safe} ORDER BY fecha_exhumacion ASC`), []);
    const mantenimientos = await safeCar<MantenimientoPagado[]>(
      db.select(`SELECT * FROM mantenimientos_pagados WHERE fosa_id = ${safe} ORDER BY anio ASC`), []);
    const cambios_titular = await safeCar<CambioTitular[]>(
      db.select(`SELECT * FROM cambios_titular WHERE fosa_id = ${safe} ORDER BY fecha_cambio DESC`), []);

    return {
      ...fosa,
      linea_codigo,
      linea_nombre,
      seccion_id,
      seccion_codigo,
      seccion_nombre,
      panteon_id,
      panteon_nombre,
      sepultaciones,
      exhumaciones,
      mantenimientos,
      cambios_titular,
    };
  },

  async crear(data: {
    linea_id: number;
    numero: string;
    libro?: string;
    registro?: string;
    capacidad_gavetas?: number;
    notas?: string | null;
  } & Partial<Omit<Fosa, "id" | "created_at" | "updated_at" | "linea_id" | "numero" | "capacidad_gavetas">>): Promise<number> {
    const db = await getDb();
    if (!data.linea_id) throw new Error("linea_id requerido");
    const res = await db.execute(
      `INSERT INTO fosas (
        linea_id, numero, capacidad_gavetas,
        libro, registro, notas,
        notas_libro, observaciones,
        titular_id, titular_nombre, titular_domicilio, titular_telefono,
        numero_titulo, fecha_titulo, superficie_ancho, superficie_alto, beneficiario
      ) VALUES (
        ${n(data.linea_id)},
        ${esc(data.numero)},
        ${n(data.capacidad_gavetas ?? 1, 1)},
        ${esc(data.libro ?? "")},
        ${esc(data.registro ?? "")},
        ${esc(data.notas ?? null)},
        ${esc(data.notas_libro ?? null)},
        ${esc(data.observaciones ?? null)},
        ${data.titular_id ?? "NULL"},
        ${esc(data.titular_nombre ?? "")},
        ${esc(data.titular_domicilio ?? "")},
        ${esc(data.titular_telefono ?? "")},
        ${esc(data.numero_titulo ?? "")},
        ${data.fecha_titulo ? esc(data.fecha_titulo) : "NULL"},
        ${esc(data.superficie_ancho ?? "")},
        ${esc(data.superficie_alto ?? "")},
        ${esc(data.beneficiario ?? "")}
      )`
    );
    return (res && typeof res.lastInsertId === "number") ? res.lastInsertId : 0;
  },

  async actualizar(id: number, data: Partial<Fosa> & Record<string, unknown>): Promise<void> {
    const db = await getDb();
    const campos = camposActualizables();
    const sets: string[] = [];
    for (const c of campos) {
      const v = (data as Record<string, unknown>)[c];
      if (v !== undefined) {
        if (v === null) sets.push(`${c}=NULL`);
        else if (typeof v === "number") sets.push(`${c}=${v}`);
        else sets.push(`${c}=${esc(v)}`);
      }
    }
    if (!sets.length) return;
    sets.push(`updated_at=${esc(new Date().toISOString())}`);
    await db.execute(`UPDATE fosas SET ${sets.join(", ")} WHERE id = ${n(id)}`);
  },

  async eliminar(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(`DELETE FROM fosas WHERE id = ${n(id)}`);
  },

  async agregarSepultacion(data: Omit<Sepultacion, "id" | "created_at" | "fosa_id" | "gaveta_id"> & { _fosa_id?: number; _gaveta_id?: number }): Promise<number> {
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
  async agregarExhumacion(data: Omit<Exhumacion, "id" | "created_at"> & { _fosa_id?: number; _gaveta_id?: number }): Promise<number> {
    const db = await getDb();
    const fosaId = data._fosa_id;
    const gavetaId = data._gaveta_id;
    if (!fosaId && !gavetaId) throw new Error("fosa_id o gaveta_id requerido");
    const col = fosaId ? "fosa_id" : "gaveta_id";
    const val = fosaId ? n(fosaId) : n(gavetaId!);
    const res = await db.execute(
      `INSERT INTO exhumaciones (${col}, nombre, fecha_exhumacion, destino, notas) VALUES (${val}, ${esc(data.nombre)}, ${esc(data.fecha_exhumacion)}, ${data.destino ? esc(data.destino) : "NULL"}, ${data.notas ? esc(data.notas) : "NULL"})`
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
  async registrarMantenimiento(data: Omit<MantenimientoPagado, "id"> & { _fosa_id?: number; _gaveta_id?: number }): Promise<number> {
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
  async registrarCambioTitular(data: Omit<CambioTitular, "id"> & { _fosa_id?: number; _gaveta_id?: number }): Promise<number> {
    const db = await getDb();
    const fosaId = data._fosa_id;
    const gavetaId = data._gaveta_id;
    if (!fosaId && !gavetaId) throw new Error("fosa_id o gaveta_id requerido");
    const col = fosaId ? "fosa_id" : "gaveta_id";
    const val = fosaId ? n(fosaId) : n(gavetaId!);
    const updateCol = fosaId ? "fosas" : "gavetas";
    const rows = await db.select<{ id: number }[]>(
      `INSERT INTO cambios_titular (${col}, titular_anterior_id, titular_anterior_nombre, titular_nuevo_id, titular_nuevo_nombre, fecha_cambio, motivo, memorandum_id) VALUES (${val}, ${data.titular_anterior_id ?? "NULL"}, ${esc(data.titular_anterior_nombre ?? "")}, ${data.titular_nuevo_id ?? "NULL"}, ${esc(data.titular_nuevo_nombre ?? "")}, ${esc(data.fecha_cambio)}, ${data.motivo ? esc(data.motivo) : "NULL"}, ${data.memorandum_id ?? "NULL"}) RETURNING id`
    );
    const newId = rows?.[0]?.id ?? 0;
    await db.execute(
      `UPDATE ${updateCol} SET titular_id=${data.titular_nuevo_id ?? "NULL"}, titular_nombre=${esc(data.titular_nuevo_nombre ?? "")} WHERE id = ${val}`
    );
    return newId;
  },
};

function camposActualizables(): (keyof Fosa)[] {
  return [
    "numero", "capacidad_gavetas",
    "libro", "registro", "notas_libro", "observaciones",
    "titular_id", "titular_nombre", "titular_domicilio", "titular_telefono",
    "numero_titulo", "fecha_titulo", "superficie_ancho", "superficie_alto", "beneficiario",
  ];
}

async function safeCar<T>(p: Promise<T>, dflt: T): Promise<T> {
  try { return (await p) ?? dflt; }
  catch (e) { console.warn("[fosasService.collections]", e); return dflt; }
}
