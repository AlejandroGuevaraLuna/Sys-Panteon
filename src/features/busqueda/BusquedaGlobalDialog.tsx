import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Search, Cross, Box, Skull, RotateCcw, Hash, User, ArrowRight, Calendar,
  MapPin, LayoutGrid,
} from "lucide-react";
import { busquedaService, type ResultadoBusqueda } from "./service";

/**
 * Dialog de búsqueda global con atajo de teclado Ctrl+F (o ⌘F en Mac).
 *
 * Se monta una sola vez en `App.tsx` y está disponible desde cualquier
 * pestaña. El atajo se intercepta con `preventDefault()` para evitar que
 * el navegador/Tauri abra su propio "Buscar en página".
 *
 * La búsqueda se comporta EXACTAMENTE igual que la del Inicio:
 *  - Mismos campos: titular, número de título, nombre de sepultado/exhumado.
 *  - Mismo debounce de 250ms.
 *  - Mismo límite de 25 por categoría.
 *  - Mismas categorías y presentación.
 */
export function BusquedaGlobalDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);

  // Atajo de teclado: Ctrl+F / ⌘F abre/cierra el dialog.
  // También maneja F como toggle si el usuario no usa modificador (poco común).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input/textarea y usa ⌘F
      // sin querer (en la mayoría de editores ⌘F es "buscar" así que está bien).
      const target = e.target as HTMLElement | null;
      const esInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      // Si el dialog está abierto y el usuario presiona Esc, dejarlo al
      // Radix Dialog que ya lo cierra por sí solo (onEscapeKeyDown).
      // Evitamos doble manejo.
      if (esInput && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        // opcional: navegar entre resultados con flechas. Dejado fuera para
        // no romper el comportamiento normal del input.
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Limpiar estado al cerrar
  useEffect(() => {
    if (!open) {
      // Pequeño delay para que no se vea el "vaciándose" al cerrar
      const id = setTimeout(() => {
        setBusqueda("");
        setResultados([]);
      }, 200);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Búsqueda con debounce (mismo que Inicio)
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const id = setTimeout(async () => {
      try {
        const r = await busquedaService.buscar(q, 25);
        setResultados(r);
      } catch (e) {
        console.error("[BusquedaGlobalDialog]", e);
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [busqueda]);

  const grouped = useMemo(() => {
    const out: Record<ResultadoBusqueda["tipo"], ResultadoBusqueda[]> = {
      "fosa-titular": [],
      "fosa-titulo": [],
      "gaveta-titular": [],
      "gaveta-titulo": [],
      sepultado: [],
      exhumado: [],
    };
    for (const r of resultados) out[r.tipo].push(r);
    return out;
  }, [resultados]);

  const totalResultados =
    grouped["fosa-titular"].length +
    grouped["fosa-titulo"].length +
    grouped["gaveta-titular"].length +
    grouped["gaveta-titulo"].length +
    grouped["sepultado"].length +
    grouped["exhumado"].length;

  const irA = (r: ResultadoBusqueda) => {
    const href = r.fosa_id
      ? `/fosas/${r.fosa_id}`
      : r.gaveta_id
        ? `/gavetas/${r.gaveta_id}`
        : null;
    if (href) {
      setOpen(false);
      navigate(href);
    }
  };

  // Detección de plataforma para mostrar el atajo correcto
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  const shortcutLabel = isMac ? "⌘F" : "Ctrl+F";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Búsqueda global
            <kbd className="ml-auto text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border">
              {shortcutLabel}
            </kbd>
          </DialogTitle>
          <DialogDescription>
            Busca por titular, número de título, o nombre de sepultado/exhumado.
            Funciona desde cualquier pestaña.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej. Eduardo Martínez, 1234, Juan Pérez…"
              className="pl-9 h-11 text-base"
            />
          </div>
        </div>

        <div className="px-6 pb-6 min-h-[120px]">
          {busqueda.trim().length < 2 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Escribe al menos 2 letras para buscar.
            </div>
          ) : buscando ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Buscando…
            </div>
          ) : totalResultados === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Sin resultados para "{busqueda}".
            </div>
          ) : (
            <div className="space-y-4">
              {/* Totales por categoría */}
              <div className="flex flex-wrap gap-2">
                {grouped["fosa-titular"].length > 0 && (
                  <Badge variant="info">
                    <Cross className="mr-1 h-3 w-3" />{" "}
                    {grouped["fosa-titular"].length} fosa(s) por titular
                  </Badge>
                )}
                {grouped["fosa-titulo"].length > 0 && (
                  <Badge variant="info">
                    <Hash className="mr-1 h-3 w-3" />{" "}
                    {grouped["fosa-titulo"].length} fosa(s) por título
                  </Badge>
                )}
                {grouped["gaveta-titular"].length > 0 && (
                  <Badge variant="info">
                    <Box className="mr-1 h-3 w-3" />{" "}
                    {grouped["gaveta-titular"].length} gaveta(s) por titular
                  </Badge>
                )}
                {grouped["gaveta-titulo"].length > 0 && (
                  <Badge variant="info">
                    <Hash className="mr-1 h-3 w-3" />{" "}
                    {grouped["gaveta-titulo"].length} gaveta(s) por título
                  </Badge>
                )}
                {grouped["sepultado"].length > 0 && (
                  <Badge variant="muted">
                    <Skull className="mr-1 h-3 w-3" />{" "}
                    {grouped["sepultado"].length} sepultado(s)
                  </Badge>
                )}
                {grouped["exhumado"].length > 0 && (
                  <Badge variant="muted">
                    <RotateCcw className="mr-1 h-3 w-3" />{" "}
                    {grouped["exhumado"].length} exhumado(s)
                  </Badge>
                )}
              </div>

              {/* Resultados por categoría */}
              {(
                [
                  "fosa-titular",
                  "fosa-titulo",
                  "gaveta-titular",
                  "gaveta-titulo",
                  "sepultado",
                  "exhumado",
                ] as const
              ).map((cat) => {
                if (grouped[cat].length === 0) return null;
                const titulosCat = {
                  "fosa-titular": "Fosas (titular coincide)",
                  "fosa-titulo": "Fosas (número de título coincide)",
                  "gaveta-titular": "Gavetas (titular coincide)",
                  "gaveta-titulo": "Gavetas (número de título coincide)",
                  sepultado: "Personas sepultadas",
                  exhumado: "Personas exhumadas",
                };
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                      {titulosCat[cat]}
                    </h3>
                    <div className="space-y-1">
                      {grouped[cat].map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => irA(r)}
                          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md border bg-card hover:bg-accent transition-colors group"
                        >
                          <ResultadoLinea r={r} />
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Versión "línea" (no card) de un resultado, para mostrarla dentro de
 * una lista compacta en el dialog. Replica la info del `ResultadoCard`
 * de Inicio pero en formato horizontal.
 */
function ResultadoLinea({ r }: { r: ResultadoBusqueda }) {
  const isFosa =
    r.tipo === "fosa-titular" ||
    r.tipo === "fosa-titulo" ||
    (r.tipo !== "gaveta-titular" &&
      r.tipo !== "gaveta-titulo" &&
      r.fosa_id != null);
  const iconByCat = {
    "fosa-titular": Cross,
    "fosa-titulo": Hash,
    "gaveta-titular": Box,
    "gaveta-titulo": Hash,
    sepultado: Skull,
    exhumado: RotateCcw,
  } as const;
  const Icon = iconByCat[r.tipo];
  const entidadLabel = isFosa ? "Fosa" : "Gaveta";
  const esMatchPorTitular =
    r.tipo === "fosa-titular" || r.tipo === "gaveta-titular";
  const esMatchPorTitulo =
    r.tipo === "fosa-titulo" || r.tipo === "gaveta-titulo";
  const esSepultado = r.tipo === "sepultado";
  const esExhumado = r.tipo === "exhumado";
  const mostrarTitular =
    !!r.extra?.titular_nombre &&
    (esMatchPorTitulo || esSepultado || esExhumado);
  const mostrarTitulo =
    !!r.extra?.numero_titulo && esMatchPorTitular;

  return (
    <>
      <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm truncate" title={r.nombre}>
            {r.nombre}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            · {entidadLabel} #{r.extra?.numero ?? "?"}
          </span>
        </div>
        {/* Línea 2: ubicación estructurada + titular */}
        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {r.extra?.seccion && (
            <span className="flex items-center gap-1">
              <LayoutGrid className="h-3 w-3" />
              <strong className="text-foreground/80">Sec:</strong>{" "}
              {r.extra.seccion}
            </span>
          )}
          {r.extra?.linea && (
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              <strong className="text-foreground/80">Lín:</strong>{" "}
              {r.extra.linea}
            </span>
          )}
          {r.extra?.panteon && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{r.extra.panteon}</span>
            </span>
          )}
        </div>
        {/* Línea 3: titular y/o N° de título */}
        {(mostrarTitular || mostrarTitulo) && (
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {mostrarTitular && (
              <span className="flex items-center gap-1 truncate">
                <User className="h-3 w-3" />
                <span className="truncate">Titular: {r.extra!.titular_nombre}</span>
              </span>
            )}
            {mostrarTitulo && (
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <strong className="text-foreground/80">N° título:</strong>{" "}
                {r.extra!.numero_titulo}
              </span>
            )}
          </div>
        )}
        {/* Línea 3: detalles por tipo */}
        {esSepultado && (r.extra?.fecha || r.extra?.fecha_fallecimiento || r.extra?.edad != null) && (
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 mt-0.5">
            {r.extra?.fecha && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Sepultación: <strong>{r.extra.fecha}</strong>
              </span>
            )}
            {r.extra?.fecha_fallecimiento && (
              <span className="flex items-center gap-1">
                <Skull className="h-3 w-3" />
                Fallecimiento: <strong>{r.extra.fecha_fallecimiento}</strong>
                {r.extra?.edad != null && ` (${r.extra.edad} años)`}
              </span>
            )}
            {!r.extra?.fecha_fallecimiento && r.extra?.edad != null && (
              <span className="flex items-center gap-1">
                <Skull className="h-3 w-3" />
                Edad: <strong>{r.extra.edad} años</strong>
              </span>
            )}
          </div>
        )}
        {esExhumado && (r.extra?.fecha || r.extra?.destino) && (
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 mt-0.5">
            {r.extra?.fecha && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Exhumación: <strong>{r.extra.fecha}</strong>
              </span>
            )}
            {r.extra?.destino && (
              <span className="flex items-center gap-1 truncate">
                <ArrowRight className="h-3 w-3" />
                Destino: <strong className="truncate">{r.extra.destino}</strong>
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
