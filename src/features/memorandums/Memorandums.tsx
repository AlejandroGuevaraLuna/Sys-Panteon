import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { ScrollText, Trash2, AlertTriangle, Download, Filter, Search, X, Hash, Calendar } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { memorandumsService, type MemorandumListado } from "./service";
import { serviciosService } from "@/features/servicios/service";
import { authService } from "@/features/auth/service";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Servicio } from "@/types";
import type { UsuarioSesion } from "@/lib/auth";

/** Paleta de colores para resaltar el emisor (un color por usuario). */
const COLORES_EMISOR: { bg: string; border: string; text: string; badge: string }[] = [
  { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-800",    badge: "bg-blue-100 text-blue-800 border-blue-200" },
  { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-800", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { bg: "bg-amber-50",   border: "border-l-amber-500",   text: "text-amber-800",   badge: "bg-amber-100 text-amber-800 border-amber-200" },
  { bg: "bg-violet-50",  border: "border-l-violet-500",  text: "text-violet-800",  badge: "bg-violet-100 text-violet-800 border-violet-200" },
  { bg: "bg-rose-50",    border: "border-l-rose-500",    text: "text-rose-800",    badge: "bg-rose-100 text-rose-800 border-rose-200" },
  { bg: "bg-cyan-50",    border: "border-l-cyan-500",    text: "text-cyan-800",    badge: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { bg: "bg-orange-50",  border: "border-l-orange-500",  text: "text-orange-800",  badge: "bg-orange-100 text-orange-800 border-orange-200" },
  { bg: "bg-fuchsia-50", border: "border-l-fuchsia-500", text: "text-fuchsia-800", badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200" },
];
const COLOR_POR_DEFECTO = { bg: "", border: "border-l-muted", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground border-muted" };

function hashUsername(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface TablaProps {
  items: MemorandumListado[];
  colorPorUsuarioId: Map<number, typeof COLORES_EMISOR[number]>;
  descargar: (m: MemorandumListado) => void;
  onEliminar: (m: MemorandumListado) => void;
}

function TablaMemorandums({ items, colorPorUsuarioId, descargar, onEliminar }: TablaProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Folio</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Servicio</TableHead>
          <TableHead>Entidad</TableHead>
          <TableHead>Ubicación</TableHead>
          <TableHead>Solicitante</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Emitido por</TableHead>
          <TableHead>Coincide</TableHead>
          <TableHead className="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((m) => {
          const color = m.created_by_user_id != null && colorPorUsuarioId.has(m.created_by_user_id)
            ? colorPorUsuarioId.get(m.created_by_user_id)!
            : (m.emitido_por_username
                ? COLORES_EMISOR[hashUsername(m.emitido_por_username) % COLORES_EMISOR.length]
                : COLOR_POR_DEFECTO);
          return (
            <TableRow
              key={m.id}
              className={`${color.bg} ${color.border} border-l-4`}
            >
              <TableCell className="font-mono font-semibold">{m.folio}</TableCell>
              <TableCell>{formatDate(m.fecha_emision)}</TableCell>
              <TableCell><Badge variant="info">{m.servicio_nombre}</Badge></TableCell>
              <TableCell>
                {m.entidad_tipo === "fosa" && `#${m.fosa_numero}`}
                {m.entidad_tipo === "gaveta" && `Gav. #${m.gaveta_numero}`}
                {!m.entidad_tipo && <span className="text-muted-foreground italic">—</span>}
              </TableCell>
              <TableCell className="text-xs">
                <div className="font-medium">{m.panteon_nombre || "—"}</div>
                <div className="text-muted-foreground">
                  Sec {m.seccion_codigo || "?"} · Lín {m.linea_codigo || "?"}
                </div>
              </TableCell>
              <TableCell className="text-sm">{m.solicitante_nombre}</TableCell>
              <TableCell className="font-semibold">{formatCurrency(m.monto)}</TableCell>
              <TableCell className="text-xs">
                {m.emitido_por
                  ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${color.badge}`}>
                      <span className="font-medium">{m.emitido_por}</span>
                      {m.emitido_por_username && (
                        <span className="opacity-75">@{m.emitido_por_username}</span>
                      )}
                    </span>
                  )
                  : <span className="text-muted-foreground italic">—</span>}
              </TableCell>
              <TableCell>
                {m.titular_coincide === 1 ? (
                  <Badge variant="success">Coincide</Badge>
                ) : (
                  <Badge variant="warning" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Diferente
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => descargar(m)} title="Descargar PDF">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEliminar(m)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function Memorandums() {
  const [items, setItems] = useState<MemorandumListado[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSesion[]>([]);
  const [filtroServicio, setFiltroServicio] = useState<string>("");
  const [filtroUsuario, setFiltroUsuario] = useState<string>("");
  const [busqueda, setBusqueda] = useState<string>("");
  const [del, setDel] = useState<MemorandumListado | null>(null);

  const cargar = async () => {
    const [memos, srvs, usrs] = await Promise.all([
      memorandumsService.listar(),
      serviciosService.listar(),
      authService.listarTodos().catch(() => []),
    ]);
    setItems(memos);
    setServicios(srvs);
    setUsuarios(usrs);
  };
  useEffect(() => { cargar(); }, []);

  const itemsFiltrados = useMemo(() => {
    let arr = items;
    if (filtroServicio) {
      arr = arr.filter((m) => m.servicio_id === Number(filtroServicio));
    }
    if (filtroUsuario) {
      arr = arr.filter((m) => m.created_by_user_id === Number(filtroUsuario));
    }
    const q = busqueda.trim().toLowerCase();
    if (q) {
      arr = arr.filter((m) => {
        const campos = [
          m.folio,
          m.solicitante_nombre,
          m.panteon_nombre,
        ];
        return campos.some((c) => c && c.toLowerCase().includes(q));
      });
    }
    return arr;
  }, [items, filtroServicio, filtroUsuario, busqueda]);

  const servicioSeleccionado = servicios.find((s) => s.id === Number(filtroServicio));
  const usuarioSeleccionado = usuarios.find((u) => u.id === Number(filtroUsuario));
  const filtrosActivos =
    !!filtroServicio || !!filtroUsuario || !!busqueda.trim();

  /**
   * Paleta de colores para identificar visualmente al emisor de cada
   * memorandum. Es determinística: el mismo username siempre obtiene
   * el mismo color, sin importar el orden ni la cantidad de usuarios.
   */
  const COLORES_USUARIO: { bg: string; border: string; text: string; badge: string }[] = [
    { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-800",    badge: "bg-blue-100 text-blue-800 border-blue-200" },
    { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-800", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    { bg: "bg-amber-50",   border: "border-l-amber-500",   text: "text-amber-800",   badge: "bg-amber-100 text-amber-800 border-amber-200" },
    { bg: "bg-violet-50",  border: "border-l-violet-500",  text: "text-violet-800",  badge: "bg-violet-100 text-violet-800 border-violet-200" },
    { bg: "bg-rose-50",    border: "border-l-rose-500",    text: "text-rose-800",    badge: "bg-rose-100 text-rose-800 border-rose-200" },
    { bg: "bg-cyan-50",    border: "border-l-cyan-500",    text: "text-cyan-800",    badge: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    { bg: "bg-orange-50",  border: "border-l-orange-500",  text: "text-orange-800",  badge: "bg-orange-100 text-orange-800 border-orange-200" },
    { bg: "bg-fuchsia-50", border: "border-l-fuchsia-500", text: "text-fuchsia-800", badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200" },
  ];
  function hashUsername(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  const colorPorUsuarioId = useMemo(() => {
    const map = new Map<number, typeof COLORES_USUARIO[number]>();
    usuarios.forEach((u, idx) => {
      map.set(u.id, COLORES_USUARIO[idx % COLORES_USUARIO.length]);
    });
    return map;
  }, [usuarios]);
  const colorParaEmitente = (
    userId: number | null | undefined,
    username: string | null | undefined,
  ) => {
    if (userId != null && colorPorUsuarioId.has(userId)) {
      return colorPorUsuarioId.get(userId)!;
    }
    if (username) return COLORES_USUARIO[hashUsername(username) % COLORES_USUARIO.length];
    return { bg: "", border: "border-l-muted", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" };
  };

  // Orden alternativo por número de folio (extrae los últimos 4 dígitos)
  const itemsPorFolio = useMemo(() => {
    return [...itemsFiltrados].sort((a, b) => {
      const na = parseInt((a.folio.match(/(\d+)$/)?.[1] ?? "0"), 10);
      const nb = parseInt((b.folio.match(/(\d+)$/)?.[1] ?? "0"), 10);
      if (na !== nb) return nb - na; // descendente por número
      return (b.id - a.id);
    });
  }, [itemsFiltrados]);

  /**
   * Genera un PDF on-demand para la fila de listado.
   */
  const descargar = async (m: MemorandumListado) => {
    try {
      const { generarMemorandumPDF } = await import("./pdf");
      const { fosasService } = await import("@/features/fosas/service");
      const { gavetasService } = await import("@/features/gavetas/service");
      const detalle = await memorandumsService.obtener(m.id);
      if (!detalle) { alert("No se pudo cargar el memorandum"); return; }
      // Cargamos la fosa/gaveta real para tener los datos de superficie
      // (ancho/alto) y el TITULAR real (no el solicitante). Sin esto, el
      // PDF de la lista siempre mostraría "—" en la superficie amparada
      // y el titular en el segundo párrafo sería incorrecto.
      let ent: Record<string, unknown> | null = null;
      if (m.fosa_id) {
        ent = (await fosasService.obtenerDetalle(m.fosa_id)) as unknown as Record<string, unknown> | null;
      } else if (m.gaveta_id) {
        ent = (await gavetasService.obtenerDetalle(m.gaveta_id)) as unknown as Record<string, unknown> | null;
      }
      // El TITULAR es el dueño de la fosa/gaveta (de la entidad real).
      // El SOLICITANTE es quien está haciendo el trámite y se muestra
      // en el primer párrafo. No deben mezclarse.
      const titularReal = String(ent?.titular_nombre ?? "").trim();
      const ctx = {
        ...(m.fosa_numero ? { numero: m.fosa_numero } : {}),
        ...(m.gaveta_numero ? { numero: m.gaveta_numero } : {}),
        seccion_codigo: m.seccion_codigo,
        linea_codigo: m.linea_codigo,
        panteon_nombre: m.panteon_nombre,
        titular_nombre: titularReal,
        libro: "", registro: "", titular_domicilio: "", titular_telefono: "",
        numero_titulo: "", fecha_titulo: null,
        // Superficie: viene de la fosa/gaveta real, o "" si no hay
        // entidad o no se pudieron cargar los datos.
        superficie_ancho: ent?.superficie_ancho ?? "",
        superficie_alto: ent?.superficie_alto ?? "",
        beneficiario: "",
      };
      const doc = generarMemorandumPDF({
        memorandum: {
          ...detalle,
          fosa_panteon_nombre: m.panteon_nombre ?? "—",
          // El detalle de `obtener()` ya incluye `servicio_tipo` (lo
          // inyectamos desde la tabla `servicios` por si el memo quedó
          // sin el JOIN del listado). También incluye `cambio_titular`
          // cuando es TRASPASO, que es lo que el PDF necesita para
          // invertir el orden del texto.
          servicio_nombre: m.servicio_nombre ?? "Servicio",
          servicio_tipo: (detalle.servicio_tipo ?? m.servicio_tipo ?? "OTRO") as never,
        } as never,
        fosa: m.fosa_id ? (ctx as never) : null,
        gaveta: m.gaveta_id ? (ctx as never) : null,
        panteon: null,
        config: {
          panteon_activo_id: null, logo_path: null,
          pie_pagina: "", ciudad: "", color_primario: "",
          memo_folio_inicial: 1,
        },
      });
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${m.folio}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("No se pudo regenerar el PDF: " + (e as Error).message);
    }
  };

  const eliminar = async () => {
    if (!del) return;
    await memorandumsService.eliminar(del.id);
    setDel(null);
    cargar();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ScrollText className="h-7 w-7" /> Memorandums emitidos
          </h1>
          <p className="text-muted-foreground">
            Historial de todos los memorandums generados en el sistema.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[220px] flex-1 max-w-md">
              <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" /> Buscar (folio, solicitante, panteón)
              </label>
              <div className="relative mt-1">
                <Input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Ej: 0090, Juan, Pabellón…"
                  className="pr-9"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="min-w-[200px]">
              <label className="text-sm text-muted-foreground">Servicio</label>
              <select
                className="w-full h-10 px-3 mt-1 rounded-md border bg-background text-base"
                value={filtroServicio}
                onChange={(e) => setFiltroServicio(e.target.value)}
              >
                <option value="">Todos los servicios</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px]">
              <label className="text-sm text-muted-foreground">Emitido por</label>
              <select
                className="w-full h-10 px-3 mt-1 rounded-md border bg-background text-base"
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
              >
                <option value="">Todos los usuarios</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} (@{u.username})
                  </option>
                ))}
              </select>
            </div>
            {filtrosActivos && (
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  setBusqueda("");
                  setFiltroServicio("");
                  setFiltroUsuario("");
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumen de filtros activos */}
      {(servicioSeleccionado || usuarioSeleccionado || busqueda.trim()) && (
        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5" />
          <span>Filtrado por:</span>
          {busqueda.trim() && (
            <Badge variant="info">Búsqueda: "{busqueda.trim()}"</Badge>
          )}
          {servicioSeleccionado && (
            <Badge variant="info">Servicio: {servicioSeleccionado.nombre}</Badge>
          )}
          {usuarioSeleccionado && (
            <Badge variant="info">Emitido por: {usuarioSeleccionado.nombre} (@{usuarioSeleccionado.username})</Badge>
          )}
          <span>({itemsFiltrados.length} resultado{itemsFiltrados.length !== 1 ? "s" : ""})</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Total: {itemsFiltrados.length}
            {filtroServicio || filtroUsuario || busqueda.trim()
              ? <span className="text-muted-foreground text-base font-normal"> (de {items.length})</span>
              : null}
          </CardTitle>
          <CardDescription>
            Cada fila se colorea según el usuario que emitió el memorandum.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itemsFiltrados.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ScrollText className="mx-auto h-10 w-10 mb-2 opacity-40" />
              {filtrosActivos
                ? <p>No hay memorandums que coincidan con los filtros.</p>
                : <p>No hay memorandums emitidos aún.</p>}
              {!filtrosActivos && (
                <p className="text-sm mt-2">Pulsa "Nuevo memorandum" para emitir el primero.</p>
              )}
            </div>
          ) : (
            <Tabs defaultValue="fecha" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="fecha" className="gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Por fecha
                </TabsTrigger>
                <TabsTrigger value="folio" className="gap-1.5">
                  <Hash className="h-3.5 w-3.5" /> Por folio
                </TabsTrigger>
              </TabsList>
              <TabsContent value="fecha" className="mt-3">
                <TablaMemorandums
                  items={itemsFiltrados}
                  colorPorUsuarioId={colorPorUsuarioId}
                  descargar={descargar}
                  onEliminar={setDel}
                />
              </TabsContent>
              <TabsContent value="folio" className="mt-3">
                <TablaMemorandums
                  items={itemsPorFolio}
                  colorPorUsuarioId={colorPorUsuarioId}
                  descargar={descargar}
                  onEliminar={setDel}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar memorandum?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el registro <strong>{del?.folio}</strong>.
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
