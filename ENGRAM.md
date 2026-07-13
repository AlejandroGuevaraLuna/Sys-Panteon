# ENGRAM — Panteón Admin

> Resumen semántico denso del proyecto. Una sola lectura = entender todo.

## Identidad

`panteon-admin` = aplicación de escritorio Tauri 2 + React 19 + TypeScript + SQLite
para el **Panteón Pabellón de Arteaga** (municipio mexicano). Reemplaza control
en papel del cementerio. v1.1.9. Estado: estable, en uso.

## Núcleo

`Panteón → Sección → Línea → {Fosa, Gaveta}` (entidades independientes, NO
fosa-contenedora-de-gavetas). Cada entidad tiene Titular, Sepultaciones,
Exhumaciones, MantenimientosPagados, CambiosTitular. `Servicio` es un
catálogo independiente. `Memorandum` une Servicio + (Fosa|Gaveta|null) +
Solicitante + Monto + PDF.

## Casos de uso principales

1. **Emisión de memorandum de pago** (camino feliz): usuario abre ficha de
   fosa/gaveta → botón "Memorandum" → selecciona servicio + solicitante →
   "Guardar y descargar PDF" → genera PDF con formato oficial (header
   "C.P. ANA LILIA REYES CISNEROS", MEMORANDUM {folio}, dos párrafos
   justificados con subrayados, firmas de Moreno Rojas y Herrera Neri) →
   INSERT en BD con `created_by_user_id` → descarga automática.

2. **Emisión sin entidad** (COMPRA_DE_TERRENO, COMPRA_DE_GAVETA): el mismo
   flujo pero sin seleccionar fosa/gaveta. El banner azul avisa que es
   "sin entidad".

3. **Búsqueda de titular**: Inicio → escribe nombre/apellido → ve cards
   de fosas y gavetas con coincidencias, con link a la ficha.

4. **Reportes mensuales**: Inicio o /reportes → matriz servicio × mes con
   totales y barras de progreso; clic en celda abre detalle.

5. **Auditoría**: lista de memorandums con columna "Emitido por" coloreada
   por emisor + filtros por emisor y por texto.

## Decisiones clave

- **Tauri 2 + SQLite local** (no servidor) → cliente pidió offline-first.
- **Sesión no persistente** → política de seguridad: cada turno = login.
- **bcryptjs (puro JS)** en vez de `bcrypt` nativo → evita compilación nativa
  en Tauri. Acepta SHA-256 legacy con migración transparente.
- **Jerarquía NO normalizada por gaveta-en-fosa** → gavetas y fosas son
  colecciones paralelas bajo la misma línea (refleja el dominio real).
- **PDF auto-contenido** (jsPDF) → no requiere visor externo; se descarga.
- **Apariencia por usuario** → tema/color son personales, no globales.

## Conceptos de dominio

- **Panteón**: cementerio físico. Único activo a la vez.
- **Sección**: agrupación geográfica (A, B, C…). Pertenece a un panteón.
- **Línea**: hilera dentro de la sección (L-1, L-2…). Pertenece a sección.
- **Fosa**: tumba en tierra. Tiene `superficie_ancho × alto` (metros, TEXT
  decimal).
- **Gaveta**: nicho en pared. Tiene `libro`, `registro`, `nivel`.
- **Titular**: dueño registrado. Cambia con el tiempo (auditado en
  `cambios_titular`).
- **Memorandum**: recibo de pago. PDF + fila en BD. Folio anual auto-incremental.

## Reglas de negocio

- `folio` único por año (formato `MEM-AAAA-NNNN`).
- Memo requiere servicio + (solicitante) + (fosa O gaveta O nada).
- Si servicio ∈ {COMPRA_DE_TERRENO, COMPRA_DE_GAVETA} → sin entidad.
- Baja lógica de usuarios: `activo = 0`, no DELETE.
- No se puede desactivar al único admin activo.
- Migración automática: BD v5 → v5+ ejecuta `ALTER TABLE` para columnas
  añadidas (fosas, gavetas, configuracion, usuarios, memorandums).

## Estructura del código

```
src/
  components/
    layout/MainLayout.tsx       # sidebar colapsable, footer con usuario
    ui/                         # shadcn/ui (Button, Card, Tabs, etc.)
  features/
    auth/                       # login, context, gestión de usuarios
    busqueda/                   # búsqueda global
    configuracion/              # tabs: cuenta, apariencia, sistema, usuarios
    fosas/    gavetas/          # CRUD + detalle (5 secciones: titular, etc.)
    lineas/    secciones/       # CRUD simplificado
    memorandumss/                # dialog, listado con tabs, PDF, service
    panteones/                  # CRUD raíz
    preferencias/               # tema/color por usuario
    reportes/                   # matriz servicio × mes
    servicios/                  # catálogo + precios con 2 decimales
  hooks/
    useTheme.ts                 # tema/color por usuario desde BD
  lib/
    auth.ts                     # bcrypt + storage
    db.ts                       # PRAGMA user_version + migraciones
    utils.ts                    # formatCurrency, formatDate, etc.
  pages/
    Inicio.tsx                  # buscador + stats + resumen del mes
    Diagnostico.tsx             # solo admin
  db/
    schema.sql                  # v5 con todas las tablas
  img/
    Logo-Pabe.png               # logo del panteón (también app icon)
```

## APIs internas (servicios)

Cada feature tiene un `service.ts` que devuelve `Promise<T>`. Nunca lanzan
HTTP, todo va a SQLite via `tauri-plugin-sql`. `esc()` escapa strings,
`n()` parsea enteros, `num()` parsea decimales.

## Limitaciones conocidas

- No hay OCR de títulos escaneados (búsqueda solo por texto capturado).
- No hay multi-equipo (todo local).
- No hay backup automático (recomendar exportar `panteon.db` periódicamente).
- PDFs no se imprimen directo: se descargan y se imprimen desde el visor.

## Métricas del proyecto

- ~30 archivos TS/TSX
- Schema: 12 tablas, 5 índices
- ~1000 líneas en `pdf.ts` (la lógica del PDF es la más densa)
- bcrypt: 0 dependencias nativas
- Bundle: 1MB JS / 28KB CSS
- Tamaño binario compilado: ~30MB (macOS .app)
