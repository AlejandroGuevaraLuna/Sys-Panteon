import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { FileText, RefreshCcw, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { reportesService, type ReportePorServicio } from "./service";
import { formatCurrency, formatDate } from "@/lib/utils";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function Reportes() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [datos, setDatos] = useState<ReportePorServicio[]>([]);
  const [totales, setTotales] = useState({ anio: anioActual, count: 0, monto: 0 });
  const [cargando, setCargando] = useState(false);

  // Detalle expandido: { servicio_id, mes } -> Array
  const [detalle, setDetalle] = useState<null | {
    servicio_id: number; servicio_nombre: string; mes: number;
    items: Array<{
      id: number; folio: string;
      fecha_emision: string;
      solicitante_nombre: string;
      titular_coincide: number;
      monto: number;
      notas: string | null;
      fosa_id: number | null;
      gaveta_id: number | null;
      panteon_nombre: string | null;
      seccion_codigo: string | null;
      linea_codigo: string | null;
      fosa_numero: string | null;
      gaveta_numero: number | null;
    }>;
  }>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = async (a: number) => {
    setCargando(true);
    setDetalle(null);
    try {
      const [d, t] = await Promise.all([
        reportesService.anualPorServicios(a),
        reportesService.totalesAnio(a),
      ]);
      setDatos(d);
      setTotales(t);
    } catch (e) {
      console.error("[Reportes.cargar]", e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(anio); }, [anio]);

  const totalesPorMes = useMemo(() => {
    const out: Array<{ count: number; monto: number }> = [];
    for (let m = 1; m <= 12; m++) {
      let count = 0, monto = 0;
      for (const s of datos) {
        const cell = s.meses[m];
        count += cell.count;
        monto += cell.monto;
      }
      out.push({ count, monto });
    }
    return out;
  }, [datos]);

  const celdaClick = async (servicioId: number, servicioNombre: string, mes: number) => {
    if (datos.find((s) => s.servicio_id === servicioId)?.meses[mes].count === 0) return;
    setCargandoDetalle(true);
    setDetalle({ servicio_id: servicioId, servicio_nombre: servicioNombre, mes, items: [] });
    try {
      const items = await reportesService.detalleMensual(servicioId, mes, anio);
      setDetalle({ servicio_id: servicioId, servicio_nombre: servicioNombre, mes, items });
    } catch (e) {
      console.error("[Reportes.detalle]", e);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const closeDetalle = () => setDetalle(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7" /> Reportes mensuales
          </h1>
          <p className="text-muted-foreground">
            Conteo y monto de cada servicio, mes a mes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon"
            onClick={() => setAnio((a) => Math.max(anioActual - 10, a - 1))}
            aria-label="Año anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="h-9 px-3 rounded-md border bg-background font-mono text-base"
          >
            {Array.from({ length: 11 }, (_, i) => anioActual - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button
            variant="outline" size="icon"
            onClick={() => setAnio((a) => Math.min(anioActual, a + 1))}
            disabled={anio >= anioActual}
            aria-label="Año siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => cargar(anio)} aria-label="Refrescar">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Resumen del año */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Año</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{anio}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Servicios activos</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{datos.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Memorandums</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{totales.count}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monto total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-700">{formatCurrency(totales.monto)}</div></CardContent>
        </Card>
      </div>

      {/* Matriz por servicio × mes */}
      <Card>
        <CardHeader>
          <CardTitle>Matriz por servicio y mes</CardTitle>
          <CardDescription>
            Cada celda muestra el conteo de memorandums y, entre paréntesis, el monto total en pesos.
            Haz clic en una celda para ver el detalle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <p className="text-center py-10 text-muted-foreground">Cargando…</p>
          ) : datos.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">No hay servicios configurados.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Servicio</TableHead>
                    {MESES_CORTO.map((m, i) => (
                      <TableHead key={i} className="text-center w-20">{m}</TableHead>
                    ))}
                    <TableHead className="text-center w-28 bg-muted/50">Total año</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.map((s) => {
                    const totalCount = Object.values(s.meses).reduce((a, b) => a + b.count, 0);
                    const totalMonto = Object.values(s.meses).reduce((a, b) => a + b.monto, 0);
                    return (
                      <TableRow key={s.servicio_id}>
                        <TableCell className="sticky left-0 bg-background font-medium">
                          {s.servicio_nombre}
                        </TableCell>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                          const c = s.meses[m];
                          const empty = c.count === 0;
                          return (
                            <TableCell
                              key={m}
                              className={`text-center cursor-pointer hover:bg-accent transition-colors ${empty ? "text-muted-foreground/50" : ""}`}
                              onClick={() => celdaClick(s.servicio_id, s.servicio_nombre, m)}
                              title={`${s.servicio_nombre} — ${MESES[m-1]} ${anio}: ${c.count} memorandum(s), $${c.monto.toFixed(2)}`}
                            >
                              {c.count}
                              <span className="text-[10px] block text-muted-foreground">
                                ${c.monto.toFixed(0)}
                              </span>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center bg-muted/50 font-semibold">
                          {totalCount}
                          <span className="text-xs block text-muted-foreground">{formatCurrency(totalMonto)}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Fila de totales por mes */}
                  <TableRow className="border-t-2 border-primary/30 bg-muted/20">
                    <TableCell className="sticky left-0 bg-muted/20 font-bold">TOTAL GENERAL</TableCell>
                    {totalesPorMes.map((t, i) => (
                      <TableCell key={i} className="text-center font-bold">
                        {t.count}
                        <span className="text-xs block text-muted-foreground">${t.monto.toFixed(0)}</span>
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-primary/10">
                      {totales.count}
                      <span className="text-xs block text-muted-foreground">{formatCurrency(totales.monto)}</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle de celda */}
      {detalle && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                Detalle — {detalle.servicio_nombre} · {MESES[detalle.mes - 1]} {anio}
              </CardTitle>
              <CardDescription>
                {detalle.items.length} memorandum(s) emitidos en ese mes.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={closeDetalle}>Cerrar</Button>
          </CardHeader>
          <CardContent>
            {cargandoDetalle ? (
              <p className="text-center py-6 text-muted-foreground">Cargando detalle…</p>
            ) : detalle.items.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">Sin memorandums en ese periodo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Coincide</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.items.map((it) => {
                    const hrefF = it.fosa_id ? `/fosas/${it.fosa_id}` : it.gaveta_id ? `/gavetas/${it.gaveta_id}` : null;
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono font-semibold">{it.folio}</TableCell>
                        <TableCell>{formatDate(it.fecha_emision)}</TableCell>
                        <TableCell>{it.solicitante_nombre}</TableCell>
                        <TableCell className="text-sm">
                          {hrefF ? (
                            <Link to={hrefF} className="text-primary hover:underline">
                              {it.panteon_nombre || "—"} · Sec {it.seccion_codigo || "?"} · Lín {it.linea_codigo || "?"} ·{" "}
                              {it.fosa_id ? `Fosa #${it.fosa_numero}` : `Gav #${it.gaveta_numero}`}
                            </Link>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {it.titular_coincide === 1 ? (
                            <Badge variant="success">Sí</Badge>
                          ) : (
                            <Badge variant="warning">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(it.monto)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={it.notas ?? ""}>
                          {it.notas || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
