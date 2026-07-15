import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, RefreshCcw, Trash2, AlertTriangle, CheckCircle2, Wrench,
  Archive, Save, RotateCcw, Loader2, FolderOpen, ExternalLink } from "lucide-react";
import { getDb, closeDb, repairSchema } from "@/lib/db";
import schemaSql from "@/db/schema.sql?raw";
import { panteonesService } from "@/features/panteones/service";
import { seccionesService } from "@/features/secciones/service";
import { lineasService } from "@/features/lineas/service";
import { fosasService } from "@/features/fosas/service";
import { gavetasService } from "@/features/gavetas/service";
import { DevToolsPanel } from "@/features/import-export/DevToolsPanel";
import {
  listarBackups, crearBackup, eliminarBackup, restaurarBackup,
  backupFormat, getBackupDir, MAX_BACKUPS, type BackupInfo, type BackupResult,
} from "@/lib/backup";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface TblInfo {
  count: number;
  sample: unknown[];
}

/**
 * Sección de respaldos automáticos: muestra los archivos en
 * `<appDataDir>/backups/` y permite crear / restaurar / eliminar.
 */
function BackupsPanel() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [lastResult, setLastResult] = useState<BackupResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  // Confirmación para eliminar
  const [toDelete, setToDelete] = useState<BackupInfo | null>(null);
  // Confirmación para restaurar
  const [toRestore, setToRestore] = useState<BackupInfo | null>(null);
  const [restoring, setRestoring] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const list = await listarBackups();
      setBackups(list);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const onCrear = async () => {
    setCreating(true);
    setErrorMsg("");
    try {
      const r = await crearBackup();
      setLastResult(r);
      if (!r.ok) setErrorMsg(r.error || "Error desconocido");
      await cargar();
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const onEliminar = async () => {
    if (!toDelete) return;
    try {
      await eliminarBackup(toDelete.path);
      setToDelete(null);
      await cargar();
    } catch (e) {
      setErrorMsg(`No se pudo eliminar: ${(e as Error).message}`);
      setToDelete(null);
    }
  };

  const onRestaurar = async () => {
    if (!toRestore) return;
    setRestoring(true);
    setErrorMsg("");
    try {
      const r = await restaurarBackup(toRestore.path);
      if (!r.ok) {
        setErrorMsg(`No se pudo restaurar: ${r.error}`);
        return;
      }
      // Recargamos la app para que getDb() lea el archivo restaurado
      window.location.reload();
    } catch (e) {
      setErrorMsg(`Error restaurando: ${(e as Error).message}`);
    } finally {
      setRestoring(false);
      setToRestore(null);
    }
  };

  const totalSize = backups.reduce((acc, b) => acc + b.size, 0);

  const abrirCarpeta = async () => {
    try {
      const dir = await getBackupDir();
      await invoke("abrir_en_explorador", { ruta: dir });
    } catch (e) {
      setErrorMsg(`No se pudo abrir la carpeta: ${(e as Error).message}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Respaldos de la base de datos
        </CardTitle>
        <CardDescription>
          Copias automáticas con <code className="text-xs">VACUUM INTO</code>. Se crean
          cada vez que cierras la aplicación y también puedes crearlas manualmente aquí.
          Se conservan los últimos <strong>{MAX_BACKUPS}</strong> archivos en
          <code className="text-xs"> appDataDir/backups/</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onCrear} disabled={creating || loading}>
            {creating
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…</>
              : <><Save className="mr-2 h-4 w-4" /> Crear respaldo ahora</>
            }
          </Button>
          <Button variant="outline" onClick={cargar} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar lista
          </Button>
          <Button variant="ghost" size="sm" onClick={abrirCarpeta} title="Abrir carpeta en Finder/Explorer">
            <ExternalLink className="mr-1 h-3 w-3" /> Abrir carpeta
          </Button>
          <div className="ml-auto text-xs text-muted-foreground flex items-center gap-2">
            <Badge variant={backups.length > 0 ? "info" : "muted"}>
              {backups.length} / {MAX_BACKUPS}
            </Badge>
            <span>Total: {backupFormat.bytes(totalSize)}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="font-mono">{errorMsg}</span>
          </div>
        )}

        {lastResult && lastResult.ok && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Respaldo creado: <strong>{lastResult.filename}</strong> ·
              tamaño {backupFormat.bytes(lastResult.size)} ·
              {lastResult.rotated > 0
                ? ` se rotaron ${lastResult.rotated} archivo(s)`
                : ` sin rotación`}{" "}
              · {lastResult.durationMs} ms
            </div>
          </div>
        )}

        {backups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No hay respaldos todavía. Crea el primero con el botón de arriba
            o cierra la aplicación para que se genere uno automático.
          </div>
        ) : (
          <div className="rounded-lg border divide-y">
            {backups.map((b, i) => (
              <div
                key={b.path}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <Badge variant={i === 0 ? "success" : "muted"} className="w-16 justify-center">
                  {i === 0 ? "nuevo" : `#${i + 1}`}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs truncate" title={b.path}>
                    {b.filename}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {backupFormat.dateTime(b.mtime)} · {backupFormat.bytes(b.size)}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setToRestore(b)}
                  disabled={i === 0}
                  title={i === 0 ? "Este es el respaldo más reciente" : "Restaurar la BD a este punto"}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Restaurar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setToDelete(b)}
                  className="text-red-700 hover:text-red-800 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* === Dialog: confirmar eliminar === */}
      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              ¿Eliminar respaldo?
            </DialogTitle>
            <DialogDescription>
              El archivo se borrará permanentemente del disco.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <div className="font-mono text-xs bg-muted p-2 rounded">
              {toDelete?.filename}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {toDelete ? backupFormat.dateTime(toDelete.mtime) : ""} · {toDelete ? backupFormat.bytes(toDelete.size) : ""}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={onEliminar}>
              <Trash2 className="mr-2 h-4 w-4" /> Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog: confirmar restaurar === */}
      <Dialog open={toRestore !== null} onOpenChange={(o) => !o && !restoring && setToRestore(null)}>
        <DialogContent className="sm:max-w-md border-amber-400">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              ¿Restaurar este respaldo?
            </DialogTitle>
            <DialogDescription>
              La base de datos actual será <strong>sobrescrita</strong> con el
              contenido de este respaldo. La aplicación se recargará automáticamente.
              Esta acción no se puede deshacer (pero tienes los demás respaldos para volver atrás).
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <div className="font-mono text-xs bg-muted p-2 rounded">
              {toRestore?.filename}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {toRestore ? backupFormat.dateTime(toRestore.mtime) : ""} · {toRestore ? backupFormat.bytes(toRestore.size) : ""}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToRestore(null)} disabled={restoring}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={onRestaurar}
              disabled={restoring}
            >
              {restoring
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Restaurando…</>
                : <><RotateCcw className="mr-2 h-4 w-4" /> Sí, restaurar</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
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

      <DevToolsPanel onChanged={diagnosticar} />

      <BackupsPanel />

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
