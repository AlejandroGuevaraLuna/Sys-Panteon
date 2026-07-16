-- ============================================================================
-- Schema v5 — Administración de Panteón
-- Jerarquía: Panteón → Sección → Línea → FOSAS y GAVETAS (entidades hermanas)
--   - Fosas y Gavetas son INDEPENDIENTES entre sí
--   - Ambas pertenecen a una LÍNEA (no: fosa → gaveta)
--   - Ambas tienen los mismos campos: número, titular, libro, registro,
--     sepultados, exhumaciones, predial, cambios de titular, mantenimiento
-- ============================================================================

-- Catálogo de panteones
CREATE TABLE IF NOT EXISTS panteones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  administrador TEXT NOT NULL DEFAULT '',
  notas TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catálogo de servicios con precios
CREATE TABLE IF NOT EXISTS servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  precio REAL NOT NULL DEFAULT 0,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

-- Titulares (catálogo reutilizable)
CREATE TABLE IF NOT EXISTS titulares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  domicilio TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  email TEXT,
  notas TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Secciones
CREATE TABLE IF NOT EXISTS secciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panteon_id INTEGER NOT NULL,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  capacidad_fosas INTEGER,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (panteon_id) REFERENCES panteones(id) ON DELETE CASCADE,
  UNIQUE (panteon_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_secciones_panteon ON secciones(panteon_id);

-- Líneas
CREATE TABLE IF NOT EXISTS lineas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seccion_id INTEGER NOT NULL,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL DEFAULT '',
  descripcion TEXT,
  capacidad_fosas INTEGER,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seccion_id) REFERENCES secciones(id) ON DELETE CASCADE,
  UNIQUE (seccion_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_lineas_seccion ON lineas(seccion_id);

-- ============================================================================
-- FOSAS (entidad A — protagonista)
-- Cada fosa pertenece a una línea. Tiene datos completos del titular, libro,
-- registro, etc. Es una entidad FINAL (ya no es padre de gavetas).
-- ============================================================================
CREATE TABLE IF NOT EXISTS fosas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  linea_id INTEGER NOT NULL,
  numero TEXT NOT NULL,
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
  capacidad_gavetas INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (linea_id) REFERENCES lineas(id) ON DELETE CASCADE,
  FOREIGN KEY (titular_id) REFERENCES titulares(id) ON DELETE SET NULL
  -- NOTA: sin UNIQUE(linea_id, numero) — se permiten múltiples fosas
  -- con la misma (línea, número) si tienen datos distintos.
);
CREATE INDEX IF NOT EXISTS idx_fosas_linea ON fosas(linea_id);
CREATE INDEX IF NOT EXISTS idx_fosas_titular ON fosas(titular_nombre);

-- ============================================================================
-- GAVETAS (entidad B — protagonista hermana)
-- Cada gaveta pertenece a una LÍNEA directamente (no depende de una fosa).
-- Tiene los MISMOS campos que fosa: titular, libro, registro, etc.
-- ============================================================================
CREATE TABLE IF NOT EXISTS gavetas (
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
  FOREIGN KEY (titular_id) REFERENCES titulares(id) ON DELETE SET NULL
  -- NOTA: sin UNIQUE(linea_id, numero) — se permiten múltiples gavetas
  -- con la misma (línea, número) si tienen datos distintos.
);
CREATE INDEX IF NOT EXISTS idx_gavetas_linea ON gavetas(linea_id);
CREATE INDEX IF NOT EXISTS idx_gavetas_titular ON gavetas(titular_nombre);

-- ============================================================================
-- COLECCIONES: cada fila pertenece a UNA fosa O UNA gaveta (no ambas)
-- Misma estructura para ambos tipos de entidad.
-- ============================================================================

-- Sepultaciones
CREATE TABLE IF NOT EXISTS sepultaciones (
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
);
CREATE INDEX IF NOT EXISTS idx_sepultaciones_fosa ON sepultaciones(fosa_id);
CREATE INDEX IF NOT EXISTS idx_sepultaciones_gaveta ON sepultaciones(gaveta_id);

-- Exhumaciones
CREATE TABLE IF NOT EXISTS exhumaciones (
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
);
CREATE INDEX IF NOT EXISTS idx_exhumaciones_fosa ON exhumaciones(fosa_id);
CREATE INDEX IF NOT EXISTS idx_exhumaciones_gaveta ON exhumaciones(gaveta_id);

-- Mantenimientos pagados (por año)
CREATE TABLE IF NOT EXISTS mantenimientos_pagados (
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
         (fosa_id IS NULL AND gaveta_id IS NOT NULL)),
  UNIQUE (COALESCE(fosa_id, -1), COALESCE(gaveta_id, -1), anio)
);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_fosa ON mantenimientos_pagados(fosa_id);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_gaveta ON mantenimientos_pagados(gaveta_id);

-- Cambios de titular
-- A partir de v8 se guardan columnas de SNAPSHOT del titular anterior
-- (domicilio, teléfono, N° título, fecha título, beneficiario) al
-- momento del cambio, para que la UI pueda mostrar el detalle aunque
-- el titular se haya editado/borrado después.
CREATE TABLE IF NOT EXISTS cambios_titular (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fosa_id INTEGER,
  gaveta_id INTEGER,
  titular_anterior_id INTEGER,
  titular_anterior_nombre TEXT NOT NULL DEFAULT '',
  titular_anterior_domicilio TEXT NOT NULL DEFAULT '',
  titular_anterior_telefono TEXT NOT NULL DEFAULT '',
  titular_anterior_numero_titulo TEXT NOT NULL DEFAULT '',
  titular_anterior_fecha_titulo TEXT,
  titular_anterior_beneficiario TEXT NOT NULL DEFAULT '',
  titular_nuevo_id INTEGER,
  titular_nuevo_nombre TEXT NOT NULL DEFAULT '',
  fecha_cambio TEXT NOT NULL DEFAULT (date('now')),
  motivo TEXT,
  memorandum_id INTEGER,
  FOREIGN KEY (fosa_id) REFERENCES fosas(id) ON DELETE CASCADE,
  FOREIGN KEY (gaveta_id) REFERENCES gavetas(id) ON DELETE CASCADE,
  FOREIGN KEY (titular_anterior_id) REFERENCES titulares(id) ON DELETE SET NULL,
  FOREIGN KEY (titular_nuevo_id) REFERENCES titulares(id) ON DELETE SET NULL,
  CHECK ((fosa_id IS NOT NULL AND gaveta_id IS NULL) OR
         (fosa_id IS NULL AND gaveta_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_cambios_fosa ON cambios_titular(fosa_id);
CREATE INDEX IF NOT EXISTS idx_cambios_gaveta ON cambios_titular(gaveta_id);

-- Memorandums (referencian fosa O gaveta)
CREATE TABLE IF NOT EXISTS memorandums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio TEXT NOT NULL UNIQUE,
  fosa_id INTEGER,
  gaveta_id INTEGER,
  servicio_id INTEGER NOT NULL,
  solicitante_nombre TEXT NOT NULL,
  solicitante_domicilio TEXT NOT NULL DEFAULT '',
  solicitante_telefono TEXT NOT NULL DEFAULT '',
  titular_coincide INTEGER NOT NULL DEFAULT 1,
  monto REAL NOT NULL DEFAULT 0,
  fecha_emision TEXT NOT NULL DEFAULT (date('now')),
  notas TEXT,
  pdf_path TEXT,
  -- ID del usuario que GENERÓ el memorandum (no quien lo descarga).
  -- Solo se muestra en la app, NUNCA en el PDF.
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fosa_id) REFERENCES fosas(id) ON DELETE RESTRICT,
  FOREIGN KEY (gaveta_id) REFERENCES gavetas(id) ON DELETE RESTRICT,
  FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CHECK ((fosa_id IS NOT NULL AND gaveta_id IS NULL) OR
         (fosa_id IS NULL AND gaveta_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_memorandums_fosa ON memorandums(fosa_id);
CREATE INDEX IF NOT EXISTS idx_memorandums_gaveta ON memorandums(gaveta_id);

-- Configuración
CREATE TABLE IF NOT EXISTS configuracion (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  panteon_activo_id INTEGER,
  logo_path TEXT,
  pie_pagina TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL DEFAULT '',
  color_primario TEXT NOT NULL DEFAULT '',
  memo_folio_inicial INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (panteon_activo_id) REFERENCES panteones(id) ON DELETE SET NULL
);
INSERT OR IGNORE INTO configuracion (id, panteon_activo_id, pie_pagina, ciudad, color_primario)
VALUES (1, NULL, '', '', '');

-- SEED: precios ejemplo
INSERT OR IGNORE INTO servicios (tipo, nombre, precio, descripcion) VALUES
  ('INHUMACION',              'Inhumación',                  3500.00, 'Servicio de inhumación en gaveta existente'),
  ('EXHUMACION',              'Exhumación',                  4500.00, 'Servicio de exhumación de restos'),
  ('MEJORA_Y_CONSTRUCCION',   'Mejora y Construcción',       8000.00, 'Trabajos de mejora o construcción en la gaveta'),
  ('MANTENIMIENTO',           'Mantenimiento Anual',          800.00, 'Cuota anual de mantenimiento de la gaveta'),
  ('COMPRA_DE_TERRENO',       'Compra de Terreno',          12000.00, 'Adquisición de terreno para nueva gaveta'),
  ('DUPLICADO',               'Duplicado de Título',          350.00, 'Emisión de duplicado del título de propiedad'),
  ('COMPRA_DE_GAVETA',        'Compra de Gaveta',           18000.00, 'Adquisición de gaveta nueva'),
  ('TRASPASO',                'Traspaso de Propiedad',       2500.00, 'Cambio de titular / traspaso de la propiedad');

-- ============================================================
-- USUARIOS (login)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,   -- hash bcrypt (formato: $2b$10$...)
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  rol TEXT NOT NULL DEFAULT 'usuario',
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Preferencias de apariencia POR USUARIO (tema, color primario).
-- Cada usuario ve la app con su propio tema y color.
CREATE TABLE IF NOT EXISTS preferencias_usuario (
  usuario_id INTEGER PRIMARY KEY,
  tema TEXT NOT NULL DEFAULT 'light',  -- 'light' | 'dark'
  color_primario TEXT NOT NULL DEFAULT '',  -- color en formato HSL "H S% L%"
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- SEED: usuarios iniciales del sistema
-- Credenciales:
--   admin / Admin123!
--   lirio / Lirio123!
INSERT OR IGNORE INTO usuarios (username, password_hash, nombre, rol) VALUES
  ('admin', '$2b$10$8AOPi0ojRRTcbtnAreSZPuu6.Qm0TyjMe8b26mmHXPlx7Wc1MVMDW', 'Administrador', 'admin'),
  ('lirio', '$2b$10$8Oauf/pxz8K8pAAVvfOKH.xDaXzSfHUPIutnuMafs2lXNBOkx9H1i', 'Lirio',         'usuario');
