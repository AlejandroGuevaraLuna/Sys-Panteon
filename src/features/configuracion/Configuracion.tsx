import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Settings as SettingsIcon, Sun, Moon, KeyRound, Check, AlertCircle, UserCircle2, AtSign } from "lucide-react";
import { configuracionService } from "./service";
import { panteonesService } from "@/features/panteones/service";
import type { AppConfig, Panteon } from "@/types";
import { ColorPicker } from "@/components/ui/color-picker";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/features/auth/AuthContext";
import { authService } from "@/features/auth/service";
import GestionUsuarios from "@/features/auth/GestionUsuarios";

export default function Configuracion() {
  const [config, setConfig] = useState<AppConfig>({
    panteon_activo_id: null, logo_path: null, pie_pagina: "", ciudad: "", color_primario: "",
    memo_folio_inicial: 1,
  });
  const [panteones, setPanteones] = useState<Panteon[]>([]);
  const [guardado, setGuardado] = useState(false);

  // Edición de perfil
  const [perfilNombre, setPerfilNombre] = useState("");
  const [perfilEmail, setPerfilEmail] = useState("");
  const [perfilTelefono, setPerfilTelefono] = useState("");
  const [perfilMsg, setPerfilMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [perfilLoading, setPerfilLoading] = useState(false);

  // Cambio de contraseña
  const [pwdActual, setPwdActual] = useState("");
  const [pwdNueva, setPwdNueva] = useState("");
  const [pwdNueva2, setPwdNueva2] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const { theme, primaryColor, setTheme, setPrimaryColor, resetColor } = useTheme();
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "admin";

  useEffect(() => {
    (async () => {
      const [c, ps] = await Promise.all([
        configuracionService.obtener(),
        panteonesService.listar(),
      ]);
      setConfig(c);
      setPanteones(ps);
    })();
  }, []);

  useEffect(() => {
    if (!usuario) return;
    (async () => {
      const p = await authService.obtenerPerfil(usuario.id);
      if (p) {
        setPerfilNombre(p.nombre);
        setPerfilEmail(p.email ?? "");
        setPerfilTelefono(p.telefono ?? "");
      }
    })();
  }, [usuario?.id]);

  const guardar = async () => {
    await configuracionService.actualizar(config);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  const guardarPerfil = async () => {
    if (!usuario) return;
    setPerfilMsg(null);
    setPerfilLoading(true);
    const r = await authService.actualizarPerfil(usuario.id, {
      nombre: perfilNombre,
      email: perfilEmail.trim() || null,
      telefono: perfilTelefono.trim() || null,
    });
    setPerfilLoading(false);
    if (r.ok) {
      setPerfilMsg({ tipo: "ok", texto: "Perfil actualizado. El nombre se reflejará en el próximo inicio de sesión." });
    } else {
      setPerfilMsg({ tipo: "err", texto: r.error || "No se pudo actualizar" });
    }
  };

  const cambiarContrasena = async () => {
    setPwdMsg(null);
    if (!usuario) return;
    if (pwdNueva !== pwdNueva2) {
      setPwdMsg({ tipo: "err", texto: "La nueva contraseña y su confirmación no coinciden" });
      return;
    }
    setPwdLoading(true);
    const r = await authService.cambiarMiContrasena(usuario.id, pwdActual, pwdNueva);
    setPwdLoading(false);
    if (r.ok) {
      setPwdMsg({ tipo: "ok", texto: "Contraseña actualizada correctamente" });
      setPwdActual(""); setPwdNueva(""); setPwdNueva2("");
    } else {
      setPwdMsg({ tipo: "err", texto: r.error || "No se pudo cambiar la contraseña" });
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="h-7 w-7" /> Configuración
          </h1>
          <p className="text-muted-foreground text-sm">
            {esAdmin
              ? "Datos del sistema, tu cuenta y los usuarios."
              : "Datos de tu cuenta y apariencia."}
          </p>
        </div>
        <Button onClick={guardar} size="sm">
          <Save className="mr-2 h-4 w-4" />
          {guardado ? "¡Guardado!" : "Guardar cambios"}
        </Button>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="perfil">Mi cuenta</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
          <TabsTrigger value="sistema">Sistema</TabsTrigger>
          {esAdmin && <TabsTrigger value="usuarios">Usuarios</TabsTrigger>}
        </TabsList>

        {/* ===== Mi cuenta ===== */}
        <TabsContent value="perfil" className="space-y-4">
          {usuario && (
            <>
              <div className="rounded-lg border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <UserCircle2 className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Datos personales</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Username</Label>
                    <div className="flex items-center gap-2">
                      <AtSign className="h-4 w-4 text-muted-foreground" />
                      <Input value={usuario.username} disabled className="font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label>Rol</Label>
                    <Input value={usuario.rol} disabled className="capitalize" />
                  </div>
                </div>
                <div>
                  <Label>Nombre completo</Label>
                  <Input
                    value={perfilNombre}
                    onChange={(e) => setPerfilNombre(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={perfilEmail}
                      onChange={(e) => setPerfilEmail(e.target.value)}
                      placeholder="usuario@correo.com"
                    />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input
                      type="tel"
                      value={perfilTelefono}
                      onChange={(e) => setPerfilTelefono(e.target.value)}
                      placeholder="(00) 0000-0000"
                    />
                  </div>
                </div>

                {perfilMsg && (
                  <div className={`rounded-md border p-3 text-sm flex items-start gap-2 ${
                    perfilMsg.tipo === "ok"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}>
                    {perfilMsg.tipo === "ok"
                      ? <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                    <span>{perfilMsg.texto}</span>
                  </div>
                )}

                <Button onClick={guardarPerfil} disabled={perfilLoading || !perfilNombre.trim()}>
                  <Save className="mr-2 h-4 w-4" />
                  {perfilLoading ? "Guardando..." : "Guardar perfil"}
                </Button>
              </div>

              <div className="rounded-lg border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Se guarda encriptada con bcrypt (cost 10).
                </p>
                <div>
                  <Label>Contraseña actual</Label>
                  <Input
                    type="password"
                    value={pwdActual}
                    onChange={(e) => setPwdActual(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nueva contraseña</Label>
                    <Input
                      type="password"
                      value={pwdNueva}
                      onChange={(e) => setPwdNueva(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <Label>Confirmar nueva</Label>
                    <Input
                      type="password"
                      value={pwdNueva2}
                      onChange={(e) => setPwdNueva2(e.target.value)}
                      placeholder="Repite la nueva"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {pwdMsg && (
                  <div className={`rounded-md border p-3 text-sm flex items-start gap-2 ${
                    pwdMsg.tipo === "ok"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}>
                    {pwdMsg.tipo === "ok"
                      ? <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                    <span>{pwdMsg.texto}</span>
                  </div>
                )}

                <Button
                  onClick={cambiarContrasena}
                  disabled={pwdLoading || !pwdActual || !pwdNueva || !pwdNueva2}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {pwdLoading ? "Actualizando..." : "Actualizar contraseña"}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ===== Apariencia ===== */}
        <TabsContent value="apariencia" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Tema</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Se aplica inmediatamente y se guarda para <strong>tu usuario</strong> (cada quien ve la app a su gusto).
              </p>
              <div className="flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  onClick={() => setTheme("light")}
                  size="sm"
                >
                  <Sun className="mr-2 h-4 w-4" /> Modo claro
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => setTheme("dark")}
                  size="sm"
                >
                  <Moon className="mr-2 h-4 w-4" /> Modo oscuro
                </Button>
              </div>
            </div>
            <div className="border-t pt-4">
              <h2 className="text-lg font-semibold mb-1">Color primario</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Se usa en encabezados, botones principales y badges de estado.
              </p>
              <ColorPicker
                value={primaryColor}
                onChange={setPrimaryColor}
                onReset={resetColor}
              />
            </div>
          </div>
        </TabsContent>

        {/* ===== Sistema ===== */}
        <TabsContent value="sistema" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Panteón activo</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Selección por defecto al generar nuevos memorandums.
              </p>
              <Select
                value={config.panteon_activo_id?.toString() ?? ""}
                onValueChange={(v) =>
                  setConfig((c) => ({ ...c, panteon_activo_id: v ? Number(v) : null }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un panteón" />
                </SelectTrigger>
                <SelectContent>
                  {panteones.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {panteones.length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  Primero registra al menos un panteón en la sección "Panteones".
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Consecutivo de memorandums</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Número inicial del consecutivo anual (formato MEM-AAAA-NNNN).
                El siguiente folio siempre será mayor o igual a este valor.
              </p>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label>Folio inicial</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={config.memo_folio_inicial ?? 1}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setConfig((c) => ({ ...c, memo_folio_inicial: Number.isFinite(v) && v >= 1 ? v : 1 }));
                    }}
                    className="font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground pb-2">
                  Ej: si pones 5, los nuevos empezarán en MEM-{new Date().getFullYear()}-0005
                  (o el siguiente disponible si ya hay más).
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== Usuarios (solo admin) ===== */}
        {esAdmin && (
          <TabsContent value="usuarios">
            <GestionUsuarios />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
