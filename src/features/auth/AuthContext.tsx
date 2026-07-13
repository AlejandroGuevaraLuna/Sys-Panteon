import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UsuarioSesion } from "@/lib/auth";
import { authService } from "./service";

interface AuthContextValue {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // La sesión NO se persiste. Al abrir la app siempre empezamos en null
  // y la ruta /login se muestra.
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const cargando = false;

  const value = useMemo<AuthContextValue>(() => ({
    usuario,
    cargando,
    async login(username, password) {
      if (!username.trim() || !password) {
        return { ok: false, error: "Captura usuario y contraseña" };
      }
      try {
        const u = await authService.login(username, password);
        if (!u) {
          return { ok: false, error: "Usuario o contraseña incorrectos" };
        }
        setUsuario(u);
        return { ok: true };
      } catch (e) {
        console.error("[AuthProvider.login]", e);
        return { ok: false, error: (e as Error).message || "Error al iniciar sesión" };
      }
    },
    logout() {
      setUsuario(null);
    },
  }), [usuario, cargando]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
