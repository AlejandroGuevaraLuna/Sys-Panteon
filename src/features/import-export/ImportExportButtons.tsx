import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { seleccionarYLeerExcel, exportarAFilaExcel, guardarExcel, type EntityType, type FilaImportada } from "./excel";
import { importarFilas } from "./importar";
import { fosasService, type FosaListado } from "@/features/fosas/service";
import { gavetasService, type GavetaListado } from "@/features/gavetas/service";
import { panteonesService } from "@/features/panteones/service";
import type { Panteon } from "@/types";

interface Props {
  tipo: EntityType;
  /** Llamado cuando termina la importación para refrescar la lista. */
  onImportado?: () => void;
  /** Llamado cuando termina la exportación. */
  onExportado?: () => void;
}

interface PreviewState {
  filas: FilaImportada[];
  advertencias: string[];
  archivo: string;
}

interface ResultadoImport {
  creadas: number;
  actualizadas: number;
  omitidas: number;
  errores: { fila: number; titular: string; numero: string; seccion: string; linea: string; razon: string }[];
  creadas_detalle: { fila: number; titular: string; numero: string; seccion: string; linea: string; accion: "creada" | "actualizada" }[];
}

/**
 * Botones de Importar / Exportar Excel para fosas o gavetas.
 * Antes de importar, muestra una previsualización con conteo de filas,
 * advertencias y selector de panteón; el usuario confirma o cancela.
 */
export function ImportExportButtons({ tipo, onImportado, onExportado }: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [panteones, setPanteones] = useState<Panteon[]>([]);
  const [panteonId, setPanteonId] = useState<number | "nuevo">("nuevo");
  const [panteonNuevoNombre, setPanteonNuevoNombre] = useState("Panteón Pabellón de Arteaga");
  const [result, setResult] = useState<ResultadoImport | null>(null);

  // Cargar panteones al abrir el dialog. Por defecto selecciona el
  // PRIMER panteón existente (en vez de "nuevo") para evitar que se
  // creen panteones duplicados accidentalmente.
  useEffect(() => {
    if (preview) {
      panteonesService.listar().then((list) => {
        setPanteones(list);
        if (list.length > 0) {
          setPanteonId(list[0].id);
          setPanteonNuevoNombre(list[0].nombre);
        } else {
          setPanteonId("nuevo");
          setPanteonNuevoNombre("Panteón Pabellón de Arteaga");
        }
      }).catch(() => setPanteones([]));
    }
  }, [preview]);

  const onImportarClick = async () => {
    setResult(null);
    setLoading(true);
    try {
      const { filas, advertencias, path } = await seleccionarYLeerExcel();
      if (!path || filas.length === 0) {
        if (advertencias.length > 0) {
          alert(advertencias.join("\n"));
        }
        return;
      }
      const nombreArchivo = path.split(/[/\\]/).pop() ?? "archivo.xlsx";
      setPreview({ filas, advertencias, archivo: nombreArchivo });
      setPanteonId("nuevo");
      setPanteonNuevoNombre("Panteón Pabellón de Arteaga");
    } catch (e) {
      alert(`Error al leer el archivo: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmarImportacion = async () => {
    if (!preview) return;
    // Determinar el nombre del panteón a usar
    let panteonNombre = "";
    if (panteonId === "nuevo") {
      panteonNombre = panteonNuevoNombre.trim();
      if (!panteonNombre) {
        alert("Escribe el nombre del panteón o selecciona uno existente.");
        return;
      }
    } else {
      const p = panteones.find((x) => x.id === panteonId);
      if (!p) {
        alert("Panteón no encontrado.");
        return;
      }
      panteonNombre = p.nombre;
    }
    setLoading(true);
    try {
      const res = await importarFilas(tipo, preview.filas, panteonNombre);
      setResult(res);
      setPreview(null);
      onImportado?.();
    } catch (e) {
      alert(`Error al importar: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const onExportarClick = async () => {
    setLoading(true);
    try {
      let filas: FilaImportada[] = [];
      if (tipo === "fosa") {
        const fosas = await fosasService.listar();
        filas = fosas.map(fosaToFila);
      } else {
        const gavetas = await gavetasService.listar();
        filas = gavetas.map(gavetaToFila);
      }
      const wb = exportarAFilaExcel(filas);
      const path = await guardarExcel(wb, `panteon-${tipo}s-${new Date().toISOString().slice(0, 10)}.xlsx`);
      if (path) {
        onExportado?.();
      }
    } catch (e) {
      alert(`Error al exportar: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onImportarClick} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Importar Excel
        </Button>
        <Button variant="outline" size="sm" onClick={onExportarClick} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Dialog de previsualización */}
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Previsualización de importación
            </DialogTitle>
            <DialogDescription>
              Revisa los datos antes de importar. Selecciona el panteón destino (se creará si no existe). Las fosas/gavetas existentes con el mismo (línea, número) se actualizarán.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                <div><strong>Archivo:</strong> {preview.archivo}</div>
                <div><strong>Tipo de entidad:</strong> {tipo === "fosa" ? "Fosas" : "Gavetas"}</div>
                <div><strong>Filas detectadas:</strong> {preview.filas.length}</div>
                {preview.advertencias.length > 0 && (
                  <div className="mt-2">
                    <strong className="text-amber-700">Advertencias:</strong>
                    <ul className="list-disc list-inside text-amber-700">
                      {preview.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              {/* Selector de panteón */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Panteón destino</label>
                {panteones.length > 0 ? (
                  <select
                    className="w-full px-3 py-2 border rounded text-base bg-background"
                    value={panteonId === "nuevo" ? "__nuevo__" : String(panteonId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__nuevo__") {
                        setPanteonId("nuevo");
                      } else {
                        setPanteonId(parseInt(v, 10));
                      }
                    }}
                  >
                    {panteones.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                    <option value="__nuevo__">+ Crear nuevo panteón…</option>
                  </select>
                ) : (
                  <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>No hay panteones registrados.</strong> Crea uno nuevo para empezar.
                  </div>
                )}
                {panteonId === "nuevo" && (
                  <input
                    className="w-full px-3 py-2 border rounded text-base"
                    value={panteonNuevoNombre}
                    onChange={(e) => setPanteonNuevoNombre(e.target.value)}
                    placeholder="Nombre del nuevo panteón"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Por defecto se usa un panteón existente. Las secciones y líneas que no existan se crean automáticamente.
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto rounded border text-sm">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">Sec</th>
                      <th className="px-2 py-1 text-left">Lín</th>
                      <th className="px-2 py-1 text-left">N°</th>
                      <th className="px-2 py-1 text-left">Titular</th>
                      <th className="px-2 py-1 text-right">Sep.</th>
                      <th className="px-2 py-1 text-right">Exh.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.filas.slice(0, 20).map((f, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{f.seccion_codigo}</td>
                        <td className="px-2 py-1">{f.linea_codigo}</td>
                        <td className="px-2 py-1 font-mono">{f.numero}</td>
                        <td className="px-2 py-1 truncate max-w-[200px]">{f.titular_nombre}</td>
                        <td className="px-2 py-1 text-right">{f.sepultados.length}</td>
                        <td className="px-2 py-1 text-right">{f.exhumaciones.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.filas.length > 20 && (
                  <div className="text-center text-xs text-muted-foreground py-1">
                    … y {preview.filas.length - 20} más
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={loading}>Cancelar</Button>
            <Button onClick={confirmarImportacion} disabled={loading || !preview}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Importar {preview?.filas.length ?? 0} {tipo === "fosa" ? "fosa(s)" : "gaveta(s)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de resultado */}
      <Dialog open={!!result} onOpenChange={(o) => { if (!o) setResult(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result && result.errores.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}
              Resultado de la importación
            </DialogTitle>
            <DialogDescription>
              {result && (
                <span>
                  {result.creadas_detalle.length} procesadas ·{" "}
                  <span className="text-green-700">{result.creadas} creadas</span> ·{" "}
                  <span className="text-blue-700">{result.actualizadas} actualizadas</span> ·{" "}
                  {result.errores.length > 0 && (
                    <span className="text-red-700">{result.errores.length} con error</span>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              {/* Resumen */}
              <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-700">{result.creadas}</div>
                  <div className="text-xs text-muted-foreground">Creadas</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-700">{result.actualizadas}</div>
                  <div className="text-xs text-muted-foreground">Actualizadas</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-700">{result.errores.length}</div>
                  <div className="text-xs text-muted-foreground">Con error</div>
                </div>
              </div>

              {/* Errores detallados */}
              {result.errores.length > 0 && (
                <div className="space-y-1">
                  <div className="font-medium text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Filas con error ({result.errores.length})
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded border border-red-200 bg-red-50">
                    <table className="w-full text-xs">
                      <thead className="bg-red-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">Fila</th>
                          <th className="px-2 py-1 text-left">Sec</th>
                          <th className="px-2 py-1 text-left">Lín</th>
                          <th className="px-2 py-1 text-left">N°</th>
                          <th className="px-2 py-1 text-left">Titular</th>
                          <th className="px-2 py-1 text-left">Razón del error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errores.map((e, i) => (
                          <tr key={i} className="border-t border-red-200">
                            <td className="px-2 py-1 font-mono">{e.fila}</td>
                            <td className="px-2 py-1">{e.seccion || "—"}</td>
                            <td className="px-2 py-1">{e.linea || "—"}</td>
                            <td className="px-2 py-1 font-mono">{e.numero || "—"}</td>
                            <td className="px-2 py-1 truncate max-w-[150px]">{e.titular}</td>
                            <td className="px-2 py-1 text-red-900 font-medium">
                              {e.razon || <span className="text-muted-foreground italic">Sin detalle</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detalle de creadas/actualizadas (colapsable) */}
              {result.creadas_detalle.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Ver detalle de las {result.creadas_detalle.length} filas procesadas correctamente
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border bg-muted/20">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">Fila</th>
                          <th className="px-2 py-1 text-left">Acción</th>
                          <th className="px-2 py-1 text-left">Sec</th>
                          <th className="px-2 py-1 text-left">Lín</th>
                          <th className="px-2 py-1 text-left">N°</th>
                          <th className="px-2 py-1 text-left">Titular</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.creadas_detalle.map((d, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1 font-mono">{d.fila}</td>
                            <td className="px-2 py-1">
                              <span className={d.accion === "creada" ? "text-green-700" : "text-blue-700"}>
                                {d.accion === "creada" ? "✓ creada" : "↻ actualizada"}
                              </span>
                            </td>
                            <td className="px-2 py-1">{d.seccion}</td>
                            <td className="px-2 py-1">{d.linea}</td>
                            <td className="px-2 py-1 font-mono">{d.numero}</td>
                            <td className="px-2 py-1 truncate max-w-[180px]">{d.titular}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResult(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =================== Converters (lista → FilaImportada) ===================

function fosaToFila(f: FosaListado): FilaImportada {
  return {
    titular_nombre: f.titular_nombre,
    numero_titulo: f.numero_titulo,
    fecha_titulo: f.fecha_titulo,
    superficie_ancho: f.superficie_ancho,
    superficie_alto: f.superficie_alto,
    seccion_codigo: f.seccion_codigo ?? "",
    linea_codigo: f.linea_codigo ?? "",
    numero: f.numero,
    libro: f.libro,
    registro: f.registro,
    titular_domicilio: f.titular_domicilio,
    titular_telefono: f.titular_telefono,
    sepultados: [],
    exhumaciones: [],
    mantenimientos: [],
    beneficiario: f.beneficiario,
    observaciones: f.observaciones ?? "",
    notas_libro: f.notas_libro ?? "",
  };
}

function gavetaToFila(g: GavetaListado): FilaImportada {
  return {
    titular_nombre: g.titular_nombre,
    numero_titulo: g.numero_titulo,
    fecha_titulo: g.fecha_titulo,
    superficie_ancho: g.superficie_ancho,
    superficie_alto: g.superficie_alto,
    seccion_codigo: g.seccion_codigo ?? "",
    linea_codigo: g.linea_codigo ?? "",
    numero: String(g.numero),
    libro: g.libro,
    registro: g.registro,
    titular_domicilio: g.titular_domicilio,
    titular_telefono: g.titular_telefono,
    sepultados: [],
    exhumaciones: [],
    mantenimientos: [],
    beneficiario: g.beneficiario,
    observaciones: g.observaciones ?? "",
    notas_libro: g.notas_libro ?? "",
  };
}
