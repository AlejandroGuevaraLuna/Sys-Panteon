import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Landmark, LayoutGrid, Rows3, Cross, Package, Wrench, ScrollText,
  BarChart3, Settings as SettingsIcon, Activity, Sun, Moon, ChevronRight,
  ChevronLeft, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/features/auth/AuthContext";
import logoPabe from "@/img/Logo-Pabe.png";

const navItems: { to: string; label: string; icon: typeof Home; end?: boolean; adminOnly?: boolean }[] = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/panteones", label: "Panteones", icon: Landmark },
  { to: "/secciones", label: "Secciones", icon: LayoutGrid },
  { to: "/lineas", label: "Líneas", icon: Rows3 },
  { to: "/fosas", label: "Fosas", icon: Cross },
  { to: "/gavetas", label: "Gavetas", icon: Package },
  { to: "/servicios", label: "Servicios y Precios", icon: Wrench },
  { to: "/memorandums", label: "Memorandums", icon: ScrollText },
  { to: "/reportes", label: "Reportes", icon: BarChart3 },
  { to: "/configuracion", label: "Configuración", icon: SettingsIcon },
  { to: "/diagnostico", label: "Diagnóstico", icon: Activity, adminOnly: true },
];

const BREADCRUMB: Record<string, string> = {
  "": "Inicio",
  panteones: "Panteones",
  secciones: "Secciones",
  lineas: "Líneas",
  fosas: "Fosas",
  gavetas: "Gavetas",
  servicios: "Servicios y Precios",
  memorandums: "Memorandums",
  reportes: "Reportes",
  configuracion: "Configuración",
  diagnostico: "Diagnóstico",
};

function buildBreadcrumb(pathname: string): string {
  if (pathname === "/") return "Inicio";
  const segs = pathname.split("/").filter(Boolean);
  return segs
    .map((s) => BREADCRUMB[s] ?? (s.length > 6 ? s.slice(0, 6) + "…" : s))
    .join("  ›  ");
}

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { usuario, logout } = useAuth();
  const [colapsado, setColapsado] = useState(false);

  return (
    <div className="flex h-screen w-full bg-muted/30">
      {/* ============== SIDEBAR / NAVBAR ============== */}
      <aside
        className={`${colapsado ? "w-16" : "w-72"} border-r bg-background flex flex-col transition-all duration-200`}
      >
        {/* Header con logo + toggle colapsar */}
        <div className={`border-b flex items-center ${colapsado ? "p-2 justify-center" : "p-4 gap-3"}`}>
          <img
            src={logoPabe}
            alt="Panteón Pabellón Arteaga"
            className={`${colapsado ? "h-9 w-9" : "h-12 w-12"} rounded-md object-contain bg-white border flex-shrink-0`}
          />
          {!colapsado && (
            <div className="leading-tight min-w-0 flex-1">
              <div className="font-bold text-base truncate" title="Pabellón Arteaga">
                Pabellón Arteaga
              </div>
              <div className="text-sm text-muted-foreground">Sistema de Gestión</div>
            </div>
          )}
          <Button
            variant="ghost" size="icon"
            onClick={() => setColapsado((c) => !c)}
            title={colapsado ? "Expandir menú" : "Colapsar menú"}
            className="h-8 w-8 flex-shrink-0"
          >
            {colapsado ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Items de navegación */}
        <nav className={`flex-1 space-y-1 overflow-y-auto ${colapsado ? "p-1" : "p-2"}`}>
          {navItems
            .filter((item) => !item.adminOnly || usuario?.rol === "admin")
            .map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={colapsado ? item.label : undefined}
                className={({ isActive }) => cn(
                  colapsado ? "justify-center px-2" : "gap-3 px-3",
                  "group flex items-center py-2.5 rounded-md text-base transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-foreground/85 hover:bg-muted hover:text-foreground"
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "" : "text-foreground/60 group-hover:text-foreground")} />
                    {!colapsado && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
                      </>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer con usuario, versión, tema y logout */}
        <div className={`border-t space-y-2 ${colapsado ? "p-2" : "p-3"}`}>
          {usuario && !colapsado && (
            <div className="flex items-center gap-2 px-1 py-1 rounded-md bg-muted/50">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {(usuario.nombre || usuario.username).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" title={usuario.nombre}>
                  {usuario.nombre}
                </div>
                <div className="text-xs text-muted-foreground truncate" title={usuario.rol}>
                  @{usuario.username} · {usuario.rol}
                </div>
              </div>
            </div>
          )}
          <div className={`flex items-center ${colapsado ? "flex-col gap-1" : "justify-between"}`}>
            {!colapsado && <Badge variant="muted" className="text-xs">v1.1.9</Badge>}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="icon" onClick={toggleTheme}
                title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
                className="h-9 w-9"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost" size="icon" onClick={() => { logout(); navigate("/login", { replace: true }); }}
                title="Cerrar sesión"
                className="h-9 w-9"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!colapsado && <div className="text-xs text-muted-foreground px-1">Datos locales · SQLite</div>}
        </div>
      </aside>

      {/* ============== MAIN ============== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b bg-background flex items-center px-6">
          <div className="text-base text-muted-foreground">
            {buildBreadcrumb(location.pathname)}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6"><Outlet /></div>
      </main>
    </div>
  );
}
