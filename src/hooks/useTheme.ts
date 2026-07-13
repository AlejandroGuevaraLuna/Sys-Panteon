import { useEffect, useState, useCallback, useRef } from "react";
import { preferenciasService } from "@/features/preferencias/service";
import { useAuth } from "@/features/auth/AuthContext";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  primaryColor: string; // HSL string "222 47% 11%" o "" para default
}

const DEFAULT_STATE: ThemeState = { theme: "light", primaryColor: "" };

function applyTheme(state: ThemeState) {
  const root = document.documentElement;
  if (state.theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  if (state.primaryColor) {
    root.style.setProperty("--primary", state.primaryColor);
    root.style.setProperty(
      "--primary-foreground",
      isLightColor(state.primaryColor) ? "222 47% 11%" : "210 40% 98%",
    );
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
  }
}

function isLightColor(hslString: string): boolean {
  const m = hslString.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  if (!m) return true;
  return parseFloat(m[3]) > 55;
}

export function useTheme() {
  const { usuario } = useAuth();
  const [state, setState] = useState<ThemeState>(DEFAULT_STATE);
  const [cargado, setCargado] = useState(false);
  // Ref que siempre apunta al estado más reciente, para que los callbacks
  // (que se recrean en cada render NO necesario) lean el valor actual.
  const stateRef = useRef<ThemeState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Al cambiar de usuario (login/logout), cargar sus preferencias desde BD.
  useEffect(() => {
    let cancelled = false;
    setCargado(false);
    if (!usuario) {
      setState(DEFAULT_STATE);
      stateRef.current = DEFAULT_STATE;
      setCargado(true);
      return;
    }
    (async () => {
      try {
        const prefs = await preferenciasService.obtener(usuario.id);
        if (cancelled) return;
        const tema: Theme = prefs.tema === "dark" ? "dark" : "light";
        const next: ThemeState = { theme: tema, primaryColor: prefs.color_primario };
        setState(next);
        stateRef.current = next;
        setCargado(true);
      } catch {
        if (cancelled) return;
        setState(DEFAULT_STATE);
        stateRef.current = DEFAULT_STATE;
        setCargado(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  // Aplicar al DOM cuando cambia el estado (después de cargar)
  useEffect(() => {
    if (cargado) applyTheme(state);
  }, [state, cargado]);

  const persistir = useCallback((next: ThemeState) => {
    if (!usuario) return;
    preferenciasService.guardar({
      usuario_id: usuario.id,
      tema: next.theme,
      color_primario: next.primaryColor,
    }).catch(() => { /* ignore */ });
  }, [usuario]);

  const setTheme = useCallback((theme: Theme) => {
    setState((s) => {
      const next = { ...s, theme };
      stateRef.current = next;
      persistir(next);
      return next;
    });
  }, [persistir]);

  const setPrimaryColor = useCallback((hsl: string) => {
    setState((s) => {
      const next = { ...s, primaryColor: hsl };
      stateRef.current = next;
      persistir(next);
      return next;
    });
  }, [persistir]);

  const resetColor = useCallback(() => {
    setState((s) => {
      const next = { ...s, primaryColor: "" };
      stateRef.current = next;
      persistir(next);
      return next;
    });
  }, [persistir]);

  const toggleTheme = useCallback(() => {
    setState((s) => {
      const next: ThemeState = { ...s, theme: s.theme === "dark" ? "light" : "dark" };
      stateRef.current = next;
      persistir(next);
      return next;
    });
  }, [persistir]);

  return { theme: state.theme, primaryColor: state.primaryColor, setTheme, setPrimaryColor, resetColor, toggleTheme };
}
