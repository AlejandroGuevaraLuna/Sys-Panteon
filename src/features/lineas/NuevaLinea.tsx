import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, ArrowRight, AlertTriangle, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { lineasService } from "./service";
import { seccionesService } from "@/features/secciones/service";
import { panteonesService } from "@/features/panteones/service";
import type { Seccion, Panteon } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secciones?: Seccion[];           // opcional, retro-compat
  seccionInicial?: number;
  onCreated?: (lineaId: number) => void;
}

/**
 * Dialog para crear una línea nueva.
 * Drill-down: Panteón → Sección.
 * Si ya hay `seccionInicial` se salta el drill-down y se enfoca solo en los datos.
 */
export default function NuevaLinea({
  open, onOpenChange, secciones: seccionesProp, seccionInicial, onCreated,
}: Props) {
  const [panteones, setPanteones] = useState<Panteon[]>([]);
  const [seccionesAll, setSeccionesAll] = useState<Seccion[]>([]);
  const [panteonId, setPanteonId] = useState("");
  const [seccionId, setSeccionId] = useState<string>(seccionInicial?.toString() ?? "");
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>("");

  // Cargar catálogos al abrir (si no se pasaron como prop)
  useEffect(() => {
    if (!open) return;
    const cargar = async () => {
      try {
        if (panteones.length === 0) {
          const [ps, ss] = await Promise.all([
            panteonesService.listar(),
            seccionesProp ? Promise.resolve(seccionesProp) : seccionesService.listar(),
          ]);
          setPanteones(ps);
          setSeccionesAll(ss);
        }
      } catch (e) {
        console.error("[NuevaLinea] carga:", e);
      }
    };
    cargar();
    // Reset al abrir
    if (!seccionInicial) {
      setPanteonId(""); setSeccionId(""); setError("");
    }
    setCodigo(""); setNombre(""); setDescripcion(""); setCapacidad("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Si hay seccionInicial, sincroniza
  useEffect(() => {
    if (seccionInicial && open) {
      setSeccionId(seccionInicial.toString());
    }
  }, [open, seccionInicial]);

  const seccionesDelPanteon = panteonId
    ? seccionesAll.filter((s) => s.panteon_id === Number(panteonId))
    : [];

  const guardar = async () => {
    setError("");
    if (!seccionId) { setError("Selecciona una sección"); return; }
    if (!codigo.trim()) { setError("El código es obligatorio"); return; }
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return; }

    setGuardando(true);
    try {
      const id = await lineasService.crear({
        seccion_id: Number(seccionId),
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        capacidad_fosas: capacidad ? Number(capacidad) : null,
        activo: 1,
      });
      onCreated?.(id);
      onOpenChange(false);
      // Reset
      setCodigo(""); setNombre(""); setDescripcion(""); setCapacidad("");
      if (!seccionInicial) setSeccionId("");
    } catch (e) {
      const err = e as Error;
      const msg = (err && err.message) ? err.message : String(e);
      console.error("[NuevaLinea] ERROR:", err);
      if (msg.includes("UNIQUE")) {
        setError(`Ya existe una línea con código "${codigo}" en esa sección.`);
      } else if (msg.includes("FOREIGN KEY")) {
        setError("La sección seleccionada no existe en la BD.");
      } else {
        setError("Error: " + msg);
      }
    } finally {
      setGuardando(false);
    }
  };

  const sinPanteones = panteones.length === 0;
  const sinSeccionesPanteon = !seccionInicial && panteonId && seccionesDelPanteon.length === 0;
  const sinSeccionesGlobal = !seccionInicial && seccionesAll.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" /> Nueva línea
          </DialogTitle>
          {!seccionInicial && (
            <DialogDescription>
              Selecciona primero el panteón, luego la sección, y captura los datos de la línea.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Caso: sin panteones registrados */}
        {sinPanteones && !seccionInicial ? (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Necesitas un panteón primero</AlertTitle>
            <AlertDescription>
              <p className="mb-3">Para crear una línea primero registra un panteón.</p>
              <Link to="/panteones" onClick={() => onOpenChange(false)}>
                <Button size="sm">Ir a Panteones</Button>
              </Link>
            </AlertDescription>
          </Alert>
        ) : sinSeccionesGlobal && !seccionInicial ? (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Necesitas una sección primero</AlertTitle>
            <AlertDescription>
              <p className="mb-3">Crea una sección dentro de un panteón antes de la línea.</p>
              <Link to="/secciones" onClick={() => onOpenChange(false)}>
                <Button size="sm">Ir a Secciones</Button>
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {/* Drill-down: solo si NO hay seccionInicial */}
            {!seccionInicial && (
              <>
                <div>
                  <Label>Panteón *</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border bg-background"
                    value={panteonId}
                    onChange={(e) => { setPanteonId(e.target.value); setSeccionId(""); }}
                  >
                    <option value="">— Selecciona un panteón —</option>
                    {panteones.map((p) => (
                      <option key={p.id} value={p.id.toString()}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Sección *</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border bg-background disabled:opacity-50"
                    value={seccionId}
                    onChange={(e) => setSeccionId(e.target.value)}
                    disabled={!panteonId}
                  >
                    <option value="">
                      {!panteonId
                        ? "— Selecciona primero un panteón —"
                        : seccionesDelPanteon.length === 0
                          ? "— Este panteón no tiene secciones —"
                          : "— Selecciona —"}
                    </option>
                    {seccionesDelPanteon.map((s) => (
                      <option key={s.id} value={s.id.toString()}>
                        Sec {s.codigo} — {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {sinSeccionesPanteon && (
                  <p className="text-xs text-amber-600 mt-1">
                    Este panteón no tiene secciones.{" "}
                    <Link to="/secciones" onClick={() => onOpenChange(false)} className="underline">
                      Crea una primero
                    </Link>.
                  </p>
                )}
              </>
            )}

            {/* Datos de la línea (siempre se muestran) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <Label>Código *</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ej: 1, 2, A" />
              </div>
              <div>
                <Label>Nombre *</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Línea 1, Línea Norte" />
              </div>
            </div>
            <div>
              <Label>Capacidad de fosas</Label>
              <Input type="number" min="1" value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea rows={2} value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)} />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-3 rounded text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={guardando}>Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={guardar}
            disabled={guardando || sinPanteones || sinSeccionesGlobal || !seccionId || !codigo.trim() || !nombre.trim()}>
            <Save className="mr-2 h-4 w-4" />
            {guardando ? "Guardando..." : "Crear línea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
