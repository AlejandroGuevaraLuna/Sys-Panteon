import { getDb } from "./db";

export async function ensureSchema(): Promise<void> {
  try {
    await getDb();
    console.info("[panteon-admin] Base de datos lista");
  } catch (e) {
    console.error("[panteon-admin] Error al inicializar la base de datos:", e);
  }
}