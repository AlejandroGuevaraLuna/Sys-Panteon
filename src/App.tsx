import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { AuthProvider } from "./features/auth/AuthContext";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import Login from "./features/auth/Login";
import MainLayout from "./components/layout/MainLayout";
import Inicio from "./pages/Inicio";
import Panteones from "./features/panteones/Panteones";
import PanteonDetalle from "./features/panteones/PanteonDetalle";
import Secciones from "./features/secciones/Secciones";
import SeccionDetalle from "./features/secciones/SeccionDetalle";
import Lineas from "./features/lineas/Lineas";
import LineaDetalle from "./features/lineas/LineaDetalle";
import Fosas from "./features/fosas/Fosas";
import FosaDetalle from "./features/fosas/FosaDetalle";
import Gavetas from "./features/gavetas/Gavetas";
import GavetaDetalle from "./features/gavetas/GavetaDetalle";
import Servicios from "./features/servicios/Servicios";
import Memorandums from "./features/memorandums/Memorandums";
import Reportes from "./features/reportes/Reportes";
import Configuracion from "./features/configuracion/Configuracion";
import Diagnostico from "./pages/Diagnostico";
import { crearBackup, backupFormat, type BackupResult } from "./lib/backup";
import { Button } from "./components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";

type ClosePhase = "idle" | "creating" | "closing" | "error";

const CLOSE_COUNTDOWN_SEC = 3;     // cuenta atrás al cerrar (éxito)
const ERROR_COUNTDOWN_SEC = 5;     // cuenta atrás al cerrar (error)
const TICK_MS = 100;               // frecuencia del cronómetro de elapsed

/**
 * Cierra la app de forma fiable. Estrategia en cascada:
 *   1. Invoca el comando Rust `cerrar_aplicacion` que llama `app.exit(0)`.
 *      Es la forma más fiable (en macOS evita el "zombie en el dock").
 *   2. Si el comando falla, fallback a `win.destroy()`.
 *   3. Si todo falla, intenta `process.exit(0)` como último recurso.
 */
async function cerrarApp(win: ReturnType<typeof getCurrentWindow>): Promise<void> {
  try {
    console.info("[AppCloseHandler] cerrando con comando Rust cerrar_aplicacion()...");
    await invoke("cerrar_aplicacion");
    // Si retorna, el OS aún no terminó el proceso (raro). Hacemos fallback.
  } catch (e) {
    console.warn("[AppCloseHandler] cerrar_aplicacion falló, intentando win.destroy():", e);
    try {
      await win.destroy();
    } catch (e2) {
      console.error("[AppCloseHandler] win.destroy() también falló:", e2);
      // Último recurso: matar el proceso JS directamente
      try {
        const p = (globalThis as { process?: { exit: (code: number) => void } }).process;
        if (p && typeof p.exit === "function") {
          p.exit(0);
        }
      } catch (e3) {
        console.error("[AppCloseHandler] process.exit() también falló:", e3);
      }
    }
  }
}

/**
 * Overlay de pantalla completa que se muestra mientras la app está:
 *   1. Creando el respaldo de la BD (con cronómetro de tiempo transcurrido).
 *   2. Mostrando un countdown antes de cerrar.
 *   3. Mostrando un error con countdown.
 *
 * Incluye un botón "Cancelar cierre" para que el usuario pueda arrepentirse.
 */
function CloseOverlay({
  phase, elapsedMs, countdown, errorMsg, backupInfo, onCancel,
}: {
  phase: ClosePhase;
  elapsedMs: number;
  countdown: number;
  errorMsg: string | null;
  backupInfo: { filename: string; size: number } | null;
  onCancel: () => void;
}) {
  if (phase === "idle") return null;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  return (
    <div
      // Bloquea clicks fuera; dejamos pasar la "X" sólo en error para no
      // dejar al usuario atrapado si algo truena.
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-background rounded-xl shadow-2xl max-w-md w-full border p-8 space-y-5 relative">
        {/* Botón X sólo durante 'error' para que el usuario pueda escapar */}
        {phase === "error" && (
          <button
            type="button"
            aria-label="Cerrar este mensaje"
            onClick={onCancel}
            className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {phase === "creating" && (
          <>
            <div className="flex justify-center">
              <Loader2 className="h-14 w-14 animate-spin text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Creando respaldo…</h2>
              <p className="text-sm text-muted-foreground">
                Estamos guardando una copia de seguridad de la base de datos.
                Este proceso es automático, por favor ten paciencia.
              </p>
              <div className="pt-2 flex items-baseline justify-center gap-2">
                <span className="text-xs text-muted-foreground">Tiempo transcurrido:</span>
                <span className="text-2xl font-mono font-bold tabular-nums text-primary">
                  {elapsedSec}s
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                No cierres la ventana manualmente ni apagues el equipo. La
                aplicación se cerrará sola cuando el respaldo termine.
              </span>
            </div>
          </>
        )}

        {phase === "closing" && (
          <>
            <div className="flex justify-center">
              <div className="rounded-full bg-emerald-100 p-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-emerald-700">
                ¡Respaldo completado!
              </h2>
              {backupInfo && (
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {backupInfo.filename} · {backupFormat.bytes(backupInfo.size)}
                </p>
              )}
              <p className="text-sm text-muted-foreground pt-1">
                La aplicación se cerrará automáticamente en:
              </p>
              <div className="text-7xl font-bold text-primary tabular-nums py-2 leading-none">
                {countdown}
              </div>
              <p className="text-xs text-muted-foreground">
                segundo{countdown === 1 ? "" : "s"}
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Cancelar cierre y seguir usando la app
            </Button>
          </>
        )}

        {phase === "error" && (
          <>
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 p-3">
                <AlertTriangle className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-red-700">
                No se pudo crear el respaldo
              </h2>
              {errorMsg && (
                <p className="text-xs text-red-700 font-mono break-all bg-red-50 p-2 rounded text-left">
                  {errorMsg}
                </p>
              )}
              <p className="text-sm text-muted-foreground pt-1">
                Cerraremos de todos modos para no dejar la app zombie.
                Se cerrará en:
              </p>
              <div className="text-7xl font-bold text-primary tabular-nums py-2 leading-none">
                {countdown}
              </div>
              <p className="text-xs text-muted-foreground">
                segundo{countdown === 1 ? "" : "s"}
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Cancelar cierre y seguir usando la app
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Escucha el cierre de la ventana. Cuando el usuario hace clic en la X:
 *   1. Muestra overlay "Creando respaldo…" con cronómetro de elapsed.
 *   2. Corre `crearBackup()`.
 *   3. Si tuvo éxito: muestra overlay "¡Listo! Cerrando en N" con countdown.
 *   4. Si falló: muestra overlay de error con countdown más largo (5s).
 *   5. Al final del countdown, llama `win.destroy()`.
 *
 * El usuario puede pulsar "Cancelar cierre" para abortar todo y seguir
 * usando la app.
 */
function AppCloseHandler() {
  const [phase, setPhase] = useState<ClosePhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<{ filename: string; size: number } | null>(null);
  const inProgress = useRef(false);
  const cancelledByUser = useRef(false);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const win = getCurrentWindow();
        const fn = await win.onCloseRequested(async (event) => {
          if (cancelled) return;
          // Si ya hay un cierre en curso, seguimos bloqueando hasta terminar
          if (inProgress.current) {
            event.preventDefault();
            return;
          }
          inProgress.current = true;
          cancelledByUser.current = false;
          event.preventDefault();

          // ===== FASE 1: creando respaldo =====
          setPhase("creating");
          setElapsedMs(0);
          setErrorMsg(null);
          setBackupInfo(null);
          const start = Date.now();
          const tick = setInterval(() => {
            setElapsedMs(Date.now() - start);
          }, TICK_MS);

          let result: BackupResult;
          try {
            result = await crearBackup();
          } catch (e) {
            result = {
              ok: false,
              path: "", filename: "", size: 0,
              totalBackups: 0, rotated: 0,
              durationMs: Date.now() - start,
              error: e instanceof Error ? e.message : String(e),
            };
          }
          clearInterval(tick);
          setElapsedMs(Date.now() - start);

          // Si el usuario canceló mientras se hacía el respaldo, abortamos
          if (cancelledByUser.current) {
            inProgress.current = false;
            return;
          }

          if (!result.ok) {
            // ===== FASE 3: error, countdown largo y cerramos igual =====
            setPhase("error");
            setErrorMsg(result.error || "Error desconocido");
            for (let i = ERROR_COUNTDOWN_SEC; i > 0; i--) {
              if (cancelledByUser.current) {
                inProgress.current = false;
                return;
              }
              setCountdown(i);
              await new Promise((r) => setTimeout(r, 1000));
            }
            setPhase("idle");
            await cerrarApp(win);
            return;
          }

          // ===== FASE 2: respaldo OK, countdown y cerramos =====
          setPhase("closing");
          setBackupInfo({ filename: result.filename, size: result.size });
          for (let i = CLOSE_COUNTDOWN_SEC; i > 0; i--) {
            if (cancelledByUser.current) {
              inProgress.current = false;
              return;
            }
            setCountdown(i);
            await new Promise((r) => setTimeout(r, 1000));
          }
          setPhase("idle");
          await cerrarApp(win);
        });
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      } catch (e) {
        // Si no estamos dentro de Tauri (ej. `vite dev` en navegador), no pasa nada
        console.warn("[AppCloseHandler] no se pudo registrar onCloseRequested:", e);
      }
    })();
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  const cancelarCierre = () => {
    cancelledByUser.current = true;
    inProgress.current = false;
    setPhase("idle");
  };

  return (
    <CloseOverlay
      phase={phase}
      elapsedMs={elapsedMs}
      countdown={countdown}
      errorMsg={errorMsg}
      backupInfo={backupInfo}
      onCancel={cancelarCierre}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppCloseHandler />
      <BrowserRouter>
        <Routes>
          {/* Login (público) */}
          <Route path="/login" element={<Login />} />

          {/* App principal (protegida) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Inicio />} />
            <Route path="panteones" element={<Panteones />} />
            <Route path="panteones/:id" element={<PanteonDetalle />} />
            <Route path="secciones" element={<Secciones />} />
            <Route path="secciones/:id" element={<SeccionDetalle />} />
            <Route path="lineas" element={<Lineas />} />
            <Route path="lineas/:id" element={<LineaDetalle />} />
            <Route path="fosas" element={<Fosas />} />
            <Route path="fosas/:id" element={<FosaDetalle />} />
            <Route path="gavetas" element={<Gavetas />} />
            <Route path="gavetas/:id" element={<GavetaDetalle />} />
            <Route path="servicios" element={<Servicios />} />
            <Route path="memorandums" element={<Memorandums />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="configuracion" element={<Configuracion />} />
            <Route path="diagnostico" element={<Diagnostico />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
