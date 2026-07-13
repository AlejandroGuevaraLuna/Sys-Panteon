import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Wrench, Save, Plus, Pencil, Trash2, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serviciosService } from "./service";
import { type Servicio } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface FormState {
  id?: number;
  nombre: string;
  precio: string;
  descripcion: string;
  activo: 0 | 1;
}

const FORM_INICIAL: FormState = {
  nombre: "",
  precio: "0",
  descripcion: "",
  activo: 1,
};

/**
 * Convierte un nombre legible ("Limpieza profunda") en un identificador
 * interno tipo slug: MAYÚSCULAS, sin acentos, guiones bajos. Si el slug
 * ya existe, agrega un sufijo numérico para evitar colisión con la
 * restricción UNIQUE de la tabla `servicios`.
 */
function generarTipoUnico(nombre: string, serviciosActuales: Servicio[], idEditar?: number): string {
  const base = nombre
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "SERVICIO";
  // ¿ya existe (excluyendo el que estamos editando)?
  const existe = (s: Servicio) => s.tipo === base && s.id !== idEditar;
  if (!serviciosActuales.some(existe)) return base;
  // Sufijo numérico
  let n = 2;
  while (serviciosActuales.some((s) => s.tipo === `${base}_${n}` && s.id !== idEditar)) n++;
  return `${base}_${n}`;
}

export default function Servicios() {
  const [items, setItems] = useState<Servicio[]>([]);
  const [dirty, setDirty] = useState<Record<number, number>>({});
  const [guardando, setGuardando] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [errorForm, setErrorForm] = useState("");
  const [delItem, setDelItem] = useState<Servicio | null>(null);

  const cargar = async () => setItems(await serviciosService.listar());
  useEffect(() => { cargar(); }, []);

  const setPrecio = (id: number, precio: number) => {
    setDirty((d) => ({ ...d, [id]: precio }));
    setItems((arr) => arr.map((s) => (s.id === id ? { ...s, precio } : s)));
  };

  const guardarPrecios = async () => {
    setGuardando(true);
    try {
      for (const [id, precio] of Object.entries(dirty)) {
        await serviciosService.actualizarPrecio(Number(id), precio);
      }
      setDirty({});
      await cargar();
    } finally {
      setGuardando(false);
    }
  };

  const abrirNuevo = () => {
    setForm(FORM_INICIAL);
    setErrorForm("");
    setOpenForm(true);
  };

  const abrirEditar = (s: Servicio) => {
    setForm({
      id: s.id,
      nombre: s.nombre,
      precio: String(s.precio ?? 0),
      descripcion: s.descripcion ?? "",
      activo: (s.activo === 1 ? 1 : 0) as 0 | 1,
    });
    setErrorForm("");
    setOpenForm(true);
  };

  const guardarForm = async () => {
    if (!form.nombre.trim()) { setErrorForm("Captura el nombre"); return; }
    if (!form.precio || isNaN(Number(form.precio))) { setErrorForm("Captura un precio válido"); return; }
    setGuardando(true);
    setErrorForm("");
    try {
      // El `tipo` se autogenera a partir del nombre para que el usuario
      // no tenga que seleccionarlo manualmente.
      const tipo = generarTipoUnico(form.nombre, items, form.id);
      const payload = {
        tipo,
        nombre: form.nombre.trim(),
        precio: Number(form.precio),
        descripcion: form.descripcion.trim() || null,
        activo: form.activo,
      };
      if (form.id) {
        await serviciosService.actualizar(form.id, payload);
      } else {
        await serviciosService.crear(payload);
      }
      await cargar();
      setOpenForm(false);
    } catch (e) {
      const err = e as Error;
      console.error("[Servicios.guardarForm]", err);
      setErrorForm(err?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!delItem) return;
    try {
      await serviciosService.eliminar(delItem.id);
      setDelItem(null);
      await cargar();
    } catch (e) {
      alert("No se pudo eliminar: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Servicios y precios</h1>
          <p className="text-muted-foreground">Crea, edita o elimina los tipos de servicio del panteón.</p>
        </div>
        <div className="flex gap-2">
          {Object.keys(dirty).length > 0 && (
            <Button onClick={guardarPrecios} disabled={guardando} variant="outline">
              <Save className="mr-2 h-4 w-4" />
              {guardando ? "Guardando..." : `Guardar ${Object.keys(dirty).length} precio(s)`}
            </Button>
          )}
          <Button onClick={abrirNuevo}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo servicio
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><Wrench className="inline h-5 w-5 mr-2" />Tipos de servicio</CardTitle>
          <CardDescription>
            Edita el precio directamente en la tabla. Para crear o eliminar un servicio, usa los botones de cada renglón.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No hay servicios registrados.</p>
              <p className="text-sm mt-2">Crea el primero con el botón «Nuevo servicio».</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-48">Precio</TableHead>
                  <TableHead className="w-28">Estado</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => {
                  const dirtyKey = dirty[s.id] != null;
                  return (
                    <TableRow key={s.id} className={dirtyKey ? "bg-amber-50/40" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {s.nombre}
                          {s.activo === 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactivo</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{s.descripcion || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number" step="0.01" min="0"
                            value={s.precio}
                            onChange={(e) => setPrecio(s.id, parseFloat(e.target.value) || 0)}
                            className="w-32"
                          />
                          <span className="text-xs text-muted-foreground">{formatCurrency(s.precio)}</span>
                          {dirtyKey && <span className="text-xs text-amber-700">●</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${s.activo ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                          {s.activo ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(s)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setDelItem(s)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Dialog: crear / editar servicio */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-2xl text-base">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {form.id ? "Editar servicio" : "Nuevo servicio"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nombre del servicio *</Label>
              <Input
                className="h-11 text-base"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Limpieza profunda, Mantenimiento mensual, …"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                El identificador interno del servicio se genera automáticamente a partir del nombre.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Precio (MXN) *</Label>
                <Input
                  type="number" step="0.01" min="0"
                  className="h-11 text-base"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, activo: 1 })}
                    className={`flex items-center gap-2 px-3 py-2 rounded border ${form.activo === 1 ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-input hover:bg-accent"}`}
                  >
                    <Power className="h-4 w-4" /> Activo
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, activo: 0 })}
                    className={`flex items-center gap-2 px-3 py-2 rounded border ${form.activo === 0 ? "border-muted-foreground bg-muted text-muted-foreground" : "border-input hover:bg-accent"}`}
                  >
                    <PowerOff className="h-4 w-4" /> Inactivo
                  </button>
                </div>
              </div>
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea
                rows={3}
                className="text-base"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Detalle del servicio, alcance, materiales, etc."
              />
            </div>

            {errorForm && (
              <div className="text-destructive bg-destructive/10 p-3 rounded text-sm">{errorForm}</div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={guardando}>Cancelar</Button>
            </DialogClose>
            <Button onClick={guardarForm} disabled={guardando}>
              <Save className="mr-2 h-4 w-4" />
              {guardando ? "Guardando..." : (form.id ? "Guardar cambios" : "Crear servicio")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <AlertDialog open={!!delItem} onOpenChange={(o) => !o && setDelItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{delItem?.nombre ?? ""}</strong>.
              Si ya hay memorandums emitidos con este servicio, no podrá eliminarse.
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
