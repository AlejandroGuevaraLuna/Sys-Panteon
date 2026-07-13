import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, RefreshCcw, Trash2, AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { getDb, closeDb, repairSchema } from "@/lib/db";
import schemaSql from "@/db/schema.sql?raw";
import { panteonesService } from "@/features/panteones/service";
import { seccionesService } from "@/features/secciones/service";
import { lineasService } from "@/features/lineas/service";
import { fosasService } from "@/features/fosas/service";
import { gavetasService } from "@/features/gavetas/service";

interface TblInfo {
  count: number;
  sample: unknown[];
}

export default function Diagnostico() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userVer, setUserVer] = useState<number>(-1);
  const [tables, setTables] = useState<Record<string, TblInfo>>({});
  const [lastErr, setLastErr] = useState<string>("");
  const [reloading, setReloading] = useState(false);
  const [probeId, setProbeId] = useState<string>("1");
  const [probeResult, setProbeResult] = useState<string>("");
  const [probeRunning, setProbeRunning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairLog, setRepairLog] = useState<string>("");

  const diagnosticar = async () => {
    setReloading(true);
    setLastErr("");
    try {
      const db = await getDb();
      // user_version
      const v = await db.select<{ user_version: number }[]>("PRAGMA user_version");
      setUserVer(v[0]?.user_version ?? 0);

      // Conteo por tabla
      const nombres = [
        "panteones", "secciones", "lineas", "fosas", "gavetas",
        "titulares", "sepultaciones", "exhumaciones", "mantenimientos_pagados",
        "cambios_titular", "memorandums", "servicios", "configuracion"
      ];
      const cts: Record<string, number> = {};
      const tbs: Record<string, TblInfo> = {};
      for (const t of nombres) {
        try {
          const cnt = await db.select<{ c: number }[]>(`SELECT COUNT(*) AS c FROM ${t}`);
          cts[t] = cnt[0]?.c ?? 0;
          const sample = await db.select<unknown[]>(`SELECT * FROM ${t} ORDER BY id ASC LIMIT 3`);
          tbs[t] = { count: cts[t], sample };
        } catch (e) {
          cts[t] = -1;
          tbs[t] = { count: -1, sample: [`❌ tabla no existe: ${(e as Error).message}`] };
        }
      }
      setCounts(cts);
      setTables(tbs);
    } catch (e) {
      setLastErr((e as Error).message);
    } finally {
      setReloading(false);
    }
  };

  const probar = async () => {
    setProbeRunning(true);
    setProbeResult("");
    const id = Number(probeId);
    const lines: string[] = [];
    try {
      const pan = await panteonesService.obtener(id);
      lines.push(`panteonesService.obtener(${id}) → ${pan ? `✓ id=${pan.id} nombre="${pan.nombre}"` : "❌ null"}`);

      const panDet = await panteonesService.obtenerDetalle(id);
      lines.push(`panteonesService.obtenerDetalle(${id}) → ${panDet ? `✓ panteón + ${panDet.secciones.length} secciones` : "❌ null"}`);

      const sec = await seccionesService.obtener(id);
      lines.push(`seccionesService.obtener(${id}) → ${sec ? `✓ codigo=${sec.codigo}` : "❌ null"}`);

      const lin = await lineasService.obtener(id);
      lines.push(`lineasService.obtener(${id}) → ${lin ? `✓ codigo=${lin.codigo}` : "❌ null"}`);

      const linDet = await lineasService.obtenerDetalle(id);
      lines.push(`lineasService.obtenerDetalle(${id}) → ${linDet ? `✓ ${linDet.fosas.length} fosas` : "❌ null"}`);

      const fosa = await fosasService.obtenerDetalle(id);
      lines.push(`fosasService.obtenerDetalle(${id}) → ${fosa ? `✓ id=${fosa.id} linea=${fosa.linea_id}` : "❌ null"}`);

      const gav = await gavetasService.obtenerDetalle(id);
      lines.push(`gavetasService.obtenerDetalle(${id}) → ${gav ? `✓ titular=${gav.titular_nombre || "(vacío)"}` : "❌ null"}`);
    } catch (e) {
      lines.push(`❌ Error: ${(e as Error).message}`);
    }
    setProbeResult(lines.join("\n"));
    setProbeRunning(false);
  };

  const repararEsquema = async () => {
    if (!confirm("Vas a crear las tablas/índices que falten sin borrar datos. ¿Continuar?")) return;
    setRepairing(true);
    setRepairLog("");
    try {
      const logs = await repairSchema();
      setRepairLog(logs.join("\n") || "Sin cambios (todo en orden).");
      await diagnosticar();
    } catch (e) {
      setRepairLog(`ERROR: ${(e as Error).message}`);
    } finally {
      setRepairing(false);
    }
  };

  const resetBD = async () => {
    if (!confirm("Esto borrará TODO. ¿Continuar?")) return;
    setReloading(true);
    setLastErr("");
    try {
      // Intentar dos estrategias: 1) dentro de la misma conexión, 2) cerrar y reabrir
      let errores: string[] = [];
      try {
        const db = await getDb();
        // Primero: borrar todo el contenido de las tablas (más rápido que DROP)
        for (const t of [
          "memorandums", "cambios_titular", "mantenimientos_pagados",
          "exhumaciones", "sepultaciones", "gavetas", "fosas", "lineas", "secciones",
          "titulares", "servicios", "panteones", "configuracion",
        ]) {
          try { await db.execute(`DELETE FROM ${t}`); } catch { /* tabla no existe */ }
        }
        // Bajar version para forzar migración desde cero
        await db.execute(`PRAGMA user_version = 0`);
        // Re-cargar BD dispara migración automáticamente
        await closeDb();
      } catch (e) {
        errores.push(`Estrategia 1: ${(e as Error).message}`);
      }

      // Ahora getDb() debe detectar version=0 y aplicar schema desde cero
      try {
        const db = await getDb();
        await db.execute(`PRAGMA user_version = 5`);
        // Confirmar
        const cv = await db.select<{ user_version: number }[]>(`PRAGMA user_version`);
        const c = await db.select<{ c: number }[]>(`SELECT COUNT(*) AS c FROM panteones`);
        console.log("[resetBD] Versión:", cv[0]?.user_version, "Panteones:", c[0]?.c);
        if (!confirm(`BD reiniciada. Versión: ${cv[0]?.user_version}, Panteones: ${c[0]?.c}.\n\nRecargar ahora?`)) {
          setReloading(false);
          return;
        }
        window.location.reload();
      } catch (e) {
        errores.push(`Estrategia 2: ${(e as Error).message}`);
      }

      if (errores.length > 0) {
        setLastErr(errores.join("\n\n"));
        setReloading(false);
      }
    } catch (e) {
      setLastErr((e as Error).message);
      setReloading(false);
    }
  };

  useEffect(() => { diagnosticar(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7" /> Diagnóstico
          </h1>
          <p className="text-muted-foreground">
            Inspección en vivo del estado de la base de datos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={diagnosticar} disabled={reloading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
          <Button variant="secondary" onClick={repararEsquema} disabled={repairing}>
            <Wrench className="mr-2 h-4 w-4" /> {repairing ? "Reparando…" : "Reparar esquema"}
          </Button>
          <Button variant="destructive" onClick={resetBD}>
            <Trash2 className="mr-2 h-4 w-4" /> Resetear BD
          </Button>
        </div>
      </div>

      {lastErr && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-semibold">Error al conectar</p>
                <p className="text-sm font-mono mt-1">{lastErr}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {repairLog && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado de la reparación</CardTitle>
            <CardDescription>
              Cada sentencia del esquema ejecutada individualmente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-80">
              {repairLog}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Database className="h-3 w-3" /> PRAGMA user_version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userVer === -1 ? "…" : userVer}
              {userVer === 4 ? <CheckCircle2 className="inline ml-2 h-5 w-5 text-emerald-600" /> : null}
            </div>
            <p className="text-xs text-muted-foreground">Esperado: 4</p>
          </CardContent>
        </Card>
        {Object.entries(counts).slice(0, 8).map(([t, c]) => (
          <Card key={t}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {c === -1 ? "—" : c}
                {c > 0 && <CheckCircle2 className="inline ml-2 h-4 w-4 text-emerald-600" />}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prueba en vivo: obtener por ID</CardTitle>
          <CardDescription>
            Pega un ID y prueba manualmente todas las funciones de búsqueda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm">ID a probar</label>
              <input
                type="number" value={probeId}
                onChange={(e) => setProbeId(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded"
              />
            </div>
            <Button onClick={probar} disabled={probeRunning}>
              {probeRunning ? "Probando…" : "Probar"}
            </Button>
          </div>
          {probeResult && (
            <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {probeResult}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por tabla</CardTitle>
          <CardDescription>
            Primeras 3 filas de cada tabla (para inspección).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(tables).map(([t, info]) => (
            <div key={t} className="border-b pb-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t}</span>
                <Badge variant={info.count > 0 ? "success" : "muted"}>
                  {info.count} registro{info.count !== 1 ? "s" : ""}
                </Badge>
              </div>
              <pre className="text-xs font-mono bg-muted/50 p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(info.sample, null, 2)}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
