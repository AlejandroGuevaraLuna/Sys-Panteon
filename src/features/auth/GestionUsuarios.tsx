import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, AlertCircle, Plus, Pencil, EyeOff, Users as UsersIcon, ShieldAlert } from "lucide-react";
import { authService } from "@/features/auth/service";
import type { UsuarioSesion } from "@/lib/auth";

interface FormState {
  id: number | null;
  username: string;
  password: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: "admin" | "usuario";
}

const EMPTY_FORM: FormState = {
  id: null, username: "", password: "", nombre: "", email: "", telefono: "", rol: "usuario",
};

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioSesion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<FormState | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Confirmación de desactivación (en vez del confirm() del navegador)
  const [aDesactivar, setADesactivar] = useState<UsuarioSesion | null>(null);
  const [desactivando, setDesactivando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const list = await authService.listarTodos();
      setUsuarios(list);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setMsg(null);
    setEditando({ ...EMPTY_FORM });
  };

  const abrirEditar = (u: UsuarioSesion) => {
    setMsg(null);
    setEditando({
      id: u.id,
      username: u.username,
      password: "",
      nombre: u.nombre,
      email: u.email ?? "",
      telefono: u.telefono ?? "",
      rol: u.rol === "admin" ? "admin" : "usuario",
    });
  };

  const cancelar = () => setEditando(null);

  const guardar = async () => {
    if (!editando) return;
    setProcesando(true);
    setMsg(null);
    try {
      if (editando.id == null) {
        const r = await authService.crearUsuario({
          username: editando.username,
          password: editando.password,
          nombre: editando.nombre,
          email: editando.email || null,
          telefono: editando.telefono || null,
          rol: editando.rol,
        });
        if (r.ok) {
          setMsg({ tipo: "ok", texto: "Usuario creado" });
          setEditando(null);
          await cargar();
        } else {
          setMsg({ tipo: "err", texto: r.error || "No se pudo crear" });
        }
      } else {
        const r = await authService.editarUsuario(editando.id, {
          nombre: editando.nombre,
          email: editando.email || null,
          telefono: editando.telefono || null,
          rol: editando.rol,
          password: editando.password || undefined,
        });
        if (r.ok) {
          setMsg({ tipo: "ok", texto: "Usuario actualizado" });
          setEditando(null);
          await cargar();
        } else {
          setMsg({ tipo: "err", texto: r.error || "No se pudo actualizar" });
        }
      }
    } finally {
      setProcesando(false);
    }
  };

  const confirmarDesactivar = async () => {
    if (!aDesactivar) return;
    setDesactivando(true);
    const r = await authService.eliminarUsuario(aDesactivar.id);
    setDesactivando(false);
    if (r.ok) {
      setMsg({ tipo: "ok", texto: `Usuario "${aDesactivar.username}" desactivado. Ya no puede iniciar sesión, pero sus datos se conservan.` });
      setADesactivar(null);
      await cargar();
    } else {
      setMsg({ tipo: "err", texto: r.error || "No se pudo desactivar" });
      setADesactivar(null);
    }
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded-md border p-3 text-sm flex items-start gap-2 ${
          msg.tipo === "ok"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        }`}>
          {msg.tipo === "ok"
            ? <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
          <span>{msg.texto}</span>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <UsersIcon className="h-5 w-5" /> Usuarios del sistema
            </CardTitle>
            <CardDescription>
              {usuarios.length} usuario{usuarios.length === 1 ? "" : "s"} activo{usuarios.length === 1 ? "" : "s"}.
              El username no se puede cambiar después de creado. "Desactivar" oculta al usuario sin eliminar sus datos.
            </CardDescription>
          </div>
          {!editando && (
            <Button onClick={abrirNuevo}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo usuario
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editando ? (
            <div className="space-y-3 border rounded-md p-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Username</Label>
                  <Input
                    value={editando.username}
                    onChange={(e) => setEditando({ ...editando, username: e.target.value })}
                    disabled={editando.id != null}
                    placeholder="ej. maria"
                    autoFocus
                  />
                </div>
                <div>
                  <Label>Rol</Label>
                  <Select
                    value={editando.rol}
                    onValueChange={(v) => setEditando({ ...editando, rol: v as "admin" | "usuario" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usuario">Usuario</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Nombre completo</Label>
                <Input
                  value={editando.nombre}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  placeholder="María López García"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editando.email}
                    onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                    placeholder="usuario@correo.com"
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    type="tel"
                    value={editando.telefono}
                    onChange={(e) => setEditando({ ...editando, telefono: e.target.value })}
                    placeholder="(00) 0000-0000"
                  />
                </div>
              </div>
              <div>
                <Label>
                  Contraseña {editando.id != null && <span className="text-muted-foreground font-normal">(dejar vacío para no cambiar)</span>}
                </Label>
                <Input
                  type="password"
                  value={editando.password}
                  onChange={(e) => setEditando({ ...editando, password: e.target.value })}
                  placeholder={editando.id != null ? "•••••••• (sin cambios)" : "Mínimo 6 caracteres"}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={cancelar} disabled={procesando}>
                  Cancelar
                </Button>
                <Button
                  onClick={guardar}
                  disabled={
                    procesando ||
                    !editando.nombre.trim() ||
                    !editando.username.trim() ||
                    (editando.id == null && editando.password.length < 6)
                  }
                >
                  {procesando
                    ? "Guardando..."
                    : editando.id == null ? "Crear usuario" : "Guardar cambios"}
                </Button>
              </div>
            </div>
          ) : cargando ? (
            <p className="text-muted-foreground text-sm">Cargando...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay usuarios registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono">@{u.username}</TableCell>
                    <TableCell>{u.nombre}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.email || "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        u.rol === "admin"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {u.rol === "admin" ? "Administrador" : "Usuario"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(u)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setADesactivar(u)}
                        title="Desactivar usuario (baja lógica)"
                        className="text-amber-700 hover:text-amber-800"
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación para desactivar */}
      <AlertDialog open={!!aDesactivar} onOpenChange={(o) => !o && setADesactivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              ¿Desactivar al usuario "{aDesactivar?.username}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                Esta acción <strong>no elimina</strong> al usuario de la base de datos.
                Se marca como <code>activo = 0</code> y desaparece de la lista.
              </p>
              <p>
                <strong>Lo que pasa después:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>El usuario <strong>ya no podrá iniciar sesión</strong>.</li>
                <li>Sus datos (nombre, email, teléfono, rol) <strong>se conservan</strong> por integridad referencial.</li>
                <li>Puedes volver a activarlo editando manualmente <code>activo = 1</code> en la BD si fuera necesario.</li>
              </ul>
              {aDesactivar?.rol === "admin" && (
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                  <strong>Atención:</strong> este usuario es administrador. Solo se puede desactivar si
                  existe al menos otro administrador activo.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desactivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarDesactivar(); }}
              disabled={desactivando}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {desactivando ? "Desactivando..." : "Sí, desactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
