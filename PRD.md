# Panteón Admin — PRD (Product Requirements Document)

> Panteón Pabellón de Arteaga · Sistema de Gestión · v1.1.9

## 1. Visión

Aplicación de escritorio nativa (Tauri 2) para administrar un panteón municipal
en su totalidad: panteones, secciones, líneas, fosas, gavetas, titulares,
servicios, memorandums (recibos de pago) y reportes. Reemplaza las planillas y
el control manual en papel por un sistema offline-first con SQLite local y un
módulo de autenticación con control de roles.

## 2. Objetivos de negocio

- **Eliminar papel**: los memorandums se generan en PDF y se imprimen directo desde
  la app; los datos nunca salen del equipo del panteón.
- **Trazabilidad**: cada acción queda registrada con `created_at`; los
  memorandums guardan quién los emitió (auditoría interna).
- **Continuidad operativa**: la app funciona sin internet. La sesión NO se
  persiste entre reinicios (cada turno requiere login explícito).
- **Cero mantenimiento de servidor**: SQLite local, todo embebido.

## 3. Usuarios y roles

| Rol | Descripción | Permisos (v1.1.9) |
|---|---|---|
| **admin** | Director / encargado de finanzas | Acceso total, incluyendo gestión de usuarios y Diagnóstico |
| **usuario** | Operador / administrativo | Todo excepto gestión de usuarios y pestaña Diagnóstico |

> No hay registro público. Solo dos cuentas iniciales: `admin` y `lirio`
> (contraseñas iniciales: `Admin123!` y `Lirio123!`; cada quien debe cambiarla
> tras el primer login).

## 4. Modelo de dominio

```
Panteón (1) ──< Sección (1) ──< Línea (1) ──< Fosa
                                       └──< Gaveta

Fosa / Gaveta ──< Sepultación
              ──< Exhumación
              ──< MantenimientoPagado
              ──< CambioTitular

Servicio (catálogo, incluye sin entidad) ──< Memorandum (1)
                                          ──> Fosa o Gaveta o ninguna
```

**Servicios sin entidad** (no requieren fosa/gaveta vinculada):
`COMPRA_DE_TERRENO`, `COMPRA_DE_GAVETA`. El resto requiere una entidad
seleccionada.

## 5. Features (v1.1.9)

### 5.1 Autenticación
- Login con usuario/contraseña, bcrypt cost=10
- Migración transparente SHA-256 → bcrypt al primer login de BD legacy
- Sesión NO persistente: cada reinicio pide credenciales
- Botón de emergencia para resetear contraseña de `admin`
- Cambio de contraseña desde Configuración → Mi cuenta

### 5.2 Modelo jerárquico
- CRUD de Panteones, Secciones, Líneas
- CRUD de Fosas (con superficie, beneficiario, titular)
- CRUD de Gavetas (con libro, registro, nivel)
- Detalle de cada entidad con: datos, titular, sepultaciones, exhumaciones,
  mantenimientos pagados, cambios de titular

### 5.3 Servicios y precios
- Catálogo de servicios con tipo autogenerado (`slugify` del nombre)
- Precio editable inline con 2 decimales (`formatCurrency`)
- Tipos: `INHUMACION`, `EXHUMACION`, `MANTENIMIENTO`, `COMPRA_DE_*`, etc.

### 5.4 Memorandums (recibos de pago)
- Generación de PDF tamaño carta, formato oficial del municipio
- Layout: header con "C.P. ANA LILIA REYES CISNEROS — ENCARGADA…", MEMORANDUM
  con número de folio, fecha, dos párrafos justificados con subrayados
  (titular, monto, ubicación, superficie, propiedad), espacio para
  observaciones, firmas de "C. JOSE LUIS MORENO ROJAS" y
  "PROF. GABRIEL HERRERA NERI"
- Word-wrap inteligente con backtracking para párrafos largos
- Auto-encoding de la entidad (fosa/gaveta) en el PDF
- Numeración consecutiva anual configurable (`memo_folio_inicial`)

### 5.5 Reportes
- Matriz servicio × mes, clic para ver detalle de cada celda
- Resumen del mes en Inicio con barras de progreso por servicio

### 5.6 Búsqueda global
- 4 categorías: titular de fosa, titular de gaveta, sepultados, exhumados
- Sin filtro por `cambios_titular` (muestra solo el titular vigente)

### 5.7 Auditoría
- Cada memorandum guarda `created_by_user_id` (FK a usuarios)
- En la lista, cada fila se colorea según el emisor
- Filtros: búsqueda libre (folio/solicitante/panteón) + por emisor
- Tabs "Por fecha" / "Por folio"

### 5.8 Apariencia por usuario
- Tema (claro/oscuro) y color primario guardados en `preferencias_usuario`
- Cada usuario ve la app a su gusto, sin afectar a otros

### 5.9 Configuración (con tabs)
- **Mi cuenta** (todos): editar nombre, email, teléfono + cambiar contraseña
- **Apariencia** (todos): tema + color primario
- **Sistema** (todos): panteón activo + folio inicial
- **Usuarios** (solo admin): CRUD completo + desactivar (baja lógica)

### 5.10 Diagnóstico (solo admin)
- Versión de schema (PRAGMA user_version)
- Botón "Reparar esquema" que ejecuta todas las migraciones pendientes
- Info del entorno

## 6. Stack técnico

| Capa | Tecnología |
|---|---|
| Shell nativa | Tauri 2.x |
| Frontend | React 19 + TypeScript 5 |
| Build | Vite 6 |
| Estilos | TailwindCSS + shadcn/ui (Radix) |
| BD local | SQLite vía tauri-plugin-sql 2.4.0 |
| Auth hash | bcryptjs (puro JS, cost 10) |
| PDF | jsPDF + jspdf-autotable |
| Router | react-router-dom 7 |
| Iconos | lucide-react |
| Package manager | pnpm 10 |

## 7. Restricciones no funcionales

- **Offline-first**: la app NO requiere internet en ningún momento.
- **Sin servidor**: no hay backend; todo el procesamiento es local.
- **Sesión no persistente**: cada reinicio pide credenciales (política de
  seguridad del cliente).
- **Tamaño**: bundle de 1MB gzip ~300KB. App nativa de ~30MB compilada.
- **Plataformas objetivo**: macOS, Windows, Linux (Tauri).

## 8. Roadmap (futuro)

- [ ] Impresión directa de PDF sin diálogo del sistema
- [ ] Sincronización opcional con servidor (si el cliente quiere multi-equipo)
- [ ] Reportes exportables a Excel/PDF
- [ ] Recordatorios automáticos de mantenimiento anual
- [ ] Foto por fosa/gaveta (almacenamiento local de imágenes)
- [ ] Búsqueda por OCR de títulos escaneados

## 9. Métricas de éxito

- 100% de los memorandums digitales vs 0% en papel
- Cero pérdida de datos por fallos de electricidad (SQLite transaccional)
- Tiempo de generación de memorandum: < 5 segundos
- Tiempo de búsqueda de un titular: < 2 segundos
