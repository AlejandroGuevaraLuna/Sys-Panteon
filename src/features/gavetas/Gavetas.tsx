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
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Box, Plus, Search, Eye, AlertTriangle, Save, ArrowRight,
  AlertCircle,
} from "lucide-react";
import { gavetasService } from "./service";
import { fosasService } from "@/features/fosas/service";
import { lineasService } from "@/features/lineas/service";
import { seccionesService } from "@/features/secciones/service";
import { panteonesService } from "@/features/panteones/service";
import { EntidadFormTabs, CAMPOS_VACIOS, type CamposEntidadForm } from "@/components/shared/EntidadFormTabs";
import {
  DialogDescription,
} from "@/components/ui/dialog";
import type { Fosa, Linea, Seccion, Panteon } from "@/types";

interface GavetaRow {
  id: number;
  linea_id: number;
  numero: number;
  titular_nombre: string;
  libro: string;
  registro: string;
  // Campos del esquema (no expuestos en el form)
  sepCount: number;
  /** Código de sección/línea/panteón para mostrar la ubicación. */
  seccion_codigo?: string;
  seccion_nombre?: string;
  linea_codigo?: string;
  panteon_nombre?: string;
  /** Año del pago de mantenimiento más reciente. */
  ultimo_mantenimiento_anio?: number | null;
}

export default function Gavetas() {
  const [rows, setRows] = useState<GavetaRow[]>([]);
  const [fosas, setFosas] = useState<Fosa[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [panteones, setPanteones] = useState<Panteon[]>([]);
  const [filtroPanteon, setFiltroPanteon] = useState("");
  const [filtroSeccion, setFiltroSeccion] = useState("");
  const [filtroLinea, setFiltroLinea] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [openNueva, setOpenNueva] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const [todasGavetas, lins, secs, pans] = await Promise.all([
        gavetasService.listar(),
        lineasService.listar(),
        seccionesService.listar(),
        panteonesService.listar(),
      ]);
      setLineas(lins);
      setSecciones(secs);
      setPanteones(pans);
      // El servicio ya devuelve ubicación + último mantenimiento.
      // Solo inyectamos sepCount=0 (placeholder; se actualizará al ir al detalle).
      const data = todasGavetas.map((g) => ({
        id: g.id,
        linea_id: g.linea_id,
        numero: g.numero,
        titular_nombre: g.titular_nombre,
        libro: g.libro,
        registro: g.registro,
        seccion_codigo: g.seccion_codigo,
        seccion_nombre: g.seccion_nombre,
        linea_codigo: g.linea_codigo,
        panteon_nombre: g.panteon_nombre,
        ultimo_mantenimiento_anio: g.ultimo_mantenimiento_anio,
        sepCount: 0,
      }));
      setRows(data);
    } finally { setCargando(false); }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    lineasService.listar().then(setLineas);
    seccionesService.listar().then(setSecciones);
    panteonesService.listar().then(setPanteones);
  }, []);

  const lineaById = (id: number) => lineas.find((l) => l.id === id);
  const seccionById = (id: number) => secciones.find((s) => s.id === id);
  const panteonById = (id: number) => panteones.find((p) => p.id === id);

  const fosasFiltradas = fosas.filter((f) => {
    if (filtroLinea && f.linea_id !== Number(filtroLinea)) return false;
    if (filtroSeccion) {
      const ln = lineaById(f.linea_id);
      if (ln?.seccion_id !== Number(filtroSeccion)) return false;
    }
    if (filtroPanteon) {
      const ln = lineaById(f.linea_id);
      const sec = ln ? seccionById(ln.seccion_id) : null;
      if (sec?.panteon_id !== Number(filtroPanteon)) return false;
    }
    return true;
  });

  const rowsFiltrados = rows.filter((r) => {
    const ln = lineas.find((l) => l.id === r.linea_id);
    if (!ln) return false;
    if (filtroLinea && ln.id !== Number(filtroLinea)) return false;
    if (filtroSeccion) {
      if (ln.seccion_id !== Number(filtroSeccion)) return false;
    }
    if (filtroPanteon) {
      const sec = ln ? seccionById(ln.seccion_id) : null;
      if (sec?.panteon_id !== Number(filtroPanteon)) return false;
    }
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!r.titular_nombre.toLowerCase().includes(q)
          && !`${r.libro}${r.registro}`.toLowerCase().includes(q)
          && !String(r.numero).includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Box className="h-7 w-7" /> Gavetas
          </h1>
          <p className="text-muted-foreground">
            Vista global de todas las gavetas. La gaveta es la entidad principal con toda la información del titular.
          </p>
        </div>
        <Button onClick={() => setOpenNueva(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva gaveta
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Puedes filtrar por panteón → sección → línea, o buscar por titular / libro / registro.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <div className="w-52">
              <Select value={filtroPanteon} onValueChange={(v) => { setFiltroPanteon(v); setFiltroSeccion(""); setFiltroLinea(""); }}>
                <SelectTrigger><SelectValue placeholder="Panteón" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {panteones.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-52">
              <Select value={filtroSeccion} onValueChange={(v) => { setFiltroSeccion(v); setFiltroLinea(""); }}>
                <SelectTrigger><SelectValue placeholder="Sección" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {secciones.filter((s) => !filtroPanteon || s.panteon_id === Number(filtroPanteon)).map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>Sec {s.codigo} — {s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-52">
              <Select value={filtroLinea} onValueChange={setFiltroLinea}>
                <SelectTrigger><SelectValue placeholder="Línea" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {lineas.filter((l) => {
                    if (filtroSeccion && l.seccion_id !== Number(filtroSeccion)) return false;
                    const sec = seccionById(l.seccion_id);
                    if (filtroPanteon && sec?.panteon_id !== Number(filtroPanteon)) return false;
                    return true;
                  }).map((l) => (
                    <SelectItem key={l.id} value={l.id.toString()}>Lín {l.codigo} — {l.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por titular, libro o registro…" className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados ({rowsFiltrados.length})</CardTitle>
          <CardDescription>Click en una gaveta para ver su ficha completa.</CardDescription>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <p className="text-center py-10 text-muted-foreground">Cargando…</p>
          ) : rowsFiltrados.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Box className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>No hay gavetas registradas.</p>
              <p className="text-sm">
                {fosas.length === 0
                  ? "Primero crea una fosa (sección → línea → fosa)."
                  : "Crea la primera gaveta con el botón 'Nueva gaveta'."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Gav.</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead className="w-32">Últ. mantenimiento</TableHead>
                  <TableHead className="w-20">Abrir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsFiltrados.map((r) => {
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-mono font-bold text-lg">{r.numero}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-semibold text-base text-foreground">{r.panteon_nombre ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          Sec {r.seccion_codigo ?? "—"}
                          {r.seccion_nombre ? ` · ${r.seccion_nombre}` : ""}
                          <span className="mx-1">·</span>
                          Lín {r.linea_codigo ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.titular_nombre
                          ? <span className="font-medium">{r.titular_nombre}</span>
                          : <span className="text-muted-foreground italic">Sin titular</span>}
                      </TableCell>
                      <TableCell>
                        {r.ultimo_mantenimiento_anio != null
                          ? <Badge variant="info">{r.ultimo_mantenimiento_anio}</Badge>
                          : <span className="text-muted-foreground italic text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="default" size="sm">
                          <Link to={`/gavetas/${r.id}`}><Eye className="h-3 w-3" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NuevaGavetaDialog
        open={openNueva}
        onOpenChange={setOpenNueva}
        fosas={fosasFiltradas}
        lineas={lineas}
        secciones={secciones}
        panteones={panteones}
        onCreated={cargar}
      />
    </div>
  );
}

// ============================================================================
// Dialog "Nueva gaveta" — pide seleccionar fosa padre (con drill-down)
// ============================================================================

function NuevaGavetaDialog({
  open, onOpenChange, fosas, lineas, secciones, panteones, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fosas: Fosa[];
  lineas: Linea[];
  secciones: Seccion[];
  panteones: Panteon[];
  onCreated?: () => void;
}) {
  const [panteonF, setPanteonF] = useState("");
  const [seccionF, setSeccionF] = useState("");
  const [lineaF, setLineaF] = useState("");
  const [form, setForm] = useState<CamposEntidadForm>(CAMPOS_VACIOS);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>("");

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setForm(CAMPOS_VACIOS);
    setPanteonF(""); setSeccionF(""); setLineaF("");
  }, [open]);

  const seccionesF = secciones.filter((s) => !panteonF || s.panteon_id === Number(panteonF));
  const lineasF = lineas.filter((l) => !seccionF || l.seccion_id === Number(seccionF));
  // `fosas` se ignora — las gavetas son independientes de las fosas
  void fosas;

  const guardar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (lineas.length === 0) {
      setError("No hay líneas creadas. Crea una primero desde /lineas.");
      return;
    }
    if (!panteonF) { setError("Selecciona el panteón"); return; }
    if (!seccionF) { setError("Selecciona la sección"); return; }
    if (!lineaF) { setError("Selecciona la línea"); return; }
    if (!form.numero.trim()) { setError("Captura el número de gaveta"); return; }

    setGuardando(true);
    try {
      const numero = parseInt(form.numero);
      const id = await gavetasService.crear({
        linea_id: Number(lineaF),
        numero: isNaN(numero) ? 1 : numero,
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
      console.log("[NuevaGaveta] id=", id);
      if (id <= 0) {
        setError("No se pudo crear la gaveta (id=0). Mira la consola.");
        setGuardando(false);
        return;
      }
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      const err = e as Error;
      const msg = (err && err.message) ? err.message : String(e);
      console.error("[NuevaGaveta] ERROR:", err);
      if (msg.includes("UNIQUE")) {
        setError(`Ya existe la gaveta #${form.numero} en esta línea.`);
      } else if (msg.includes("no such table")) {
        setError("Esquema de BD desactualizado. Detalle: " + msg);
      } else {
        setError("Error: " + msg);
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl text-base">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Box className="h-5 w-5" /> Nueva gaveta
          </DialogTitle>
          <DialogDescription>
            Las gavetas son independientes de las fosas. Selecciona la ubicación (Panteón → Sección → Línea).
          </DialogDescription>
        </DialogHeader>

        {lineas.length === 0 ? (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No hay líneas disponibles</AlertTitle>
            <AlertDescription>
              Para crear una gaveta primero necesitas: Panteón → Sección → Línea.
              <div className="mt-3">
                <Link to="/lineas" onClick={() => onOpenChange(false)}>
                  <Button size="sm">Ir a crear una línea</Button>
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Drill-down Panteón → Sección → Línea (SIN fosa) */}
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
              tipo="gaveta"
              form={form}
              onChange={setForm}
              onSubmit={guardar}
              guardando={guardando}
              submitLabel="Crear gaveta"
              submitDisabled={!panteonF || !seccionF || !lineaF}
              onCancel={() => onOpenChange(false)}
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
  );
}