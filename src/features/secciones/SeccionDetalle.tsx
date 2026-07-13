import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ArrowLeft, LayoutGrid, Plus, Pencil, Trash2, Eye, ArrowRight } from "lucide-react";
import { seccionesService } from "./service";
import { lineasService } from "@/features/lineas/service";
import { panteonesService } from "@/features/panteones/service";
import type { Seccion, Linea, Panteon } from "@/types";

export default function SeccionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const seccionId = Number(id);
  const [seccion, setSeccion] = useState<Seccion | null>(null);
  const [panteon, setPanteon] = useState<Panteon | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [fosasPorLinea, setFosasPorLinea] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [openLinea, setOpenLinea] = useState(false);
  const [editLinea, setEditLinea] = useState<Linea | null>(null);
  const [delLinea, setDelLinea] = useState<Linea | null>(null);
  const [linForm, setLinForm] = useState({ codigo: "", nombre: "", descripcion: "", capacidad_fosas: "", activo: true });

  const cargar = async () => {
    if (!seccionId) return;
    setLoading(true);
    try {
      console.log(`[SeccionDetalle] Cargando sección #${seccionId}`);
      const sec = await seccionesService.obtener(seccionId);
      if (!sec) {
        console.warn(`[SeccionDetalle] Sección #${seccionId} no encontrada`);
        setSeccion(null);
        setLoading(false);
        return;
      }
      console.log(`[SeccionDetalle] Sección encontrada:`, sec);
      setSeccion(sec);
      // Cargar panteón por separado para no fallar si la sección ya cargó
      try {
        const p = await panteonesService.obtener(sec.panteon_id);
        setPanteon(p);
      } catch (e) {
        console.warn("No se pudo cargar el panteón:", e);
        setPanteon(null);
      }
      const lins = await lineasService.listar(seccionId);
      setLineas(lins);
      const counts: Record<number, number> = {};
      for (const l of lins) counts[l.id] = await lineasService.contarFosas(l.id);
      setFosasPorLinea(counts);
    } catch (e) {
      console.error("Error cargando sección:", e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [seccionId]);

  const abrirNuevaLinea = () => {
    setEditLinea(null);
    setLinForm({ codigo: "", nombre: "", descripcion: "", capacidad_fosas: "", activo: true });
    setOpenLinea(true);
  };
  const abrirEditarLinea = (l: Linea) => {
    setEditLinea(l);
    setLinForm({ codigo: l.codigo, nombre: l.nombre, descripcion: l.descripcion ?? "", capacidad_fosas: l.capacidad_fosas?.toString() ?? "", activo: !!l.activo });
    setOpenLinea(true);
  };
  const guardarLinea = async () => {
    if (!linForm.codigo.trim() || !linForm.nombre.trim()) {
      console.warn("Código y nombre requeridos");
      return;
    }
    try {
      const payload = {
        seccion_id: seccionId,
        codigo: linForm.codigo.trim(), nombre: linForm.nombre.trim(),
        descripcion: linForm.descripcion || null,
        capacidad_fosas: linForm.capacidad_fosas ? Number(linForm.capacidad_fosas) : null,
        activo: linForm.activo ? 1 : 0,
      };
      if (editLinea) await lineasService.actualizar(editLinea.id, payload);
      else await lineasService.crear(payload);
      setOpenLinea(false); cargar();
    } catch (e) {
      console.error("Error guardando línea:", e);
    }
  };
  const eliminarLinea = async () => {
    if (!delLinea) return;
    try { await lineasService.eliminar(delLinea.id); setDelLinea(null); cargar(); }
    catch (e) {
      console.error("No se puede eliminar línea:", e);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <p>Cargando sección #{seccionId}…</p>
      <p className="text-xs">Si tarda, abre DevTools (Ctrl+Shift+I) para ver los logs.</p>
    </div>
  );
  if (!seccion) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <p className="text-lg">Sección #{seccionId} no encontrada</p>
      <p className="text-sm max-w-md text-center">
        Ve a <Link to="/diagnostico" className="text-primary underline">Diagnóstico</Link> para inspeccionar la BD.
      </p>
      <Button onClick={cargar}>Reintentar</Button>
      <Button variant="outline" onClick={() => navigate("/secciones")}>Volver a Secciones</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link to="/panteones" className="hover:underline">Panteones</Link>
        <span className="mx-2">/</span>
        {panteon ? (
          <><Link to={`/panteones/${panteon.id}`} className="hover:underline">{panteon.nombre}</Link><span className="mx-2">/</span></>
        ) : (
          <span className="text-amber-600">[Panteón no encontrado] </span>
        )}
        <span className="text-foreground font-medium">Sección {seccion.codigo} — {seccion.nombre}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-1">
            <Link to={panteon ? `/panteones/${panteon.id}` : "/panteones"}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al panteón
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <LayoutGrid className="h-7 w-7" />
            <span className="px-2 py-1 rounded bg-primary/10 text-primary">Sección {seccion.codigo}</span>
            <span className="text-muted-foreground">·</span>
            <span>{seccion.nombre}</span>
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5" /> Líneas</CardTitle>
            <CardDescription>Para crear fosas primero necesitas una línea.</CardDescription>
          </div>
          <Button onClick={abrirNuevaLinea}><Plus className="mr-2 h-4 w-4" /> Nueva línea</Button>
        </CardHeader>
        <CardContent>
          {lineas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ArrowRight className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>Esta sección aún no tiene líneas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Nombre</TableHead>
                <TableHead className="text-center">Fosas</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {lineas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono font-semibold">{l.codigo}</TableCell>
                    <TableCell className="font-medium">
                      <Link to={`/lineas/${l.id}`} className="hover:underline text-primary">{l.nombre}</Link>
                    </TableCell>
                    <TableCell className="text-center"><Badge variant="muted">{fosasPorLinea[l.id] ?? 0}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm" title="Ver"><Link to={`/lineas/${l.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      <Button variant="ghost" size="sm" onClick={() => abrirEditarLinea(l)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDelLinea(l)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openLinea} onOpenChange={setOpenLinea}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editLinea ? "Editar línea" : "Nueva línea"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código *</Label><Input value={linForm.codigo} onChange={(e) => setLinForm({ ...linForm, codigo: e.target.value })} placeholder="1, 2, A" /></div>
              <div><Label>Nombre *</Label><Input value={linForm.nombre} onChange={(e) => setLinForm({ ...linForm, nombre: e.target.value })} placeholder="Línea 1" /></div>
            </div>
            <div><Label>Capacidad de fosas</Label><Input type="number" min="1" value={linForm.capacidad_fosas} onChange={(e) => setLinForm({ ...linForm, capacidad_fosas: e.target.value })} /></div>
            <div><Label>Descripción</Label><Textarea value={linForm.descripcion} onChange={(e) => setLinForm({ ...linForm, descripcion: e.target.value })} rows={2} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="linActivo" checked={linForm.activo} onChange={(e) => setLinForm({ ...linForm, activo: e.target.checked })} />
              <Label htmlFor="linActivo">Línea activa</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={guardarLinea}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delLinea} onOpenChange={(o) => !o && setDelLinea(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>¿Eliminar línea?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Se eliminará <strong>{delLinea?.nombre}</strong> y todas sus fosas.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={eliminarLinea}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}