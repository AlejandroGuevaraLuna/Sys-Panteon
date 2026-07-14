/**
 * Herramientas de desarrollo — SOLO disponibles en modo dev.
 *
 * Permite borrar todas las fosas, gavetas y sus colecciones
 * (sepultaciones, exhumaciones, mantenimientos, cambios de titular,
 * memorandums) para hacer pruebas más fácilmente.
 *
 * NO muestra ninguna UI en producción.
 */
import { getDb } from "@/lib/db";

export interface DevWipeResult {
  fosas: number;
  gavetas: number;
  sepultaciones: number;
  exhumaciones: number;
  mantenimientos: number;
  cambios_titular: number;
  memorandums: number;
}

/** Borra TODAS las fosas/gavetas y sus datos relacionados. */
export async function devWipeAll(): Promise<DevWipeResult> {
  const db = await getDb();
  await db.execute("PRAGMA foreign_keys = OFF");
  const result: DevWipeResult = {
    fosas: 0, gavetas: 0, sepultaciones: 0, exhumaciones: 0,
    mantenimientos: 0, cambios_titular: 0, memorandums: 0,
  };
  // Conteos antes (para reportar al usuario)
  for (const t of ["fosas", "gavetas", "sepultaciones", "exhumaciones",
                   "mantenimientos_pagados", "cambios_titular", "memorandums"] as const) {
    const c = await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM ${t}`);
    const key = t === "mantenimientos_pagados" ? "mantenimientos" : (t as keyof DevWipeResult);
    (result as unknown as Record<string, number>)[key] = c[0]?.n ?? 0;
  }
  // Deletes (orden importante: primero las que tienen FK)
  await db.execute("DELETE FROM memorandums");
  await db.execute("DELETE FROM cambios_titular");
  await db.execute("DELETE FROM mantenimientos_pagados");
  await db.execute("DELETE FROM exhumaciones");
  await db.execute("DELETE FROM sepultaciones");
  await db.execute("DELETE FROM gavetas");
  await db.execute("DELETE FROM fosas");
  // NO borramos: panteones, secciones, líneas, servicios, usuarios,
  // configuracion. Eso es la "infraestructura" del sistema.
  await db.execute("PRAGMA foreign_keys = ON");
  return result;
}

/** Borra solo fosas (sin tocar gavetas ni otras entidades). */
export async function devWipeFosas(): Promise<DevWipeResult> {
  const db = await getDb();
  await db.execute("PRAGMA foreign_keys = OFF");
  const result: DevWipeResult = {
    fosas: 0, gavetas: 0, sepultaciones: 0, exhumaciones: 0,
    mantenimientos: 0, cambios_titular: 0, memorandums: 0,
  };
  result.fosas = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM fosas`))[0]?.n ?? 0;
  result.sepultaciones = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM sepultaciones WHERE fosa_id IS NOT NULL`))[0]?.n ?? 0;
  result.exhumaciones = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM exhumaciones WHERE fosa_id IS NOT NULL`))[0]?.n ?? 0;
  result.mantenimientos = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM mantenimientos_pagados WHERE fosa_id IS NOT NULL`))[0]?.n ?? 0;
  result.cambios_titular = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM cambios_titular WHERE fosa_id IS NOT NULL`))[0]?.n ?? 0;
  result.memorandums = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM memorandums WHERE fosa_id IS NOT NULL`))[0]?.n ?? 0;
  await db.execute("DELETE FROM memorandums WHERE fosa_id IS NOT NULL");
  await db.execute("DELETE FROM cambios_titular WHERE fosa_id IS NOT NULL");
  await db.execute("DELETE FROM mantenimientos_pagados WHERE fosa_id IS NOT NULL");
  await db.execute("DELETE FROM exhumaciones WHERE fosa_id IS NOT NULL");
  await db.execute("DELETE FROM sepultaciones WHERE fosa_id IS NOT NULL");
  await db.execute("DELETE FROM fosas");
  await db.execute("PRAGMA foreign_keys = ON");
  return result;
}

/** Borra solo gavetas (sin tocar fosas ni otras entidades). */
export async function devWipeGavetas(): Promise<DevWipeResult> {
  const db = await getDb();
  await db.execute("PRAGMA foreign_keys = OFF");
  const result: DevWipeResult = {
    fosas: 0, gavetas: 0, sepultaciones: 0, exhumaciones: 0,
    mantenimientos: 0, cambios_titular: 0, memorandums: 0,
  };
  result.gavetas = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM gavetas`))[0]?.n ?? 0;
  result.sepultaciones = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM sepultaciones WHERE gaveta_id IS NOT NULL`))[0]?.n ?? 0;
  result.exhumaciones = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM exhumaciones WHERE gaveta_id IS NOT NULL`))[0]?.n ?? 0;
  result.mantenimientos = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM mantenimientos_pagados WHERE gaveta_id IS NOT NULL`))[0]?.n ?? 0;
  result.cambios_titular = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM cambios_titular WHERE gaveta_id IS NOT NULL`))[0]?.n ?? 0;
  result.memorandums = (await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM memorandums WHERE gaveta_id IS NOT NULL`))[0]?.n ?? 0;
  await db.execute("DELETE FROM memorandums WHERE gaveta_id IS NOT NULL");
  await db.execute("DELETE FROM cambios_titular WHERE gaveta_id IS NOT NULL");
  await db.execute("DELETE FROM mantenimientos_pagados WHERE gaveta_id IS NOT NULL");
  await db.execute("DELETE FROM exhumaciones WHERE gaveta_id IS NOT NULL");
  await db.execute("DELETE FROM sepultaciones WHERE gaveta_id IS NOT NULL");
  await db.execute("DELETE FROM gavetas");
  await db.execute("PRAGMA foreign_keys = ON");
  return result;
}
