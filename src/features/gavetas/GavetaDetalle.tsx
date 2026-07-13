import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Box, Pencil, ScrollText } from "lucide-react";
import { gavetasService } from "./service";
import type { GavetaDetalle, Panteon, AppConfig } from "@/types";
import { EntidadSecciones } from "@/components/shared/EntidadSecciones";
import MemorandumDialog from "@/features/memorandums/MemorandumDialog";
import { panteonesService } from "@/features/panteones/service";
import { configuracionService } from "@/features/configuracion/service";

export default function GavetaDetalle() {
  const { id } = useParams();
  const gavetaId = Number(id);
  const [gaveta, setGaveta] = useState<GavetaDetalle | null>(null);
  const [panteon, setPanteon] = useState<Panteon | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [openMemo, setOpenMemo] = useState(false);

  const cargar = async () => {
    if (!gavetaId) return;
    setGaveta(null);
    try {
      const det = await gavetasService.obtenerDetalle(gavetaId);
      if (!det) return;
      // Asegurar campos de contexto
      const conContexto: GavetaDetalle = {
        ...det,
        linea_codigo: "", linea_nombre: "",
        seccion_id: 0, seccion_codigo: "", seccion_nombre: "",
        panteon_id: 0, panteon_nombre: "",
      };
      // Cargar contexto: línea, sección, panteón
      try {
        const db = await (await import("@/lib/db")).getDb();
        const linea = (await db.select<{ codigo: string; nombre: string; seccion_id: number }[]>(
          `SELECT codigo, nombre, seccion_id FROM lineas WHERE id=${det.linea_id}`
        ))[0];
        if (linea) {
          conContexto.linea_codigo = linea.codigo;
          conContexto.linea_nombre = linea.nombre;
          const sec = (await db.select<{ id: number; codigo: string; nombre: string; panteon_id: number }[]>(
            `SELECT id, codigo, nombre, panteon_id FROM secciones WHERE id=${linea.seccion_id}`
          ))[0];
          if (sec) {
            conContexto.seccion_id = sec.id;
            conContexto.seccion_codigo = sec.codigo;
            conContexto.seccion_nombre = sec.nombre;
            conContexto.panteon_id = sec.panteon_id;
            const pan = (await db.select<Panteon[]>(
              `SELECT * FROM panteones WHERE id=${sec.panteon_id}`
            ))[0];
            if (pan) conContexto.panteon_nombre = pan.nombre;
          }
        }
      } catch (e) { console.warn("[GavetaDetalle] contexto:", e); }
      setGaveta(conContexto);

      // Panteón para el PDF + configuración del panteón
      try {
        if (conContexto.panteon_id > 0) {
          const pan = await panteonesService.obtener(conContexto.panteon_id);
          setPanteon(pan);
        }
      } catch { /* ignore */ }
      try {
        const cfg = await configuracionService.obtener();
        setConfig(cfg);
      } catch { /* ignore */ }
    } catch (e) {
      console.error("[GavetaDetalle] cargar:", e);
    }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [gavetaId]);

  if (!gaveta) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-lg">Cargando gaveta #{gavetaId}…</p>
        <Button onClick={cargar}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center text-sm text-muted-foreground flex-wrap gap-y-1">
        <Link to="/panteones" className="hover:underline">Panteones</Link>
        <span className="mx-2">/</span>
        <Link to={`/panteones/${gaveta.panteon_id}`} className="hover:underline">{gaveta.panteon_nombre || "—"}</Link>
        <span className="mx-2">/</span>
        <Link to={`/secciones/${gaveta.seccion_id}`} className="hover:underline">Sec {gaveta.seccion_codigo || "?"}</Link>
        <span className="mx-2">/</span>
        <Link to={`/lineas/${gaveta.linea_id}`} className="hover:underline">Lín {gaveta.linea_codigo || "?"}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">Gaveta #{gaveta.numero}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-1">
            <Link to={`/lineas/${gaveta.linea_id}`}><ArrowLeft className="mr-2 h-4 w-4" /> Volver a la línea</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <Box className="h-7 w-7" />
            <span className="text-muted-foreground">Gaveta</span>
            <span className="px-3 py-1 rounded bg-primary text-primary-foreground text-2xl">#{gaveta.numero}</span>
          </h1>
          <p className="text-muted-foreground">{gaveta.titular_nombre || "—"}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpenMemo(true)}>
            <ScrollText className="mr-2 h-4 w-4" /> Memorandums
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Titular</CardTitle></CardHeader>
          <CardContent>
            <div className="font-medium">{gaveta.titular_nombre || "—"}</div>
            <div className="text-xs text-muted-foreground">{gaveta.titular_telefono || "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Sepultados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{gaveta.sepultaciones?.length ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Mantenimiento</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{gaveta.mantenimientos?.length ?? 0}</div></CardContent>
        </Card>
      </div>

      <EntidadSecciones tipo="gaveta" entidad={gaveta} onChange={cargar} />

      <MemorandumDialog
        open={openMemo}
        onOpenChange={setOpenMemo}
        tipo="gaveta"
        entidadId={gavetaId}
        entidad={gaveta}
        panteon={panteon}
        config={config ?? undefined}
        titularEntidad={gaveta.titular_nombre}
        onCreated={() => cargar()}
      />
    </div>
  );
}
