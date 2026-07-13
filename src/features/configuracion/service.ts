import { getDb } from "../../lib/db";
import type { AppConfig } from "../../types";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function n(v: unknown, dflt = 0): number {
  const r = parseInt(String(v ?? ""));
  return Number.isFinite(r) ? r : dflt;
}

const DEFAULT_CONFIG: AppConfig = {
  panteon_activo_id: null,
  logo_path: null,
  pie_pagina: "",
  ciudad: "",
  color_primario: "",
  memo_folio_inicial: 1,
};

export const configuracionService = {
  async obtener(): Promise<AppConfig> {
    try {
      const db = await getDb();
      const rows = await db.select<AppConfig[]>("SELECT * FROM configuracion WHERE id=1");
      return { ...DEFAULT_CONFIG, ...(rows[0] ?? {}) };
    } catch {
      return DEFAULT_CONFIG;
    }
  },
  async actualizar(data: Partial<AppConfig>): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    if (data.panteon_activo_id !== undefined) {
      sets.push(`panteon_activo_id=${data.panteon_activo_id === null ? "NULL" : n(data.panteon_activo_id)}`);
    }
    if (data.logo_path !== undefined) {
      sets.push(`logo_path=${data.logo_path === null ? "NULL" : esc(data.logo_path)}`);
    }
    if (data.pie_pagina !== undefined) sets.push(`pie_pagina=${esc(data.pie_pagina)}`);
    if (data.ciudad !== undefined) sets.push(`ciudad=${esc(data.ciudad)}`);
    if (data.color_primario !== undefined) sets.push(`color_primario=${esc(data.color_primario)}`);
    if (data.memo_folio_inicial !== undefined) sets.push(`memo_folio_inicial=${n(data.memo_folio_inicial, 1)}`);
    if (!sets.length) return;
    await db.execute(`UPDATE configuracion SET ${sets.join(", ")} WHERE id=1`);
  },
};
