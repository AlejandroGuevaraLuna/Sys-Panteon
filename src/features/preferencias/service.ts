import { getDb } from "../../lib/db";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function n(v: unknown, dflt = 0): number {
  const r = parseInt(String(v ?? ""));
  return Number.isFinite(r) ? r : dflt;
}

export interface PreferenciasUsuario {
  usuario_id: number;
  tema: "light" | "dark";
  color_primario: string;
}

const DEFAULT_PREF: Omit<PreferenciasUsuario, "usuario_id"> = {
  tema: "light",
  color_primario: "",
};

export const preferenciasService = {
  async obtener(usuarioId: number): Promise<PreferenciasUsuario> {
    const db = await getDb();
    const rows = await db.select<PreferenciasUsuario[]>(
      `SELECT usuario_id, tema, color_primario FROM preferencias_usuario WHERE usuario_id = ${n(usuarioId)} LIMIT 1`,
    );
    return rows?.[0] ?? { usuario_id: usuarioId, ...DEFAULT_PREF };
  },

  async guardar(p: PreferenciasUsuario): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO preferencias_usuario (usuario_id, tema, color_primario)
       VALUES (${n(p.usuario_id)}, ${esc(p.tema)}, ${esc(p.color_primario)})
       ON CONFLICT(usuario_id) DO UPDATE SET
         tema = excluded.tema,
         color_primario = excluded.color_primario`,
    );
  },
};
