# Panteón Admin

Aplicación de escritorio nativa para el **Panteón Pabellón de Arteaga**.
Administra panteones, secciones, líneas, fosas, gavetas, titulares, servicios
y memorandums (recibos de pago) con generación de PDF. Funciona 100% offline.

> v1.1.9 · Tauri 2 + React 19 + TypeScript + SQLite

---

## Stack

| Capa | Tecnología |
|---|---|
| Shell nativa | [Tauri 2](https://tauri.app/) (Rust + WebView) |
| UI | [React 19](https://react.dev/) + TypeScript 5 |
| Build / Dev | [Vite 6](https://vitejs.dev/) |
| Estilos | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix) |
| Base de datos | SQLite vía [tauri-plugin-sql](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/sql) 2.4 |
| Auth hash | [bcryptjs](https://www.npmjs.com/package/bcryptjs) (puro JS, sin compilación nativa) |
| PDF | [jsPDF](https://github.com/parallax/jsPDF) |
| Routing | react-router-dom 7 |
| Iconos | [lucide-react](https://lucide.dev/) |
| Package manager | pnpm 10 |

## Requisitos

- **Node.js** 18+ (probado con 20)
- **pnpm** 10+
- **Rust** (toolchain estable) — solo para `tauri dev` o builds nativos
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: Microsoft C++ Build Tools
- **Linux**: `webkit2gtk-4.1`, `libssl-dev`, `libayatana-appindicator3-dev`,
  `librsvg2-dev` (ver [docs de Tauri](https://tauri.app/start/prerequisites/))

## Instalación

```bash
# 1. Clonar
git clone <repo-url> panteon-admin
cd panteon-admin

# 2. Dependencias JS
pnpm install

# 3. Dependencias Rust (solo la primera vez)
cd src-tauri && cargo fetch && cd ..
```

## Desarrollo

```bash
# Modo dev (hot-reload en Vite, devtools de Tauri)
pnpm tauri dev
# Equivalente:
npx @tauri-apps/cli dev
```

Abre la app en una ventana nativa. Los cambios en `src/` se recargan
automáticamente.

## Build de producción

```bash
# Build del frontend (TS check + bundle)
pnpm build

# Build nativo (genera instaladores .dmg, .msi, .AppImage, .deb, etc.)
pnpm tauri build
```

Los instaladores quedan en:
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/{deb,appimage}/`

## Estructura del proyecto

```
panteon-admin/
├── src/                        # Frontend (React + TS)
│   ├── components/
│   │   ├── layout/             # MainLayout (sidebar + header)
│   │   └── ui/                 # Componentes shadcn/ui
│   ├── features/               # Módulos por dominio
│   │   ├── auth/               # Login, AuthContext, GestiónUsuarios
│   │   ├── busqueda/           # Búsqueda global
│   │   ├── configuracion/      # Tabs: cuenta, apariencia, sistema, usuarios
│   │   ├── fosas/, gavetas/    # CRUD con 5 secciones
│   │   ├── lineas/, secciones/, panteones/
│   │   ├── memorandums/        # PDF + dialog + listado
│   │   ├── preferencias/       # Tema/color por usuario
│   │   ├── reportes/           # Matriz servicio × mes
│   │   └── servicios/          # Catálogo + precios
│   ├── hooks/useTheme.ts       # Tema/color por usuario
│   ├── lib/
│   │   ├── auth.ts             # bcrypt + sesión
│   │   ├── db.ts               # SQLite + migraciones
│   │   └── utils.ts            # formatCurrency, formatDate
│   ├── pages/
│   │   ├── Inicio.tsx          # Dashboard principal
│   │   └── Diagnostico.tsx     # Solo admin
│   ├── db/schema.sql           # Schema v5
│   ├── img/Logo-Pabe.png       # Logo del panteón
│   ├── App.tsx                 # Router + AuthProvider
│   └── styles.css              # Tailwind + tokens CSS
├── src-tauri/                  # Backend Rust + config Tauri
│   ├── src/main.rs             # Entry point
│   ├── tauri.conf.json         # Config ventana + bundle
│   ├── Cargo.toml
│   ├── capabilities/           # Permisos Tauri
│   └── icons/                  # icon.png, icon.icns, icon.ico, etc.
├── PRD.md                      # Product Requirements Document
├── ENGRAM.md                   # Resumen semántico denso
├── README.md                   # Este archivo
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vite.config.ts
```

## Credenciales iniciales

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin123!` | Administrador |
| `lirio` | `Lirio123!` | Usuario |

> Cambia la contraseña tras el primer login desde **Configuración → Mi cuenta**.

## Modelos principales

```
Panteón (1) ─< Sección (1) ─< Línea (1) ─< Fosa
                                     └──< Gaveta

Fosa/Gaveta ─< Sepultación, Exhumación, MantenimientoPagado, CambioTitular

Servicio (catálogo) ─< Memorandum (recibo PDF)
                   ─> Fosa o Gaveta o ninguna
```

## Características

- **Autenticación** con bcrypt (cost 10) y migración transparente de hashes
  legacy SHA-256.
- **Sesión no persistente**: cada reinicio de la app pide credenciales.
- **CRUD jerárquico** de Panteones, Secciones, Líneas, Fosas, Gavetas.
- **Generación de PDF** con formato oficial (MEMORANDUM, fecha, párrafos
  justificados con subrayados, espacio para observaciones, firmas).
- **Numeración consecutiva anual** de folios, configurable
  (`memo_folio_inicial`).
- **Búsqueda global** por titular de fosa, titular de gaveta, sepultados y
  exhumados.
- **Reportes mensuales** matriz servicio × mes.
- **Auditoría**: cada memorandum registra `created_by_user_id` (quién lo
  generó). Lista con color por emisor y filtros.
- **Apariencia por usuario**: tema (claro/oscuro) y color primario guardados
  individualmente en `preferencias_usuario`.
- **Configuración con tabs**:
  - Mi cuenta (datos + cambiar contraseña)
  - Apariencia (tema + color)
  - Sistema (panteón activo + folio inicial)
  - Usuarios (solo admin) — CRUD con baja lógica y AlertDialog de confirmación
- **Gestión de usuarios** (solo admin): crear, editar, desactivar (baja
  lógica, nunca DELETE físico).
- **Diagnóstico** (solo admin): versión de schema, reparar esquema.
- **Sidebar colapsable** con tooltips en iconos.

## Comandos útiles

```bash
# Lint
pnpm tsc --noEmit

# Generar iconos desde el logo
npx @tauri-apps/cli icon src/img/Logo-Pabe.png
# (requiere que el PNG sea cuadrado; redimensionar con sips o convert si no)

# Build sin empaquetar (rápido, solo verifica que compila)
npx @tauri-apps/cli build --no-bundle

# Diagnóstico de Tauri
npx @tauri-apps/cli info
```

## Base de datos

La BD SQLite se crea automáticamente al primer arranque en:
- macOS: `~/Library/Application Support/com.panteon.admin/panteon.db`
- Windows: `%APPDATA%\com.panteon.admin\panteon.db`
- Linux: `~/.local/share/com.panteon.admin/panteon.db`

### Respaldos

```bash
# macOS
cp ~/Library/Application\ Support/com.panteon.admin/panteon.db \
   ~/Desktop/panteon-backup-$(date +%Y%m%d).db
```

### Migraciones

El schema usa `PRAGMA user_version`. Al abrir la BD:
1. Si `user_version < TARGET_VERSION` (5), ejecuta las migraciones pendientes.
2. `ensureEntityColumns` añade columnas faltantes con `ALTER TABLE`.
3. `ensureUserColumns` añade `email`/`telefono` + crea `preferencias_usuario`.
4. `ensureMemorandumsColumns` añade `created_by_user_id`.
5. `ensureConfigColumns` añade `memo_folio_inicial`.

Todo es idempotente: si las columnas ya existen, no pasa nada.

## Troubleshooting

### `Failed to create app icon: resource path icons/icon.icns doesn't exist`

Regenera los iconos desde el logo:
```bash
# El logo debe ser cuadrado
sips -z 512 512 src/img/Logo-Pabe.png --out /tmp/Logo-Pabe-square.png
npx @tauri-apps/cli icon /tmp/Logo-Pabe-square.png
```

### `no such column: email` al hacer login

La BD ya existía con un esquema anterior. Las migraciones `ensureUserColumns`
añaden las columnas automáticamente al abrir la app. Si no, ejecuta desde
**Diagnóstico → Reparar esquema** (solo admin).

### `UNIQUE constraint failed: memorandums.folio`

Dos inserts con el mismo folio. La app usa un `useRef` para prevenir
doble-click y el service hace retry on UNIQUE regenerando el folio. Si
persiste, ve a la lista de memos y elimina el duplicado.

## Licencia

Privado — uso interno del Panteón Pabellón de Arteaga.
