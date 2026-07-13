import jsPDF from "jspdf";
import { formatCurrency, formatDateLong } from "@/lib/utils";
import type {
  MemorandumDetalle, AppConfig, Panteon, FosaDetalle, Gaveta, GavetaDetalle,
  Fosa,
} from "@/types";

interface GenerateOpts {
  memorandum: MemorandumDetalle;
  /** Contexto de la entidad. Se pasa fosa o gaveta (NO ambas). */
  fosa?: FosaDetalle | Fosa | null;
  gaveta?: GavetaDetalle | Gaveta | null;
  panteon: Panteon | null;
  config: AppConfig;
  logoDataUrl?: string;
}

/**
 * Memorandum en formato CARTA (8.5 x 11 in = 215.9 x 279.4 mm).
 * El diseño está compactado a la mitad superior de la hoja. Sólo imprime
 * el servicio solicitado (no el catálogo completo). El cuerpo es un
 * párrafo justificado con "fills" (subrayados con valor) entremezclados.
 */
export function generarMemorandumPDF({
  memorandum,
  fosa,
  gaveta,
  panteon,
  config,
  logoDataUrl,
}: GenerateOpts): jsPDF {
  const PAGE_W = 215.9;
  const PAGE_H = 279.4;
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
  const margin = 14;
  const innerW = PAGE_W - margin * 2;

  // Datos derivados
  const ent = (fosa ?? gaveta) as Record<string, unknown> | null;
  const fosaNumero = fosa?.numero != null ? `#${fosa.numero}` : "";
  const gavetaNumero = gaveta?.numero != null ? `#${gaveta.numero}` : "";
  const entLabel = fosa ? "fosa" : gaveta ? "gaveta" : "entidad";
  const entNumero = fosaNumero || gavetaNumero || "—";
  const panteonNombre = panteon?.nombre ?? (memorandum.fosa_panteon_nombre || "—");
  const seccionCod = String(ent?.seccion_codigo ?? "");
  const lineaCod = String(ent?.linea_codigo ?? "");
  const ancho = String(ent?.superficie_ancho ?? "").trim();
  const alto = String(ent?.superficie_alto ?? "").trim();
  // Superficie: solo incluir las dimensiones que estén capturadas.
  // Si solo hay ancho, mostrar solo "ancho X m" (no "largo — m").
  // Si solo hay alto, mostrar solo "largo Y m" (no "ancho — m").
  let superficie = "—";
  if (ancho && alto) {
    superficie = `ancho ${ancho} m × largo ${alto} m`;
  } else if (ancho) {
    superficie = `ancho ${ancho} m`;
  } else if (alto) {
    superficie = `largo ${alto} m`;
  }
  const titular = String(ent?.titular_nombre ?? "").trim() || "—";

  const montoStr = formatCurrency(memorandum.monto);
  const fechaStr = formatDateLong(memorandum.fecha_emision);

  // ============== Header ==============
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", margin, 8, 14, 14); }
    catch { /* ignore */ }
  }

  // Bloque presentador (a la izquierda del header)
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("C.P. ANA LILIA REYES CISNEROS", margin, 11);
  doc.setFont("helvetica", "normal");
  doc.text("ENCARGADA DE DESPCHO DE FINANZAS Y", margin, 14);
  doc.text("ADMINISTRACIÓN", margin, 17);

  // Título centrado: "MEMORANDUM {N}" donde N es el consecutivo del folio
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const folioNum = (memorandum.folio.match(/(\d+)$/)?.[1] ?? "0").padStart(4, "0");
  doc.text(`MEMORANDUM ${folioNum}`, PAGE_W / 2, 14, { align: "center" });

  // Fecha y Asunto a la derecha
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`FECHA:`, PAGE_W - margin - 40, 11);
  doc.text(`ASUNTO:`, PAGE_W - margin - 40, 15);
  doc.setFont("helvetica", "bold");
  doc.text(fechaStr, PAGE_W - margin, 11, { align: "right" });
  doc.text("Pago", PAGE_W - margin, 15, { align: "right" });

  // Línea horizontal bajo el header
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.line(margin, 21, PAGE_W - margin, 21);

  // Helper: ancho de fill = ancho del texto + 3mm de padding, con un
  // mínimo de `minW`. Evita que fills con texto largo (p.ej. nombres de
  // panteón) se desborden del subrayado.
  const fw = (text: string, minW = 14): number =>
    Math.max(minW, doc.getTextWidth(text) + 3);

  // ============== Párrafo 1 (justificado, con titular y monto) ==============
  // "Por este conducto le hago su conocimiento que el / la C. {titular}
  //  realizará el pago por la cantidad total de $ {monto}"
  const titW = Math.min(70, fw(titular, 28));
  const monW = fw(montoStr, 28);
  let y = drawJustifiedParagraph(
    doc,
    8,
    [
      { type: "text", value: "Por este conducto le hago su conocimiento que el / la C." },
      { type: "fill", value: titular, width: titW },
      // montoStr ya trae "$" desde formatCurrency; el text NO debe repetirlo.
      { type: "text", value: "realizará el pago por la cantidad total de" },
      { type: "fill", value: montoStr, width: monW },
      { type: "text", value: "." },
    ],
    margin,
    28,
    innerW,
    5,
  );
  y += 10;  // separación antes del servicio (mayor, para que no se vea pegado)

  // ============== Servicio solicitado (centrado, en la misma línea que el precio) ==============
  const nombreServicio = (memorandum.servicio_nombre || "Servicio").toUpperCase();
  // montoStr ya viene con "$" desde formatCurrency; lo usamos tal cual
  // para evitar el doble signo "$ $".
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 80);
  const srvW = doc.getTextWidth(nombreServicio);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0);
  const monW2 = doc.getTextWidth(montoStr);
  const gapSrvMon = 6; // separación entre servicio y precio
  const bloqueW = srvW + gapSrvMon + monW2;
  // La línea base del servicio está en y (sin offset extra). Esto deja
  // el mismo espacio arriba y abajo del servicio.
  const srvY = y;
  const srvX = (PAGE_W - bloqueW) / 2;
  // Dibuja el servicio
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 80);
  doc.text(nombreServicio, srvX, srvY);
  // Dibuja el precio en la misma Y, a la derecha del servicio
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(montoStr, srvX + srvW + gapSrvMon, srvY);
  y = srvY + 10;  // MISMO espacio arriba y abajo del servicio (10mm cada uno)

  // ============== Párrafo 2 (justificado, ubicación + superficie + titular) ==============
  // "De la {fosa/gaveta} #N ubicado en la sección {S} linea {L} {F/G} #N
  //  del Panteón {Nombre} con una superficie amparada de {ancho × largo}
  //  propiedad de C: {titular}. Lo anterior para los tramites correspondientes."
  const entLabelW = fw(entLabel, 14);
  const entNum = (fosaNumero || gavetaNumero || "—");
  const entEntNum = fosaNumero ? fosaNumero : (gavetaNumero || "—");
  y = drawJustifiedParagraph(
    doc,
    7,
    [
      { type: "text", value: "De la" },
      { type: "fill", value: entLabel, width: entLabelW },
      { type: "text", value: `${entNum} ubicado en la sección` },
      { type: "fill", value: seccionCod || "—", width: fw(seccionCod || "—", 14) },
      { type: "text", value: "linea" },
      { type: "fill", value: lineaCod || "—", width: fw(lineaCod || "—", 12) },
      { type: "text", value: entLabel },
      { type: "fill", value: entEntNum, width: fw(entEntNum, 10) },
      { type: "text", value: "del Panteón" },
      { type: "fill", value: panteonNombre, width: fw(panteonNombre, 30) },
      { type: "text", value: "con una superficie amparada de" },
      { type: "fill", value: superficie, width: fw(superficie, 30) },
      { type: "text", value: "propiedad de" },
      { type: "fill", value: `C: ${titular}`, width: fw(`C: ${titular}`, 30) },
      { type: "text", value: ". Lo anterior para los tramites correspondientes." },
    ],
    margin,
    y,
    innerW,
    4.5,
  );

  // ============== Firmas ==============
  // Cada firma tiene una línea horizontal. El nombre y los cargos van
  // centrados respecto a esa línea, no anclados a la izquierda.
  const firmaY = Math.max(y + 6, 78);
  const colIzqX = margin;
  const colDerX = PAGE_W - margin - 65;
  const colIzqCentro = colIzqX + 35;  // centro de la línea izq (de +5 a +65)
  const colDerCentro = colDerX + 30;  // centro de la línea der (de 0 a +60)

  doc.line(colIzqX + 5, firmaY, colIzqX + 65, firmaY);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("C. JOSE LUIS MORENO ROJAS", colIzqCentro, firmaY + 3, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("DIRECTOR DE LA DIRECCIÓN DE SERVICIOS PÚBLICOS", colIzqCentro, firmaY + 5.5, { align: "center" });
  doc.text("MUNICIPALES Y MANTENIMIENTO", colIzqCentro, firmaY + 8, { align: "center" });

  doc.line(colDerX, firmaY, colDerX + 60, firmaY);
  doc.setFont("helvetica", "bold");
  doc.text("PROF. GABRIEL HERRERA NERI", colDerCentro, firmaY + 3, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("JEFE DEL DEPARTAMENTO DE PANTEONES Y", colDerCentro, firmaY + 5.5, { align: "center" });
  doc.text("MANTENIMIENTO", colDerCentro, firmaY + 8, { align: "center" });

  // ============== Observación ==============
  if (memorandum.notas) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVACIÓN:", margin, firmaY + 14);
    doc.setFont("helvetica", "normal");
    const obsLines = doc.splitTextToSize(memorandum.notas, innerW);
    doc.text(obsLines, margin, firmaY + 17);
  }

  // ============== Pie de página ==============
  if (config.ciudad || config.pie_pagina) {
    doc.setFontSize(6);
    doc.setTextColor(120);
    const txt = [config.ciudad, config.pie_pagina].filter(Boolean).join(" · ");
    if (txt) doc.text(txt, PAGE_W / 2, PAGE_H - 8, { align: "center" });
    doc.setTextColor(0);
  }

  return doc;
}

interface Segment {
  type: "text" | "fill";
  value: string;
  width?: number;
}

type Token = { kind: "word"; text: string } | { kind: "fill"; value: string; width: number };

/**
 * Si un fill es más ancho que `maxW`, lo divide por palabras en
 * sub-fills que cada uno cabe en `maxW`. Esto evita que un nombre de
 * panteón o titular muy largo desborde el margen derecho.
 * Si una palabra su sola ya excede `maxW` (caso patológico), se emite
 * tal cual y se le añade un flag para que el render la abrevie.
 */
function dividirFill(doc: jsPDF, value: string, maxW: number): { value: string; width: number; overflow: boolean }[] {
  const fullW = doc.getTextWidth(value) + 3;
  if (fullW <= maxW) return [{ value, width: fullW, overflow: false }];

  const words = value.split(/\s+/).filter((w) => w.length > 0);
  const subs: { value: string; width: number; overflow: boolean }[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const testW = doc.getTextWidth(test) + 3;
    if (testW <= maxW) {
      current = test;
    } else {
      if (current) {
        subs.push({ value: current, width: doc.getTextWidth(current) + 3, overflow: false });
      }
      const wordW = doc.getTextWidth(word) + 3;
      if (wordW > maxW) {
        // Una sola palabra ya no cabe. Truncamos con elipsis.
        let trunc = word;
        while (trunc.length > 3 && doc.getTextWidth(trunc) + 3 > maxW) {
          trunc = trunc.slice(0, -1);
        }
        subs.push({ value: trunc + "…", width: doc.getTextWidth(trunc + "…") + 3, overflow: true });
        current = "";
      } else {
        current = word;
      }
    }
  }
  if (current) {
    subs.push({ value: current, width: doc.getTextWidth(current) + 3, overflow: false });
  }
  return subs.length > 0 ? subs : [{ value, width: fullW, overflow: true }];
}

/**
 * Tokeniza los segmentos en palabras y fills. Los fills que exceden
 * `maxW` se dividen en sub-fills. Los fills que se dividen llevan
 * un flag `overflow: true` para que el render pueda ajustar su estilo
 * (p.ej. un guion de continuación).
 */
function tokenizar(doc: jsPDF, segs: Segment[], maxW: number): Token[] {
  const tokens: Token[] = [];
  for (const s of segs) {
    if (s.type === "text") {
      const parts = s.value.match(/\S+|\s+/g) ?? [s.value];
      for (const p of parts) {
        if (/^\s+$/.test(p)) continue;
        tokens.push({ kind: "word", text: p });
      }
    } else {
      const subs = dividirFill(doc, s.value, maxW);
      for (const sub of subs) {
        tokens.push({ kind: "fill", value: sub.value, width: sub.width });
      }
    }
  }
  return tokens;
}

/**
 * Construye líneas de tokens que caben en `maxW`. Cuando un token (text o
 * fill) no cabe en la línea actual, hace BACKTRACK al último "word"
 * (no fill) de la línea y mueve desde ahí a la siguiente. Esto mantiene
 * los pares (text, fill) juntos para que un fill no quede huérfano en
 * una línea con un "del Panteón" colgando, ni se salga del margen.
 */
function buildLines(doc: jsPDF, tokens: Token[], maxW: number): Token[][] {
  const wcache = new Map<string, number>();
  const w = (t: Token): number => {
    if (t.kind === "word") {
      let v = wcache.get(t.text);
      if (v === undefined) { v = doc.getTextWidth(t.text); wcache.set(t.text, v); }
      return v;
    }
    return t.width;
  };
  const spaceW = doc.getTextWidth(" ");

  const lines: Token[][] = [];
  let current: Token[] = [];
  let currentW = 0;

  for (const t of tokens) {
    const tw = w(t);

    if (current.length > 0 && currentW + tw > maxW) {
      // Backtrack: encontrar el último "word" en `current`.
      let lastWordIdx = -1;
      for (let i = current.length - 1; i >= 0; i--) {
        if (current[i].kind === "word") { lastWordIdx = i; break; }
      }
      if (lastWordIdx === -1) {
        // No hay words anteriores. Esto significa que el último token
        // de current es un fill que ocupa toda la línea (o más). Lo
        // cerramos en su propia línea y empezamos una nueva con `t`.
        lines.push(current);
        current = [t];
        currentW = tw + spaceW;
      } else {
        // Mover desde `lastWordIdx` a la nueva línea, junto con `t`.
        const tail = current.splice(lastWordIdx);
        lines.push(current);
        current = [...tail, t];
        currentW = tail.reduce((acc, x) => acc + w(x), 0) + tw + spaceW * (tail.length + 1);
      }
    } else {
      current.push(t);
      currentW += tw + spaceW;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * Dibuja un párrafo justificado a partir de segmentos (texto y fills con
 * subrayados). Hace word-wrapping automático. Justifica cada línea
 * excepto la última (que queda alineada a la izquierda con espacios
 * normales entre palabras).
 *
 * Devuelve la `y` final (después de la última línea) para que el caller
 * pueda seguir dibujando debajo.
 */
function drawJustifiedParagraph(
  doc: jsPDF,
  fontSize: number,
  segs: Segment[],
  x: number,
  y: number,
  maxW: number,
  lineHeight: number,
): number {
  doc.setLineWidth(0.25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);

  const tokens = tokenizar(doc, segs, maxW);
  const lines = buildLines(doc, tokens, maxW);

  const wcache = new Map<string, number>();
  const w = (t: Token): number => {
    if (t.kind === "word") {
      let v = wcache.get(t.text);
      if (v === undefined) { v = doc.getTextWidth(t.text); wcache.set(t.text, v); }
      return v;
    }
    return t.width;
  };
  const spaceW = doc.getTextWidth(" ");

  let cy = y;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const isLast = li === lines.length - 1;
    const totalW = line.reduce((acc, t) => acc + w(t), 0);
    const nGaps = Math.max(0, line.length - 1);
    const freeSpace = maxW - totalW;
    // IMPORTANTE: NO sumar spaceW a freeSpace/nGaps. En `buildLines`
    // ya acumulamos `+ spaceW` después de cada token en `currentW`, así
    // que el `gap` en el render es el ESPACIO TOTAL entre tokens (no el
    // adicional encima de un spaceW). Sumar spaceW extra causaba que la
    // línea final midiera (N-1) * spaceW mm más de maxW, desbordando el
    // margen derecho.
    const gap = nGaps === 0
      ? 0
      : isLast
        ? spaceW
        : Math.max(spaceW, freeSpace / nGaps);

    let cursor = x;
    for (let i = 0; i < line.length; i++) {
      const t = line[i];
      const tw = w(t);
      if (t.kind === "word") {
        doc.text(t.text, cursor, cy);
        cursor += tw;
      } else {
        doc.line(cursor, cy + 0.5, cursor + tw, cy + 0.5);
        const textW = doc.getTextWidth(t.value);
        doc.text(t.value, cursor + Math.max(0, (tw - textW) / 2), cy);
        cursor += tw;
      }
      if (i < line.length - 1) cursor += gap;
    }
    cy += lineHeight;
  }
  return cy;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
