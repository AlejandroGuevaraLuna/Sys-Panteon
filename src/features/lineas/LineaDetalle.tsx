import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, ArrowRight, Pencil, Save, Trash2, Power, PowerOff } from "lucide-react";
import { lineasService, type LineaDetalleSafe } from "./service";
import { seccionesService } from "@/features/secciones/service";
import { panteonesService } from "@/features/panteones/service";
import { formatDate } from "@/lib/utils";
import type { Panteon, Seccion } from "@/types";

export default function LineaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lineaId = Number(id);
  const [data, setData] = useState<LineaDetalleSafe | null>(null);
  const [seccion, setSeccion] = useState<Seccion | null>(null);
  const [panteon, setPanteon] = useState<Panteon | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmEliminar, setConfirmEliminar] = useState(false);

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    capacidad_fosas: "",
    activo: 1 as 0 | 1,
  });

  const cargar = async () => {
    if (!lineaId) return;
    setLoading(true);
    try {
      const lin = await lineasService.obtenerDetalle(lineaId);
      if (!lin) { setData(null); return; }
      setData(lin);
      setForm({
        codigo: lin.codigo,
        nombre: lin.nombre,
        descripcion: lin.descripcion ?? "",
        capacidad_fosas: lin.capacidad_fosas != null ? String(lin.capacidad_fosas) : "",
        activo: (lin.activo === 1 ? 1 : 0) as 0 | 1,
      });
      // Cargar también la sección y el panteón para el breadcrumb
      try {
        const sec = await seccionesService.obtener(lin.seccion_id);
        setSeccion(sec);
        if (sec) {
          const pan = await panteonesService.obtener(sec.panteon_id);
          setPanteon(pan);
        }
      } catch { /* ignore */ }
    } catch (e) {
      console.error("Error cargando línea:", e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [lineaId]);

  const guardar = async () => {
    if (!data) return;
    if (!form.codigo.trim()) { setError("Captura el código de la línea"); return; }
    if (!form.nombre.trim()) { setError("Captura el nombre de la línea"); return; }
    setGuardando(true);
    setError("");
    try {
      await lineasService.actualizar(data.id, {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion || null,
        capacidad_fosas: form.capacidad_fosas ? Number(form.capacidad_fosas) : null,
        activo: form.activo,
      });
      await cargar();
      setEditando(false);
    } catch (e) {
      const err = e as Error;
      console.error("[LineaDetalle.guardar]", err);
      setError(err?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!data) return;
    try {
      await lineasService.eliminar(data.id);
      navigate("/secciones");
    } catch (e) {
      const err = e as Error;
      console.error("[LineaDetalle.eliminar]", err);
      alert("No se pudo eliminar: " + (err?.message || String(e)));
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <p>Cargando línea #{lineaId}…</p>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <p className="text-lg">Línea #{lineaId} no encontrada</p>
      <Button variant="outline" onClick={() => navigate("/lineas")}>Volver a Líneas</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-muted-foreground flex-wrap gap-y-1">
        <Link to="/panteones" className="hover:underline">Panteones</Link>
        <span className="mx-2">/</span>
        {panteon && (
          <>
            <Link to={`/panteones/${panteon.id}`} className="hover:underline">{panteon.nombre}</Link>
            <span className="mx-2">/</span>
          </>
        )}
        {seccion && (
          <>
            <Link to={`/secciones/${seccion.id}`} className="hover:underline">Sec {seccion.codigo} — {seccion.nombre}</Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-foreground font-medium">Línea {data.codigo}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-1">
            <Link to={seccion ? `/secciones/${seccion.id}` : "/secciones"}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la sección
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <ArrowRight className="h-7 w-7" />
            <span className="px-3 py-1 rounded bg-primary text-primary-foreground text-2xl">Línea {data.codigo}</span>
            <span className="text-muted-foreground">·</span>
            <span>{data.nombre}</span>
            {data.activo === 1 ? (
              <Badge variant="success">Activa</Badge>
            ) : (
              <Badge variant="muted">Inactiva</Badge>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          {!editando ? (
            <>
              <Button variant="outline" onClick={() => setEditando(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button variant="destructive" onClick={() => setConfirmEliminar(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => {
                setEditando(false);
                setError("");
                setForm({
                  codigo: data.codigo,
                  nombre: data.nombre,
                  descripcion: data.descripcion ?? "",
                  capacidad_fosas: data.capacidad_fosas != null ? String(data.capacidad_fosas) : "",
                  activo: (data.activo === 1 ? 1 : 0) as 0 | 1,
                });
              }} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={guardando}>
                <Save className="mr-2 h-4 w-4" /> {guardando ? "Guardando..." : "Guardar cambios"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tarjeta principal: datos de la línea */}
      <Card>
        <CardHeader>
          <CardTitle>Datos de la línea</CardTitle>
          <CardDescription>
            Visualiza y edita la información de esta línea.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editando ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input
                  className="h-11 text-base"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="Ej: L-1"
                />
              </div>
              <div>
                <Label>Nombre *</Label>
                <Input
                  className="h-11 text-base"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre de la línea"
                />
              </div>
              <div>
                <Label>Capacidad de fosas (referencial)</Label>
                <Input
                  type="number" min="0"
                  className="h-11 text-base"
                  value={form.capacidad_fosas}
                  onChange={(e) => setForm({ ...form, capacidad_fosas: e.target.value })}
                  placeholder="Sin límite"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Capacidad indicativa. Las fosas y gavetas son entidades independientes.
                </p>
              </div>
              <div>
                <Label>Estado</Label>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, activo: 1 })}
                    className={`flex items-center gap-2 px-3 py-2 rounded border ${form.activo === 1 ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-input hover:bg-accent"}`}
                  >
                    <Power className="h-4 w-4" /> Activa
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, activo: 0 })}
                    className={`flex items-center gap-2 px-3 py-2 rounded border ${form.activo === 0 ? "border-muted-foreground bg-muted text-muted-foreground" : "border-input hover:bg-accent"}`}
                  >
                    <PowerOff className="h-4 w-4" /> Inactiva
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <Textarea
                  rows={3}
                  className="text-base"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Notas o descripción opcional"
                />
              </div>
            </div>
          ) : (
            <dl className="grid gap-4 md:grid-cols-2 text-sm">
              <div><dt className="text-muted-foreground">Código</dt><dd className="font-mono font-semibold text-base">{data.codigo}</dd></div>
              <div><dt className="text-muted-foreground">Nombre</dt><dd className="font-medium text-base">{data.nombre}</dd></div>
              <div>
                <dt className="text-muted-foreground">Sección</dt>
                <dd>
                  {seccion ? (
                    <Link to={`/secciones/${seccion.id}`} className="text-primary hover:underline">
                      Sec {seccion.codigo} — {seccion.nombre}
                    </Link>
                  ) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Panteón</dt>
                <dd>
                  {panteon ? (
                    <Link to={`/panteones/${panteon.id}`} className="text-primary hover:underline">
                      {panteon.nombre}
                    </Link>
                  ) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Capacidad de fosas</dt>
                <dd className="font-medium">
                  {data.capacidad_fosas != null ? data.capacidad_fosas : <span className="text-muted-foreground italic">Sin límite</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estado</dt>
                <dd>{data.activo === 1 ? <Badge variant="success">Activa</Badge> : <Badge variant="muted">Inactiva</Badge>}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-muted-foreground">Descripción</dt>
                <dd className="whitespace-pre-wrap">{data.descripcion || <span className="text-muted-foreground italic">Sin descripción</span>}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Creada</dt>
                <dd className="text-muted-foreground">{data.created_at ? formatDate(data.created_at.slice(0, 10)) : "—"}</dd>
              </div>
            </dl>
          )}

          {error && (
            <div className="text-destructive bg-destructive/10 p-3 rounded text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmar eliminación */}
      <AlertDialog open={confirmEliminar} onOpenChange={setConfirmEliminar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar línea {data.codigo}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si la línea tiene fosas o gavetas
              vinculadas, primero elimínalas desde su página correspondiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
