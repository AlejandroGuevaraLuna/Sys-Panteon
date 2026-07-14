import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
  DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Cross, Plus, Search, Eye, Save, AlertCircle, AlertTriangle } from "lucide-react";
import { fosasService } from "./service";
import { lineasService } from "@/features/lineas/service";
import { seccionesService } from "@/features/secciones/service";
import { panteonesService } from "@/features/panteones/service";
import { ImportExportButtons } from "@/features/import-export/ImportExportButtons";
import { gavetasService } from "@/features/gavetas/service";
import { EntidadFormTabs } from "@/components/shared/EntidadFormTabs";
import { CAMPOS_VACIOS, type CamposEntidadForm } from "@/components/shared/EntidadFormTabs";
import type {
  Fosa, Linea, Seccion, Panteon,
} from "@/types";
import type { FosaListado } from "./service";

export default function Fosas() {
  const [items, setItems] = useState<FosaListado[]>([]);
  const [panteones, setPanteones] = useState<Panteon[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [panteonId, setPanteonId] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  // Estado del dialog
  const [panteonF, setPanteonF] = useState("");
  const [seccionF, setSeccionF] = useState("");
  const [lineaF, setLineaF] = useState("");
  const [form, setForm] = useState<CamposEntidadForm>(CAMPOS_VACIOS);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>("");

  const cargar = async () => {
    setCargando(true);
    console.log("[Fosas] cargar() inicio");
    const safe = async <T,>(name: string, p: Promise<T>, dflt: T): Promise<T> => {
      try {
        const r = await p;
        console.log(`[Fosas] ${name} → ${Array.isArray(r) ? r.length : "—"} registros`);
        return r ?? dflt;
      } catch (e) {
        console.error(`[Fosas] ${name} ERROR:`, e);
        return dflt;
      }
    };

    const [fosas, secs, lins, pans] = await Promise.all([
      safe("fosasService.listar", fosasService.listar({
        panteon_id: panteonId ? Number(panteonId) : undefined,
        busqueda: busqueda || undefined,
      }), [] as FosaListado[]),
      safe("seccionesService.listar", seccionesService.listar(), [] as Seccion[]),
      safe("lineasService.listar", lineasService.listar(), [] as Linea[]),
      safe("panteonesService.listar", panteonesService.listar(), [] as Panteon[]),
    ]);

    console.log(`[Fosas] totales → fosas:${fosas.length} secciones:${secs.length} líneas:${lins.length} panteones:${pans.length}`);

    setSecciones(secs);
    setLineas(lins);
    setPanteones(pans);
    // El servicio ya devuelve los campos derivados (linea_codigo, panteon_nombre, ultimo_mantenimiento_anio)
    setItems(fosas);
    setCargando(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [panteonId]);
  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const seccionesF = secciones.filter((s) => !panteonF || s.panteon_id === Number(panteonF));
  const lineasF = lineas.filter((l) => !seccionF || l.seccion_id === Number(seccionF));

  const abrirDialog = () => {
    console.log("[Fosas] abrirDialog, lineas disponibles:", lineas.length);
    setError("");
    setForm(CAMPOS_VACIOS);
    setPanteonF(""); setSeccionF(""); setLineaF("");
    cargar();
    setOpenDialog(true);
  };

  const cerrarDialog = () => {
    if (guardando) return;
    setOpenDialog(false);
    setError("");
  };

  const guardar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log("[Fosas.guardar] submit", { panteonF, seccionF, lineaF, form });
    setError("");

    if (lineas.length === 0) {
      setError("No hay líneas creadas. Crea una primero desde /lineas.");
      return;
    }
    if (!panteonF) { setError("Selecciona el panteón"); return; }
    if (!seccionF) { setError("Selecciona la sección"); return; }
    if (!lineaF) { setError("Selecciona la línea"); return; }
    if (!form.numero.trim()) { setError("Captura el número de fosa"); return; }

    setGuardando(true);
    try {
      const id = await fosasService.crear({
        linea_id: Number(lineaF),
        numero: form.numero.trim(),
        capacidad_gavetas: Math.max(1, Number(form.capacidad_gavetas) || 1),
        libro: form.libro,
        registro: form.registro,
        titular_nombre: form.titular_nombre,
        titular_domicilio: form.titular_domicilio,
        titular_telefono: form.titular_telefono,
        numero_titulo: form.numero_titulo,
        fecha_titulo: form.fecha_titulo || null,
        superficie_ancho: form.superficie_ancho || "",
        superficie_alto: form.superficie_alto || "",
        beneficiario: form.beneficiario,
        observaciones: form.observaciones,
        notas_libro: form.notas_libro,
      });
      console.log("[Fosas.guardar] fosa creada id=", id);
      if (id <= 0) {
        setError("No se pudo crear la fosa (id=0). Mira la consola (Ctrl+Shift+I).");
        setGuardando(false);
        return;
      }
      setOpenDialog(false);
      await cargar();
    } catch (e) {
      const err = e as Error;
      const msg = (err && err.message) ? err.message : String(e);
      console.error("[Fosas.guardar] ERROR:", err);
      if (msg.includes("UNIQUE")) {
        setError(`Ya existe una fosa con número "${form.numero}" en esta línea.`);
      } else if (msg.includes("no such table") || msg.includes("no column")) {
        setError(`Esquema de BD desactualizado. Detalle: ${msg}`);
      } else {
        setError(`Error: ${msg}`);
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Cross className="h-7 w-7" /> Fosas
          </h1>
          <p className="text-muted-foreground">
            Las fosas se crean dentro de una línea.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={cargar} disabled={cargando}>
            Recargar
          </Button>
          <ImportExportButtons tipo="fosa" onImportado={cargar} />
          <Dialog open={openDialog} onOpenChange={(o) => { if (!o) cerrarDialog(); else abrirDialog(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nueva fosa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl text-base">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Cross className="h-5 w-5" /> Nueva fosa
                </DialogTitle>
                <DialogDescription>
                  Selecciona la ubicación (Panteón → Sección → Línea) y captura los datos completos.
                </DialogDescription>
              </DialogHeader>

              {lineas.length === 0 ? (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No hay líneas disponibles</AlertTitle>
                  <AlertDescription>
                    Para crear una fosa primero necesitas una línea.
                    <div className="mt-3">
                      <Link to="/lineas" onClick={() => setOpenDialog(false)}>
                        <Button size="sm">Ir a crear una línea</Button>
                      </Link>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {/* Ubicación (drill-down vertical) */}
                  <div className="space-y-3">
                    <div>
                      <Label>Panteón *</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border bg-background"
                        value={panteonF}
                        onChange={(e) => { setPanteonF(e.target.value); setSeccionF(""); setLineaF(""); }}
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
                        value={seccionF}
                        onChange={(e) => { setSeccionF(e.target.value); setLineaF(""); }}
                        disabled={!panteonF}
                      >
                        <option value="">
                          {!panteonF ? "— Selecciona primero un panteón —"
                            : seccionesF.length === 0 ? "— Este panteón no tiene secciones —"
                            : "— Selecciona una sección —"}
                        </option>
                        {seccionesF.map((s) => (
                          <option key={s.id} value={s.id.toString()}>Sec {s.codigo} — {s.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Línea *</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border bg-background disabled:opacity-50"
                        value={lineaF}
                        onChange={(e) => setLineaF(e.target.value)}
                        disabled={!seccionF}
                      >
                        <option value="">
                          {!seccionF ? "— Selecciona primero una sección —"
                            : lineasF.length === 0 ? "— Esta sección no tiene líneas —"
                            : "— Selecciona una línea —"}
                        </option>
                        {lineasF.map((l) => (
                          <option key={l.id} value={l.id.toString()}>Lín {l.codigo} — {l.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Form con tabs (datos + titular + notas) */}
                  <EntidadFormTabs
                    tipo="fosa"
                    form={form}
                    onChange={setForm}
                    onSubmit={guardar}
                    guardando={guardando}
                    submitLabel="Crear fosa"
                    submitDisabled={!panteonF || !seccionF || !lineaF}
                    onCancel={cerrarDialog}
                  />

                  {error && (
                    <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-3 rounded text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtra por panteón o busca por número de fosa o código.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <div className="w-56">
              <select
                className="w-full h-10 px-3 rounded-md border bg-background"
                value={panteonId}
                onChange={(e) => setPanteonId(e.target.value)}
              >
                <option value="">Todos los panteones</option>
                {panteones.map((p) => (
                  <option key={p.id} value={p.id.toString()}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[280px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por número de fosa o código…"
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <p className="text-center py-10 text-muted-foreground">Cargando…</p>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Cross className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>No hay fosas registradas.</p>
              <p className="text-sm mt-2">Crea la primera con el botón «Nueva fosa».</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Fosa</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead className="w-32">Últ. mantenimiento</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell><span className="font-mono font-bold text-lg">#{f.numero}</span></TableCell>
                    <TableCell className="text-sm">
                      <div className="font-semibold text-base text-foreground">{f.panteon_nombre ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        Sec {f.seccion_codigo ?? "—"}
                        {f.seccion_nombre ? ` · ${f.seccion_nombre}` : ""}
                        <span className="mx-1">·</span>
                        Lín {f.linea_codigo ?? "—"}
                        {f.linea_nombre ? ` · ${f.linea_nombre}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {f.titular_nombre
                        ? <span className="font-medium">{f.titular_nombre}</span>
                        : <span className="text-muted-foreground italic">Sin titular</span>}
                    </TableCell>
                    <TableCell>
                      {f.ultimo_mantenimiento_anio != null
                        ? (() => {
                            const anioActual = new Date().getFullYear();
                            const esActual = f.ultimo_mantenimiento_anio === anioActual;
                            return (
                              <Badge
                                variant={esActual ? "success" : "info"}
                                title={esActual
                                  ? `Mantenimiento al corriente (${anioActual})`
                                  : `Último mantenimiento en ${f.ultimo_mantenimiento_anio}`}
                              >
                                {f.ultimo_mantenimiento_anio}
                                {esActual && " ✓"}
                              </Badge>
                            );
                          })()
                        : <span className="text-muted-foreground italic text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/fosas/${f.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
