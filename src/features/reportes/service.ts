import { getDb } from "../../lib/db";

export interface ReportePorServicio {
  servicio_id: number;
  servicio_nombre: string;
  servicio_tipo: string;
  /** Año en formato YYYY */
  anio: number;
  /** Mes 1-12 → { count, total $ } */
  meses: Record<number, { count: number; monto: number }>;
}

export const reportesService = {
  /**
   * Devuelve el reporte anual de TODOS los servicios. Cada servicio
   * tiene los 12 meses con su conteo y monto.
   *
   * Si `anio` no se da, usa el año actual.
   */
  async anualPorServicios(anio?: number): Promise<ReportePorServicio[]> {
    const target = anio ?? new Date().getFullYear();
    const db = await getDb();
    // Un solo query: GROUP BY servicio_id + mes
    const rows = await db.select<Array<{
      servicio_id: number; servicio_nombre: string; servicio_tipo: string;
      mes: number; count: number; monto: number;
    }>>(`
      SELECT m.servicio_id,
             sv.nombre AS servicio_nombre,
             sv.tipo   AS servicio_tipo,
             CAST(strftime('%m', m.fecha_emision) AS INTEGER) AS mes,
             COUNT(*) AS count,
             COALESCE(SUM(m.monto), 0) AS monto
      FROM memorandums m
      JOIN servicios sv ON sv.id = m.servicio_id
      WHERE CAST(strftime('%Y', m.fecha_emision) AS INTEGER) = ${Number(target)}
      GROUP BY m.servicio_id, mes, sv.nombre, sv.tipo
      ORDER BY sv.nombre
    `);

    // Poblar la matriz: incluir TODOS los servicios (incluso los que tienen 0)
    const servicios = await db.select<Array<{
      id: number; nombre: string; tipo: string;
    }>>(`SELECT id, nombre, tipo FROM servicios ORDER BY nombre`);

    const map = new Map<number, ReportePorServicio>();
    for (const s of servicios) {
      map.set(s.id, {
        servicio_id: s.id,
        servicio_nombre: s.nombre,
        servicio_tipo: s.tipo,
        anio: target,
        meses: Object.fromEntries(
          Array.from({ length: 12 }, (_, i) => [i + 1, { count: 0, monto: 0 }]),
        ),
      });
    }
    for (const r of rows) {
      const item = map.get(r.servicio_id);
      if (item) {
        item.meses[r.mes] = { count: r.count, monto: r.monto };
      }
    }
    return Array.from(map.values());
  },

  /** Total global del año (todos los servicios, todos los meses). */
  async totalesAnio(anio?: number): Promise<{
    anio: number;
    count: number;
    monto: number;
  }> {
    const target = anio ?? new Date().getFullYear();
    const db = await getDb();
    const rows = await db.select<Array<{ count: number; monto: number }>>(`
      SELECT COUNT(*) AS count, COALESCE(SUM(monto), 0) AS monto
      FROM memorandums
      WHERE CAST(strftime('%Y', fecha_emision) AS INTEGER) = ${Number(target)}
    `);
    return { anio: target, count: rows[0]?.count ?? 0, monto: rows[0]?.monto ?? 0 };
  },

  /**
   * Devuelve los memorandos (sin PDF blob) para una combinación de
   * servicio + mes + año. Útil para el panel de detalle al picar
   * una celda de la matriz.
   */
  async detalleMensual(
    servicio_id: number,
    mes: number,
    anio: number,
  ): Promise<Array<{
    id: number; folio: string;
    fecha_emision: string;
    solicitante_nombre: string;
    titular_coincide: number;
    monto: number;
    notas: string | null;
    fosa_id: number | null;
    gaveta_id: number | null;
    panteon_nombre: string | null;
    seccion_codigo: string | null;
    linea_codigo: string | null;
    fosa_numero: string | null;
    gaveta_numero: number | null;
  }>> {
    if (mes < 1 || mes > 12) return [];
    const db = await getDb();
    const mm = String(mes).padStart(2, "0");
    return db.select<Array<{
      id: number; folio: string;
      fecha_emision: string;
      solicitante_nombre: string;
      titular_coincide: number;
      monto: number;
      notas: string | null;
      fosa_id: number | null;
      gaveta_id: number | null;
      panteon_nombre: string | null;
      seccion_codigo: string | null;
      linea_codigo: string | null;
      fosa_numero: string | null;
      gaveta_numero: number | null;
    }>>(`
      SELECT m.id, m.folio, m.fecha_emision, m.solicitante_nombre,
             m.titular_coincide, m.monto, m.notas,
             m.fosa_id, m.gaveta_id,
             CASE WHEN m.fosa_id IS NOT NULL THEN p1.nombre
                  ELSE p2.nombre END AS panteon_nombre,
             CASE WHEN m.fosa_id IS NOT NULL THEN s1.codigo
                  ELSE s2.codigo END AS seccion_codigo,
             CASE WHEN m.fosa_id IS NOT NULL THEN l1.codigo
                  ELSE l2.codigo END AS linea_codigo,
             f.numero  AS fosa_numero,
             g.numero  AS gaveta_numero
      FROM memorandums m
      LEFT JOIN fosas f ON f.id = m.fosa_id
      LEFT JOIN lineas l1 ON l1.id = f.linea_id
      LEFT JOIN secciones s1 ON s1.id = l1.seccion_id
      LEFT JOIN panteones p1 ON p1.id = s1.panteon_id
      LEFT JOIN gavetas g ON g.id = m.gaveta_id
      LEFT JOIN lineas l2 ON l2.id = g.linea_id
      LEFT JOIN secciones s2 ON s2.id = l2.seccion_id
      LEFT JOIN panteones p2 ON p2.id = s2.panteon_id
      WHERE m.servicio_id = ${Number(servicio_id)}
        AND CAST(strftime('%Y', m.fecha_emision) AS INTEGER) = ${Number(anio)}
        AND CAST(strftime('%m', m.fecha_emision) AS INTEGER) = ${Number(mes)}
      ORDER BY m.fecha_emision ASC, m.id ASC
    `);
  },
};
