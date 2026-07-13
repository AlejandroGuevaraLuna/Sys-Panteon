import { getDb } from "../../lib/db";
import { verifyPassword, hashPassword, isBcryptHash, type UsuarioSesion } from "../../lib/auth";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function n(v: unknown, dflt = 0): number {
  const r = parseInt(String(v ?? ""));
  return Number.isFinite(r) ? r : dflt;
}

interface UsuarioRow {
  id: number;
  username: string;
  password_hash: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rol: string;
  activo: number;
}

export const authService = {
  /**
   * Valida credenciales contra la BD. Devuelve el usuario (sin hash) si
   * son correctas, o null si no.
   *
   * Si el hash guardado es legacy (SHA-256) y la contraseña es correcta,
   * re-hashea con bcrypt y actualiza la BD en el mismo login.
   */
  async login(username: string, password: string): Promise<UsuarioSesion | null> {
    const db = await getDb();
    const rows = await db.select<UsuarioRow[]>(
      `SELECT id, username, password_hash, nombre, email, telefono, rol, activo
       FROM usuarios
       WHERE username = ${esc(username.trim().toLowerCase())} AND activo = 1
       LIMIT 1`,
    );
    const u = rows?.[0];
    if (!u) return null;
    const ok = await verifyPassword(password, u.password_hash);
    if (!ok) return null;

    // Migración transparente: si el hash es legacy, re-hashear con bcrypt
    if (!isBcryptHash(u.password_hash)) {
      try {
        const nuevoHash = await hashPassword(password);
        await db.execute(
          `UPDATE usuarios SET password_hash = ${esc(nuevoHash)} WHERE id = ${n(u.id)}`,
        );
        console.info(`[auth] password migrado a bcrypt para usuario id=${u.id}`);
      } catch (e) {
        console.warn("[auth] no se pudo re-hashear con bcrypt:", e);
      }
    }

    return {
      id: u.id, username: u.username, nombre: u.nombre, rol: u.rol,
      email: u.email, telefono: u.telefono,
    };
  },

  /** Devuelve los datos del usuario (sin hash) para edición de perfil. */
  async obtenerPerfil(usuarioId: number): Promise<UsuarioSesion | null> {
    const db = await getDb();
    const rows = await db.select<UsuarioRow[]>(
      `SELECT id, username, nombre, email, telefono, rol FROM usuarios WHERE id = ${n(usuarioId)} LIMIT 1`,
    );
    const u = rows?.[0];
    if (!u) return null;
    return {
      id: u.id, username: u.username, nombre: u.nombre, rol: u.rol,
      email: u.email, telefono: u.telefono,
    };
  },

  /** Actualiza nombre, email y teléfono del usuario. */
  async actualizarPerfil(
    usuarioId: number,
    data: { nombre: string; email: string | null; telefono: string | null },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!data.nombre.trim()) {
      return { ok: false, error: "El nombre no puede estar vacío" };
    }
    const db = await getDb();
    await db.execute(
      `UPDATE usuarios
       SET nombre = ${esc(data.nombre.trim())},
           email = ${data.email?.trim() ? esc(data.email.trim().toLowerCase()) : "NULL"},
           telefono = ${data.telefono?.trim() ? esc(data.telefono.trim()) : "NULL"}
       WHERE id = ${n(usuarioId)}`,
    );
    return { ok: true };
  },

  /**
   * Cambia la contraseña de un usuario. Valida la contraseña actual antes
   * de actualizar.
   */
  async cambiarMiContrasena(
    usuarioId: number,
    contrasenaActual: string,
    contrasenaNueva: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!contrasenaActual || !contrasenaNueva) {
      return { ok: false, error: "Captura la contraseña actual y la nueva" };
    }
    if (contrasenaNueva.length < 6) {
      return { ok: false, error: "La nueva contraseña debe tener al menos 6 caracteres" };
    }
    if (contrasenaActual === contrasenaNueva) {
      return { ok: false, error: "La nueva contraseña debe ser distinta a la actual" };
    }
    const db = await getDb();
    const rows = await db.select<UsuarioRow[]>(
      `SELECT id, password_hash FROM usuarios WHERE id = ${n(usuarioId)} LIMIT 1`,
    );
    const u = rows?.[0];
    if (!u) return { ok: false, error: "Usuario no encontrado" };
    const ok = await verifyPassword(contrasenaActual, u.password_hash);
    if (!ok) return { ok: false, error: "La contraseña actual es incorrecta" };

    const nuevoHash = await hashPassword(contrasenaNueva);
    await db.execute(
      `UPDATE usuarios SET password_hash = ${esc(nuevoHash)} WHERE id = ${n(usuarioId)}`,
    );
    return { ok: true };
  },

  /**
   * RESET DE EMERGENCIA: fuerza la contraseña del usuario admin a "Admin123!"
   * (hasheada con bcrypt). Usar solo si la BD se quedó con hashes
   * incompatibles y la migración transparente no funcionó.
   * Devuelve true si reseteó, false si el usuario "admin" no existe.
   */
  async resetearAdminEmergencia(): Promise<boolean> {
    const db = await getDb();
    const rows = await db.select<{ id: number }[]>(
      `SELECT id FROM usuarios WHERE username = 'admin' LIMIT 1`,
    );
    const u = rows?.[0];
    if (!u) return false;
    const nuevoHash = await hashPassword("Admin123!");
    await db.execute(
      `UPDATE usuarios SET password_hash = ${esc(nuevoHash)} WHERE id = ${n(u.id)}`,
    );
    return true;
  },

  // ============ CRUD de usuarios (solo admin) ============

  async listarTodos(): Promise<UsuarioSesion[]> {
    const db = await getDb();
    return db.select<UsuarioSesion[]>(
      `SELECT id, username, nombre, email, telefono, rol FROM usuarios WHERE activo = 1 ORDER BY username`,
    );
  },

  /** Crea un usuario con username, nombre, email opcional y contraseña inicial. */
  async crearUsuario(data: {
    username: string;
    password: string;
    nombre: string;
    email?: string | null;
    telefono?: string | null;
    rol: "admin" | "usuario";
  }): Promise<{ ok: boolean; id?: number; error?: string }> {
    const username = data.username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
      return { ok: false, error: "Username inválido. Usa 3-30 caracteres: letras, números, _.-" };
    }
    if (!data.nombre.trim()) return { ok: false, error: "El nombre es requerido" };
    if (data.password.length < 6) {
      return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
    }
    const db = await getDb();
    const existentes = await db.select<{ id: number }[]>(
      `SELECT id FROM usuarios WHERE username = ${esc(username)} LIMIT 1`,
    );
    if (existentes.length > 0) {
      return { ok: false, error: `Ya existe un usuario con username "${username}"` };
    }
    const hash = await hashPassword(data.password);
    const r = await db.execute(
      `INSERT INTO usuarios (username, password_hash, nombre, email, telefono, rol, activo)
       VALUES (${esc(username)}, ${esc(hash)}, ${esc(data.nombre.trim())},
               ${data.email?.trim() ? esc(data.email.trim().toLowerCase()) : "NULL"},
               ${data.telefono?.trim() ? esc(data.telefono.trim()) : "NULL"},
               ${esc(data.rol)}, 1)`,
    );
    return { ok: true, id: r?.lastInsertId };
  },

  /** Edita un usuario existente. Si `password` viene vacío, no se cambia. */
  async editarUsuario(id: number, data: {
    nombre: string;
    email?: string | null;
    telefono?: string | null;
    rol: "admin" | "usuario";
    password?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!data.nombre.trim()) return { ok: false, error: "El nombre es requerido" };
    const db = await getDb();
    if (data.password && data.password.length > 0) {
      if (data.password.length < 6) {
        return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
      }
      const hash = await hashPassword(data.password);
      await db.execute(
        `UPDATE usuarios SET
           nombre = ${esc(data.nombre.trim())},
           email = ${data.email?.trim() ? esc(data.email.trim().toLowerCase()) : "NULL"},
           telefono = ${data.telefono?.trim() ? esc(data.telefono.trim()) : "NULL"},
           rol = ${esc(data.rol)},
           password_hash = ${esc(hash)}
         WHERE id = ${n(id)}`,
      );
    } else {
      await db.execute(
        `UPDATE usuarios SET
           nombre = ${esc(data.nombre.trim())},
           email = ${data.email?.trim() ? esc(data.email.trim().toLowerCase()) : "NULL"},
           telefono = ${data.telefono?.trim() ? esc(data.telefono.trim()) : "NULL"},
           rol = ${esc(data.rol)}
         WHERE id = ${n(id)}`,
      );
    }
    return { ok: true };
  },

  /** Baja lógica: marca activo = 0. No elimina físicamente. */
  async eliminarUsuario(id: number): Promise<{ ok: boolean; error?: string }> {
    const db = await getDb();
    // No permitir eliminar al único admin activo
    const admins = await db.select<{ c: number }[]>(
      `SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'admin' AND activo = 1`,
    );
    const target = await db.select<{ rol: string }[]>(
      `SELECT rol FROM usuarios WHERE id = ${n(id)}`,
    );
    if (target?.[0]?.rol === "admin" && (admins?.[0]?.c ?? 0) <= 1) {
      return { ok: false, error: "No puedes eliminar al único administrador activo" };
    }
    await db.execute(`UPDATE usuarios SET activo = 0 WHERE id = ${n(id)}`);
    return { ok: true };
  },
};
