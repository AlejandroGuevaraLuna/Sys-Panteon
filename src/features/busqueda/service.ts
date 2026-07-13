import { getDb } from "../../lib/db";

function escLike(v: string): string {
  return v.replace(/'/g, "''").replace(/[%_]/g, "\\$&");
}

export interface ResultadoBusqueda {
  /** Categoría del resultado. */
  tipo: "fosa-titular" | "gaveta-titular" | "sepultado" | "exhumado";
  /** ID de la entidad que contiene el match (fosa, gaveta, o la entidad dueña del sepultado/exhumado). */
  fosa_id?: number;
  gaveta_id?: number;
  /** Nombre que matcheó (titular, sepultado o exhumado). */
  nombre: string;
  /** Contexto extra para mostrar. */
  extra?: {
    panteon?: string;
    seccion?: string;
    linea?: string;
    numero?: string | number;
    fecha?: string;
    notas?: string | null;
    /** Para titular: coincide con el de la ficha. Para sepultado: nombre en la ficha. */
    titular_nombre?: string;
  };
}

export const busquedaService = {
  /**
   * Búsqueda global: titular de fosa/gaveta, nombre de sepultado y
   * nombre de exhumado. Devuelve hasta `limite` resultados en cada categoría.
   */
  async buscar(q: string, limite = 25): Promise<ResultadoBusqueda[]> {
    const term = q.trim();
    if (!term) return [];
    const like = `%${escLike(term.toLowerCase())}%`;
    const db = await getDb();

    const [fosas, gavetas, sepsF, sepsG, exhF, exhG] = await Promise.all([
      db.select<Array<{
        id: number; numero: string; titular_nombre: string;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT f.id, f.numero, f.titular_nombre,
               p.nombre AS panteon,
               s.codigo || ' — ' || s.nombre AS seccion,
               l.codigo || ' — ' || l.nombre AS linea
        FROM fosas f
        JOIN lineas l ON l.id = f.linea_id
        JOIN secciones s ON s.id = l.seccion_id
        JOIN panteones p ON p.id = s.panteon_id
        WHERE LOWER(f.titular_nombre) LIKE '${like}'
        LIMIT ${Number(limite)}
      `).catch(() => []),
      db.select<Array<{
        id: number; numero: number; titular_nombre: string;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT g.id, g.numero, g.titular_nombre,
               p.nombre AS panteon,
               s.codigo || ' — ' || s.nombre AS seccion,
               l.codigo || ' — ' || l.nombre AS linea
        FROM gavetas g
        JOIN lineas l ON l.id = g.linea_id
        JOIN secciones s ON s.id = l.seccion_id
        JOIN panteones p ON p.id = s.panteon_id
        WHERE LOWER(g.titular_nombre) LIKE '${like}'
        LIMIT ${Number(limite)}
      `).catch(() => []),
      db.select<Array<{
        id: number; nombre: string; fecha_sepultacion: string;
        fecha_fallecimiento: string | null; notas: string | null;
        fosa_id: number; fosa_numero: string;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT s.id, s.nombre, s.fecha_sepultacion, s.fecha_fallecimiento, s.notas,
               f.id AS fosa_id, f.numero AS fosa_numero,
               p.nombre AS panteon,
               s2.codigo || ' — ' || s2.nombre AS seccion,
               l.codigo || ' — ' || l.nombre AS linea
        FROM sepultaciones s
        JOIN fosas f ON f.id = s.fosa_id
        JOIN lineas l ON l.id = f.linea_id
        JOIN secciones s2 ON s2.id = l.seccion_id
        JOIN panteones p ON p.id = s2.panteon_id
        WHERE LOWER(s.nombre) LIKE '${like}'
          AND s.fosa_id IS NOT NULL
        LIMIT ${Number(limite)}
      `).catch(() => []),
      db.select<Array<{
        id: number; nombre: string; fecha_sepultacion: string;
        fecha_fallecimiento: string | null; notas: string | null;
        gaveta_id: number; gaveta_numero: number;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT s.id, s.nombre, s.fecha_sepultacion, s.fecha_fallecimiento, s.notas,
               g.id AS gaveta_id, g.numero AS gaveta_numero,
               p.nombre AS panteon,
               s2.codigo || ' — ' || s2.nombre AS seccion,
               l.codigo || ' — ' || l.nombre AS linea
        FROM sepultaciones s
        JOIN gavetas g ON g.id = s.gaveta_id
        JOIN lineas l ON l.id = g.linea_id
        JOIN secciones s2 ON s2.id = l.seccion_id
        JOIN panteones p ON p.id = s2.panteon_id
        WHERE LOWER(s.nombre) LIKE '${like}'
          AND s.gaveta_id IS NOT NULL
        LIMIT ${Number(limite)}
      `).catch(() => []),
      db.select<Array<{
        id: number; nombre: string; fecha_exhumacion: string;
        destino: string | null; notas: string | null;
        fosa_id: number; fosa_numero: string;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT e.id, e.nombre, e.fecha_exhumacion, e.destino, e.notas,
               f.id AS fosa_id, f.numero AS fosa_numero,
               p.nombre AS panteon,
               s2.codigo || ' — ' || s2.nombre AS seccion,
               l.codigo || ' — ' || l.nombre AS linea
        FROM exhumaciones e
        JOIN fosas f ON f.id = e.fosa_id
        JOIN lineas l ON l.id = f.linea_id
        JOIN secciones s2 ON s2.id = l.seccion_id
        JOIN panteones p ON p.id = s2.panteon_id
        WHERE LOWER(e.nombre) LIKE '${like}'
          AND e.fosa_id IS NOT NULL
        LIMIT ${Number(limite)}
      `).catch(() => []),
      db.select<Array<{
        id: number; nombre: string; fecha_exhumacion: string;
        destino: string | null; notas: string | null;
        gaveta_id: number; gaveta_numero: number;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT e.id, e.nombre, e.fecha_exhumacion, e.destino, e.notas,
               g.id AS gaveta_id, g.numero AS gaveta_numero,
               p.nombre AS panteon,
               s2.codigo || ' — ' || s2.nombre AS seccion,
               l.codigo || ' — ' || l.nombre AS linea
        FROM exhumaciones e
        JOIN gavetas g ON g.id = e.gaveta_id
        JOIN lineas l ON l.id = g.linea_id
        JOIN secciones s2 ON s2.id = l.seccion_id
        JOIN panteones p ON p.id = s2.panteon_id
        WHERE LOWER(e.nombre) LIKE '${like}'
          AND e.gaveta_id IS NOT NULL
        LIMIT ${Number(limite)}
      `).catch(() => []),
    ]);

    const res: ResultadoBusqueda[] = [];

    for (const f of fosas) {
      res.push({
        tipo: "fosa-titular",
        fosa_id: f.id,
        nombre: f.titular_nombre,
        extra: {
          panteon: f.panteon,
          seccion: f.seccion,
          linea: f.linea,
          numero: f.numero,
          titular_nombre: f.titular_nombre,
        },
      });
    }
    for (const g of gavetas) {
      res.push({
        tipo: "gaveta-titular",
        gaveta_id: g.id,
        nombre: g.titular_nombre,
        extra: {
          panteon: g.panteon,
          seccion: g.seccion,
          linea: g.linea,
          numero: g.numero,
          titular_nombre: g.titular_nombre,
        },
      });
    }
    for (const s of [...sepsF, ...sepsG]) {
      const isFosa = "fosa_id" in s && s.fosa_id != null;
      res.push({
        tipo: "sepultado",
        fosa_id: isFosa ? (s as { fosa_id: number }).fosa_id : undefined,
        gaveta_id: !isFosa ? (s as { gaveta_id: number }).gaveta_id : undefined,
        nombre: s.nombre,
        extra: {
          panteon: s.panteon,
          seccion: s.seccion,
          linea: s.linea,
          numero: (s as { fosa_numero?: string; gaveta_numero?: number })
            .fosa_numero ?? (s as { gaveta_numero: number }).gaveta_numero,
          fecha: s.fecha_sepultacion,
          notas: s.notas,
        },
      });
    }
    for (const e of [...exhF, ...exhG]) {
      const isFosa = "fosa_id" in e && e.fosa_id != null;
      res.push({
        tipo: "exhumado",
        fosa_id: isFosa ? (e as { fosa_id: number }).fosa_id : undefined,
        gaveta_id: !isFosa ? (e as { gaveta_id: number }).gaveta_id : undefined,
        nombre: e.nombre,
        extra: {
          panteon: e.panteon,
          seccion: e.seccion,
          linea: e.linea,
          numero: (e as { fosa_numero?: string; gaveta_numero?: number })
            .fosa_numero ?? (e as { gaveta_numero: number }).gaveta_numero,
          fecha: e.fecha_exhumacion,
          notas: e.destino || e.notas,
        },
      });
    }

    return res;
  },
};
