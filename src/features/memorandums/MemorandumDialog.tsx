import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2, Plus, FileText, ScrollText, Download, Info } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { memorandumsService, type MemorandumListado } from "./service";
import { serviciosService } from "@/features/servicios/service";
import { fosasService } from "@/features/fosas/service";
import { gavetasService } from "@/features/gavetas/service";
import type { Servicio, AppConfig, Fosa, Gaveta } from "@/types";
import { generarMemorandumPDF, blobToDataUrl } from "./pdf";

/** Servicios que NO requieren una fosa/gaveta vinculada. */
export const SERVICIOS_SIN_ENTIDAD = new Set<string>([
  "COMPRA_DE_TERRENO",
  "COMPRA_DE_GAVETA",
]);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Tipo de entidad. Si NO se especifica, el dialog opera en modo global:
   * permite crear memorandums sin entidad (para servicios "sin entidad") y
   * también con entidad (eligiendo fosa o gaveta) para los demás servicios.
   */
  tipo?: "fosa" | "gaveta";
  /** ID de la entidad (fosa o gaveta) a la que se vincula el memorandum. Opcional en modo global. */
  entidadId?: number;
  /** Contexto para el PDF (la entidad completa, con datos del titular). */
  entidad?: unknown;
  /** Panteón donde se emite (para el encabezado del PDF). */
  panteon?: unknown;
  /** Configuración (logo, pie de página, ciudad). */
  config?: AppConfig;
  /** Nombre del titular de la entidad (para comparar con solicitante). */
  titularEntidad?: string | null;
  /** Recargar padre. */
  onCreated?: () => void;
  /**
   * Paso inicial del dialog. Por defecto "lista". En contextos donde la lista
   * se ve en otra parte (ej. /memorandums), pasar "nuevo" para abrir directo
   * al formulario sin pantalla intermedia.
   */
  defaultStep?: "lista" | "nuevo";
}

const DEFAULT_CONFIG: AppConfig = {
  panteon_activo_id: null,
  logo_path: null,
  pie_pagina: "",
  ciudad: "",
  color_primario: "",
  memo_folio_inicial: 1,
};

/**
 * Dialog de memorandums. Tres modos de uso:
 *  1) Modo fosa:    <MemorandumDialog tipo="fosa" entidadId={...} />
 *  2) Modo gaveta:  <MemorandumDialog tipo="gaveta" entidadId={...} />
 *  3) Modo global:  <MemorandumDialog />   (sin tipo/entidadId)
 *
 * En modo global, los servicios de "Compra de terreno" y "Compra de gaveta"
 * se pueden emitir SIN seleccionar fosa ni gaveta; el resto de servicios
 * requiere que se elija una antes de poder guardar.
 */
export default function MemorandumDialog({
  open, onOpenChange, tipo, entidadId, entidad, panteon,
  config = DEFAULT_CONFIG,
  titularEntidad = "",
  onCreated,
  defaultStep = "lista",
}: Props) {
  const esGlobal = !tipo || !entidadId;
  const { usuario } = useAuth();
  const [step, setStep] = useState<"lista" | "nuevo">(defaultStep);
  const [items, setItems] = useState<MemorandumListado[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [fosasTodas, setFosasTodas] = useState<Fosa[]>([]);
  const [gavetasTodas, setGavetasTodas] = useState<Gaveta[]>([]);
  const [form, setForm] = useState({
    servicio_id: "",
    entidad_tipo: "fosa" as "fosa" | "gaveta",
    entidad_id: "",
    solicitante_nombre: "",
    solicitante_domicilio: "",
    solicitante_telefono: "",
    titular_coincide: true,
    monto: "0",
    fecha_emision: new Date().toISOString().slice(0, 10),
    notas: "",
  });
  const [guardando, setGuardando] = useState(false);
  /** Guard sincrónico: evita que un doble-click dispare dos INSERTs con el
   *  mismo folio antes de que React deshabilite el botón. */
  const guardandoRef = useRef(false);
  const [error, setError] = useState("");

  const cargar = async () => {
    try {
      const srvs = await serviciosService.listar();
      setServicios(srvs.filter((s) => s.activo === 1));
      if (esGlobal) {
        // En modo global, listar todos los memorandums
        const todos = await memorandumsService.listar();
        setItems(todos);
        // Cargar fosas y gavetas para el selector (cuando aplique)
        try {
          const [fs, gs] = await Promise.all([
            fosasService.listar(),
            gavetasService.listar(),
          ]);
          setFosasTodas(fs);
          setGavetasTodas(gs);
        } catch { /* ignore */ }
      } else {
        // En modo fosa/gaveta, listar los de esa entidad
        const lista = await memorandumsService.listarPorEntidad(tipo!, entidadId!);
        setItems(lista);
      }
    } catch (e) {
      console.error("[MemorandumDialog.cargar] ERROR", e);
    }
  };

  useEffect(() => {
    if (open) {
      setStep(defaultStep);
      setForm({
        servicio_id: "",
        entidad_tipo: "fosa",
        entidad_id: "",
        solicitante_nombre: "",
        solicitante_domicilio: "",
        solicitante_telefono: "",
        titular_coincide: true,
        monto: "0",
        fecha_emision: new Date().toISOString().slice(0, 10),
        notas: "",
      });
      setError("");
      cargar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Servicio seleccionado (helper). */
  const srvSeleccionado = servicios.find((s) => s.id === Number(form.servicio_id));
  const esSinEntidad = srvSeleccionado
    ? SERVICIOS_SIN_ENTIDAD.has(srvSeleccionado.tipo)
    : false;

  /** En modo global, si el servicio no es "sin entidad", exigimos fosa o gaveta. */
  const requiereEntidad = esGlobal && !esSinEntidad;

  const guardar = async () => {
    // Guard sincrónico contra doble-click. setGuardando(true) es async
    // (React re-render), así que sin este ref dos clicks rápidos pasan
    // ambos por la guarda async y generan dos INSERTs con el mismo folio.
    if (guardandoRef.current) return;
    if (!form.servicio_id) { setError("Selecciona un servicio"); return; }
    if (!form.solicitante_nombre.trim()) { setError("Captura el nombre del solicitante"); return; }

    // Determinar el FK
    let fosa_id: number | null = null;
    let gaveta_id: number | null = null;
    if (esGlobal) {
      if (requiereEntidad) {
        if (!form.entidad_id) {
          setError("Selecciona una fosa o gaveta para este servicio");
          return;
        }
        if (form.entidad_tipo === "fosa") fosa_id = Number(form.entidad_id);
        else gaveta_id = Number(form.entidad_id);
      } else {
        // Servicio sin entidad: fosa_id = NULL, gaveta_id = NULL
      }
    } else {
      if (tipo === "fosa") fosa_id = entidadId!;
      else gaveta_id = entidadId!;
    }

    guardandoRef.current = true;
    setGuardando(true);
    setError("");
    try {
      const srv = servicios.find((s) => s.id === Number(form.servicio_id));
      const monto = form.monto && Number(form.monto) > 0
        ? Number(form.monto)
        : (srv?.precio ?? 0);

      const folio = await memorandumsService.siguienteFolio();
      const data = {
        folio,
        fosa_id,
        gaveta_id,
        servicio_id: Number(form.servicio_id),
        solicitante_nombre: form.solicitante_nombre.trim(),
        solicitante_domicilio: form.solicitante_domicilio.trim(),
        solicitante_telefono: form.solicitante_telefono.trim(),
        titular_coincide: requiereEntidad ? (form.titular_coincide ? 1 : 0) : 1,
        monto,
        fecha_emision: form.fecha_emision,
        notas: form.notas || null,
        pdf_path: null as string | null,
        // Solo se registra QUIÉN GENERÓ el memorandum, no quien lo descarga
        created_by_user_id: usuario?.id ?? null,
      };

      // Generar el PDF (best-effort: si falla, guardamos el memo sin PDF)
      let pdfBlob: Blob | null = null;
      try {
        pdfBlob = await generarPDFBlob(data);
        data.pdf_path = await blobToDataUrl(pdfBlob);
      } catch (e) {
        console.warn("[MemorandumDialog] PDF falló, guardando solo registro:", e);
        data.pdf_path = null;
      }

      // INSERT ÚNICO. El service tiene su propio retry on UNIQUE
      // (hasta 5 intentos regenerando el folio). Si tras los reintentos
      // sigue fallando, el error se propaga al catch externo.
      const { id, folio: folioFinal } = await memorandumsService.crear(data);
      if (id <= 0) {
        setError("No se pudo crear el memorandum");
        return;
      }

      // Si el retry regeneró el folio, el PDF que generamos antes trae el
      // folio viejo. Regeneramos el PDF con el folio final y actualizamos
      // pdf_path en BD. (Solo ocurre si hubo race; en el flujo normal
      // folioFinal === folio y no entra al if.)
      if (pdfBlob && folioFinal !== folio) {
        try {
          const dataActualizado = { ...data, folio: folioFinal };
          pdfBlob = await generarPDFBlob(dataActualizado);
          await memorandumsService.actualizarPdfPath(id, await blobToDataUrl(pdfBlob));
        } catch (e) {
          console.warn("[MemorandumDialog] Regenerar PDF con folio nuevo falló:", e);
        }
      }

      // Descargar el PDF (best-effort, después de un guardado exitoso)
      if (pdfBlob) {
        try {
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${folioFinal}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch { /* ignore */ }
      }

      onCreated?.();
      await cargar();
      setStep("lista");
    } catch (e) {
      const err = e as Error;
      console.error("[MemorandumDialog.guardar]", err);
      setError(err?.message || String(e));
    } finally {
      setGuardando(false);
      guardandoRef.current = false;
    }
  };

  const generarPDFBlob = async (memoDraft: {
    folio: string;
    fosa_id: number | null;
    gaveta_id: number | null;
    servicio_id: number;
    solicitante_nombre: string;
    solicitante_domicilio: string;
    solicitante_telefono: string;
    titular_coincide: number;
    monto: number;
    fecha_emision: string;
    notas: string | null;
  }): Promise<Blob> => {
    const srv = servicios.find((s) => s.id === memoDraft.servicio_id);
    // Para construir el PDF con contexto, si no tenemos entidad intentamos
    // buscarla.
    let entidadCtx: unknown = entidad;
    let titularCtx = titularEntidad;
    if (esGlobal && memoDraft.fosa_id) {
      try {
        const f = await fosasService.obtenerDetalle(memoDraft.fosa_id);
        if (f) {
          entidadCtx = f;
          titularCtx = f.titular_nombre;
        }
      } catch { /* ignore */ }
    } else if (esGlobal && memoDraft.gaveta_id) {
      try {
        const g = await gavetasService.obtenerDetalle(memoDraft.gaveta_id);
        if (g) {
          entidadCtx = g;
          titularCtx = g.titular_nombre;
        }
      } catch { /* ignore */ }
    }
    const memorandumDetalle = {
      ...memoDraft,
      id: 0,
      pdf_path: null,
      created_at: new Date().toISOString(),
      servicio_nombre: srv?.nombre ?? "Servicio",
      servicio_tipo: (srv?.tipo ?? "OTRO") as never,
      fosa_panteon_nombre: (panteon as { nombre?: string })?.nombre ?? "—",
      fosa_seccion_codigo: (entidadCtx as { seccion_codigo?: string })?.seccion_codigo ?? "",
      fosa_seccion_nombre: (entidadCtx as { seccion_nombre?: string })?.seccion_nombre ?? "",
      fosa_linea_codigo: (entidadCtx as { linea_codigo?: string })?.linea_codigo ?? "",
      fosa_linea_nombre: (entidadCtx as { linea_nombre?: string })?.linea_nombre ?? "",
      fosa_numero: (entidadCtx as { numero?: string })?.numero ?? "",
      gaveta_numero: (entidadCtx as { numero?: number })?.numero ?? 0,
      gaveta_libro: (entidadCtx as { libro?: string })?.libro ?? "",
      gaveta_registro: (entidadCtx as { registro?: string })?.registro ?? "",
      titular_nombre: titularCtx ?? "",
    };

    const pdfDoc = generarMemorandumPDF({
      memorandum: memorandumDetalle as never,
      fosa: memoDraft.fosa_id ? (entidadCtx as never) ?? null : null,
      gaveta: memoDraft.gaveta_id ? (entidadCtx as never) ?? null : null,
      panteon: (panteon as never) ?? null,
      config,
    });

    return pdfDoc.output("blob");
  };

  const descargar = async (m: MemorandumListado) => {
    try {
      const detalle = await memorandumsService.obtener(m.id);
      if (!detalle) { alert("No se pudo cargar el memorandum"); return; }
      const memoDraft = {
        folio: m.folio,
        fosa_id: m.fosa_id ?? null,
        gaveta_id: m.gaveta_id ?? null,
        servicio_id: m.servicio_id,
        solicitante_nombre: m.solicitante_nombre,
        solicitante_domicilio: m.solicitante_domicilio,
        solicitante_telefono: m.solicitante_telefono,
        titular_coincide: m.titular_coincide,
        monto: m.monto,
        fecha_emision: m.fecha_emision,
        notas: m.notas,
      };
      // Para descargas reusamos el servicio para obtener servicios
      const srvs = servicios.length ? servicios : await serviciosService.listar();
      const blob = await generarPDFBlobFromDraft(memoDraft, m, srvs);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${m.folio}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("No se pudo regenerar el PDF: " + (e as Error).message);
    }
  };

  const generarPDFBlobFromDraft = async (
    memoDraft: Parameters<typeof generarPDFBlob>[0],
    m: MemorandumListado,
    srvs: Servicio[],
  ): Promise<Blob> => {
    const srv = srvs.find((s) => s.id === memoDraft.servicio_id);
    const memorandumDetalle = {
      ...memoDraft,
      id: 0,
      pdf_path: null,
      created_at: m.created_at ?? new Date().toISOString(),
      servicio_nombre: srv?.nombre ?? m.servicio_nombre,
      servicio_tipo: (srv?.tipo ?? m.servicio_tipo) as never,
      fosa_panteon_nombre: m.panteon_nombre ?? "—",
      fosa_seccion_codigo: m.seccion_codigo ?? "",
      fosa_seccion_nombre: "",
      fosa_linea_codigo: m.linea_codigo ?? "",
      fosa_linea_nombre: "",
      fosa_numero: m.fosa_numero ?? "",
      gaveta_numero: m.gaveta_numero ?? 0,
      gaveta_libro: "", gaveta_registro: "",
      titular_nombre: m.solicitante_nombre,
    };
    const pdfDoc = generarMemorandumPDF({
      memorandum: memorandumDetalle as never,
      fosa: memoDraft.fosa_id ? (entidad as never) ?? null : null,
      gaveta: memoDraft.gaveta_id ? (entidad as never) ?? null : null,
      panteon: (panteon as never) ?? null,
      config,
    });
    return pdfDoc.output("blob");
  };

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este memorandum?")) return;
    try {
      await memorandumsService.eliminar(id);
      await cargar();
      onCreated?.();
    } catch (e) {
      console.error("[MemorandumDialog.eliminar]", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl text-base">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ScrollText className="h-5 w-5" />
            Memorandums
            {esGlobal && <Badge variant="info">Global</Badge>}
            {step === "nuevo" && <Badge variant="info">Nuevo</Badge>}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {step === "lista"
              ? esGlobal
                ? "Todos los memorandums emitidos en el sistema."
                : `Memorandums emitidos para esta ${tipo}.`
              : "Captura el servicio, los datos del solicitante y el monto."}
          </p>
        </DialogHeader>

        {step === "lista" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setStep("nuevo")}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo memorandum
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No hay memorandums {esGlobal ? "en el sistema" : `para esta ${tipo}`}.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Emitido por</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono font-semibold">{m.folio}</TableCell>
                      <TableCell className="text-sm">{m.fecha_emision}</TableCell>
                      <TableCell className="text-sm">{m.servicio_nombre}</TableCell>
                      <TableCell className="text-sm">{m.solicitante_nombre}</TableCell>
                      <TableCell className="text-sm">${m.monto.toFixed(2)}</TableCell>
                      <TableCell className="text-xs">
                        {m.emitido_por
                          ? (
                            <div>
                              <div className="font-medium">{m.emitido_por}</div>
                              {m.emitido_por_username && (
                                <div className="text-muted-foreground">@{m.emitido_por_username}</div>
                              )}
                            </div>
                          )
                          : <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => descargar(m)} title="Descargar PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => eliminar(m.id)} title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Servicio + Fecha */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Servicio *</Label>
                <select
                  className="w-full h-11 px-3 rounded-md border bg-background text-base"
                  value={form.servicio_id}
                  onChange={(e) => {
                    const srv = servicios.find((s) => s.id === Number(e.target.value));
                    setForm({
                      ...form,
                      servicio_id: e.target.value,
                      monto: srv ? String(srv.precio) : form.monto,
                    });
                  }}
                >
                  <option value="">— Selecciona un servicio —</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                      {s.precio > 0 ? ` — $${s.precio}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Fecha de emisión</Label>
                <Input
                  type="date"
                  className="h-11 text-base"
                  value={form.fecha_emision}
                  onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })}
                />
              </div>
            </div>

            {/* Aviso cuando el servicio es "sin entidad" */}
            {esSinEntidad && (
              <div className="bg-blue-50 border border-blue-200 text-blue-900 text-sm rounded p-3 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Este servicio se emite sin entidad.</strong>{" "}
                  El memorandum no se vinculará a ninguna fosa ni gaveta.
                </div>
              </div>
            )}

            {/* En modo global + servicio con entidad requerida, mostrar selector */}
            {esGlobal && requiereEntidad && (
              <div className="space-y-2">
                <Label>Entidad (fosa o gaveta) *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <select
                    className="h-10 px-3 rounded-md border bg-background text-base"
                    value={form.entidad_tipo}
                    onChange={(e) => setForm({ ...form, entidad_tipo: e.target.value as "fosa" | "gaveta", entidad_id: "" })}
                  >
                    <option value="fosa">Fosa</option>
                    <option value="gaveta">Gaveta</option>
                  </select>
                  <select
                    className="h-10 px-3 rounded-md border bg-background text-base"
                    value={form.entidad_id}
                    onChange={(e) => setForm({ ...form, entidad_id: e.target.value })}
                  >
                    <option value="">— Selecciona {form.entidad_tipo} —</option>
                    {form.entidad_tipo === "fosa"
                      ? fosasTodas.map((f) => (
                          <option key={f.id} value={f.id}>#{f.numero} {f.titular_nombre ? `— ${f.titular_nombre}` : ""}</option>
                        ))
                      : gavetasTodas.map((g) => (
                          <option key={g.id} value={g.id}>#{g.numero} {g.titular_nombre ? `— ${g.titular_nombre}` : ""}</option>
                        ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este servicio requiere una fosa o gaveta vinculada.
                </p>
              </div>
            )}

            {/* Datos del solicitante */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nombre del solicitante *</Label>
                <Input
                  className="h-11 text-base"
                  value={form.solicitante_nombre}
                  onChange={(e) => setForm({ ...form, solicitante_nombre: e.target.value })}
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  className="h-11 text-base"
                  value={form.solicitante_telefono}
                  onChange={(e) => setForm({ ...form, solicitante_telefono: e.target.value })}
                  placeholder="(33) 1234-5678"
                />
              </div>
            </div>

            <div>
              <Label>Domicilio del solicitante</Label>
              <Input
                className="h-11 text-base"
                value={form.solicitante_domicilio}
                onChange={(e) => setForm({ ...form, solicitante_domicilio: e.target.value })}
                placeholder="Calle, número, colonia, ciudad"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Monto</Label>
                <Input
                  type="number" step="0.01" min="0"
                  className="h-11 text-base"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                />
              </div>
              {/* Checkbox "titular coincide" solo cuando hay entidad vinculada */}
              {esGlobal && requiereEntidad && (
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="titular_ok"
                    checked={form.titular_coincide}
                    onChange={(e) => setForm({ ...form, titular_coincide: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="titular_ok">El solicitante coincide con el titular</Label>
                </div>
              )}
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                rows={3}
                className="text-base"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Observaciones, condiciones, etc."
              />
            </div>

            {error && (
              <div className="text-destructive bg-destructive/10 p-3 rounded text-sm">{error}</div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 border-t">
          {step === "lista" ? (
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("lista")} disabled={guardando}>
                Volver al listado
              </Button>
              <Button onClick={guardar} disabled={guardando}>
                <Save className="mr-2 h-4 w-4" />
                {guardando ? "Generando..." : "Guardar y descargar PDF"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
