import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { ArrowRight, Plus, Search, Eye, ArrowLeft } from "lucide-react";
import { lineasService } from "./service";
import { seccionesService } from "@/features/secciones/service";
import { panteonesService } from "@/features/panteones/service";
import type { Linea, Seccion, Panteon } from "@/types";
import NuevaLinea from "./NuevaLinea";

export default function Lineas() {
  const [items, setItems] = useState<Linea[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [panteones, setPanteones] = useState<Panteon[]>([]);
  const [filtroSeccion, setFiltroSeccion] = useState<string>("");
  const [filtroPanteon, setFiltroPanteon] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [openNueva, setOpenNueva] = useState(false);

  const cargar = async () => {
    const data = await lineasService.listar(
      filtroSeccion ? Number(filtroSeccion) : undefined
    );
    setItems(data);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [filtroSeccion]);

  useEffect(() => {
    seccionesService.listar().then(setSecciones);
    panteonesService.listar().then(setPanteones);
  }, []);

  const seccionesFiltradas = secciones.filter((s) =>
    filtroPanteon ? s.panteon_id === Number(filtroPanteon) : true
  );

  const itemsFiltrados = items.filter((l) => {
    const sec = secciones.find((s) => s.id === l.seccion_id);
    if (filtroPanteon && sec?.panteon_id !== Number(filtroPanteon)) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return l.codigo.toLowerCase().includes(q) || l.nombre.toLowerCase().includes(q);
    }
    return true;
  });

  const seccionById = (id: number) => secciones.find((s) => s.id === id);
  const panteonById = (id: number) => panteones.find((p) => p.id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ArrowRight className="h-7 w-7" /> Líneas
          </h1>
          <p className="text-muted-foreground">
            Cada línea pertenece a una sección y agrupa fosas. Para crear una línea primero necesitas una sección.
          </p>
        </div>
        <Button onClick={() => setOpenNueva(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva línea
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtra por panteón o sección, o busca por código/nombre.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <div className="w-56">
              <Select value={filtroPanteon} onValueChange={(v) => { setFiltroPanteon(v); setFiltroSeccion(""); }}>
                <SelectTrigger><SelectValue placeholder="Todos los panteones" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {panteones.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-56">
              <Select value={filtroSeccion} onValueChange={setFiltroSeccion}>
                <SelectTrigger><SelectValue placeholder="Todas las secciones" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {seccionesFiltradas.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      Sec {s.codigo} — {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por código o nombre…" className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados ({itemsFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {itemsFiltrados.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ArrowRight className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>No hay líneas registradas.</p>
              <p className="text-sm">
                {secciones.length === 0
                  ? "Primero crea una sección dentro de un panteón."
                  : "Crea la primera línea con el botón 'Nueva línea'."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sección</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead className="text-center">Fosas</TableHead>
                  <TableHead className="text-center">Capacidad</TableHead>
                  <TableHead>Panteón</TableHead>
                  <TableHead className="w-24">Abrir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsFiltrados.map((l) => {
                  const sec = seccionById(l.seccion_id);
                  const pan = sec ? panteonById(sec.panteon_id) : null;
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs">
                          Sec {sec?.codigo ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-base">{l.codigo}</div>
                        <div className="text-xs text-muted-foreground">{l.nombre}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="muted">—</Badge>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {l.capacidad_fosas ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {pan ? (
                          <Link to={`/panteones/${pan.id}`} className="text-primary hover:underline">
                            {pan.nombre}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="default" size="sm">
                          <Link to={`/lineas/${l.id}`}>
                            <Eye className="mr-1 h-3 w-3" /> Abrir
                          </Link>
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

      <NuevaLinea
        open={openNueva}
        onOpenChange={setOpenNueva}
        secciones={secciones}
        onCreated={cargar}
      />
    </div>
  );
}