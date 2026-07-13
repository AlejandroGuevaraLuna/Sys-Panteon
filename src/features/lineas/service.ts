import { getDb } from "../../lib/db";
import type { Linea, Fosa, Seccion, Panteon } from "../../types";

export interface LineaDetalleSafe extends Linea {
  seccion_codigo: string;
  seccion_nombre: string;
  panteon_id: number;
  panteon_nombre: string;
  total_fosas: number;
  fosas: Fosa[];
}

async function listar(seccion_id?: number): Promise<Linea[]> {
  const db = await getDb();
  const filter = seccion_id ? ` WHERE seccion_id = ${parseInt(String(seccion_id))}` : "";
  return db.select<Linea[]>(`SELECT * FROM lineas${filter} ORDER BY codigo ASC`);
}

async function obtener(id: number): Promise<Linea | null> {
  const db = await getDb();
  console.log(`[lineasService.obtener(${id})] ejecutando`);
  try {
    const rows = await db.select<Linea[]>(
      `SELECT * FROM lineas WHERE id = ${parseInt(String(id)) || 0} LIMIT 1`
    );
    const res = (rows && rows[0]) ?? null;
    console.log(`[lineasService.obtener(${id})] rows=${rows?.length ?? 0}, primero=${JSON.stringify(res)}`);
    return res;
  } catch (e) {
    console.error(`[lineasService.obtener(${id})] ERROR:`, e);
    return null;
  }
}

async function obtenerDetalle(id: number): Promise<LineaDetalleSafe | null> {
  console.log(`[lineasService.obtenerDetalle] INICIO id=${id}`);
  const db = await getDb();

  // PASO 1: Obtener la línea por id
  let linea: Linea | null = null;
  try {
    const safe = parseInt(String(id)) || 0;
    if (!safe) {
      console.warn(`[obtenerDetalle] id inválido: ${id}`);
      return null;
    }
    const rows = await db.select<Linea[]>(
      `SELECT id, seccion_id, codigo, nombre, descripcion, capacidad_fosas, activo, created_at FROM lineas WHERE id = ${safe} LIMIT 1`
    );
    linea = rows?.[0] ?? null;
    console.log(`[obtenerDetalle] paso1 linea:`, linea);
  } catch (e) {
    console.error(`[obtenerDetalle] paso1 (linea) ERROR:`, e);
    return null;
  }

  if (!linea) {
    console.warn(`[obtenerDetalle] línea ${id} no existe`);
    return null;
  }

  // PASO 2 y 3: Contexto (sección, panteón)
  let seccion_codigo = "", seccion_nombre = "", panteon_id: number = 0, panteon_nombre = "";
  try {
    const secRows = await db.select<Seccion[]>(
      `SELECT id, panteon_id, codigo, nombre, descripcion, capacidad_fosas, activo, created_at FROM secciones WHERE id = ${linea.seccion_id} LIMIT 1`
    );
    const sec = secRows?.[0];
    if (sec) {
      seccion_codigo = sec.codigo;
      seccion_nombre = sec.nombre;
      panteon_id = sec.panteon_id;
      const panRows = await db.select<Panteon[]>(
        `SELECT id, nombre, direccion, telefono, administrador, notas, activo, created_at FROM panteones WHERE id = ${sec.panteon_id} LIMIT 1`
      );
      const pan = panRows?.[0];
      if (pan) panteon_nombre = pan.nombre;
    }
  } catch (e) {
    console.warn(`[obtenerDetalle] contexto:`, e);
  }

  // PASO 4: Contar y listar fosas
  let total_fosas = 0;
  let fosas: Fosa[] = [];
  try {
    const fc = await db.select<{ c: number }[]>(
      `SELECT COUNT(*) AS c FROM fosas WHERE linea_id = ${linea.id}`
    );
    total_fosas = fc[0]?.c ?? 0;
    if (total_fosas > 0) {
      fosas = await db.select<Fosa[]>(
        `SELECT id, linea_id, numero, capacidad_gavetas, created_at, updated_at FROM fosas WHERE linea_id = ${linea.id} ORDER BY numero ASC`
      );
    }
  } catch (e) {
    console.warn(`[obtenerDetalle] fosas:`, e);
  }

  return {
    ...linea,
    seccion_codigo,
    seccion_nombre,
    panteon_id,
    panteon_nombre,
    total_fosas,
    fosas,
  };
}

async function crear(data: Omit<Linea, "id" | "created_at">): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ id: number }[]>(
    `INSERT INTO lineas (seccion_id, codigo, nombre, descripcion, capacidad_fosas, activo) VALUES (${parseInt(String(data.seccion_id)) || 0}, '${(data.codigo ?? "").replace(/'/g, "''")}', '${(data.nombre ?? "").replace(/'/g, "''")}', ${data.descripcion ? `'${data.descripcion.replace(/'/g, "''")}'` : "NULL"}, ${data.capacidad_fosas ?? "NULL"}, ${data.activo ?? 1}) RETURNING id`
  );
  return rows[0]?.id ?? 0;
}

async function actualizar(id: number, data: Partial<Linea>): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  if (data.seccion_id !== undefined) sets.push(`seccion_id=${parseInt(String(data.seccion_id))}`);
  if (data.codigo !== undefined) sets.push(`codigo='${(data.codigo ?? "").replace(/'/g, "''")}'`);
  if (data.nombre !== undefined) sets.push(`nombre='${(data.nombre ?? "").replace(/'/g, "''")}'`);
  if (data.descripcion !== undefined) sets.push(`descripcion=${data.descripcion ? `'${data.descripcion.replace(/'/g, "''")}'` : "NULL"}`);
  if (data.capacidad_fosas !== undefined) sets.push(`capacidad_fosas=${data.capacidad_fosas ?? "NULL"}`);
  if (data.activo !== undefined) sets.push(`activo=${data.activo ?? 1}`);
  if (!sets.length) return;
  await db.execute(`UPDATE lineas SET ${sets.join(", ")} WHERE id = ${parseInt(String(id)) || 0}`);
}

async function eliminar(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM lineas WHERE id = ${parseInt(String(id)) || 0}`);
}

async function contarFosas(id: number): Promise<number> {
  const db = await getDb();
  try {
    const rows = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) AS count FROM fosas WHERE linea_id = ${parseInt(String(id)) || 0}`
    );
    return rows?.[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export const lineasService = {
  listar,
  obtener,
  obtenerDetalle,
  crear,
  actualizar,
  eliminar,
  contarFosas,
};
