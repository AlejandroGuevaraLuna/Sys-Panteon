// src/lib/backup.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sistema de respaldos automáticos de la base de datos SQLite.
//
// • Crea una copia "limpia" usando `VACUUM INTO` (SQLite garantiza que el
//   archivo resultante es autocontenido, aunque la BD origen esté abierta).
// • Guarda los respaldos en `<appDataDir>/backups/` con nombre
//   `panteon-backup-YYYY-MM-DDTHH-MM-SS.db`.
// • Rota automáticamente: conserva sólo los últimos `MAX_BACKUPS` archivos
//   (borrando los más antiguos).
// • Pensado para llamarse desde el handler de cierre de la ventana
//   (`onCloseRequested`) en `App.tsx`.
// ─────────────────────────────────────────────────────────────────────────────

import { appDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readDir,
  remove,
  stat,
  readFile,
  writeFile,
} from "@tauri-apps/plugin-fs";

/** Cantidad máxima de respaldos que se conservan en disco. */
export const MAX_BACKUPS = 30;

/** Subcarpeta dentro de appDataDir donde se guardan los respaldos. */
const BACKUP_DIR = "backups";

/** Nombre de archivo del SQLite principal (lo abre el plugin-sql). */
const LIVE_DB_NAME = "panteon.db";

export interface BackupResult {
  ok: boolean;
  /** Ruta absoluta al archivo recién creado (vacío si falló). */
  path: string;
  /** Sólo el nombre de archivo. */
  filename: string;
  /** Tamaño en bytes. */
  size: number;
  /** Cuántos respaldos quedaron en disco después de la rotación. */
  totalBackups: number;
  /** Cuántos archivos se borraron por la rotación. */
  rotated: number;
  /** Duración del respaldo en milisegundos. */
  durationMs: number;
  /** Mensaje de error si ok=false. */
  error?: string;
}

export interface BackupInfo {
  filename: string;
  path: string;
  /** Tamaño en bytes. */
  size: number;
  /** Fecha de modificación como ms epoch. */
  mtime: number;
}

/** Formato `YYYY-MM-DDTHH-MM-SS` (usamos `-` en vez de `:` porque Windows lo prohíbe). */
function formatDateForFilename(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

/** Escapa comillas simples para poder meter una ruta dentro de un string literal SQL. */
function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''");
}

function formatBytes(n: number): string {
  if (!n || n < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDateTime(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Devuelve la ruta absoluta a la carpeta de respaldos (creándola si hace falta). */
export async function getBackupDir(): Promise<string> {
  const dir = await join(await appDataDir(), BACKUP_DIR);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

/** Lista los respaldos existentes, ordenados del más reciente al más antiguo. */
export async function listarBackups(): Promise<BackupInfo[]> {
  const dir = await join(await appDataDir(), BACKUP_DIR);
  console.info(`[backup] listarBackups() leyendo de: ${dir}`);
  if (!(await exists(dir))) {
    console.info(`[backup] el directorio ${dir} no existe, regresando []`);
    return [];
  }
  const entries = await readDir(dir);
  console.info(`[backup] readDir devolvió ${entries.length} entradas`);
  const items: BackupInfo[] = [];
  for (const entry of entries) {
    if (!entry.name || !entry.name.endsWith(".db")) continue;
    try {
      const fullPath = await join(dir, entry.name);
      const info = await stat(fullPath);
      items.push({
        filename: entry.name,
        path: fullPath,
        size: Number(info.size ?? 0),
        mtime: Number(info.mtime ?? 0),
      });
    } catch (e) {
      console.warn(`[backup] no se pudo leer ${entry.name}:`, e);
    }
  }
  // Más reciente primero
  items.sort((a, b) => b.mtime - a.mtime);
  console.info(`[backup] listarBackups() → ${items.length} archivo(s) .db`);
  return items;
}

/**
 * Crea un respaldo nuevo de la base de datos y aplica la rotación.
 * Devuelve un `BackupResult` con info útil para mostrarla al usuario.
 *
 * NOTA: `VACUUM INTO` toma un snapshot consistente del archivo, así que es
 * seguro llamarlo aunque haya conexiones abiertas o transacciones en curso.
 */
export async function crearBackup(): Promise<BackupResult> {
  const start = Date.now();
  try {
    const dir = await getBackupDir();
    const filename = `panteon-backup-${formatDateForFilename(new Date())}.db`;
    const backupPath = await join(dir, filename);
    console.info(`[backup] crearBackup() → ${backupPath}`);

    // Importación dinámica para no cargar el módulo de BD en import estático
    // (mantiene `backup.ts` libre de dependencias circulares).
    const { getDb } = await import("./db");
    const db = await getDb();

    // `VACUUM INTO` necesita la ruta como string literal; escapamos las
    // comillas por si la ruta del usuario las trae.
    const sqlPath = escapeSqlString(backupPath);
    await db.execute(`VACUUM INTO '${sqlPath}'`);
    console.info(`[backup] VACUUM INTO ejecutado OK`);

    // Tamaño del archivo recién creado
    let size = 0;
    try {
      const info = await stat(backupPath);
      size = Number(info.size ?? 0);
    } catch { /* ignore */ }

    // Rotación: si hay más de MAX_BACKUPS, borrar los más viejos
    const all = await listarBackups();
    let rotated = 0;
    if (all.length > MAX_BACKUPS) {
      const sobrantes = all.slice(MAX_BACKUPS);
      for (const item of sobrantes) {
        try {
          await remove(item.path);
          rotated++;
        } catch (e) {
          console.warn(`[backup] no se pudo borrar ${item.path}:`, e);
        }
      }
    }

    console.info(
      `[backup] OK ${filename} (${size} B, rotados: ${rotated}, total: ${Math.min(all.length, MAX_BACKUPS)}, ${Date.now() - start} ms)`,
    );
    return {
      ok: true,
      path: backupPath,
      filename,
      size,
      totalBackups: Math.min(all.length, MAX_BACKUPS),
      rotated,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[backup] crearBackup falló:", msg);
    return {
      ok: false,
      path: "",
      filename: "",
      size: 0,
      totalBackups: 0,
      rotated: 0,
      durationMs: Date.now() - start,
      error: msg,
    };
  }
}

/** Borra un respaldo del disco. */
export async function eliminarBackup(path: string): Promise<void> {
  await remove(path);
}

/**
 * Restaura la base de datos desde un archivo de respaldo:
 *   1. Cierra la conexión activa.
 *   2. Sobrescribe el archivo `panteon.db` con el contenido del backup.
 *   3. La próxima vez que alguien llame `getDb()`, se reabrirá desde cero.
 *
 * El llamador es responsable de recargar la UI después (ej. `window.location.reload()`).
 */
export async function restaurarBackup(path: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { closeDb } = await import("./db");
    await closeDb();
    const livePath = await join(await appDataDir(), LIVE_DB_NAME);
    const data = await readFile(path);
    await writeFile(livePath, data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Helpers reusables para formatear tamaño y fecha en la UI. */
export const backupFormat = {
  bytes: formatBytes,
  dateTime: formatDateTime,
};
