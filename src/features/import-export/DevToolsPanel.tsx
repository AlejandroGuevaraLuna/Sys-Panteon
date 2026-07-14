import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Wrench, AlertTriangle, Loader2 } from "lucide-react";
import { devWipeAll, devWipeFosas, devWipeGavetas, type DevWipeResult } from "./dev-tools";

type WipeKind = "fosas" | "gavetas" | "all";

const WIPE_CONFIG: Record<WipeKind, {
  label: string;
  description: string;
  run: () => Promise<DevWipeResult>;
}> = {
  fosas: {
    label: "Borrar fosas",
    description: "¿Borrar TODAS las fosas y sus datos relacionados (sepultados, exhumaciones, mantenimientos, cambios de titular, memorandums)?",
    run: devWipeFosas,
  },
  gavetas: {
    label: "Borrar gavetas",
    description: "¿Borrar TODAS las gavetas y sus datos relacionados?",
    run: devWipeGavetas,
  },
  all: {
    label: "Borrar TODO",
    description: "¿Borrar TODAS las fosas Y TODAS las gavetas, junto con sus datos relacionados? Esta acción es muy destructiva.",
    run: devWipeAll,
  },
};

/**
 * Panel de herramientas de desarrollo. SOLO visible cuando Vite está
 * en modo dev (pnpm tauri dev). En producción (pnpm tauri build) este
 * componente no se renderiza, así que no hay riesgo.
 */
export function DevToolsPanel({ onChanged }: { onChanged?: () => void }) {
  const [busy, setBusy] = useState<WipeKind | null>(null);
  const [lastResult, setLastResult] = useState<DevWipeResult | null>(null);

  // Flujo de triple confirmación con Dialogs nativos (no prompt()).
  // step 0: inactivo. step 1: descripción. step 2: escribir BORRAR.
  // step 3: confirmación final. step 4: ejecutando.
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [target, setTarget] = useState<WipeKind | null>(null);
  const [typed, setTyped] = useState("");

  if (!import.meta.env.DEV) return null;

  const start = (kind: WipeKind) => {
    setTarget(kind);
    setTyped("");
    setStep(1);
  };

  const close = () => {
    setStep(0);
    setTarget(null);
    setTyped("");
  };

  const execute = async () => {
    if (!target) return;
    setStep(4);
    setBusy(target);
    try {
      const res = await WIPE_CONFIG[target].run();
      setLastResult(res);
      onChanged?.();
    } catch (e) {
      // Mostrar error en el último step (se quedará abierto)
      alert(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      close();
    }
  };

  const cfg = target ? WIPE_CONFIG[target] : null;
  const matchOK = typed === "BORRAR";

  return (
    <>
      <Card className="border-amber-300 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <Wrench className="h-5 w-5" />
            Dev Tools
            <span className="ml-2 text-xs font-normal text-amber-700">
              (solo visible en desarrollo)
            </span>
          </CardTitle>
          <CardDescription className="text-amber-800">
            Herramientas para borrar datos de prueba. No afecta a panteones,
            secciones, líneas, servicios ni usuarios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert className="border-red-300 bg-red-50 text-red-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Acciones IRREVERSIBLES</AlertTitle>
            <AlertDescription>
              Cada acción requiere triple confirmación. No se puede deshacer.
            </AlertDescription>
          </Alert>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              variant="outline"
              className="border-amber-400 text-amber-900 hover:bg-amber-100"
              onClick={() => start("fosas")}
              disabled={busy !== null || step !== 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Borrar fosas
            </Button>
            <Button
              variant="outline"
              className="border-amber-400 text-amber-900 hover:bg-amber-100"
              onClick={() => start("gavetas")}
              disabled={busy !== null || step !== 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Borrar gavetas
            </Button>
            <Button
              variant="outline"
              className="border-red-500 text-red-700 hover:bg-red-100"
              onClick={() => start("all")}
              disabled={busy !== null || step !== 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Borrar TODO
            </Button>
          </div>
          {lastResult && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
              <strong>Última operación completada.</strong> Se borraron:
              <ul className="list-disc list-inside mt-1 text-xs">
                {lastResult.fosas > 0 && <li>{lastResult.fosas} fosa(s)</li>}
                {lastResult.gavetas > 0 && <li>{lastResult.gavetas} gaveta(s)</li>}
                {lastResult.sepultaciones > 0 && <li>{lastResult.sepultaciones} sepultación(es)</li>}
                {lastResult.exhumaciones > 0 && <li>{lastResult.exhumaciones} exhumación(es)</li>}
                {lastResult.mantenimientos > 0 && <li>{lastResult.mantenimientos} mantenimiento(s)</li>}
                {lastResult.cambios_titular > 0 && <li>{lastResult.cambios_titular} cambio(s) de titular</li>}
                {lastResult.memorandums > 0 && <li>{lastResult.memorandums} memorandum(ns)</li>}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* === Dialog de paso 1: descripción === */}
      <Dialog open={step === 1} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              Confirmar acción ({cfg?.label})
            </DialogTitle>
            <DialogDescription>
              Vas a realizar una acción destructiva. Lee con atención:
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">{cfg?.description}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Cancelar</Button>
            <Button variant="destructive" onClick={() => setStep(2)}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog de paso 2: escribir BORRAR === */}
      <Dialog open={step === 2} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              Verificación adicional
            </DialogTitle>
            <DialogDescription>
              Para confirmar, escribe exactamente <strong>BORRAR</strong> (en mayúsculas) en el campo de abajo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-text">Escribe BORRAR:</Label>
            <Input
              id="confirm-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              placeholder="BORRAR"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && matchOK) {
                  setStep(3);
                }
              }}
            />
            {typed && !matchOK && (
              <p className="text-xs text-red-700">No coincide. Debe decir exactamente "BORRAR".</p>
            )}
            {matchOK && (
              <p className="text-xs text-green-700">Correcto. Avanza a la confirmación final.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Cancelar</Button>
            <Button variant="destructive" onClick={() => setStep(3)} disabled={!matchOK}>
              Siguiente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog de paso 3: última oportunidad === */}
      <Dialog open={step === 3} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md border-red-400">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              ¿Última oportunidad?
            </DialogTitle>
            <DialogDescription>
              Esta acción <strong>NO se puede deshacer</strong>. Se borrarán permanentemente los registros seleccionados.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            <strong>Vas a borrar:</strong> {cfg?.description}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Cancelar</Button>
            <Button variant="destructive" onClick={execute}>
              {busy === target ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Borrando…</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" /> Sí, borrar ahora</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
