import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MapPin, ArrowRight } from "lucide-react";
import { panteonesService } from "./service";
import type { Panteon } from "@/types";

const empty: Omit<Panteon, "id" | "created_at"> = {
  nombre: "", direccion: "", telefono: "", administrador: "", notas: "", activo: 1,
};

export default function Panteones() {
  const [items, setItems] = useState<Panteon[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Panteon | null>(null);
  const [form, setForm] = useState(empty);
  const [del, setDel] = useState<Panteon | null>(null);

  const cargar = async () => setItems(await panteonesService.listar());
  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => { setEdit(null); setForm(empty); setOpen(true); };
  const abrirEditar = (p: Panteon) => {
    setEdit(p);
    setForm({ nombre: p.nombre, direccion: p.direccion, telefono: p.telefono, administrador: p.administrador, notas: p.notas ?? "", activo: p.activo });
    setOpen(true);
  };
  const guardar = async () => {
    if (!form.nombre.trim()) return;
    if (edit) await panteonesService.actualizar(edit.id, form);
    else await panteonesService.crear(form);
    setOpen(false); cargar();
  };
  const eliminar = async () => {
    if (!del) return;
    try { await panteonesService.eliminar(del.id); }
    catch { alert("No se puede eliminar: tiene contenido asociado"); }
    setDel(null); cargar();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panteones</h1>
          <p className="text-muted-foreground">Cada panteón agrupa secciones, líneas, fosas y gavetas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNuevo}><Plus className="mr-2 h-4 w-4" /> Nuevo panteón</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Editar panteón" : "Nuevo panteón"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Nombre *</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
              <div><Label>Dirección</Label><Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Teléfono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                <div><Label>Administrador</Label><Input value={form.administrador} onChange={(e) => setForm({ ...form, administrador: e.target.value })} /></div>
              </div>
              <div><Label>Notas</Label><Textarea value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="activo" checked={!!form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked ? 1 : 0 })} />
                <Label htmlFor="activo">Activo</Label>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={guardar}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="text-center py-10 text-muted-foreground">
              <MapPin className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>No hay panteones registrados.</p>
            </CardContent>
          </Card>
        ) : items.map((p) => (
          <Card key={p.id} className="hover:border-primary transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> {p.nombre}</CardTitle>
                  <CardDescription>{p.direccion || "Sin dirección"}</CardDescription>
                </div>
                <Badge variant={p.activo ? "success" : "muted"}>{p.activo ? "Activo" : "Inactivo"}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm mb-3">
                {p.telefono && <div className="text-muted-foreground">📞 {p.telefono}</div>}
                {p.administrador && <div className="text-muted-foreground">👤 {p.administrador}</div>}
              </div>
              <div className="flex gap-1">
                <Button asChild variant="default" size="sm" className="flex-1">
                  <Link to={`/panteones/${p.id}`}>Abrir <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => abrirEditar(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setDel(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>¿Eliminar panteón?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Se eliminará <strong>{del?.nombre}</strong> y todo su contenido.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={eliminar}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}