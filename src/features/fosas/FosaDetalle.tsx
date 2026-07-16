import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Cross, Pencil, Box, ScrollText, Users } from "lucide-react";
import { fosasService, type FosaDetalleCompleta, type FosaVecina } from "./service";
import { formatDateLong } from "@/lib/utils";
import { EntidadSecciones } from "@/components/shared/EntidadSecciones";
import { VecinasSheet, type VecinaMinima } from "@/components/shared/VecinasSheet";
import FosaForm from "./FosaForm";
import MemorandumDialog from "@/features/memorandums/MemorandumDialog";
import { panteonesService } from "@/features/panteones/service";
import { configuracionService } from "@/features/configuracion/service";
import type { Panteon, AppConfig } from "@/types";

export default function FosaDetalle() {
  const { id } = useParams();
  const fosaId = Number(id);
  const [fosa, setFosa] = useState<FosaDetalleCompleta | null>(null);
  const [panteon, setPanteon] = useState<Panteon | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [editando, setEditando] = useState(false);
  const [openMemo, setOpenMemo] = useState(false);
  const [openVecinas, setOpenVecinas] = useState(false);

  const cargar = async () => {
    if (!fosaId) return;
    setFosa(null);
    try {
      const det = await fosasService.obtenerDetalle(fosaId);
      if (!det) return;
      setFosa(det);
      // Cargar panteón y configuración para el PDF de memorandum
      try {
        const pan = await panteonesService.obtener(det.panteon_id);
        setPanteon(pan);
      } catch { /* ignore */ }
      try {
        const cfg = await configuracionService.obtener();
        setConfig(cfg);
      } catch { /* ignore */ }
    } catch (e) {
      console.error("Error cargando fosa:", e);
    }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [fosaId]);

  if (!fosa) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-lg">Cargando fosa #{fosaId}…</p>
        <Button onClick={cargar}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center text-sm text-muted-foreground flex-wrap gap-y-1">
        <Link to="/panteones" className="hover:underline">Panteones</Link>
        <span className="mx-2">/</span>
        <Link to={`/panteones/${fosa.panteon_id}`} className="hover:underline">{fosa.panteon_nombre || "—"}</Link>
        <span className="mx-2">/</span>
        <Link to={`/secciones/${fosa.seccion_id || 0}`} className="hover:underline">Sec {fosa.seccion_codigo || "?"}</Link>
        <span className="mx-2">/</span>
        <Link to={`/lineas/${fosa.linea_id}`} className="hover:underline">Lín {fosa.linea_codigo || "?"}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">Fosa {fosa.numero}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-1">
            <Link to={`/lineas/${fosa.linea_id}`}><ArrowLeft className="mr-2 h-4 w-4" /> Volver a la línea</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <Cross className="h-7 w-7" />
            <span className="px-2 py-1 rounded bg-primary/10 text-primary">Sec {fosa.seccion_codigo || "?"}</span>
            <span className="text-muted-foreground">·</span>
            <span className="px-2 py-1 rounded bg-primary/10 text-primary">Lín {fosa.linea_codigo || "?"}</span>
            <span className="text-muted-foreground">·</span>
            <span className="px-2 py-1 rounded bg-primary text-primary-foreground text-2xl">Fosa {fosa.numero}</span>
          </h1>
          <p className="text-muted-foreground">{fosa.panteon_nombre || "—"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenVecinas(true)}>
            <Users className="mr-2 h-4 w-4" /> Fosas vecinas
          </Button>
          <Button variant="outline" onClick={() => setEditando(!editando)}>
            {editando ? <><Save className="mr-2 h-4 w-4" /> Listo</> : <><Pencil className="mr-2 h-4 w-4" /> Editar</>}
          </Button>
          <Button onClick={() => setOpenMemo(true)}>
            <ScrollText className="mr-2 h-4 w-4" /> Memorandums
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Titular</CardTitle></CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{fosa.titular_nombre || "—"}</div>
            <div className="text-xs text-muted-foreground">{fosa.titular_telefono || "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Libro / Registro</CardTitle></CardHeader>
          <CardContent>
            <div className="font-mono text-base">L: {fosa.libro || "—"}</div>
            <div className="font-mono text-xs text-muted-foreground">R: {fosa.registro || "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Capacidad</CardTitle></CardHeader>
          <CardContent><Badge variant="muted">{fosa.capacidad_gavetas} gavetas</Badge></CardContent>
        </Card>
      </div>

      {editando ? (
        <FosaForm fosa={fosa} onCancel={() => setEditando(false)} onSave={async (data) => {
          await fosasService.actualizar(fosa.id, data as any);
          await cargar();
          setEditando(false);
        }} />
      ) : (
        <EntidadSecciones tipo="fosa" entidad={fosa} onChange={cargar} />
      )}

      <MemorandumDialog
        open={openMemo}
        onOpenChange={setOpenMemo}
        tipo="fosa"
        entidadId={fosaId}
        entidad={fosa}
        panteon={panteon}
        config={config ?? undefined}
        titularEntidad={fosa.titular_nombre}
        onCreated={() => cargar()}
      />

      <VecinasSheet
        tipo="fosa"
        etiqueta="fosa"
        entidadId={fosaId}
        open={openVecinas}
        onOpenChange={setOpenVecinas}
        cargar={async (id, rango) => {
          const lista: FosaVecina[] = await fosasService.vecinas(id, rango);
          return lista as unknown as VecinaMinima[];
        }}
      />
    </div>
  );
}
