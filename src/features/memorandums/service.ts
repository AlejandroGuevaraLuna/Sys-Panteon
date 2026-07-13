import { getDb } from "../../lib/db";
import type { Memorandum, MemorandumDetalle } from "../../types";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function n(v: unknown, dflt = 0): number {
  const r = parseInt(String(v ?? ""));
  return Number.isFinite(r) ? r : dflt;
}

/** Datos enriquecidos para mostrar en la UI (sin pdf_path). */
export interface MemorandumListado extends Memorandum {
  servicio_nombre: string;
  servicio_tipo: string;
  panteon_nombre?: string;
  seccion_codigo?: string;
  linea_codigo?: string;
  fosa_numero?: string;
  gaveta_numero?: number;
  entidad_tipo?: "fosa" | "gaveta";
  /** Nombre del usuario que GENERÓ el memorandum (no quien lo descarga). */
  emitido_por?: string | null;
  emitido_por_username?: string | null;
}

export const memorandumsService = {
  /**
   * Lista todos los memorandums con datos de contexto (panteón, sección,
   * línea, número de fosa/gaveta) usando JOIN condicional según el FK que
   * esté presente. Incluye quién lo generó (LEFT JOIN a usuarios).
   */
  async listar(): Promise<MemorandumListado[]> {
    const db = await getDb();
    return db.select<MemorandumListado[]>(
      `SELECT m.*,
              sv.nombre AS servicio_nombre,
              sv.tipo   AS servicio_tipo,
              COALESCE(p1.nombre, p2.nombre) AS panteon_nombre,
              COALESCE(s1.codigo, s2.codigo) AS seccion_codigo,
              COALESCE(l1.codigo, l2.codigo) AS linea_codigo,
              f.numero   AS fosa_numero,
              g.numero   AS gaveta_numero,
              CASE WHEN m.fosa_id IS NOT NULL THEN 'fosa'
                   WHEN m.gaveta_id IS NOT NULL THEN 'gaveta'
                   ELSE NULL END AS entidad_tipo,
              u.nombre   AS emitido_por,
              u.username AS emitido_por_username
       FROM memorandums m
       JOIN servicios sv ON sv.id = m.servicio_id
       LEFT JOIN fosas f ON f.id = m.fosa_id
       LEFT JOIN lineas l1 ON l1.id = f.linea_id
       LEFT JOIN secciones s1 ON s1.id = l1.seccion_id
       LEFT JOIN panteones p1 ON p1.id = s1.panteon_id
       LEFT JOIN gavetas g ON g.id = m.gaveta_id
       LEFT JOIN lineas l2 ON l2.id = g.linea_id
       LEFT JOIN secciones s2 ON s2.id = l2.seccion_id
       LEFT JOIN panteones p2 ON p2.id = s2.panteon_id
       LEFT JOIN usuarios u ON u.id = m.created_by_user_id
       ORDER BY m.fecha_emision DESC, m.id DESC`
    );
  },

  /**
   * Lista los memorandums vinculados a UNA entidad (fosa o gaveta).
   * Incluye quién lo generó.
   */
  async listarPorEntidad(
    tipo: "fosa" | "gaveta",
    id: number,
  ): Promise<MemorandumListado[]> {
    const db = await getDb();
    const col = tipo === "fosa" ? "fosa_id" : "gaveta_id";
    return db.select<MemorandumListado[]>(
      `SELECT m.*,
              sv.nombre AS servicio_nombre,
              sv.tipo   AS servicio_tipo,
              COALESCE(p1.nombre, p2.nombre) AS panteon_nombre,
              COALESCE(s1.codigo, s2.codigo) AS seccion_codigo,
              COALESCE(l1.codigo, l2.codigo) AS linea_codigo,
              f.numero AS fosa_numero,
              g.numero AS gaveta_numero,
              u.nombre   AS emitido_por,
              u.username AS emitido_por_username
       FROM memorandums m
       JOIN servicios sv ON sv.id = m.servicio_id
       LEFT JOIN fosas f ON f.id = m.fosa_id
       LEFT JOIN lineas l1 ON l1.id = f.linea_id
       LEFT JOIN secciones s1 ON s1.id = l1.seccion_id
       LEFT JOIN panteones p1 ON p1.id = s1.panteon_id
       LEFT JOIN gavetas g ON g.id = m.gaveta_id
       LEFT JOIN lineas l2 ON l2.id = g.linea_id
       LEFT JOIN secciones s2 ON s2.id = l2.seccion_id
       LEFT JOIN panteones p2 ON p2.id = s2.panteon_id
       LEFT JOIN usuarios u ON u.id = m.created_by_user_id
       WHERE m.${col} = ${n(id)}
       ORDER BY m.fecha_emision DESC, m.id DESC`
    );
  },

  async obtener(id: number): Promise<MemorandumDetalle | null> {
    const db = await getDb();
    const rows = await db.select<Memorandum[]>(
      `SELECT * FROM memorandums WHERE id = ${n(id)} LIMIT 1`,
    );
    const memo = rows[0] ?? null;
    if (!memo) return null;

    // Para servicios de TRASPASO, cargamos el cambio de titular
    // asociado (preferentemente el vinculado por memorandum_id; si no
    // hay, el más reciente de la fosa/gaveta). Esto le permite al PDF
    // invertir el orden del texto (titular anterior en el párrafo 1,
    // solicitante en el párrafo 2).
    let servicioTipo: string | null = null;
    if (memo.servicio_id) {
      const sv = await db.select<{ tipo: string }[]>(
        `SELECT tipo FROM servicios WHERE id = ${n(memo.servicio_id)} LIMIT 1`,
      );
      servicioTipo = sv[0]?.tipo ?? null;
    }
    let cambioTitular: MemorandumDetalle["cambio_titular"] = null;
    if (servicioTipo === "TRASPASO" && (memo.fosa_id || memo.gaveta_id)) {
      const fkCol = memo.fosa_id ? "fosa_id" : "gaveta_id";
      const fkVal = memo.fosa_id || memo.gaveta_id;
      const ct = await db.select<{
        titular_anterior_nombre: string; titular_nuevo_nombre: string;
        fecha_cambio: string; motivo: string | null;
      }[]>(
        `SELECT titular_anterior_nombre, titular_nuevo_nombre,
                fecha_cambio, motivo
         FROM cambios_titular
         WHERE ${fkCol} = ${n(fkVal)}
         ORDER BY
           CASE WHEN memorandum_id = ${n(memo.id)} THEN 0 ELSE 1 END,
           fecha_cambio DESC, id DESC
         LIMIT 1`,
      );
      if (ct[0]) cambioTitular = ct[0];
    }
    // Devolvemos un MemorandumDetalle parcial: los campos del JOIN
    // extendido (fosa_seccion_codigo, etc.) quedan vacíos, y el PDF los
    // sobreescribe desde el contexto (ctx en la descarga). Lo que sí
    // importa aquí es `cambio_titular` y `servicio_tipo`.
    return {
      ...memo,
      servicio_tipo: servicioTipo as never,
      cambio_titular: cambioTitular,
      fosa_seccion_codigo: "", fosa_seccion_nombre: "",
      fosa_linea_codigo: "", fosa_linea_nombre: "",
      fosa_numero: "", fosa_panteon_nombre: "",
      gaveta_numero: 0, gaveta_nivel: "",
      gaveta_libro: "", gaveta_registro: "",
      servicio_nombre: "",
      titular_nombre: "",
    };
  },

  async siguienteFolio(): Promise<string> {
    const db = await getDb();
    const anio = new Date().getFullYear();
    // Reglas:
    // 1) El siguiente folio = ÚLTIMO folio creado (en el año actual) + 1.
    // 2) Nunca puede ser menor al `memo_folio_inicial` configurado.
    // Esto evita que COUNT(*) + 1 colisione cuando el inicial configurado
    // es mayor que el conteo de registros (p.ej. inicial=90, 1 memo creado
    // → COUNT=1, 1+1=2, ignoraría el 90).
    const [maxRows, cfgRows] = await Promise.all([
      db.select<{ last: number | null }[]>(
        `SELECT MAX(CAST(SUBSTR(folio, -4) AS INTEGER)) AS last
         FROM memorandums
         WHERE folio LIKE 'MEM-${anio}-%'`
      ),
      db.select<{ memo_folio_inicial: number }[]>(
        "SELECT memo_folio_inicial FROM configuracion WHERE id=1"
      ),
    ]);
    const inicial = cfgRows[0]?.memo_folio_inicial ?? 1;
    const ultimo = maxRows[0]?.last ?? 0;
    const siguiente = Math.max(ultimo + 1, inicial);
    const consecutivo = String(siguiente).padStart(4, "0");
    return `MEM-${anio}-${consecutivo}`;
  },

  /**
   * Crea un memorandum. Devuelve `{ id, folio }` donde `folio` es el que
   * realmente se insertó (puede diferir del que pasó el caller si tuvimos
   * que regenerarlo por un UNIQUE conflict). Esto permite al dialog
   * regenerar el PDF con el folio correcto.
   */
  async crear(data: Omit<Memorandum, "id" | "created_at" | "created_by_user_id"> & { created_by_user_id?: number | null }): Promise<{ id: number; folio: string }> {
    const db = await getDb();
    // Defensa contra race conditions: si el caller nos pasa un folio que
    // ya está en uso (p.ej. doble-click rápido que ejecutó dos
    // `siguienteFolio()` antes de que la primera INSERT se cometiera),
    // regeneramos el folio y reintentamos. Hasta 5 intentos.
    const maxAttempts = 5;
    let folio = data.folio;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const r = await db.execute(
          `INSERT INTO memorandums (
             folio, fosa_id, gaveta_id, servicio_id,
             solicitante_nombre, solicitante_domicilio, solicitante_telefono,
             titular_coincide, monto, fecha_emision, notas, pdf_path,
             created_by_user_id
           ) VALUES (
             ${esc(folio)},
             ${data.fosa_id ?? "NULL"},
             ${data.gaveta_id ?? "NULL"},
             ${n(data.servicio_id)},
             ${esc(data.solicitante_nombre)},
             ${esc(data.solicitante_domicilio)},
             ${esc(data.solicitante_telefono)},
             ${data.titular_coincide ?? 0},
             ${data.monto ?? 0},
             ${esc(data.fecha_emision)},
             ${data.notas ? esc(data.notas) : "NULL"},
             ${data.pdf_path ? esc(data.pdf_path) : "NULL"},
             ${data.created_by_user_id ?? "NULL"}
           )`,
        );
        const id = r && typeof r.lastInsertId === "number" ? r.lastInsertId : 0;
        return { id, folio };
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        const isFolioConflict = msg.includes("UNIQUE constraint failed: memorandums.folio");
        if (isFolioConflict && attempt < maxAttempts - 1) {
          // Reintenta con un folio nuevo. La siguiente vez la query COUNT
          // ya verá el INSERT anterior, así que devolverá un consecutivo
          // mayor y no chocará.
          folio = await this.siguienteFolio();
          continue;
        }
        throw e;
      }
    }
    throw new Error("No se pudo generar un folio único tras varios intentos");
  },

  async actualizarPdfPath(id: number, path: string): Promise<void> {
    const db = await getDb();
    await db.execute(`UPDATE memorandums SET pdf_path=${esc(path)} WHERE id = ${n(id)}`);
  },

  async eliminar(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(`DELETE FROM memorandums WHERE id = ${n(id)}`);
  },
};
