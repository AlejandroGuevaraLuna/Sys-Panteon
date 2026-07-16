import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Cross,
  ScrollText,
  MapPin,
  LayoutGrid,
  Box,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Receipt,
  Wrench,
  Search,
  User,
  Skull,
  RotateCcw,
  FileText,
  Hash,
  ArrowRight,
  Minus,
} from 'lucide-react';
import { fosasService } from '@/features/fosas/service';
import { panteonesService } from '@/features/panteones/service';
import { seccionesService } from '@/features/secciones/service';
import { lineasService } from '@/features/lineas/service';
import { memorandumsService } from '@/features/memorandums/service';
import {
  busquedaService,
  type ResultadoBusqueda,
} from '@/features/busqueda/service';
import { formatCurrency } from '@/lib/utils';

const MESES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];
const MESES_COMPLETO = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

interface ResumenMes {
  mes: number;
  anio: number;
  totalCount: number;
  totalMonto: number;
  porServicio: Array<{
    servicio_id: number;
    servicio_nombre: string;
    count: number;
    monto: number;
  }>;
}

export default function Inicio() {
  const [stats, setStats] = useState({
    panteones: 0,
    secciones: 0,
    lineas: 0,
    fosas: 0,
    gavetas: 0,
    gavetasConTitular: 0,
    memorandums: 0,
    memoAnio: 0,
    memoMonto: 0,
  });

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [ultimoAnio, setUltimoAnio] = useState(new Date().getFullYear());
  const [resumenMes, setResumenMes] = useState<ResumenMes | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [fosas, panteones, secciones, lineas, memos] = await Promise.all([
          fosasService.listar(),
          panteonesService.listar(),
          seccionesService.listar(),
          lineasService.listar(),
          memorandumsService.listar(),
        ]);
        const gavetasTodas = await import('@/features/gavetas/service')
          .then((m) => m.gavetasService.listar())
          .catch(() => []);
        const gavetasConTitular = gavetasTodas.filter(
          (g) => g.titular_nombre,
        ).length;

        // Memorandos del año actual
        const anioActual = new Date().getFullYear();
        const memoAnio = memos.filter((m) =>
          m.fecha_emision?.startsWith(String(anioActual)),
        ).length;
        const memoMonto = memos
          .filter((m) => m.fecha_emision?.startsWith(String(anioActual)))
          .reduce((acc, m) => acc + (m.monto ?? 0), 0);

        // Resumen del mes actual (por servicio)
        const hoy = new Date();
        const mesActual = hoy.getMonth() + 1; // 1-12
        const memosMesActual = memos.filter((m) => {
          const d = (m.fecha_emision ?? '').slice(0, 7); // "YYYY-MM"
          return d === `${anioActual}-${String(mesActual).padStart(2, '0')}`;
        });
        const porServicioMap = new Map<
          number,
          { nombre: string; count: number; monto: number }
        >();
        for (const m of memosMesActual) {
          const cur = porServicioMap.get(m.servicio_id) ?? {
            nombre: m.servicio_nombre,
            count: 0,
            monto: 0,
          };
          cur.count += 1;
          cur.monto += m.monto ?? 0;
          porServicioMap.set(m.servicio_id, cur);
        }
        const porServicio = Array.from(porServicioMap.entries())
          .map(([servicio_id, v]) => ({
            servicio_id,
            servicio_nombre: v.nombre,
            count: v.count,
            monto: v.monto,
          }))
          .sort((a, b) => b.monto - a.monto);
        setResumenMes({
          mes: mesActual,
          anio: anioActual,
          totalCount: memosMesActual.length,
          totalMonto: memosMesActual.reduce(
            (acc, m) => acc + (m.monto ?? 0),
            0,
          ),
          porServicio,
        });

        setStats({
          panteones: panteones.filter((p) => p.activo).length,
          secciones: secciones.filter((s) => s.activo).length,
          lineas: lineas.filter((l) => l.activo).length,
          fosas: fosas.length,
          gavetas: gavetasTodas.length,
          gavetasConTitular,
          memorandums: memos.length,
          memoAnio,
          memoMonto,
        });
      } catch (e) {
        console.error('[Inicio] ERROR cargando stats:', e);
      }
    })();
  }, []);

  // Búsqueda con debounce
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
        console.error('[Inicio.buscar]', e);
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [busqueda]);

  const grouped = useMemo(() => {
    const out: Record<ResultadoBusqueda['tipo'], ResultadoBusqueda[]> = {
      'fosa-titular': [],
      'fosa-titulo': [],
      'gaveta-titular': [],
      'gaveta-titulo': [],
      sepultado: [],
      exhumado: [],
    };
    for (const r of resultados) out[r.tipo].push(r);
    return out;
  }, [resultados]);

  const totalResultados =
    grouped['fosa-titular'].length +
    grouped['fosa-titulo'].length +
    grouped['gaveta-titular'].length +
    grouped['gaveta-titulo'].length +
    grouped['sepultado'].length +
    grouped['exhumado'].length;

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Panel principal</h1>
        <p className='text-muted-foreground'>
          Buscador global y resumen del panteón.
        </p>
      </div>

      {/* ============== Buscador ============== */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Search className='h-4 w-4' />
            Búsqueda global
          </CardTitle>
          <CardDescription>
            Busca por nombre del titular de una fosa/gaveta, por número de
            título, o por nombre de personas sepultadas o exhumadas.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder='Ej. Eduardo Martiez, Juan Pérez, etc.'
              className='pl-9 h-11 text-base'
            />
          </div>

          {busqueda.trim().length < 2 ? (
            <p className='text-sm text-muted-foreground'>
              Escribe al menos 2 letras para buscar.
            </p>
          ) : buscando ? (
            <p className='text-sm text-muted-foreground'>Buscando…</p>
          ) : totalResultados === 0 ? (
            <p className='text-sm text-muted-foreground'>
              Sin resultados para "{busqueda}".
            </p>
          ) : (
            <div className='space-y-6'>
              {/* Totales por categoría */}
              <div className='flex flex-wrap gap-2'>
                {grouped['fosa-titular'].length > 0 && (
                  <Badge variant='info'>
                    <Cross className='mr-1 h-3 w-3' />{' '}
                    {grouped['fosa-titular'].length} fosa(s) por titular
                  </Badge>
                )}
                {grouped['fosa-titulo'].length > 0 && (
                  <Badge variant='info'>
                    <Hash className='mr-1 h-3 w-3' />{' '}
                    {grouped['fosa-titulo'].length} fosa(s) por título
                  </Badge>
                )}
                {grouped['gaveta-titular'].length > 0 && (
                  <Badge variant='info'>
                    <Box className='mr-1 h-3 w-3' />{' '}
                    {grouped['gaveta-titular'].length} gaveta(s) por titular
                  </Badge>
                )}
                {grouped['gaveta-titulo'].length > 0 && (
                  <Badge variant='info'>
                    <Hash className='mr-1 h-3 w-3' />{' '}
                    {grouped['gaveta-titulo'].length} gaveta(s) por título
                  </Badge>
                )}
                {grouped['sepultado'].length > 0 && (
                  <Badge variant='muted'>
                    <Skull className='mr-1 h-3 w-3' />{' '}
                    {grouped['sepultado'].length} sepultado(s)
                  </Badge>
                )}
                {grouped['exhumado'].length > 0 && (
                  <Badge variant='muted'>
                    <RotateCcw className='mr-1 h-3 w-3' />{' '}
                    {grouped['exhumado'].length} exhumado(s)
                  </Badge>
                )}
              </div>

              {/* ============= CARDS ============= */}
              {(
                [
                  'fosa-titular',
                  'fosa-titulo',
                  'gaveta-titular',
                  'gaveta-titulo',
                  'sepultado',
                  'exhumado',
                ] as const
              ).map((cat) => {
                if (grouped[cat].length === 0) return null;
                const titulos = {
                  'fosa-titular': 'Fosas (titular coincide)',
                  'fosa-titulo': 'Fosas (número de título coincide)',
                  'gaveta-titular': 'Gavetas (titular coincide)',
                  'gaveta-titulo': 'Gavetas (número de título coincide)',
                  sepultado: 'Personas sepultadas',
                  exhumado: 'Personas exhumadas',
                };
                return (
                  <div key={cat}>
                    <h3 className='text-sm font-semibold text-muted-foreground mb-2'>
                      {titulos[cat]}
                    </h3>
                    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                      {grouped[cat].map((r, i) => (
                        <ResultadoCard
                          key={i}
                          r={r}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============== Resumen del mes ============== */}
      {resumenMes && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Calendar className='h-5 w-5' /> Resumen de{' '}
              {MESES_COMPLETO[resumenMes.mes - 1]} {resumenMes.anio}
            </CardTitle>
            <CardDescription>
              Servicios emitidos durante el mes en curso.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Totales del mes */}
            <div className='grid gap-3 sm:grid-cols-3'>
              <div className='rounded-lg border bg-muted/40 p-4'>
                <div className='text-sm text-muted-foreground flex items-center gap-1'>
                  <Receipt className='h-3.5 w-3.5' /> Memorandums
                </div>
                <div className='text-3xl font-bold mt-1'>
                  {resumenMes.totalCount}
                </div>
              </div>
              <div className='rounded-lg border bg-emerald-50 p-4'>
                <div className='text-sm text-emerald-700 flex items-center gap-1'>
                  <TrendingUp className='h-3.5 w-3.5' /> Monto total
                </div>
                <div className='text-3xl font-bold text-emerald-700 mt-1'>
                  {formatCurrency(resumenMes.totalMonto)}
                </div>
              </div>
              <div className='rounded-lg border bg-blue-50 p-4'>
                <div className='text-sm text-blue-700 flex items-center gap-1'>
                  <Wrench className='h-3.5 w-3.5' /> Servicios distintos
                </div>
                <div className='text-3xl font-bold text-blue-700 mt-1'>
                  {resumenMes.porServicio.length}
                </div>
              </div>
            </div>

            {/* Breakdown por servicio */}
            {resumenMes.porServicio.length === 0 ? (
              <div className='text-center py-4 text-muted-foreground text-sm'>
                Aún no se han emitido memorandums en{' '}
                {MESES_COMPLETO[resumenMes.mes - 1]}.
              </div>
            ) : (
              <div className='space-y-2'>
                <h3 className='text-sm font-semibold text-muted-foreground'>
                  Por servicio
                </h3>
                <div className='space-y-1.5'>
                  {resumenMes.porServicio.map((s) => {
                    const pct =
                      resumenMes.totalMonto > 0
                        ? Math.round((s.monto / resumenMes.totalMonto) * 100)
                        : 0;
                    return (
                      <div
                        key={s.servicio_id}
                        className='flex items-center gap-3'
                      >
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center justify-between gap-2 mb-0.5'>
                            <span
                              className='text-sm font-medium truncate'
                              title={s.servicio_nombre}
                            >
                              {s.servicio_nombre}
                            </span>
                            <span className='text-xs text-muted-foreground flex-shrink-0'>
                              {s.count} · {formatCurrency(s.monto)}
                            </span>
                          </div>
                          <div className='h-2 w-full bg-muted rounded overflow-hidden'>
                            <div
                              className='h-full bg-primary/70 transition-all'
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className='text-xs text-muted-foreground w-10 text-right'>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Button
                  asChild
                  variant='link'
                  size='sm'
                  className='px-0 text-sm'
                >
                  <Link to={`/reportes`}>Ver reporte completo →</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============== Stats ============== */}
      <div className='grid gap-4 md:grid-cols-3 lg:grid-cols-5'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium flex items-center gap-1'>
              <MapPin className='h-3 w-3' /> Panteones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.panteones}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium flex items-center gap-1'>
              <LayoutGrid className='h-3 w-3' /> Secciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.secciones}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>Líneas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.lineas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium flex items-center gap-1'>
              <Cross className='h-3 w-3' /> Fosas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.fosas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium flex items-center gap-1'>
              <Box className='h-3 w-3' /> Gavetas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.gavetasConTitular}
              <span className='text-base text-muted-foreground'>
                /{stats.gavetas}
              </span>
            </div>
            <p className='text-xs text-muted-foreground'>Con titular / total</p>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Actividad del año {ultimoAnio}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <ScrollText className='h-4 w-4 text-muted-foreground' />
                <span>Memorandums emitidos</span>
              </div>
              <Badge variant='info'>{stats.memoAnio}</Badge>
            </div>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <FileText className='h-4 w-4 text-muted-foreground' />
                <span>Monto total emitido</span>
              </div>
              <Badge variant='success'>{formatCurrency(stats.memoMonto)}</Badge>
            </div>
            <Button
              asChild
              variant='outline'
              size='sm'
              className='mt-2 w-full'
            >
              <Link to='/reportes'>Ver reportes mensuales →</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-2'>
            <Button
              asChild
              variant='outline'
              className='justify-start'
            >
              <Link to='/panteones'>
                <MapPin className='mr-2 h-4 w-4' /> Panteones
              </Link>
            </Button>
            <Button
              asChild
              variant='outline'
              className='justify-start'
            >
              <Link to='/memorandums'>
                <ScrollText className='mr-2 h-4 w-4' /> Historial de memorandums
              </Link>
            </Button>
            <Button
              asChild
              variant='outline'
              className='justify-start'
            >
              <Link to='/reportes'>
                <FileText className='mr-2 h-4 w-4' /> Reportes mensuales
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResultadoCard({ r }: { r: ResultadoBusqueda }) {
  const isFosa =
    r.tipo === 'fosa-titular' ||
    r.tipo === 'fosa-titulo' ||
    (r.tipo !== 'gaveta-titular' &&
      r.tipo !== 'gaveta-titulo' &&
      r.fosa_id != null);
  const href = r.fosa_id
    ? `/fosas/${r.fosa_id}`
    : r.gaveta_id
      ? `/gavetas/${r.gaveta_id}`
      : '/';
  const iconByCat = {
    'fosa-titular': Cross,
    'fosa-titulo': Hash,
    'gaveta-titular': Box,
    'gaveta-titulo': Hash,
    sepultado: Skull,
    exhumado: RotateCcw,
  } as const;
  const Icon = iconByCat[r.tipo];
  const entidadLabel = isFosa ? 'Fosa' : 'Gaveta';
  // Para matches por titular, mostramos también el N° de título si existe.
  // Para matches por título, mostramos el titular si existe.
  const esMatchPorTitular =
    r.tipo === 'fosa-titular' || r.tipo === 'gaveta-titular';
  const esMatchPorTitulo =
    r.tipo === 'fosa-titulo' || r.tipo === 'gaveta-titulo';
  const esSepultado = r.tipo === 'sepultado';
  const esExhumado = r.tipo === 'exhumado';
  const mostrarTitular =
    !!r.extra?.titular_nombre &&
    (esMatchPorTitulo || esSepultado || esExhumado);
  const mostrarTitulo =
    !!r.extra?.numero_titulo && esMatchPorTitular;

  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardContent className='pt-4 pb-4 space-y-2'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex items-center gap-2 min-w-0 flex-1'>
            <Icon className='h-4 w-4 flex-shrink-0 text-muted-foreground' />
            <span
              className='font-semibold text-base truncate'
              title={r.nombre}
            >
              {r.nombre}
            </span>
          </div>
          <Badge variant='info'>
            {entidadLabel} #{r.extra?.numero ?? '?'}
          </Badge>
        </div>
        {mostrarTitular && (
          <div className='text-xs text-muted-foreground flex items-center gap-1'>
            <User className='h-3 w-3' />
            <span className='truncate'>
              Titular: {r.extra!.titular_nombre}
            </span>
          </div>
        )}
        {mostrarTitulo && (
          <div className='text-xs text-muted-foreground flex items-center gap-1'>
            <Hash className='h-3 w-3' />
            <span className='truncate'>
              N° de título: {r.extra!.numero_titulo}
            </span>
          </div>
        )}

        {/* Ubicación: SIEMPRE visible en TODAS las cards (cuando hay datos) */}
        {(r.extra?.panteon ||
          r.extra?.seccion ||
          r.extra?.linea ||
          r.extra?.numero != null) && (
          <div className='text-xs border-t pt-2 space-y-0.5'>
            {r.extra?.panteon && (
              <div className='flex items-baseline gap-1.5'>
                <MapPin className='h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground' />
                <span className='truncate'>
                  <strong className='text-foreground/80'>Panteón:</strong>{" "}
                  {r.extra.panteon}
                </span>
              </div>
            )}
            {r.extra?.seccion && (
              <div className='flex items-baseline gap-1.5'>
                <LayoutGrid className='h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground' />
                <span className='truncate'>
                  <strong className='text-foreground/80'>Sección:</strong>{" "}
                  {r.extra.seccion}
                </span>
              </div>
            )}
            {r.extra?.linea && (
              <div className='flex items-baseline gap-1.5'>
                <Minus className='h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground' />
                <span className='truncate'>
                  <strong className='text-foreground/80'>Línea:</strong>{" "}
                  {r.extra.linea}
                </span>
              </div>
            )}
            {r.extra?.numero != null && (
              <div className='flex items-baseline gap-1.5'>
                <Hash className='h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground' />
                <span>
                  <strong className='text-foreground/80'>
                    N° de {entidadLabel}:
                  </strong>{" "}
                  #{r.extra.numero}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Detalles específicos para SEPULTADO */}
        {esSepultado && (r.extra?.fecha || r.extra?.fecha_fallecimiento || r.extra?.edad || r.extra?.notas) && (
          <div className='text-xs text-muted-foreground border-t pt-2 space-y-1'>
            {r.extra?.fecha && (
              <div className='flex items-center gap-1'>
                <Calendar className='h-3 w-3' />
                <span>
                  <strong>Sepultación:</strong> {r.extra.fecha}
                </span>
              </div>
            )}
            {r.extra?.fecha_fallecimiento && (
              <div className='flex items-center gap-1'>
                <Skull className='h-3 w-3' />
                <span>
                  <strong>Fallecimiento:</strong> {r.extra.fecha_fallecimiento}
                  {r.extra?.edad != null && ` (${r.extra.edad} años)`}
                </span>
              </div>
            )}
            {!r.extra?.fecha_fallecimiento && r.extra?.edad != null && (
              <div className='flex items-center gap-1'>
                <Skull className='h-3 w-3' />
                <span><strong>Edad:</strong> {r.extra.edad} años</span>
              </div>
            )}
            {r.extra?.notas && (
              <div className='italic text-muted-foreground/90 line-clamp-2'>
                &ldquo;{r.extra.notas}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* Detalles específicos para EXHUMADO */}
        {esExhumado && (r.extra?.fecha || r.extra?.destino || r.extra?.notas) && (
          <div className='text-xs text-muted-foreground border-t pt-2 space-y-1'>
            {r.extra?.fecha && (
              <div className='flex items-center gap-1'>
                <Calendar className='h-3 w-3' />
                <span>
                  <strong>Exhumación:</strong> {r.extra.fecha}
                </span>
              </div>
            )}
            {r.extra?.destino && (
              <div className='flex items-center gap-1'>
                <ArrowRight className='h-3 w-3' />
                <span>
                  <strong>Destino:</strong> {r.extra.destino}
                </span>
              </div>
            )}
            {r.extra?.notas && (
              <div className='italic text-muted-foreground/90 line-clamp-2'>
                &ldquo;{r.extra.notas}&rdquo;
              </div>
            )}
          </div>
        )}

        <Button
          asChild
          size='sm'
          variant='outline'
          className='w-full mt-2'
        >
          <Link to={href}>Abrir ficha →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
