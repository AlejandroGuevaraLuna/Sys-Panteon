import { getDb } from "../../lib/db";
import type { Panteon, Seccion } from "../../types";

async function listar(): Promise<Panteon[]> {
  const db = await getDb();
  return db.select<Panteon[]>("SELECT * FROM panteones ORDER BY activo DESC, nombre ASC");
}

async function obtener(id: number): Promise<Panteon | null> {
  const db = await getDb();
  console.log(`[panteonesService.obtener(${id})] ejecutando query`);
  try {
    const safe = parseInt(String(id)) || 0;
    if (!safe) return null;
    const rows = await db.select<Panteon[]>(
      `SELECT * FROM panteones WHERE id = ${safe} LIMIT 1`
    );
    console.log(`[panteonesService.obtener(${safe})] rows=${rows?.length ?? 0}, primero=${JSON.stringify(rows?.[0])}`);
    return (rows && rows[0]) ?? null;
  } catch (e) {
    console.error(`[panteonesService.obtener(${id})] ERROR:`, e);
    return null;
  }
}

interface PanteonDetalleData {
  panteon: Panteon;
  secciones: (Seccion & {
    total_lineas: number;
    total_fosas: number;
    total_gavetas: number;
  })[];
}

async function obtenerDetalle(id: number): Promise<PanteonDetalleData | null> {
  console.log(`[panteonesService.obtenerDetalle] INICIO id=${id}`);
  const db = await getDb();

  const safe = parseInt(String(id)) || 0;
  if (!safe) return null;

  const panteonRows = await db.select<Panteon[]>(
    `SELECT * FROM panteones WHERE id = ${safe} LIMIT 1`
  );
  const panteon = panteonRows?.[0];
  if (!panteon) {
    console.warn(`[panteonesService.obtenerDetalle] Panteón ${safe} no existe`);
    return null;
  }

  const seccionesRaw = await db.select<Seccion[]>(
    `SELECT * FROM secciones WHERE panteon_id = ${safe} ORDER BY codigo ASC`
  );

  const secciones = [];
  for (const s of (seccionesRaw || [])) {
    let total_lineas = 0, total_fosas = 0, total_gavetas = 0;
    try {
      const tl = await db.select<{ c: number }[]>(
        `SELECT COUNT(*) AS c FROM lineas WHERE seccion_id = ${s.id}`
      );
      total_lineas = tl?.[0]?.c ?? 0;
      if (total_lineas > 0) {
        const tf = await db.select<{ c: number }[]>(
          `SELECT COUNT(*) AS c FROM fosas WHERE linea_id IN (SELECT id FROM lineas WHERE seccion_id = ${s.id})`
        );
        total_fosas = tf?.[0]?.c ?? 0;
        if (total_fosas > 0) {
          const tg = await db.select<{ c: number }[]>(
            `SELECT COUNT(*) AS c FROM gavetas WHERE fosa_id IN (SELECT id FROM fosas WHERE linea_id IN (SELECT id FROM lineas WHERE seccion_id = ${s.id}))`
          );
          total_gavetas = tg?.[0]?.c ?? 0;
        }
      }
    } catch { /* ignore */ }
    secciones.push({ ...s, total_lineas, total_fosas, total_gavetas });
  }

  return { panteon, secciones };
}

async function crear(data: Omit<Panteon, "id" | "created_at">): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ id: number }[]>(
    `INSERT INTO panteones (nombre, direccion, telefono, administrador, notas, activo) VALUES ('${(data.nombre ?? "").replace(/'/g, "''")}', '${(data.direccion ?? "").replace(/'/g, "''")}', '${(data.telefono ?? "").replace(/'/g, "''")}', '${(data.administrador ?? "").replace(/'/g, "''")}', ${data.notas ? `'${data.notas.replace(/'/g, "''")}'` : "NULL"}, ${data.activo ?? 1}) RETURNING id`
  );
  return rows?.[0]?.id ?? 0;
}

async function actualizar(id: number, data: Partial<Panteon>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE panteones SET nombre='${(data.nombre ?? "").replace(/'/g, "''")}', direccion='${(data.direccion ?? "").replace(/'/g, "''")}', telefono='${(data.telefono ?? "").replace(/'/g, "''")}', administrador='${(data.administrador ?? "").replace(/'/g, "''")}', notas=${data.notas ? `'${data.notas.replace(/'/g, "''")}'` : "NULL"}, activo=${data.activo ?? 1} WHERE id=${parseInt(String(id)) || 0}`
  );
}

async function eliminar(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM panteones WHERE id = ${parseInt(String(id)) || 0}`);
}

export const panteonesService = { listar, obtener, obtenerDetalle, crear, actualizar, eliminar };
