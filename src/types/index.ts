// Tipos del dominio — Panteón v4
export interface Panteon {
  id: number; nombre: string; direccion: string; telefono: string;
  administrador: string; notas: string | null; activo: number; created_at: string;
}
export type TipoServicio =
  | "INHUMACION" | "EXHUMACION" | "MEJORA_Y_CONSTRUCCION" | "MANTENIMIENTO"
  | "COMPRA_DE_TERRENO" | "DUPLICADO" | "COMPRA_DE_GAVETA" | "TRASPASO";
export const TIPOS_SERVICIO: { value: TipoServicio; label: string }[] = [
  { value: "INHUMACION", label: "Inhumación" },
  { value: "EXHUMACION", label: "Exhumación" },
  { value: "MEJORA_Y_CONSTRUCCION", label: "Mejora y Construcción" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "COMPRA_DE_TERRENO", label: "Compra de Terreno" },
  { value: "DUPLICADO", label: "Duplicado" },
  { value: "COMPRA_DE_GAVETA", label: "Compra de Gaveta" },
  { value: "TRASPASO", label: "Traspaso" },
];
export interface Servicio {
  id: number; tipo: TipoServicio; nombre: string; precio: number;
  descripcion: string | null; activo: number;
}
export interface Titular {
  id: number; nombre: string; domicilio: string; telefono: string;
  email: string | null; notas: string | null; created_at: string;
}

export interface Seccion {
  id: number; panteon_id: number; codigo: string; nombre: string;
  descripcion: string | null; capacidad_fosas: number | null;
  activo: number; created_at: string;
}

export interface Linea {
  id: number; seccion_id: number; codigo: string; nombre: string;
  descripcion: string | null; capacidad_fosas: number | null;
  activo: number; created_at: string;
}

/** Campos comunes compartidos entre Fosa y Gaveta (titular + datos libro) */
export interface CamposEntidad {
  libro: string;
  registro: string;
  titular_id: number | null;
  titular_nombre: string;
  titular_domicilio: string;
  titular_telefono: string;
  numero_titulo: string;
  fecha_titulo: string | null;
  superficie_ancho: string;
  superficie_alto: string;
  beneficiario: string;
  observaciones: string | null;
  notas_libro: string | null;
}

export interface Fosa extends CamposEntidad {
  id: number; linea_id: number;
  numero: string; notas: string | null;
  capacidad_gavetas: number;
  created_at: string; updated_at: string;
}

export interface Gaveta extends CamposEntidad {
  id: number; linea_id: number;
  numero: number; notas: string | null;
  created_at: string;
}

export interface Sepultacion {
  id: number; fosa_id?: number | null; gaveta_id?: number | null;
  nombre: string; fecha_sepultacion: string; fecha_fallecimiento: string | null;
  edad: number | null; notas: string | null; created_at: string;
}
export interface Exhumacion {
  id: number; fosa_id?: number | null; gaveta_id?: number | null;
  nombre: string; fecha_exhumacion: string; destino: string | null;
  notas: string | null; created_at: string;
}
export interface MantenimientoPagado {
  id: number; fosa_id?: number | null; gaveta_id?: number | null;
  anio: number; fecha_pago: string; monto: number; notas: string | null;
}
export interface CambioTitular {
  id: number; fosa_id?: number | null; gaveta_id?: number | null;
  titular_anterior_id: number | null; titular_anterior_nombre: string;
  /** Snapshot del titular anterior al momento del cambio (v8+). */
  titular_anterior_domicilio?: string;
  titular_anterior_telefono?: string;
  titular_anterior_numero_titulo?: string;
  titular_anterior_fecha_titulo?: string | null;
  titular_anterior_beneficiario?: string;
  titular_nuevo_id: number | null; titular_nuevo_nombre: string;
  fecha_cambio: string; motivo: string | null; memorandum_id: number | null;
}
export interface Memorandum {
  id: number; folio: string;
  fosa_id?: number | null; gaveta_id?: number | null;
  servicio_id: number; solicitante_nombre: string;
  solicitante_domicilio: string; solicitante_telefono: string;
  titular_coincide: number; monto: number;
  fecha_emision: string; notas: string | null; pdf_path: string | null;
  /** ID del usuario que GENERÓ el memorandum. Solo visible en la app, NUNCA en el PDF. */
  created_by_user_id?: number | null;
  created_at: string;
}
export interface AppConfig {
  panteon_activo_id: number | null; logo_path: string | null;
  pie_pagina: string; ciudad: string; color_primario: string;
  /** Número inicial del folio de memorandums. El siguiente folio será este
   *  número si aún no hay memorandos emitidos, o MAX(emitidos, inicial) + 1. */
  memo_folio_inicial: number;
}

// Tipos detalle - pueden tener campos faltantes como '' o 0 si el contexto no existe
export interface LineaDetalle extends Linea {
  seccion_codigo: string; seccion_nombre: string;
  panteon_id: number; panteon_nombre: string;
  total_fosas: number; total_gavetas: number;
  fosas: Fosa[];
  gavetas: Gaveta[];
}

export interface FosaDetalle extends Fosa {
  seccion_id: number;
  linea_codigo: string; linea_nombre: string;
  seccion_codigo: string; seccion_nombre: string;
  panteon_id: number; panteon_nombre: string;
  sepultaciones: Sepultacion[];
  exhumaciones: Exhumacion[];
  mantenimientos: MantenimientoPagado[];
  cambios_titular: CambioTitular[];
}

export interface GavetaDetalle extends Gaveta {
  linea_codigo: string; linea_nombre: string;
  seccion_id: number;
  seccion_codigo: string; seccion_nombre: string;
  panteon_id: number; panteon_nombre: string;
  sepultaciones: Sepultacion[];
  exhumaciones: Exhumacion[];
  mantenimientos: MantenimientoPagado[];
  cambios_titular: CambioTitular[];
}

// Re-exports de tipos prácticos
export type { Fosa as FosaBase } from "./index";


export interface MemorandumDetalle extends Memorandum {
  fosa_seccion_codigo: string; fosa_seccion_nombre: string;
  fosa_linea_codigo: string; fosa_linea_nombre: string;
  fosa_numero: string; fosa_panteon_nombre: string;
  gaveta_numero: number; gaveta_nivel: string;
  gaveta_libro: string; gaveta_registro: string;
  servicio_nombre: string; servicio_tipo: TipoServicio;
  titular_nombre: string;
  /** Para servicios de TRASPASO, contiene el cambio de titular más
   *  reciente asociado a esta fosa/gaveta (el vinculado por
   *  memorandum_id, o el más reciente si no hay vínculo). */
  cambio_titular?: {
    titular_anterior_nombre: string;
    titular_nuevo_nombre: string;
    fecha_cambio: string;
    motivo: string | null;
  } | null;
}