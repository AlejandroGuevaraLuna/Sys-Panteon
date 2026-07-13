import { getDb } from "../../lib/db";
import type { Seccion } from "../../types";

async function listar(panteon_id?: number): Promise<Seccion[]> {
  const db = await getDb();
  const filter = panteon_id ? ` WHERE panteon_id = ${parseInt(String(panteon_id)) || 0}` : "";
  return db.select<Seccion[]>(`SELECT * FROM secciones${filter} ORDER BY codigo ASC`);
}

async function obtener(id: number): Promise<Seccion | null> {
  const db = await getDb();
  console.log(`[seccionesService.obtener(${id})] ejecutando`);
  try {
    const rows = await db.select<Seccion[]>(
      `SELECT id, panteon_id, codigo, nombre, descripcion, capacidad_fosas, activo, created_at FROM secciones WHERE id = ${parseInt(String(id)) || 0} LIMIT 1`
    );
    const res = (rows && rows[0]) ?? null;
    console.log(`[seccionesService.obtener(${id})] rows=${rows?.length ?? 0}, →`, res);
    return res;
  } catch (e) {
    console.error(`[seccionesService.obtener(${id})] ERROR:`, e);
    return null;
  }
}

async function contarLineas(id: number): Promise<number> {
  const db = await getDb();
  try {
    const rows = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) AS count FROM lineas WHERE seccion_id = ${parseInt(String(id)) || 0}`
    );
    return rows?.[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

async function crear(data: Omit<Seccion, "id" | "created_at">): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ id: number }[]>(
    `INSERT INTO secciones (panteon_id, codigo, nombre, descripcion, capacidad_fosas, activo) VALUES (${parseInt(String(data.panteon_id)) || 0}, '${(data.codigo ?? "").replace(/'/g, "''")}', '${(data.nombre ?? "").replace(/'/g, "''")}', ${data.descripcion ? `'${data.descripcion.replace(/'/g, "''")}'` : "NULL"}, ${data.capacidad_fosas ?? "NULL"}, ${data.activo ?? 1}) RETURNING id`
  );
  return rows[0]?.id ?? 0;
}

async function actualizar(id: number, data: Partial<Seccion>): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  if (data.panteon_id !== undefined) sets.push(`panteon_id=${parseInt(String(data.panteon_id)) || 0}`);
  if (data.codigo !== undefined) sets.push(`codigo='${(data.codigo ?? "").replace(/'/g, "''")}'`);
  if (data.nombre !== undefined) sets.push(`nombre='${(data.nombre ?? "").replace(/'/g, "''")}'`);
  if (data.descripcion !== undefined) sets.push(`descripcion=${data.descripcion ? `'${data.descripcion.replace(/'/g, "''")}'` : "NULL"}`);
  if (data.capacidad_fosas !== undefined) sets.push(`capacidad_fosas=${data.capacidad_fosas ?? "NULL"}`);
  if (data.activo !== undefined) sets.push(`activo=${data.activo ?? 1}`);
  if (!sets.length) return;
  await db.execute(`UPDATE secciones SET ${sets.join(", ")} WHERE id = ${parseInt(String(id)) || 0}`);
}

async function eliminar(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM secciones WHERE id = ${parseInt(String(id)) || 0}`);
}

export const seccionesService = {
  listar,
  obtener,
  contarLineas,
  crear,
  actualizar,
  eliminar,
};
