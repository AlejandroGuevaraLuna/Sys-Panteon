/**
 * Servicio de importación de fosas/gavetas desde datos parseados del Excel.
 * Crea automáticamente la jerarquía faltante (panteón → sección → línea).
 */
import { getDb } from "@/lib/db";
import type { EntityType, FilaImportada } from "./excel";

/** Convierte un valor a entero seguro para SQL. */
function n(v: unknown, dflt = 0): number {
  const r = parseInt(String(v ?? ""));
  return Number.isFinite(r) ? r : dflt;
}

/** Escapa comillas simples para SQL. */
function esc(s: string): string {
  return String(s ?? "").replace(/'/g, "''");
}

/**
 * Extrae un mensaje legible de un error, sin importar su forma.
 * Maneja: Error estándar, string, objetos con `message` y
 * objetos con `error` (formato de @tauri-apps/plugin-sql).
 */
function errorMsg(e: unknown, fallback = "Error desconocido"): string {
  if (e == null) return fallback;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    // Plugin Tauri SQL devuelve { code, message }
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.error === "string" && obj.error) return obj.error;
    // Intentar JSON
    try {
      const json = JSON.stringify(e);
      if (json && json !== "{}" && json !== "null") return json;
    } catch { /* ignore */ }
  }
  return String(e);
}

/** Traduce errores comunes de SQLite a un mensaje más humano. */
function traducirErrorSqlite(raw: string): string {
  // Patrones comunes de SQLite
  const patterns: { regex: RegExp; friendly: string }[] = [
    {
      regex: /UNIQUE constraint failed: (\S+)\.(\S+)/i,
      friendly: "Ya existe un registro con este mismo valor (violación de UNIQUE en $1.$2)",
    },
    {
      regex: /NOT NULL constraint failed: (\S+)\.(\S+)/i,
      friendly: "Falta un campo obligatorio ($1.$2)",
    },
    {
      regex: /FOREIGN KEY constraint failed/i,
      friendly: "Referencia inválida (FOREIGN KEY). El registro relacionado no existe",
    },
    {
      regex: /CHECK constraint failed: (\S+)/i,
      friendly: "Violación de CHECK en $1 (regla de validación de la tabla)",
    },
    {
      regex: /no such table: (\S+)/i,
      friendly: "La tabla '$1' no existe en la base de datos",
    },
    {
      regex: /no such column: (\S+)/i,
      friendly: "La columna '$1' no existe en la tabla",
    },
    {
      regex: /database is locked/i,
      friendly: "La base de datos está bloqueada por otra operación",
    },
  ];
  for (const p of patterns) {
    const m = raw.match(p.regex);
    if (m) {
      return p.friendly.replace(/\$(\d)/g, (_, i) => m[parseInt(i, 10)]);
    }
  }
  return raw;
}

/** Extrae y traduce un error de cualquier fuente. */
function errorAmigable(e: unknown, fallback?: string): string {
  const raw = errorMsg(e, fallback);
  return traducirErrorSqlite(raw);
}

interface ImportResult {
  creadas: number;
  actualizadas: number;
  omitidas: number;
  errores: { fila: number; titular: string; numero: string; seccion: string; linea: string; razon: string }[];
  creadas_detalle: { fila: number; titular: string; numero: string; seccion: string; linea: string; accion: "creada" | "actualizada" }[];
}

/** Asegura que existe un panteón; si no, lo crea con valores por defecto. */
async function ensurePanteon(nombre: string, db: Awaited<ReturnType<typeof getDb>>): Promise<number> {
  const rows = await db.select<{ id: number }[]>(
    `SELECT id FROM panteones WHERE nombre = '${esc(nombre)}' LIMIT 1`,
  );
  if (rows[0]) return rows[0].id;
  const r = await db.execute(
    `INSERT INTO panteones (nombre, direccion, telefono, administrador, notas, activo)
     VALUES ('${esc(nombre)}', '', '', '', NULL, 1)`,
  );
  return r.lastInsertId ?? 0;
}

async function ensureSeccion(
  panteonId: number, codigo: string, db: Awaited<ReturnType<typeof getDb>>,
): Promise<number> {
  const r = await db.select<{ id: number }[]>(
    `SELECT id FROM secciones WHERE panteon_id = ${n(panteonId)} AND codigo = '${esc(codigo)}' LIMIT 1`,
  );
  if (r[0]) return r[0].id;
  const ins = await db.execute(
    `INSERT INTO secciones (panteon_id, codigo, nombre, descripcion, capacidad_fosas, activo)
     VALUES (${n(panteonId)}, '${esc(codigo)}', 'Sección ${esc(codigo)}', NULL, NULL, 1)`,
  );
  return ins.lastInsertId ?? 0;
}

async function ensureLinea(
  seccionId: number, codigo: string, db: Awaited<ReturnType<typeof getDb>>,
): Promise<number> {
  const r = await db.select<{ id: number }[]>(
    `SELECT id FROM lineas WHERE seccion_id = ${n(seccionId)} AND codigo = '${esc(codigo)}' LIMIT 1`,
  );
  if (r[0]) return r[0].id;
  const ins = await db.execute(
    `INSERT INTO lineas (seccion_id, codigo, nombre, descripcion, capacidad_fosas, activo)
     VALUES (${n(seccionId)}, '${esc(codigo)}', 'Línea ${esc(codigo)}', NULL, NULL, 1)`,
  );
  return ins.lastInsertId ?? 0;
}

/** Verifica si ya existe una fosa/gaveta con el mismo (linea_id, numero). */
/**
 * Comprueba si ya existe una entidad. Por defecto SIEMPRE devuelve null
 * (no hay dedup): cada fila del Excel crea un nuevo registro. Esto se
 * decidió porque las variantes de datos del Excel hacían que la dedup
 * generara demasiados falsos positivos.
 *
 * Si en el futuro quieres reactivar la dedup, restaura la lógica de
 * la versión anterior.
 */
async function existeEntidad(
  _tipo: EntityType, _lineaId: number, _numero: string, _f: FilaImportada,
  _db: Awaited<ReturnType<typeof getDb>>,
): Promise<number | null> {
  return null;
}

/** Inserta una fosa/gaveta. SIEMPRE crea un registro nuevo (no hay dedup). */
async function upsertEntidad(
  tipo: EntityType, lineaId: number, f: FilaImportada, db: Awaited<ReturnType<typeof getDb>>,
): Promise<{ id: number; created: boolean }> {
  const tabla = tipo === "fosa" ? "fosas" : "gavetas";
  const r = await db.execute(
    `INSERT INTO ${tabla} (
       linea_id, numero, libro, registro,
       titular_nombre, titular_domicilio, titular_telefono,
       numero_titulo, fecha_titulo,
       superficie_ancho, superficie_alto,
       beneficiario, observaciones, notas_libro
     ) VALUES (
       ${n(lineaId)}, '${esc(f.numero)}', '${esc(f.libro)}', '${esc(f.registro)}',
       '${esc(f.titular_nombre)}', '${esc(f.titular_domicilio)}', '${esc(f.titular_telefono)}',
       '${esc(f.numero_titulo)}', ${f.fecha_titulo ? `'${esc(f.fecha_titulo)}'` : "NULL"},
       '${esc(f.superficie_ancho)}', '${esc(f.superficie_alto)}',
       '${esc(f.beneficiario)}',
       ${f.observaciones ? `'${esc(f.observaciones)}'` : "NULL"},
       ${f.notas_libro ? `'${esc(f.notas_libro)}'` : "NULL"}
     )`,
  );
  let id = r.lastInsertId ?? 0;
  if (id === 0) {
    // Fallback: intentar leer el último id insertado
    const r2 = await db.select<{ id: number }[]>(
      `SELECT id FROM ${tabla} WHERE linea_id = ${n(lineaId)} ORDER BY id DESC LIMIT 1`,
    );
    if (r2[0]) id = r2[0].id;
    else throw new Error(
      `No se pudo insertar la ${tipo} "${f.numero}" en la línea ${lineaId}.`,
    );
  }
  return { id, created: true };
}

/** Reemplaza las colecciones (sepultados, exhumaciones, mantenimientos)
 *  de una fosa/gaveta. NO borra cambios de titular ni memorandums. */
async function reemplazarColecciones(
  tipo: EntityType, entidadId: number, f: FilaImportada,
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<void> {
  const fkCol = tipo === "fosa" ? "fosa_id" : "gaveta_id";
  // Sepultados
  await db.execute(`DELETE FROM sepultaciones WHERE ${fkCol} = ${n(entidadId)}`);
  for (const s of f.sepultados) {
    if (!s.nombre) continue;
    // La columna real es fecha_fallecimiento, no fecha_defuncion.
    // fecha_sepultacion es nullable (migración v5→v6), así que si
    // no hay fecha, se guarda NULL en ambas.
    await db.execute(
      `INSERT INTO sepultaciones (${fkCol}, nombre, fecha_sepultacion, fecha_fallecimiento, notas)
       VALUES (${n(entidadId)}, '${esc(s.nombre)}',
         ${s.fecha ? `'${esc(s.fecha)}'` : "NULL"},
         ${s.fecha ? `'${esc(s.fecha)}'` : "NULL"},
         NULL)`,
    );
  }
  // Exhumaciones
  await db.execute(`DELETE FROM exhumaciones WHERE ${fkCol} = ${n(entidadId)}`);
  for (const e of f.exhumaciones) {
    if (!e.nombre) continue;
    // La columna real es fecha_exhumacion, no fecha.
    await db.execute(
      `INSERT INTO exhumaciones (${fkCol}, nombre, fecha_exhumacion, destino, notas)
       VALUES (${n(entidadId)}, '${esc(e.nombre)}',
         ${e.fecha ? `'${esc(e.fecha)}'` : "NULL"},
         NULL, NULL)`,
    );
  }
  // Mantenimientos
  await db.execute(`DELETE FROM mantenimientos_pagados WHERE ${fkCol} = ${n(entidadId)}`);
  for (const anio of f.mantenimientos) {
    await db.execute(
      `INSERT INTO mantenimientos_pagados (${fkCol}, anio, fecha_pago, monto, notas)
       VALUES (${n(entidadId)}, ${n(anio)}, date('now'), 0, NULL)`,
    );
  }
}

/** Importa un conjunto de filas como fosas o gavetas. SIN DEDUP:
 *  cada fila del Excel se inserta como un nuevo registro. */
export async function importarFilas(
  tipo: EntityType,
  filas: FilaImportada[],
  panteonNombre: string,
): Promise<ImportResult> {
  const db = await getDb();
  const result: ImportResult = {
    creadas: 0,
    actualizadas: 0,
    omitidas: 0,
    errores: [],
    creadas_detalle: [],
  };
  // 1) Asegurar panteón
  let panteonId: number;
  try {
    panteonId = await ensurePanteon(panteonNombre, db);
  } catch (e) {
    result.errores.push({
      fila: 0,
      titular: "(panteón)",
      numero: "",
      seccion: "",
      linea: "",
      razon: `No se pudo crear/asegurar el panteón "${panteonNombre}": ${errorAmigable(e)}`,
    });
    return result;
  }
  // Cache de secciones y líneas para no consultar de más
  const seccionCache = new Map<string, number>();
  const lineaCache = new Map<string, number>();
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const numFila = i + 2; // +2 porque la fila 1 es el header
    // Validaciones con razones específicas
    if (!f.seccion_codigo) {
      result.errores.push({
        fila: numFila, titular: f.titular_nombre || "(sin nombre)", numero: f.numero,
        seccion: "", linea: f.linea_codigo,
        razon: "Falta el código de Sección",
      });
      continue;
    }
    if (!f.linea_codigo) {
      result.errores.push({
        fila: numFila, titular: f.titular_nombre || "(sin nombre)", numero: f.numero,
        seccion: f.seccion_codigo, linea: "",
        razon: "Falta el código de Línea",
      });
      continue;
    }
    if (!f.numero) {
      result.errores.push({
        fila: numFila, titular: f.titular_nombre || "(sin nombre)", numero: "",
        seccion: f.seccion_codigo, linea: f.linea_codigo,
        razon: "Falta el número de " + (tipo === "fosa" ? "fosa" : "gaveta"),
      });
      continue;
    }
    try {
      const seccionKey = f.seccion_codigo;
      if (!seccionCache.has(seccionKey)) {
        const id = await ensureSeccion(panteonId, f.seccion_codigo, db);
        seccionCache.set(seccionKey, id);
      }
      const seccionId = seccionCache.get(seccionKey)!;
      const lineaKey = `${seccionId}:${f.linea_codigo}`;
      if (!lineaCache.has(lineaKey)) {
        const id = await ensureLinea(seccionId, f.linea_codigo, db);
        lineaCache.set(lineaKey, id);
      }
      const lineaId = lineaCache.get(lineaKey)!;
      // SIEMPRE INSERT, sin dedup
      const { id } = await upsertEntidad(tipo, lineaId, f, db);
      await reemplazarColecciones(tipo, id, f, db);
      result.creadas++;
      result.creadas_detalle.push({
        fila: numFila, titular: f.titular_nombre || "(sin nombre)", numero: f.numero,
        seccion: f.seccion_codigo, linea: f.linea_codigo,
        accion: "creada",
      });
    } catch (e) {
      result.errores.push({
        fila: numFila, titular: f.titular_nombre || "(sin nombre)", numero: f.numero,
        seccion: f.seccion_codigo, linea: f.linea_codigo,
        razon: errorAmigable(e, "Error al procesar la fila"),
      });
    }
  }
  return result;
}
