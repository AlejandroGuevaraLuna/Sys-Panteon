import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { authService } from "./service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Eye, EyeOff, KeyRound } from "lucide-react";
import logoPabe from "@/img/Logo-Pabe.png";

export default function Login() {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (usuario) navigate("/", { replace: true });
  }, [usuario, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const r = await login(username, password);
    setLoading(false);
    if (!r.ok) setError(r.error || "No se pudo iniciar sesión");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-muted/40 via-background to-muted/60 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-xl shadow-lg p-8 space-y-6">
          {/* Logo y título */}
          <div className="flex flex-col items-center text-center space-y-3">
            <img
              src={logoPabe}
              alt="Panteón Pabellón Arteaga"
              className="h-20 w-20 rounded-xl object-contain bg-white border shadow-sm"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pabellón Arteaga</h1>
              <p className="text-sm text-muted-foreground">Sistema de Gestión de Panteón</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario"
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  tabIndex={-1}
                  title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Verificando..." : "Iniciar sesión"}
            </Button>
          </form>

          {error && error.toLowerCase().includes("incorrect") && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("¿Resetear la contraseña del usuario 'admin' a 'Admin123!'? Úsalo solo si no puedes entrar.")) return;
                setLoading(true);
                setError("");
                const ok = await authService.resetearAdminEmergencia();
                setLoading(false);
                if (ok) {
                  setUsername("admin");
                  setPassword("Admin123!");
                  setError("✓ Contraseña de admin reseteada. Captura 'Admin123!' y presiona Iniciar sesión.");
                } else {
                  setError("No se encontró el usuario 'admin' en la BD.");
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline w-full text-center"
            >
              <KeyRound className="inline h-3 w-3 mr-1" />
              ¿No puedes entrar? Resetea la contraseña del admin
            </button>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          Panteón Admin v1.1.9 — acceso restringido
        </p>
      </div>
    </div>
  );
}
