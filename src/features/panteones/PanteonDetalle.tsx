import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ArrowLeft, MapPin, Plus, Pencil, Trash2, LayoutGrid, Eye } from "lucide-react";
import { panteonesService } from "./service";
import { seccionesService } from "@/features/secciones/service";
import type { Panteon, Seccion } from "@/types";

export default function PanteonDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const panteonId = Number(id);
  const [data, setData] = useState<{ panteon: Panteon; secciones: (Seccion & { total_lineas: number; total_fosas: number; total_gavetas: number })[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSeccion, setOpenSeccion] = useState(false);
  const [editSeccion, setEditSeccion] = useState<Seccion | null>(null);
  const [delSeccion, setDelSeccion] = useState<Seccion | null>(null);
  const [secForm, setSecForm] = useState({ codigo: "", nombre: "", descripcion: "", capacidad_fosas: "", activo: true });

  const cargar = async () => {
    if (!panteonId) return;
    setLoading(true);
    try {
      const d = await panteonesService.obtenerDetalle(panteonId);
      setData(d);
    } catch (e) {
      console.error("Error cargando panteón:", e);
      alert("Error al cargar el panteón: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [panteonId]);

  const abrirNuevaSeccion = () => {
    setEditSeccion(null);
    setSecForm({ codigo: "", nombre: "", descripcion: "", capacidad_fosas: "", activo: true });
    setOpenSeccion(true);
  };
  const abrirEditarSeccion = (s: Seccion) => {
    setEditSeccion(s);
    setSecForm({ codigo: s.codigo, nombre: s.nombre, descripcion: s.descripcion ?? "", capacidad_fosas: s.capacidad_fosas?.toString() ?? "", activo: !!s.activo });
    setOpenSeccion(true);
  };
  const guardarSeccion = async () => {
    if (!secForm.codigo.trim() || !secForm.nombre.trim()) return;
    const payload = {
      panteon_id: panteonId,
      codigo: secForm.codigo.trim(), nombre: secForm.nombre.trim(),
      descripcion: secForm.descripcion || null,
      capacidad_fosas: secForm.capacidad_fosas ? Number(secForm.capacidad_fosas) : null,
      activo: secForm.activo ? 1 : 0,
    };
    if (editSeccion) await seccionesService.actualizar(editSeccion.id, payload);
    else await seccionesService.crear(payload);
    setOpenSeccion(false);
    cargar();
  };
  const eliminarSeccion = async () => {
    if (!delSeccion) return;
    try { await seccionesService.eliminar(delSeccion.id); }
    catch { alert("No se puede eliminar: tiene líneas/fosas asociadas"); }
    setDelSeccion(null); cargar();
  };

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">Cargando panteón #{panteonId}…</div>;
  if (!data) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <p>Panteón #{panteonId} no encontrado.</p>
      <p className="text-xs">Es posible que la base de datos esté en una versión vieja o corrupta. Prueba reiniciarla desde Configuración.</p>
      <Button onClick={() => navigate("/panteones")}>Volver a Panteones</Button>
    </div>
  );
  const { panteon, secciones } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link to="/panteones" className="hover:underline flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Panteones</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{panteon.nombre}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-7 w-7" /> {panteon.nombre}
          </h1>
          <p className="text-muted-foreground">
            {panteon.direccion || "Sin dirección"} {panteon.telefono && `· Tel: ${panteon.telefono}`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Secciones</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{secciones.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Líneas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{secciones.reduce((a, s) => a + s.total_lineas, 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Fosas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{secciones.reduce((a, s) => a + s.total_fosas, 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Gavetas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{secciones.reduce((a, s) => a + s.total_gavetas, 0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" /> Secciones</CardTitle>
            <CardDescription>Para crear líneas primero necesitas una sección.</CardDescription>
          </div>
          <Button onClick={abrirNuevaSeccion}><Plus className="mr-2 h-4 w-4" /> Nueva sección</Button>
        </CardHeader>
        <CardContent>
          {secciones.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <LayoutGrid className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>Este panteón aún no tiene secciones.</p>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Nombre</TableHead>
                <TableHead className="text-center">Líneas</TableHead>
                <TableHead className="text-center">Fosas</TableHead>
                <TableHead className="text-center">Gavetas</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {secciones.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-semibold">{s.codigo}</TableCell>
                    <TableCell className="font-medium">
                      <Link to={`/secciones/${s.id}`} className="hover:underline text-primary">{s.nombre}</Link>
                    </TableCell>
                    <TableCell className="text-center"><Badge variant="muted">{s.total_lineas}</Badge></TableCell>
                    <TableCell className="text-center"><Badge variant="muted">{s.total_fosas}</Badge></TableCell>
                    <TableCell className="text-center"><Badge variant="muted">{s.total_gavetas}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm" title="Ver"><Link to={`/secciones/${s.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      <Button variant="ghost" size="sm" onClick={() => abrirEditarSeccion(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDelSeccion(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openSeccion} onOpenChange={setOpenSeccion}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSeccion ? "Editar sección" : "Nueva sección"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código *</Label><Input value={secForm.codigo} onChange={(e) => setSecForm({ ...secForm, codigo: e.target.value })} placeholder="A, B, N-1" /></div>
              <div><Label>Nombre *</Label><Input value={secForm.nombre} onChange={(e) => setSecForm({ ...secForm, nombre: e.target.value })} placeholder="Sección A" /></div>
            </div>
            <div><Label>Capacidad de fosas</Label><Input type="number" min="1" value={secForm.capacidad_fosas} onChange={(e) => setSecForm({ ...secForm, capacidad_fosas: e.target.value })} /></div>
            <div><Label>Descripción</Label><Textarea value={secForm.descripcion} onChange={(e) => setSecForm({ ...secForm, descripcion: e.target.value })} rows={2} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="secActivo" checked={secForm.activo} onChange={(e) => setSecForm({ ...secForm, activo: e.target.checked })} />
              <Label htmlFor="secActivo">Sección activa</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={guardarSeccion}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delSeccion} onOpenChange={(o) => !o && setDelSeccion(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>¿Eliminar sección?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Se eliminará <strong>{delSeccion?.nombre}</strong> y todo lo que contiene.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={eliminarSeccion}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}