import Database from "@tauri-apps/plugin-sql";
import schemaSql from "../db/schema.sql?raw";

const DB_URL = "sqlite:panteon.db";
const TARGET_VERSION = 7;

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load(DB_URL);
  try {
    await aplicarMigraciones(_db);
  } catch (e) {
    console.error("[db] aplicarMigraciones falló, intento reparar esquema:", e);
    await repararEsquema(_db);
  }
  // Pase final: garantizar que TODAS las tablas/índices del esquema existen
  await ejecutarEsquemaRobusto(_db);
  // Pase adicional defensivo: crea EXPLÍCITAMENTE las tablas de colección si
  // siguen faltando (DDL en línea, no depende del parseo de schema.sql)
  await forceCreateCollectionTables(_db);
  // Pase final extra: añade columnas v5 faltantes en fosas/gavetas si existen
  await ensureEntityColumns(_db, "fosas");
  await ensureEntityColumns(_db, "gavetas");
  // Asegurar columnas de configuración (memo_folio_inicial)
  await ensureConfigColumns(_db);
  // Asegurar columnas de usuarios (email, telefono) + tabla preferencias
  await ensureUserColumns(_db);
  // Asegurar columna created_by_user_id en memorandums
  await ensureMemorandumsColumns(_db);
  await setUserVersion(_db, TARGET_VERSION);
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_db) { await _db.close(); _db = null; }
}

/** API pública para "Reparar esquema" desde Diagnóstico */
export async function repairSchema(): Promise<string[]> {
  if (!_db) _db = await Database.load(DB_URL);
  const logs: string[] = [];
  logs.push(...await ejecutarEsquemaRobusto(_db, /* verbose */ true));
  await forceCreateCollectionTables(_db, /* verbose */ logs);
  await ensureEntityColumns(_db, "fosas", logs);
  await ensureEntityColumns(_db, "gavetas", logs);
  await ensureConfigColumns(_db, logs);
  await ensureUserColumns(_db, logs);
  await ensureMemorandumsColumns(_db, logs);
  await setUserVersion(_db, TARGET_VERSION);
  return logs;
}

// ----------- Núcleo: ejecución de esquema robusta ------------

/**
 * Divide el SQL en sentencias (CREATE TABLE / CREATE INDEX / CREATE UNIQUE INDEX /
 * CREATE VIEW / CREATE TRIGGER) y las ejecuta UNA POR UNA con captura de error
 * individual, de modo que un fallo en una sentencia no aborta las siguientes.
 *
 * Importante: NO descartamos sentencias que empiecen por `--` (comentario
 * seguido de CREATE… en la siguiente línea), porque SQL las acepta como tales.
 */
async function ejecutarEsquemaRobusto(db: Database, verbose = false): Promise<string[]> {
  const logs: string[] = [];
  // 1. Quitar comentarios de línea completa y normalizar saltos
  const limpio = schemaSql
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((ln) => !/^\s*--/.test(ln))
    .join("\n");

  // 2. Separar por `;`
  const statements = limpio
    .split(/;\s*\n/)
    .map((s) => s.trim().replace(/;+\s*$/, ""))
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await db.execute(stmt);
      if (verbose) logs.push(`OK: ${stmt.split("\n")[0].slice(0, 80)}…`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already exists/i.test(msg)) {
        if (verbose) logs.push(`(ya existía) ${stmt.split("\n")[0].slice(0, 60)}…`);
      } else {
        const line0 = stmt.split("\n")[0].slice(0, 80);
        console.warn(`[esquema] fallo en "${line0}": ${msg}`);
        logs.push(`ERROR: ${line0} → ${msg}`);
      }
    }
  }
  return logs;
}

// ----------- Migraciones ------------

async function aplicarMigraciones(db: Database): Promise<void> {
  const current = await getUserVersion(db);
  if (current === TARGET_VERSION) return;
  console.info(`[panteon-admin] Migrando schema v${current} → v${TARGET_VERSION}`);
  if (current === 0) {
    await ejecutarEsquemaRobusto(db);
  } else if (current === 1 || current === 2) {
    await dropAll(db);
    await ejecutarEsquemaRobusto(db);
  } else if (current === 3) {
    await dropAll(db);
    await ejecutarEsquemaRobusto(db);
  } else if (current === 4) {
    await migrarV4aV5Preservando(db);
  } else if (current === 5) {
    await migrarV5aV6FechasOpcionales(db);
  } else if (current === 6) {
    await migrarV6aV7SinUniqueLineaNumero(db);
  }
  // Cualquier versión rara: reconstruir
  else {
    console.warn(`[panteon-admin] versión desconocida ${current}, ejecutando reparación`);
    await ejecutarEsquemaRobusto(db);
  }
}

/**
 * Migración v4 → v5 preservando datos del usuario.
 * Si tras la migración queda alguna tabla faltante, se crea vía ejecutarEsquemaRobusto.
 */
/**
 * Migración v6 → v7: elimina la restricción UNIQUE(linea_id, numero)
 * de las tablas fosas y gavetas. El usuario decidió que se permita
 * tener múltiples fosas/gavetas con la misma (línea, número) si tienen
 * datos distintos (caso común en el Excel del panteón). La detección
 * de duplicados se hace en el importador.
 */
async function migrarV6aV7SinUniqueLineaNumero(db: Database): Promise<void> {
  console.info("[migrarV6aV7] INICIO — eliminando UNIQUE(linea_id, numero)");
  await db.execute("PRAGMA foreign_keys = OFF");
  try {
    const hayFosas = await tableExists(db, "fosas");
    if (hayFosas) {
      const cols = await db.select<{ name: string; type: string; notnull: number; dflt_value: any }[]>(
        `PRAGMA table_info(fosas)`,
      );
      const nombresCols = cols.map((c) => c.name);
      const defsCols = cols.map((c) => {
        const nn = c.notnull ? "NOT NULL" : "";
        const dflt = c.dflt_value !== null ? `DEFAULT ${c.dflt_value}` : "";
        return `${c.name} ${c.type} ${nn} ${dflt}`.trim();
      });
      const fkCols = await db.select<{ from: string; to: string }[]>(
        `SELECT "from", "to" FROM pragma_foreign_key_list('fosas')`,
      );
      const fkClauses = fkCols.length > 0
        ? `, FOREIGN KEY (${fkCols[0].from}) REFERENCES ${fkCols[0].to}(id) ON DELETE CASCADE`
        : "";
      await db.execute("CREATE TABLE fosas_new (\n        " +
        defsCols.join(",\n        ") + fkClauses + "\n      )");
      await db.execute(`INSERT INTO fosas_new (${nombresCols.join(", ")}) SELECT ${nombresCols.join(", ")} FROM fosas`);
      await db.execute("DROP TABLE fosas");
      await db.execute("ALTER TABLE fosas_new RENAME TO fosas");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_fosas_linea ON fosas(linea_id)");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_fosas_titular ON fosas(titular_nombre)");
      console.info("[migrarV6aV7] fosas recreada sin UNIQUE");
    }
    const hayGavetas = await tableExists(db, "gavetas");
    if (hayGavetas) {
      const cols = await db.select<{ name: string; type: string; notnull: number; dflt_value: any }[]>(
        `PRAGMA table_info(gavetas)`,
      );
      const nombresCols = cols.map((c) => c.name);
      const defsCols = cols.map((c) => {
        const nn = c.notnull ? "NOT NULL" : "";
        const dflt = c.dflt_value !== null ? `DEFAULT ${c.dflt_value}` : "";
        return `${c.name} ${c.type} ${nn} ${dflt}`.trim();
      });
      await db.execute("CREATE TABLE gavetas_new (\n        " + defsCols.join(",\n        ") + "\n      )");
      await db.execute(`INSERT INTO gavetas_new (${nombresCols.join(", ")}) SELECT ${nombresCols.join(", ")} FROM gavetas`);
      await db.execute("DROP TABLE gavetas");
      await db.execute("ALTER TABLE gavetas_new RENAME TO gavetas");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_gavetas_linea ON gavetas(linea_id)");
      console.info("[migrarV6aV7] gavetas recreada sin UNIQUE");
    }
  } finally {
    await db.execute("PRAGMA foreign_keys = ON");
  }
  console.info("[migrarV6aV7] FIN");
}

async function migrarV5aV6FechasOpcionales(db: Database): Promise<void> {
  console.info("[migrarV5aV6] INICIO — haciendo fechas opcionales");
  await db.execute("PRAGMA foreign_keys = OFF");
  try {
    const haySepultaciones = await tableExists(db, "sepultaciones");
    if (haySepultaciones) {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS sepultaciones_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fosa_id INTEGER,
          gaveta_id INTEGER,
          nombre TEXT NOT NULL,
          fecha_sepultacion TEXT,
          fecha_fallecimiento TEXT,
          edad INTEGER,
          notas TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (fosa_id) REFERENCES fosas(id) ON DELETE CASCADE,
          FOREIGN KEY (gaveta_id) REFERENCES gavetas(id) ON DELETE CASCADE,
          CHECK ((fosa_id IS NOT NULL AND gaveta_id IS NULL) OR
                 (fosa_id IS NULL AND gaveta_id IS NOT NULL))
        )
      `);
      await db.execute(`
        INSERT INTO sepultaciones_new
          (id, fosa_id, gaveta_id, nombre, fecha_sepultacion, fecha_fallecimiento, edad, notas, created_at)
        SELECT id, fosa_id, gaveta_id, nombre,
               NULLIF(fecha_sepultacion, ''),
               NULLIF(fecha_fallecimiento, ''),
               edad, notas, created_at
        FROM sepultaciones
      `);
      await db.execute("DROP TABLE sepultaciones");
      await db.execute("ALTER TABLE sepultaciones_new RENAME TO sepultaciones");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_sepultaciones_fosa ON sepultaciones(fosa_id)");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_sepultaciones_gaveta ON sepultaciones(gaveta_id)");
      console.info("[migrarV5aV6] sepultaciones recreada");
    }
    const hayExhumaciones = await tableExists(db, "exhumaciones");
    if (hayExhumaciones) {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS exhumaciones_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fosa_id INTEGER,
          gaveta_id INTEGER,
          nombre TEXT NOT NULL,
          fecha_exhumacion TEXT,
          destino TEXT,
          notas TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (fosa_id) REFERENCES fosas(id) ON DELETE CASCADE,
          FOREIGN KEY (gaveta_id) REFERENCES gavetas(id) ON DELETE CASCADE,
          CHECK ((fosa_id IS NOT NULL AND gaveta_id IS NULL) OR
                 (fosa_id IS NULL AND gaveta_id IS NOT NULL))
        )
      `);
      await db.execute(`
        INSERT INTO exhumaciones_new
          (id, fosa_id, gaveta_id, nombre, fecha_exhumacion, destino, notas, created_at)
        SELECT id, fosa_id, gaveta_id, nombre,
               NULLIF(fecha_exhumacion, ''),
               destino, notas, created_at
        FROM exhumaciones
      `);
      await db.execute("DROP TABLE exhumaciones");
      await db.execute("ALTER TABLE exhumaciones_new RENAME TO exhumaciones");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_exhumaciones_fosa ON exhumaciones(fosa_id)");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_exhumaciones_gaveta ON exhumaciones(gaveta_id)");
      console.info("[migrarV5aV6] exhumaciones recreada");
    }
  } finally {
    await db.execute("PRAGMA foreign_keys = ON");
  }
  console.info("[migrarV5aV6] FIN");
}

async function migrarV4aV5Preservando(db: Database): Promise<void> {
  console.info("[migrarV4aV5Preservando] INICIO");
  try {
    await db.execute("PRAGMA foreign_keys = OFF");

    // 1. Verificar si gavetas tiene fosa_id (esquema v4) o linea_id (v5)
    let gavetasIsV4 = false;
    try {
      const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(gavetas)`);
      gavetasIsV4 = (cols || []).some((c) => String(c.name).toLowerCase() === "fosa_id");
    } catch (e) {
      console.warn("[migrarV4aV5] no se pudo inspeccionar gavetas:", e);
    }

    if (gavetasIsV4) {
      console.info("[migrarV4aV5] gavetas en esquema v4, actualizando a v5...");
      await db.execute(`
        CREATE TABLE IF NOT EXISTS gavetas_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          linea_id INTEGER NOT NULL,
          numero INTEGER NOT NULL,
          notas TEXT,
          libro TEXT NOT NULL DEFAULT '',
          registro TEXT NOT NULL DEFAULT '',
          titular_id INTEGER,
          titular_nombre TEXT NOT NULL DEFAULT '',
          titular_domicilio TEXT NOT NULL DEFAULT '',
          titular_telefono TEXT NOT NULL DEFAULT '',
          numero_titulo TEXT NOT NULL DEFAULT '',
          fecha_titulo TEXT,
          superficie_ancho TEXT NOT NULL DEFAULT '',
          superficie_alto TEXT NOT NULL DEFAULT '',
          beneficiario TEXT NOT NULL DEFAULT '',
          observaciones TEXT,
          notas_libro TEXT,
          predial_al_corriente INTEGER NOT NULL DEFAULT 1,
          predial_ultimo_pago_anio INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (linea_id) REFERENCES lineas(id) ON DELETE CASCADE,
          FOREIGN KEY (titular_id) REFERENCES titulares(id) ON DELETE SET NULL,
          UNIQUE (linea_id, numero)
        )
      `);
      try {
        await db.execute(`
          INSERT INTO gavetas_new (
            id, linea_id, numero, notas, libro, registro,
            titular_id, titular_nombre, titular_domicilio, titular_telefono,
            numero_titulo, fecha_titulo, superficie_ancho, superficie_alto, beneficiario,
            observaciones, notas_libro, predial_al_corriente,
            predial_ultimo_pago_anio, created_at
          )
          SELECT
            g.id,
            COALESCE(f.linea_id, 0) AS linea_id,
            g.numero, g.notas, g.libro, g.registro,
            g.titular_id, g.titular_nombre, g.titular_domicilio, g.titular_telefono,
            g.numero_titulo, g.fecha_titulo, '', '', g.beneficiario,
            g.observaciones, g.notas_libro, g.predial_al_corriente,
            g.predial_ultimo_pago_anio, g.created_at
          FROM gavetas g LEFT JOIN fosas f ON g.fosa_id = f.id
        `);
        console.info("[migrarV4aV5] gavetas copiadas con linea_id");
      } catch (e) {
        console.warn("[migrarV4aV5] copia gavetas falló:", e);
      }
      await db.execute("DROP TABLE IF EXISTS gavetas");
      await db.execute("ALTER TABLE gavetas_new RENAME TO gavetas");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_gavetas_linea ON gavetas(linea_id)");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_gavetas_titular ON gavetas(titular_nombre)");
    }

    // 2. Asegurar que las colecciones tengan fosa_id (si existen con esquema v4)
    const colecciones = ["sepultaciones", "exhumaciones", "mantenimientos_pagados", "cambios_titular", "memorandums"];
    for (const col of colecciones) {
      try {
        const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(${col})`);
        const colNames = (cols || []).map((c) => String(c.name).toLowerCase());
        const hasFosa = colNames.includes("fosa_id");
        if (!hasFosa && colNames.length > 0) {
          console.info(`[migrarV4aV5] añadiendo fosa_id a ${col}`);
          await db.execute(
            `ALTER TABLE ${col} ADD COLUMN fosa_id INTEGER REFERENCES fosas(id) ON DELETE CASCADE`
          );
        }
      } catch (e) {
        console.warn(`[migrarV4aV5] ${col}:`, e);
      }
    }

    // 3. Campos faltantes en fosas
    try {
      const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(fosas)`);
      const colNames = (cols || []).map((c) => String(c.name).toLowerCase());
      const faltantes: { col: string; def: string }[] = [
        { col: "libro", def: `TEXT NOT NULL DEFAULT ''` },
        { col: "registro", def: `TEXT NOT NULL DEFAULT ''` },
        { col: "titular_id", def: `INTEGER` },
        { col: "titular_nombre", def: `TEXT NOT NULL DEFAULT ''` },
        { col: "titular_domicilio", def: `TEXT NOT NULL DEFAULT ''` },
        { col: "titular_telefono", def: `TEXT NOT NULL DEFAULT ''` },
        { col: "numero_titulo", def: `TEXT NOT NULL DEFAULT ''` },
        { col: "fecha_titulo", def: `TEXT` },
        { col: "superficie_ancho", def: `TEXT NOT NULL DEFAULT ''` },
        { col: "superficie_alto", def: `TEXT NOT NULL DEFAULT ''` },
        { col: "beneficiario", def: `TEXT NOT NULL DEFAULT ''` },
        { col: "observaciones", def: `TEXT` },
        { col: "notas_libro", def: `TEXT` },
        { col: "predial_al_corriente", def: `INTEGER NOT NULL DEFAULT 1` },
        { col: "predial_ultimo_pago_anio", def: `INTEGER` },
      ];
      for (const f of faltantes) {
        if (!colNames.includes(f.col)) {
          try {
            await db.execute(`ALTER TABLE fosas ADD COLUMN ${f.col} ${f.def}`);
            console.info(`[migrarV4aV5] añadido fosas.${f.col}`);
          } catch { /* silencioso */ }
        }
      }
    } catch (e) {
      console.warn("[migrarV4aV5] alter fosas:", e);
    }

    // 4. CRÍTICO: garantizar todas las tablas del esquema v5
    await ejecutarEsquemaRobusto(db);
    await db.execute("PRAGMA foreign_keys = ON");
    console.info("[migrarV4aV5Preservando] COMPLETADO");
  } catch (e) {
    console.error("[migrarV4aV5Preservando] ERROR:", e);
    await dropAll(db);
    await ejecutarEsquemaRobusto(db);
  }
}

/**
 * Reparación explícita: crea las tablas que falten sin tocar las existentes.
 * Útil para "Diagnóstico → Reparar esquema".
 */
async function repararEsquema(db: Database): Promise<void> {
  console.info("[repararEsquema] INICIO");
  await db.execute("PRAGMA foreign_keys = OFF");
  await ejecutarEsquemaRobusto(db);
  await db.execute("PRAGMA foreign_keys = ON");
  console.info("[repararEsquema] COMPLETADO");
}

async function getUserVersion(db: Database): Promise<number> {
  try {
    const rows = await db.select<{ user_version: number }[]>("PRAGMA user_version");
    return rows[0]?.user_version ?? 0;
  } catch {
    return 0;
  }
}

async function setUserVersion(db: Database, v: number): Promise<void> {
  try {
    await db.execute(`PRAGMA user_version = ${v}`);
  } catch (e) {
    console.warn(`[db] no se pudo setear user_version=${v}:`, e);
  }
}

async function dropAll(db: Database): Promise<void> {
  try {
    await db.execute("PRAGMA foreign_keys = OFF");
  } catch { /* ignore */ }
  for (const t of [
    "memorandums", "cambios_titular", "mantenimientos_pagados",
    "exhumaciones", "sepultaciones", "gavetas", "fosas", "lineas", "secciones",
    "titulares", "servicios", "panteones", "configuracion",
  ]) {
    try { await db.execute(`DROP TABLE IF EXISTS ${t}`); } catch { /* ignore */ }
  }
  try {
    await db.execute("PRAGMA foreign_keys = ON");
  } catch { /* ignore */ }
}

/**
 * Red de seguridad: DDL en línea para las 5 tablas de colección, ejecutada
 * SIEMPRE al final de getDb(). Si por alguna razón la corrida por esquema.sql
 * no creó alguna de estas tablas (porque el split se comió una sentencia o
 * porque la BD ya estaba en un estado raro), esta función las crea.
 *
 * Además agrega las columnas fosa_id/gaveta_id si faltan en tablas existentes.
 */
async function forceCreateCollectionTables(
  db: Database,
  logs?: string[],
): Promise<void> {
  const ddl = [
    {
      tabla: "sepultaciones",
      sql: `CREATE TABLE IF NOT EXISTS sepultaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fosa_id INTEGER,
        gaveta_id INTEGER,
        nombre TEXT NOT NULL,
        fecha_sepultacion TEXT NOT NULL,
        fecha_fallecimiento TEXT,
        edad INTEGER,
        notas TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (fosa_id) REFERENCES fosas(id) ON DELETE CASCADE,
        FOREIGN KEY (gaveta_id) REFERENCES gavetas(id) ON DELETE CASCADE,
        CHECK ((fosa_id IS NOT NULL AND gaveta_id IS NULL) OR
               (fosa_id IS NULL AND gaveta_id IS NOT NULL))
      )`,
    },
    {
      tabla: "exhumaciones",
      sql: `CREATE TABLE IF NOT EXISTS exhumaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fosa_id INTEGER,
        gaveta_id INTEGER,
        nombre TEXT NOT NULL,
        fecha_exhumacion TEXT NOT NULL,
        destino TEXT,
        notas TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (fosa_id) REFERENCES fosas(id) ON DELETE CASCADE,
        FOREIGN KEY (gaveta_id) REFERENCES gavetas(id) ON DELETE CASCADE,
        CHECK ((fosa_id IS NOT NULL AND gaveta_id IS NULL) OR
               (fosa_id IS NULL AND gaveta_id IS NOT NULL))
      )`,
    },
    {
      tabla: "mantenimientos_pagados",
      sql: `CREATE TABLE IF NOT EXISTS mantenimientos_pagados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fosa_id INTEGER,
        gaveta_id INTEGER,
        anio INTEGER NOT NULL,
        fecha_pago TEXT NOT NULL,
        monto REAL NOT NULL DEFAULT 0,
        notas TEXT,
        FOREIGN KEY (fosa_id) REFERENCES fosas(id) ON DELETE CASCADE,
        FOREIGN KEY (gaveta_id) REFERENCES gavetas(id) ON DELETE CASCADE,
        CHECK ((fosa_id IS NOT NULL AND gaveta_id IS NULL) OR
               (fosa_id IS NULL AND gaveta_id IS NOT NULL))
      )`,
    },
    {
      tabla: "cambios_titular",
      sql: `CREATE TABLE IF NOT EXISTS cambios_titular (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fosa_id INTEGER,
        gaveta_id INTEGER,
        titular_anterior_id INTEGER,
        titular_anterior_nombre TEXT NOT NULL DEFAULT '',
        titular_nuevo_id INTEGER,
        titular_nuevo_nombre TEXT NOT NULL DEFAULT '',
        fecha_cambio TEXT NOT NULL,
        motivo TEXT,
        memorandum_id INTEGER,
        FOREIGN KEY (fosa_id) REFERENCES fosas(id) ON DELETE CASCADE,
        FOREIGN KEY (gaveta_id) REFERENCES gavetas(id) ON DELETE CASCADE,
        FOREIGN KEY (memorandum_id) REFERENCES memorandums(id) ON DELETE SET NULL,
        CHECK ((fosa_id IS NOT NULL AND gaveta_id IS NULL) OR
               (fosa_id IS NULL AND gaveta_id IS NOT NULL))
      )`,
    },
    {
      tabla: "memorandums",
      sql: `CREATE TABLE IF NOT EXISTS memorandums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folio TEXT NOT NULL,
        fosa_id INTEGER,
        gaveta_id INTEGER,
        servicio_id INTEGER NOT NULL,
        solicitante_nombre TEXT NOT NULL DEFAULT '',
        solicitante_domicilio TEXT NOT NULL DEFAULT '',
        solicitante_telefono TEXT NOT NULL DEFAULT '',
        titular_coincide INTEGER NOT NULL DEFAULT 0,
        monto REAL NOT NULL DEFAULT 0,
        fecha_emision TEXT NOT NULL,
        notas TEXT,
        pdf_path TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (fosa_id) REFERENCES fosas(id) ON DELETE SET NULL,
        FOREIGN KEY (gaveta_id) REFERENCES gavetas(id) ON DELETE SET NULL,
        FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE RESTRICT,
        CHECK ((fosa_id IS NOT NULL AND gaveta_id IS NULL) OR
               (fosa_id IS NULL AND gaveta_id IS NOT NULL) OR
               (fosa_id IS NULL AND gaveta_id IS NULL))
      )`,
    },
  ];

  let fkWasOn = true;
  try {
    // FK off para evitar fallos en CREATE INDEX si la tabla no existe aún
    const r = await db.select<{ fk_on: number }[]>("PRAGMA foreign_keys");
    fkWasOn = (r[0]?.fk_on ?? 1) === 1;
    if (fkWasOn) await db.execute("PRAGMA foreign_keys = OFF");
  } catch { /* ignore */ }

  for (const { tabla, sql } of ddl) {
    try {
      const existe = await tableExists(db, tabla);
      if (!existe) {
        await db.execute(sql);
        const msg = `forceCreateCollectionTables: CREATED ${tabla}`;
        console.info(`[${msg}]`);
        logs?.push(msg);
      } else {
        // Verificar columnas fosa_id / gaveta_id; añadir las que falten
        await ensureDualFK(db, tabla);
      }
    } catch (e) {
      console.error(`[forceCreateCollectionTables] ${tabla}: ${e}`);
      logs?.push(`ERROR creando ${tabla}: ${e instanceof Error ? e.message : e}`);
    }
  }

  try {
    if (fkWasOn) await db.execute("PRAGMA foreign_keys = ON");
  } catch { /* ignore */ }
}

async function tableExists(db: Database, name: string): Promise<boolean> {
  try {
    const rows = await db.select<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`,
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function ensureDualFK(db: Database, tabla: string): Promise<void> {
  try {
    const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(${tabla})`);
    const names = (cols || []).map((c) => String(c.name).toLowerCase());
    if (!names.includes("fosa_id")) {
      await db.execute(`ALTER TABLE ${tabla} ADD COLUMN fosa_id INTEGER`);
    }
    if (!names.includes("gaveta_id")) {
      await db.execute(`ALTER TABLE ${tabla} ADD COLUMN gaveta_id INTEGER`);
    }
  } catch (e) {
    console.warn(`[ensureDualFK] ${tabla}: ${e}`);
  }
}

/**
 * Asegura que la tabla `configuracion` tenga las columnas v1.1.9+.
 * Si la BD ya existía antes de este cambio, le añadimos las columnas con
 * `ALTER TABLE ... ADD COLUMN` con su DEFAULT.
 */
async function ensureConfigColumns(db: Database, logs?: string[]): Promise<void> {
  try {
    if (!(await tableExists(db, "configuracion"))) return;
    const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(configuracion)`);
    const names = new Set((cols || []).map((c) => String(c.name).toLowerCase()));
    if (!names.has("memo_folio_inicial")) {
      try {
        await db.execute(`ALTER TABLE configuracion ADD COLUMN memo_folio_inicial INTEGER NOT NULL DEFAULT 1`);
        const msg = "ensureConfigColumns: añadida configuracion.memo_folio_inicial";
        console.info(`[${msg}]`);
        logs?.push(msg);
      } catch (e) {
        console.warn(`[ensureConfigColumns] memo_folio_inicial: ${e}`);
      }
    }
  } catch (e) {
    console.warn("[ensureConfigColumns]", e);
  }
}

/**
 * Asegura que la tabla `memorandums` tenga la columna añadida en v1.1.9:
 *   - created_by_user_id INTEGER
 * Referencia a usuarios(id). Si la BD es vieja, agrega la columna.
 */
async function ensureMemorandumsColumns(db: Database, logs?: string[]): Promise<void> {
  try {
    if (await tableExists(db, "memorandums")) {
      const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(memorandums)`);
      const names = new Set((cols || []).map((c) => String(c.name).toLowerCase()));
      if (!names.has("created_by_user_id")) {
        try {
          await db.execute(`ALTER TABLE memorandums ADD COLUMN created_by_user_id INTEGER`);
          const msg = "ensureMemorandumsColumns: añadida memorandums.created_by_user_id";
          console.info(`[${msg}]`);
          logs?.push(msg);
        } catch (e) {
          console.warn(`[ensureMemorandumsColumns] created_by_user_id: ${e}`);
        }
      }
    }
  } catch (e) {
    console.warn("[ensureMemorandumsColumns]", e);
  }
}

/**
 * Asegura que la tabla `usuarios` tenga las columnas añadidas en v1.1.9:
 *   - email TEXT
 *   - telefono TEXT
 * Si la tabla existía con un esquema anterior (sólo username/nombre/rol),
 * agrega las columnas faltantes con ALTER TABLE. Cada columna es NULLABLE
 * así que es seguro para filas existentes.
 *
 * Crea además la tabla `preferencias_usuario` si no existe.
 */
async function ensureUserColumns(db: Database, logs?: string[]): Promise<void> {
  try {
    if (await tableExists(db, "usuarios")) {
      const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(usuarios)`);
      const names = new Set((cols || []).map((c) => String(c.name).toLowerCase()));
      const addCol = async (col: string, decl: string) => {
        if (!names.has(col)) {
          try {
            await db.execute(`ALTER TABLE usuarios ADD COLUMN ${col} ${decl}`);
            const msg = `ensureUserColumns: añadida usuarios.${col}`;
            console.info(`[${msg}]`);
            logs?.push(msg);
          } catch (e) {
            console.warn(`[ensureUserColumns] ${col}: ${e}`);
          }
        }
      };
      await addCol("email", "TEXT");
      await addCol("telefono", "TEXT");
    }
  } catch (e) {
    console.warn("[ensureUserColumns]", e);
  }
  // Tabla de preferencias por usuario
  try {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS preferencias_usuario (
         usuario_id INTEGER PRIMARY KEY,
         tema TEXT NOT NULL DEFAULT 'light',
         color_primario TEXT NOT NULL DEFAULT '',
         FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
       )`
    );
  } catch (e) {
    console.warn("[ensureUserColumns] preferencias_usuario:", e);
  }
}

/**
 * Asegura que la tabla de entidad (fosas/gavetas) tenga TODAS las columnas del
 * esquema v5. Si la tabla existía con un esquema viejo (sólo unas pocas
 * columnas), agrega las que faltan con ALTER TABLE … ADD COLUMN.
 *
 * Cada columna tiene DEFAULT así que es seguro para filas existentes.
 */
const COLUMNAS_V5_FOSA = [
  { col: "libro",                    def: "TEXT NOT NULL DEFAULT ''" },
  { col: "registro",                 def: "TEXT NOT NULL DEFAULT ''" },
  { col: "titular_id",               def: "INTEGER" },
  { col: "titular_nombre",           def: "TEXT NOT NULL DEFAULT ''" },
  { col: "titular_domicilio",        def: "TEXT NOT NULL DEFAULT ''" },
  { col: "titular_telefono",         def: "TEXT NOT NULL DEFAULT ''" },
  { col: "numero_titulo",            def: "TEXT NOT NULL DEFAULT ''" },
  { col: "fecha_titulo",             def: "TEXT" },
  { col: "superficie_ancho",         def: "TEXT NOT NULL DEFAULT ''" },
  { col: "superficie_alto",          def: "TEXT NOT NULL DEFAULT ''" },
  { col: "beneficiario",             def: "TEXT NOT NULL DEFAULT ''" },
  { col: "observaciones",            def: "TEXT" },
  { col: "notas_libro",              def: "TEXT" },
  { col: "predial_al_corriente",     def: "INTEGER NOT NULL DEFAULT 1" },
  { col: "predial_ultimo_pago_anio", def: "INTEGER" },
];
const COLUMNAS_V5_GAVETA = COLUMNAS_V5_FOSA; // mismas columnas

async function ensureEntityColumns(
  db: Database,
  tabla: "fosas" | "gavetas",
  logs?: string[],
): Promise<void> {
  try {
    const existe = await tableExists(db, tabla);
    if (!existe) return;
    const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(${tabla})`);
    const names = new Set((cols || []).map((c) => String(c.name).toLowerCase()));
    const cfg = tabla === "fosas" ? COLUMNAS_V5_FOSA : COLUMNAS_V5_GAVETA;
    for (const { col, def } of cfg) {
      if (!names.has(col)) {
        try {
          await db.execute(`ALTER TABLE ${tabla} ADD COLUMN ${col} ${def}`);
          const msg = `ensureEntityColumns: AÑADIDA ${tabla}.${col}`;
          console.info(`[${msg}]`);
          logs?.push(msg);
        } catch (e) {
          console.warn(`[ensureEntityColumns] ${tabla}.${col}: ${e}`);
        }
      }
    }
  } catch (e) {
    console.error(`[ensureEntityColumns] ${tabla}:`, e);
  }
}
