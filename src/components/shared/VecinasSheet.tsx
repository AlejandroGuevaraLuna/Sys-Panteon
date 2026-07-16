import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, MapPin, LayoutGrid, Hash, Skull, Loader2, ExternalLink, ArrowRight,
} from "lucide-react";

/**
 * Estructura mínima que necesita el sheet para renderizar una vecina.
 * Ambos services (fosas y gavetas) la cumplen.
 */
export interface VecinaMinima {
  id: number;
  numero: string | number;
  titular_nombre: string;
  numero_titulo?: string;
  seccion_codigo?: string;
  seccion_nombre?: string;
  linea_codigo?: string;
  linea_nombre?: string;
  panteon_nombre?: string;
  sepultaciones: Array<{ id: number; nombre: string; fecha_sepultacion: string }>;
}

export interface VecinasSheetProps {
  /** Tipo para decidir la ruta al hacer click. */
  tipo: "fosa" | "gaveta";
  /** Etiqueta para el singular ("fosa" / "gaveta"). */
  etiqueta: string;
  /** ID de la entidad actual (para excluirla de los resultados). */
  entidadId: number;
  /** Estado abierto/cerrado controlado por el padre. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Función que devuelve las vecinas; se llama cada vez que se abre. */
  cargar: (id: number, rango?: number) => Promise<VecinaMinima[]>;
  /** Rango de "cercanía" (±N). Default 3. */
  rango?: number;
}

/**
 * Panel lateral (Sheet de shadcn) con las fosas/gavetas vecinas de la
 * entidad actual. Reutilizable para fosas y gavetas.
 *
 * Muestra de cada vecina:
 *  - Sección / Línea / N° de {fosa|gaveta}
 *  - Titular
 *  - N° de título
 *  - Lista de sepultados con su fecha
 */
export function VecinasSheet({
  tipo, etiqueta, entidadId, open, onOpenChange, cargar, rango = 3,
}: VecinasSheetProps) {
  const [vecinas, setVecinas] = useState<VecinaMinima[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVecinas(null);
    (async () => {
      try {
        const lista = await cargar(entidadId, rango);
        if (!cancelled) setVecinas(lista);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, entidadId, rango, cargar]);

  const irAVecina = (id: number) => {
    onOpenChange(false);
    navigate(`/${tipo === "fosa" ? "fosas" : "gavetas"}/${id}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1)}s vecinas
          </SheetTitle>
          <SheetDescription>
            En la misma sección, dentro de ±{rango} números. Misma línea implica
            misma sección y mismo panteón.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando vecinas…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              {error}
            </div>
          )}

          {!loading && !error && vecinas && vecinas.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              No hay {etiqueta}s vecinas dentro del rango de ±{rango}.
              <div className="text-xs mt-1">
                Esto puede pasar si la línea tiene pocos registros o si el número
                está en un extremo.
              </div>
            </div>
          )}

          {!loading && !error && vecinas && vecinas.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground">
                {vecinas.length} {etiqueta}
                {vecinas.length === 1 ? "" : "s"} encontrada{vecinas.length === 1 ? "" : "s"}:
              </div>
              {vecinas.map((v) => (
                <VecinaCard key={v.id} v={v} onOpen={irAVecina} tipo={tipo} />
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VecinaCard({
  v, onOpen, tipo,
}: {
  v: VecinaMinima;
  onOpen: (id: number) => void;
  tipo: "fosa" | "gaveta";
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 hover:shadow-sm transition-shadow">
      {/* Header: número + badge de tipo */}
      <div className="flex items-center justify-between gap-2">
        <Badge variant="info" className="text-sm">
          #{v.numero}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpen(v.id)}
          className="h-7 px-2 text-xs"
        >
          Abrir <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </div>

      {/* Titular */}
      <div className="text-sm">
        <span className="text-muted-foreground">Titular: </span>
        <span className="font-medium">
          {v.titular_nombre || <span className="text-muted-foreground italic">— sin titular —</span>}
        </span>
      </div>

      {/* N° de título */}
      {v.numero_titulo && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Hash className="h-3 w-3" />
          N° de título: <span className="font-mono">{v.numero_titulo}</span>
        </div>
      )}

      {/* Ubicación: Sección / Línea */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        {v.seccion_codigo && (
          <div className="flex items-center gap-1">
            <LayoutGrid className="h-3 w-3" />
            <span>
              <strong className="text-foreground/80">Sección:</strong>{" "}
              {v.seccion_codigo}
              {v.seccion_nombre ? ` — ${v.seccion_nombre}` : ""}
            </span>
          </div>
        )}
        {v.linea_codigo && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>
              <strong className="text-foreground/80">Línea:</strong>{" "}
              {v.linea_codigo}
              {v.linea_nombre ? ` — ${v.linea_nombre}` : ""}
            </span>
          </div>
        )}
        {v.panteon_nombre && (
          <div className="text-muted-foreground/80 truncate">
            {v.panteon_nombre}
          </div>
        )}
      </div>

      {/* Sepultados */}
      <div className="border-t pt-2 mt-2">
        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
          <Skull className="h-3 w-3" />
          Sepultados ({v.sepultaciones.length})
        </div>
        {v.sepultaciones.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            Sin sepultados registrados
          </div>
        ) : (
          <ul className="space-y-0.5">
            {v.sepultaciones.map((s) => (
              <li
                key={s.id}
                className="text-xs flex items-center gap-1.5 text-foreground/90"
              >
                <ArrowRight className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                <span className="truncate flex-1">{s.nombre}</span>
                <span className="text-muted-foreground font-mono text-[10px] flex-shrink-0">
                  {s.fecha_sepultacion}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
