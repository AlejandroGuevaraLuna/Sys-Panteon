/**
 * Módulo de import/export de fosas y gavetas desde/hacia Excel.
 *
 * Estructura esperada del Excel (basada en el formato del panteón):
 *   - Una hoja por sección; solo usamos la PRIMERA hoja
 *   - Fila 1 = encabezados
 *   - Filas 2..N = datos
 *   - Columnas:
 *     Titular | N° de Título | Fecha Título | Superficie Amparada |
 *     Sección | Línea | Número Fosa | Libro | Registro | Domicilio |
 *     Teléfono | N° Sepultados |
 *     NOMBRE1..NOMBRE7 | FECHA1..FECHA7  (sepultados) |
 *     NÚMERO DE EXHUMACIONES |
 *     NOMBRE1..NOMBRE7 | FECHA1..FECHA7  (exhumaciones) |
 *     MANTENIMIENTO | BENEFICIARIO | OBSERVACIONES | NOTAS DEL LIBRO
 */
import * as XLSX from "xlsx";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

export type EntityType = "fosa" | "gaveta";

export interface FilaImportada {
  titular_nombre: string;
  numero_titulo: string;
  fecha_titulo: string | null;
  superficie_ancho: string;
  superficie_alto: string;
  seccion_codigo: string;
  linea_codigo: string;
  numero: string; // string en fosa, pero se convierte a número al guardar gaveta
  libro: string;
  registro: string;
  titular_domicilio: string;
  titular_telefono: string;
  sepultados: { nombre: string; fecha: string | null }[];
  exhumaciones: { nombre: string; fecha: string | null }[];
  mantenimientos: number[]; // años
  beneficiario: string;
  observaciones: string;
  notas_libro: string;
}

/**
 * Normaliza el header para hacerlo más fácil de matchear.
 * Quita acentos, pasa a minúsculas, quita espacios extras y caracteres
 * que no son alfanuméricos.
 */
function normHeader(h: string): string {
  return String(h ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Encuentra la primera columna cuyo header normalizado coincide con uno
 * de los candidatos (también normalizados). Devuelve el índice de la
 * columna o -1.
 */
function findCol(headers: string[], candidates: string[]): number {
  const norm = headers.map(normHeader);
  const wanted = candidates.map(normHeader);
  for (let i = 0; i < norm.length; i++) {
    if (wanted.includes(norm[i])) return i;
  }
  return -1;
}

/** Helper: convierte una celda a string, manejando null/undefined/dates. */
function cellToStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "";
    return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

/**
 * Convierte una celda a fecha ISO (YYYY-MM-DD) o null.
 * Acepta: Date, número serial de Excel, string DD/MM/YYYY, string
 * YYYY-MM-DD, string con hora "YYYY-MM-DD HH:MM:SS".
 */
function cellToDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  // ISO directo
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, "0");
    const mm = dmyMatch[2].padStart(2, "0");
    let yyyy = dmyMatch[3];
    if (yyyy.length === 2) yyyy = (parseInt(yyyy, 10) > 50 ? "19" : "20") + yyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  // Número serial de Excel
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const yyyy = d.y.toString().padStart(4, "0");
      const mm = d.m.toString().padStart(2, "0");
      const dd = d.d.toString().padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  // Año solo (4 dígitos)
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return `${yearOnly[1]}-01-01`;
  return null;
}

/**
 * Parsea la celda "Superficie Amparada" (formato libre).
 * Acepta: "2.30 m x 1 m", "2.00 x 1 mts", "2.30 x 1", "2 x 1 m", etc.
 *
 * CONVENCIÓN del Excel: el formato es "LARGO × ANCHO" (primero el
 * número grande, después el pequeño). Entonces:
 *   - nums[0] (primero) = largo → se guarda en `alto`
 *   - nums[1] (segundo) = ancho → se guarda en `ancho`
 *
 * Devuelve { ancho, alto } en metros.
 */
function parseSuperficie(s: string): { ancho: string; alto: string } {
  if (!s) return { ancho: "", alto: "" };
  const nums = s.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return { ancho: "", alto: "" };
  if (nums.length === 1) return { ancho: nums[0], alto: "" };
  // nums[0] = LARGO (el grande) → `alto`
  // nums[1] = ANCHO (el pequeño) → `ancho`
  return { ancho: nums[1], alto: nums[0] };
}

/**
 * Parsea la celda "MANTENIMIENTO" (años separados por coma o "y").
 * Acepta: "2023, 2024, 2025", "2025 y 2026", "Pago de mantenimiento 2024".
 * Devuelve array de números (años).
 */
function parseMantenimiento(s: string): number[] {
  if (!s) return [];
  // Encuentra todos los años de 4 dígitos (1900-2100)
  const years = s.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/g);
  if (!years) return [];
  return years.map((y) => parseInt(y, 10)).filter((n) => n >= 1900 && n <= 2100);
}

/** Lee un archivo Excel y devuelve las filas parseadas (solo la 1ª hoja). */
export function parsearExcel(rows: unknown[][]): {
  filas: FilaImportada[];
  advertencias: string[];
} {
  const advertencias: string[] = [];
  if (rows.length < 2) {
    return { filas: [], advertencias: ["El archivo no tiene filas de datos (solo encabezados o vacío)."] };
  }
  const headers = rows[0].map((h) => cellToStr(h));
  // Mapear columnas
  const colTitular = findCol(headers, ["Titular", "Nombre del Propietario"]);
  const colNumeroTitulo = findCol(headers, ["N° de Título", "Numero de Titulo", "NUMERO DE TITULO", "N° de Titulo"]);
  const colFechaTitulo = findCol(headers, ["Fecha Título", "Fecha de Titulo", "FECHA DE TITULO", "Fecha Titulo"]);
  const colSuperficie = findCol(headers, ["Superficie Amparada", "SUPERFICIE AMPARADA"]);
  const colSeccion = findCol(headers, ["Sección", "Seccion", "SECCION"]);
  const colLinea = findCol(headers, ["Línea", "Linea", "LINEA"]);
  // Detecta el número de la entidad. Algunas hojas usan "Número Fosa",
  // otras "Número Gaveta". El parser acepta ambas variantes.
  // IMPORTANTE: se busca por palabras completas (fosa/gaveta) para
  // evitar falsos positivos con "FOSA" suelta que podría ser parte de
  // otro encabezado.
  const colNumeroFosa = findCol(headers, [
    "Número Fosa", "Numero Fosa", "Numero de Fosa", "No Fosa",
    "Número Gaveta", "Numero Gaveta", "Numero de Gaveta", "No Gaveta",
  ]);
  const colLibro = findCol(headers, ["Libro", "LIBRO"]);
  const colRegistro = findCol(headers, ["Registro", "REGISTRO"]);
  const colDomicilio = findCol(headers, ["Domicilio", "DOMICILIO"]);
  const colTelefono = findCol(headers, ["Teléfono", "Telefono", "TELEFONO"]);
  const colNumSepult = findCol(headers, ["N° Sepultados", "Numero de Sepultados", "N_SEPULT", "N° de Sepultados"]);
  // Sepultados: 7 pares NOMBRE(N)/FECHA(N)
  const sepNombres: number[] = [];
  const sepFechas: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const n = findCol(headers, [`NOMBRE${i}`, `NOMBRE ${i}`, `Nombre ${i}`, `Nombre${i}`]);
    const f = findCol(headers, [`FECHA${i}`, `FECHA ${i}`, `Fecha ${i}`, `Fecha${i}`]);
    if (n !== -1) sepNombres.push(n);
    if (f !== -1) sepFechas.push(f);
  }
  // Exhumaciones
  const colNumExh = findCol(headers, ["N° de Exhumaciones", "NUMERO DE EXHUMACIONES", "Numero de Exhumaciones"]);
  const exhNombres: number[] = [];
  const exhFechas: number[] = [];
  // Las columnas de exhumaciones están después de "N° de Exhumaciones"
  // Buscamos por número dentro de un rango
  if (colNumExh !== -1) {
    for (let i = 1; i <= 7; i++) {
      const n = findCol(headers, [`NOMBRE${i}`, `NOMBRE ${i}`, `Nombre ${i}`, `Nombre${i}`]);
      const f = findCol(headers, [`FECHA${i}`, `FECHA ${i}`, `Fecha ${i}`, `Fecha${i}`]);
      // Solo los que están después de colNumExh
      if (n > colNumExh) exhNombres.push(n);
      if (f > colNumExh) exhFechas.push(f);
    }
  }
  const colMantenimiento = findCol(headers, ["MANTENIMIENTO", "Mantenimiento"]);
  const colBeneficiario = findCol(headers, ["BENEFICIARIO", "Beneficiario"]);
  const colObservaciones = findCol(headers, ["OBSERVACIONES", "Observaciones"]);
  const colNotasLibro = findCol(headers, ["NOTAS DEL LIBRO", "Notas del Libro", "Notas del libro"]);

  if (colNumeroFosa === -1) {
    advertencias.push(
      "No se encontró la columna 'Número Fosa' ni 'Número Gaveta'. Las filas no se importarán.",
    );
  } else {
    // Avisar qué columna se detectó
    const nombreCol = headers[colNumeroFosa];
    if (nombreCol && /gaveta/i.test(nombreCol)) {
      advertencias.push(`Detectada columna '${nombreCol}'. Las filas se importarán como GAVETAS.`);
    } else if (nombreCol && /fosa/i.test(nombreCol)) {
      advertencias.push(`Detectada columna '${nombreCol}'. Las filas se importarán como FOSAS.`);
    }
  }
  if (colSeccion === -1) {
    advertencias.push("No se encontró la columna Sección.");
  }
  if (colLinea === -1) {
    advertencias.push("No se encontró la columna Línea.");
  }

  const filas: FilaImportada[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const v = (idx: number) => (idx === -1 ? "" : cellToStr(row[idx]));
    const f = (idx: number) => (idx === -1 ? null : cellToDate(row[idx]));
    const num = cellToStr(row[colNumeroFosa]);
    if (!num) continue; // fila vacía
    const titular = v(colTitular);
    // Si la fila está completamente vacía, saltar
    if (!titular && !num && !v(colSeccion)) continue;

    // Sepultados: tomar los pares en orden hasta que ambos estén vacíos
    const sepultura: { nombre: string; fecha: string | null }[] = [];
    const totalSep = Math.max(sepNombres.length, sepFechas.length);
    for (let j = 0; j < totalSep; j++) {
      const n = v(sepNombres[j] ?? -1);
      const fch = f(sepFechas[j] ?? -1);
      if (n || fch) sepultura.push({ nombre: n, fecha: fch });
    }
    // Exhumaciones
    const exhumaciones: { nombre: string; fecha: string | null }[] = [];
    const totalExh = Math.max(exhNombres.length, exhFechas.length);
    for (let j = 0; j < totalExh; j++) {
      const n = v(exhNombres[j] ?? -1);
      const fch = f(exhFechas[j] ?? -1);
      if (n || fch) exhumaciones.push({ nombre: n, fecha: fch });
    }
    const sup = parseSuperficie(v(colSuperficie));
    filas.push({
      titular_nombre: titular,
      numero_titulo: v(colNumeroTitulo),
      fecha_titulo: f(colFechaTitulo),
      superficie_ancho: sup.ancho,
      superficie_alto: sup.alto,
      seccion_codigo: v(colSeccion),
      linea_codigo: v(colLinea),
      numero: num,
      libro: v(colLibro),
      registro: v(colRegistro),
      titular_domicilio: v(colDomicilio),
      titular_telefono: v(colTelefono),
      sepultados: sepultura,
      exhumaciones,
      mantenimientos: parseMantenimiento(v(colMantenimiento)),
      beneficiario: v(colBeneficiario),
      observaciones: v(colObservaciones),
      notas_libro: v(colNotasLibro),
    });
  }
  return { filas, advertencias };
}

/** Lee un archivo del disco (Tauri o fallback) y devuelve filas + advertencias. */
export async function leerExcel(path: string): Promise<{
  filas: FilaImportada[];
  advertencias: string[];
}> {
  let workbook: XLSX.WorkBook;
  if (path.startsWith("file://") || path.startsWith("content://") || path.startsWith("data:")) {
    // Es una URL, fetch (Tauri file input)
    const resp = await fetch(path);
    const buf = await resp.arrayBuffer();
    workbook = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
  } else {
    // Es una ruta local, leemos con Tauri fs o fetch
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const data = await readFile(path);
    workbook = XLSX.read(data, { type: "buffer", cellDates: true });
  }
  // Solo la primera hoja
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { filas: [], advertencias: ["El archivo no contiene hojas."] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return parsearExcel(rows as unknown[][]);
}

/** Abre un dialog para que el usuario elija un Excel y lo lee. */
export async function seleccionarYLeerExcel(): Promise<{
  filas: FilaImportada[];
  advertencias: string[];
  path: string | null;
}> {
  const path = await openDialog({
    multiple: false,
    filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
  });
  if (!path || Array.isArray(path)) {
    return { filas: [], advertencias: [], path: null };
  }
  const { filas, advertencias } = await leerExcel(path as string);
  return { filas, advertencias, path: path as string };
}

/** Genera un workbook con las filas pasadas (para exportar). */
export function exportarAFilaExcel(filas: FilaImportada[]): XLSX.WorkBook {
  const headers = [
    "Titular", "N° de Título", "Fecha Título", "Superficie Amparada",
    "Sección", "Línea", "Número Fosa", "Libro", "Registro",
    "Domicilio", "Teléfono", "N° Sepultados",
    "NOMBRE1", "FECHA1", "NOMBRE2", "FECHA2", "NOMBRE3", "FECHA3",
    "NOMBRE4", "FECHA4", "NOMBRE5", "FECHA5", "NOMBRE6", "FECHA6",
    "NOMBRE7", "FECHA7",
    "N° de Exhumaciones",
    "NOMBRE1", "FECHA1", "NOMBRE2", "FECHA2", "NOMBRE3", "FECHA3",
    "NOMBRE4", "FECHA4", "NOMBRE5", "FECHA5", "NOMBRE6", "FECHA6",
    "NOMBRE7", "FECHA7",
    "MANTENIMIENTO", "BENEFICIARIO", "OBSERVACIONES", "NOTAS DEL LIBRO",
  ];
  const rows: unknown[][] = [headers];
  for (const f of filas) {
    const row: unknown[] = [];
    row.push(f.titular_nombre);
    row.push(f.numero_titulo);
    row.push(f.fecha_titulo ?? "");
    row.push(f.superficie_ancho && f.superficie_alto
      ? `${f.superficie_ancho} m x ${f.superficie_alto} m`
      : f.superficie_ancho || f.superficie_alto || "");
    row.push(f.seccion_codigo);
    row.push(f.linea_codigo);
    row.push(f.numero);
    row.push(f.libro);
    row.push(f.registro);
    row.push(f.titular_domicilio);
    row.push(f.titular_telefono);
    row.push(f.sepultados.length);
    // 7 pares de sepultados
    for (let i = 0; i < 7; i++) {
      row.push(f.sepultados[i]?.nombre ?? "");
      row.push(f.sepultados[i]?.fecha ?? "");
    }
    row.push(f.exhumaciones.length);
    for (let i = 0; i < 7; i++) {
      row.push(f.exhumaciones[i]?.nombre ?? "");
      row.push(f.exhumaciones[i]?.fecha ?? "");
    }
    row.push(f.mantenimientos.join(", "));
    row.push(f.beneficiario);
    row.push(f.observaciones);
    row.push(f.notas_libro);
    rows.push(row);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fosas");
  return wb;
}

/** Genera el Excel y abre un dialog para guardarlo. */
export async function guardarExcel(wb: XLSX.WorkBook, defaultName: string): Promise<string | null> {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const path = await saveDialog({
    defaultPath: defaultName,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (!path) return null;
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(path as string, new Uint8Array(wbout as ArrayBuffer));
  return path as string;
}
