import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Plus, ArrowRight, LayoutGrid } from "lucide-react";
import { seccionesService } from "./service";
import { panteonesService } from "@/features/panteones/service";
import type { Seccion, Panteon } from "@/types";

export default function Secciones() {
  const [items, setItems] = useState<Seccion[]>([]);
  const [panteones, setPanteones] = useState<Panteon[]>([]);
  const [openNueva, setOpenNueva] = useState(false);
  const [form, setForm] = useState({ panteon_id: "", codigo: "", nombre: "", descripcion: "", capacidad_fosas: "", activo: true });

  const cargar = async () => setItems(await seccionesService.listar());
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    panteonesService.listar().then(setPanteones);
  }, []);

  const guardar = async () => {
    if (!form.panteon_id || !form.codigo.trim() || !form.nombre.trim()) {
      alert("Panteón, código y nombre son obligatorios");
      return;
    }
    try {
      await seccionesService.crear({
        panteon_id: Number(form.panteon_id),
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion || null,
        capacidad_fosas: form.capacidad_fosas ? Number(form.capacidad_fosas) : null,
        activo: form.activo ? 1 : 0,
      });
      setOpenNueva(false);
      setForm({ panteon_id: "", codigo: "", nombre: "", descripcion: "", capacidad_fosas: "", activo: true });
      cargar();
    } catch (e) {
      const err = e as Error;
      if (err.message.includes("UNIQUE")) {
        alert(`Ya existe una sección con código "${form.codigo}" en ese panteón.`);
      } else {
        alert("Error: " + err.message);
      }
    }
  };

  const panteonById = (id: number) => panteones.find((p) => p.id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="h-7 w-7" /> Secciones
          </h1>
          <p className="text-muted-foreground">
            Cada sección pertenece a un panteón y agrupa líneas. Para crear una línea primero necesitas una sección.
          </p>
        </div>
        <Dialog open={openNueva} onOpenChange={setOpenNueva}>
          <DialogTrigger asChild>
            <Button disabled={panteones.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> Nueva sección
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" /> Nueva sección
              </DialogTitle>
            </DialogHeader>
            {panteones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Primero registra un <Link to="/panteones" className="text-primary hover:underline">panteón</Link>.
              </p>
            ) : (
              <div className="grid gap-3">
                <div>
                  <Label>Panteón padre *</Label>
                  <Select value={form.panteon_id} onValueChange={(v) => setForm({ ...form, panteon_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona panteón" /></SelectTrigger>
                    <SelectContent>
                      {panteones.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Código *</Label>
                    <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                      placeholder="A, B, N-1" />
                  </div>
                  <div>
                    <Label>Nombre *</Label>
                    <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Sección A" />
                  </div>
                </div>
                <div>
                  <Label>Capacidad de fosas</Label>
                  <Input type="number" min="1" value={form.capacidad_fosas}
                    onChange={(e) => setForm({ ...form, capacidad_fosas: e.target.value })} />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="secActivo" checked={form.activo}
                    onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                  <Label htmlFor="secActivo">Sección activa</Label>
                </div>
              </div>
            )}
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
              <LayoutGrid className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>No hay secciones registradas.</p>
              <p className="text-sm">
                {panteones.length === 0
                  ? <>Primero crea un <Link to="/panteones" className="text-primary hover:underline">panteón</Link>.</>
                  : "Crea la primera sección con el botón 'Nueva sección'."}
              </p>
            </CardContent>
          </Card>
        ) : items.map((s) => {
          const pan = panteonById(s.panteon_id);
          return (
            <Card key={s.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <LayoutGrid className="h-5 w-5" />
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-sm">Sec {s.codigo}</span>
                    </CardTitle>
                    <CardDescription>{s.nombre}</CardDescription>
                  </div>
                  <Badge variant={s.activo ? "success" : "muted"}>{s.activo ? "Activa" : "Inactiva"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-3">
                  {pan ? <>Panteón: <Link to={`/panteones/${pan.id}`} className="text-primary hover:underline">{pan.nombre}</Link></> : "—"}
                </div>
                <Button asChild variant="default" size="sm" className="w-full">
                  <Link to={`/secciones/${s.id}`}>Abrir <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}