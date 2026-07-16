import { getDb } from "../../lib/db";

function escLike(v: string): string {
  return v.replace(/'/g, "''").replace(/[%_]/g, "\\$&");
}

export type ResultadoTipo =
  | "fosa-titular"
  | "fosa-titulo"
  | "gaveta-titular"
  | "gaveta-titulo"
  | "sepultado"
  | "exhumado";

export interface ResultadoBusqueda {
  /** Categoría del resultado. */
  tipo: ResultadoTipo;
  /** ID de la entidad que contiene el match (fosa, gaveta, o la entidad dueña del sepultado/exhumado). */
  fosa_id?: number;
  gaveta_id?: number;
  /**
   * El valor que matcheó con la búsqueda.
   *  - Para `*-titular`: es el nombre del titular.
   *  - Para `*-titulo`:  es el número de título.
   *  - Para `sepultado`/`exhumado`: es el nombre de la persona.
   */
  nombre: string;
  /** Contexto extra para mostrar. */
  extra?: {
    panteon?: string;
    seccion?: string;
    linea?: string;
    numero?: string | number;
    fecha?: string;
    notas?: string | null;
    /** Para el match principal: titular. Para match por título: el titular de la ficha. */
    titular_nombre?: string;
    /** Para el match principal: número de título. Para match por titular: el título de la ficha. */
    numero_titulo?: string;
    /** Solo para sepultado: fecha de fallecimiento (si se conoce). */
    fecha_fallecimiento?: string | null;
    /** Solo para sepultado: edad al fallecer (si se conoce). */
    edad?: number | null;
    /** Solo para exhumado: destino de los restos. */
    destino?: string | null;
  };
}

export const busquedaService = {
  /**
   * Búsqueda global: titular de fosa/gaveta, número de título de fosa/gaveta,
   * nombre de sepultado y nombre de exhumado. Devuelve hasta `limite`
   * resultados en cada categoría.
   */
  async buscar(q: string, limite = 25): Promise<ResultadoBusqueda[]> {
    const term = q.trim();
    if (!term) return [];
    const like = `%${escLike(term.toLowerCase())}%`;
    const db = await getDb();

    const [fosasTitular, fosasTitulo, gavetasTitular, gavetasTitulo,
      sepsF, sepsG, exhF, exhG] = await Promise.all([
      db.select<Array<{
        id: number; numero: string; titular_nombre: string; numero_titulo: string;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT f.id, f.numero, f.titular_nombre, f.numero_titulo,
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
        id: number; numero: string; titular_nombre: string; numero_titulo: string;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT f.id, f.numero, f.titular_nombre, f.numero_titulo,
               p.nombre AS panteon,
               s.codigo || ' — ' || s.nombre AS seccion,
               l.codigo || ' — ' || l.nombre AS linea
        FROM fosas f
        JOIN lineas l ON l.id = f.linea_id
        JOIN secciones s ON s.id = l.seccion_id
        JOIN panteones p ON p.id = s.panteon_id
        WHERE f.numero_titulo <> ''
          AND LOWER(f.numero_titulo) LIKE '${like}'
        LIMIT ${Number(limite)}
      `).catch(() => []),
      db.select<Array<{
        id: number; numero: number; titular_nombre: string; numero_titulo: string;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT g.id, g.numero, g.titular_nombre, g.numero_titulo,
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
        id: number; numero: number; titular_nombre: string; numero_titulo: string;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT g.id, g.numero, g.titular_nombre, g.numero_titulo,
               p.nombre AS panteon,
               s.codigo || ' — ' || s.nombre AS seccion,
               l.codigo || ' — ' || l.nombre AS linea
        FROM gavetas g
        JOIN lineas l ON l.id = g.linea_id
        JOIN secciones s ON s.id = l.seccion_id
        JOIN panteones p ON p.id = s.panteon_id
        WHERE g.numero_titulo <> ''
          AND LOWER(g.numero_titulo) LIKE '${like}'
        LIMIT ${Number(limite)}
      `).catch(() => []),
      db.select<Array<{
        id: number; nombre: string; fecha_sepultacion: string;
        fecha_fallecimiento: string | null; edad: number | null;
        notas: string | null;
        fosa_id: number; fosa_numero: string;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT s.id, s.nombre, s.fecha_sepultacion, s.fecha_fallecimiento, s.edad, s.notas,
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
        fecha_fallecimiento: string | null; edad: number | null;
        notas: string | null;
        gaveta_id: number; gaveta_numero: number;
        panteon: string; seccion: string; linea: string;
      }>>(`
        SELECT s.id, s.nombre, s.fecha_sepultacion, s.fecha_fallecimiento, s.edad, s.notas,
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

    for (const f of fosasTitular) {
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
          numero_titulo: f.numero_titulo || undefined,
        },
      });
    }
    for (const f of fosasTitulo) {
      // No duplicar si ya lo encontramos por nombre del titular
      if (res.some((r) => r.tipo === "fosa-titular" && r.fosa_id === f.id)) {
        // Opcional: podríamos enriquecer el resultado existente con numero_titulo.
        // Como ya agregamos numero_titulo arriba, lo saltamos.
        continue;
      }
      res.push({
        tipo: "fosa-titulo",
        fosa_id: f.id,
        nombre: f.numero_titulo,
        extra: {
          panteon: f.panteon,
          seccion: f.seccion,
          linea: f.linea,
          numero: f.numero,
          titular_nombre: f.titular_nombre,
          numero_titulo: f.numero_titulo,
        },
      });
    }
    for (const g of gavetasTitular) {
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
          numero_titulo: g.numero_titulo || undefined,
        },
      });
    }
    for (const g of gavetasTitulo) {
      if (res.some((r) => r.tipo === "gaveta-titular" && r.gaveta_id === g.id)) {
        continue;
      }
      res.push({
        tipo: "gaveta-titulo",
        gaveta_id: g.id,
        nombre: g.numero_titulo,
        extra: {
          panteon: g.panteon,
          seccion: g.seccion,
          linea: g.linea,
          numero: g.numero,
          titular_nombre: g.titular_nombre,
          numero_titulo: g.numero_titulo,
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
          fecha_fallecimiento: s.fecha_fallecimiento,
          edad: s.edad,
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
          destino: e.destino,
          notas: e.notas,
        },
      });
    }

    return res;
  },
};
