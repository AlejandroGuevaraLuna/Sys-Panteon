/**
 * Helpers de autenticación: hash bcrypt (preferido) y verificación
 * legacy SHA-256 para migración transparente de BD antiguas.
 *
 * Formatos aceptados en `password_hash`:
 *   - bcrypt: "$2b$10$..."  (preferido, nuevo formato)
 *   - legacy: "salt:hex"     (SHA-256 con salt, BD anteriores a v1.1.9)
 *
 * El primer login exitoso con un hash legacy lo re-hashea con bcrypt.
 */
import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

export interface UsuarioSesion {
  id: number;
  username: string;
  nombre: string;
  rol: string;
  email?: string | null;
  telefono?: string | null;
}

export function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(stored);
}

/** SHA-256 simple con prefijo de salt (formato legacy). */
function sha256Hex(input: string): string {
  // jsPDF-style synchronous fallback usando SubtleCrypto via Promise,
  // pero para mantener sync aquí usamos un helper asíncrono.
  // Como verifyLegacyPassword es async, esto está OK.
  return ""; // no usado directamente
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export async function verifyLegacySha256Password(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const h = await sha256(`${salt}:${password}`);
  return h === expected;
}

/** Hashea una contraseña con bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** Verifica una contraseña contra un hash (bcrypt o legacy SHA-256). */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (isBcryptHash(stored)) {
    try { return await bcrypt.compare(password, stored); } catch { return false; }
  }
  // Legacy SHA-256
  return verifyLegacySha256Password(password, stored);
}

// NOTA: la sesión NO se persiste entre reinicios de la app. Cada vez que
// se abre, se debe volver a iniciar sesión. (Requerimiento del proyecto.)
