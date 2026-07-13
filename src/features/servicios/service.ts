import { getDb } from "../../lib/db";
import type { Servicio, TipoServicio } from "../../types";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function n(v: unknown, dflt = 0): number {
  // parseInt para IDs/contadores (enteros)
  const r = parseInt(String(v ?? ""));
  return Number.isFinite(r) ? r : dflt;
}
/** parseFloat para campos con decimales (precios, montos) */
function num(v: unknown, dflt = 0): number {
  const r = parseFloat(String(v ?? ""));
  return Number.isFinite(r) ? r : dflt;
}

export const serviciosService = {
  async listar(): Promise<Servicio[]> {
    const db = await getDb();
    return db.select<Servicio[]>("SELECT * FROM servicios ORDER BY id ASC");
  },
  async obtener(id: number): Promise<Servicio | null> {
    const db = await getDb();
    const rows = await db.select<Servicio[]>(
      `SELECT * FROM servicios WHERE id = ${n(id)} LIMIT 1`,
    );
    return rows[0] ?? null;
  },
  async obtenerPorTipo(tipo: TipoServicio): Promise<Servicio | null> {
    const db = await getDb();
    const rows = await db.select<Servicio[]>(
      `SELECT * FROM servicios WHERE tipo = ${esc(tipo)} LIMIT 1`,
    );
    return rows[0] ?? null;
  },
  async crear(data: {
    tipo: TipoServicio | string;
    nombre: string;
    precio?: number;
    descripcion?: string | null;
    activo?: number;
  }): Promise<number> {
    const db = await getDb();
    const res = await db.execute(
      `INSERT INTO servicios (tipo, nombre, precio, descripcion, activo) VALUES (
        ${esc(data.tipo)},
        ${esc(data.nombre)},
        ${num(data.precio ?? 0, 0)},
        ${data.descripcion ? esc(data.descripcion) : "NULL"},
        ${data.activo ?? 1}
      )`,
    );
    return res && typeof res.lastInsertId === "number" ? res.lastInsertId : 0;
  },
  async actualizar(id: number, data: {
    tipo?: TipoServicio | string;
    nombre?: string;
    precio?: number;
    descripcion?: string | null;
    activo?: number;
  }): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    if (data.tipo !== undefined) sets.push(`tipo = ${esc(data.tipo)}`);
    if (data.nombre !== undefined) sets.push(`nombre = ${esc(data.nombre)}`);
    if (data.precio !== undefined) sets.push(`precio = ${num(data.precio, 0)}`);
    if (data.descripcion !== undefined) sets.push(`descripcion = ${data.descripcion ? esc(data.descripcion) : "NULL"}`);
    if (data.activo !== undefined) sets.push(`activo = ${n(data.activo, 1)}`);
    if (!sets.length) return;
    await db.execute(`UPDATE servicios SET ${sets.join(", ")} WHERE id = ${n(id)}`);
  },
  async actualizarPrecio(id: number, precio: number): Promise<void> {
    return this.actualizar(id, { precio });
  },
  async eliminar(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(`DELETE FROM servicios WHERE id = ${n(id)}`);
  },
};
