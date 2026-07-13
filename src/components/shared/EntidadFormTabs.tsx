import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface CamposEntidadForm {
  // Datos principales (pestaña 1)
  numero: string;
  libro: string;
  registro: string;
  capacidad_gavetas: string;

  // Titular (pestaña 2)
  titular_nombre: string;
  titular_domicilio: string;
  titular_telefono: string;
  numero_titulo: string;
  fecha_titulo: string;
  superficie_ancho: string;
  superficie_alto: string;
  beneficiario: string;

  // Notas (pestaña 3)
  observaciones: string;
  notas_libro: string;
}

export const CAMPOS_VACIOS: CamposEntidadForm = {
  numero: "",
  libro: "",
  registro: "",
  capacidad_gavetas: "1",
  titular_nombre: "",
  titular_domicilio: "",
  titular_telefono: "",
  numero_titulo: "",
  fecha_titulo: "",
  superficie_ancho: "1",
  superficie_alto: "2.5",
  beneficiario: "",
  observaciones: "",
  notas_libro: "",
};

interface Props {
  tipo: "fosa" | "gaveta";
  form: CamposEntidadForm;
  onChange: (form: CamposEntidadForm) => void;
  onSubmit: () => void;
  guardando: boolean;
  /** Etiqueta del botón de submit (ej. "Crear fosa") */
  submitLabel: string;
  /** Deshabilita el botón de submit (ej. si no hay línea seleccionada) */
  submitDisabled?: boolean;
  /** Acción para cancelar */
  onCancel?: () => void;
}

/**
 * Formulario de creación de fosa o gaveta con pestañas.
 * Pestañas:
 *   1. Datos (número, capacidad, nivel)
 *   2. Titular (nombre, domicilio, título, beneficiario, etc.)
 *   3. Predial / Notas
 *
 * La pestaña 1 es la más importante porque tiene los campos requeridos.
 * El resto puede llenarse después desde la ficha.
 */
export function EntidadFormTabs({
  tipo, form, onChange, onSubmit, guardando, submitLabel, submitDisabled, onCancel,
}: Props) {
  const upd = (patch: Partial<CamposEntidadForm>) => onChange({ ...form, ...patch });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero.trim()) return;
    onSubmit();
  };

  const acento = tipo === "fosa" ? "primary" : "primary";

  // Estilos locales para agrandar inputs/labels del formulario de creación
  const inputCls = "h-11 text-base";
  const labelCls = "text-sm font-medium";
  const helperCls = "text-sm text-muted-foreground mt-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-base">
      <Tabs defaultValue="datos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-11">
          <TabsTrigger value="datos" className="text-base">1. Datos</TabsTrigger>
          <TabsTrigger value="titular" className="text-base">2. Titular</TabsTrigger>
          <TabsTrigger value="notas" className="text-base">3. Notas</TabsTrigger>
        </TabsList>

        {/* Pestaña 1: Datos principales */}
        <TabsContent value="datos" className="space-y-4 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Número *</Label>
              <Input
                className={inputCls}
                value={form.numero}
                onChange={(e) => upd({ numero: e.target.value })}
                placeholder={tipo === "fosa" ? "Ej: 1, A, 10" : "Ej: 1, 2, 50"}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                El número es obligatorio.
              </p>
            </div>
            {tipo === "fosa" && (
              <div>
                <Label>Capacidad (referencial)</Label>
                <Input
                className={inputCls}
                  type="number" min="1" max="50"
                  value={form.capacidad_gavetas}
                  onChange={(e) => upd({ capacidad_gavetas: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  En v5 las gavetas son independientes — este valor es sólo informativo.
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Libro</Label>
              <Input
                className={inputCls}
                value={form.libro}
                onChange={(e) => upd({ libro: e.target.value })}
                placeholder="Ej: L-2024-001"
              />
            </div>
            <div>
              <Label>Registro</Label>
              <Input
                className={inputCls}
                value={form.registro}
                onChange={(e) => upd({ registro: e.target.value })}
                placeholder="Número"
              />
            </div>
          </div>
        </TabsContent>

        {/* Pestaña 2: Titular */}
        <TabsContent value="titular" className="space-y-3 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nombre del titular</Label>
              <Input
                className={inputCls}
                value={form.titular_nombre}
                onChange={(e) => upd({ titular_nombre: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                className={inputCls}
                value={form.titular_telefono}
                onChange={(e) => upd({ titular_telefono: e.target.value })}
                placeholder="(33) 1234-5678"
              />
            </div>
          </div>
          <div>
            <Label>Domicilio</Label>
            <Input
                className={inputCls}
              value={form.titular_domicilio}
              onChange={(e) => upd({ titular_domicilio: e.target.value })}
              placeholder="Calle, número, colonia, ciudad"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Número de título</Label>
              <Input
                className={inputCls}
                value={form.numero_titulo}
                onChange={(e) => upd({ numero_titulo: e.target.value })}
                placeholder="T-12345"
              />
            </div>
            <div>
              <Label>Fecha del título</Label>
              <Input
                className={inputCls}
                type="date"
                value={form.fecha_titulo}
                onChange={(e) => upd({ fecha_titulo: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ancho (m)</Label>
              <Input
                className={inputCls}
                type="number" step="0.01" min="0"
                value={form.superficie_ancho}
                onChange={(e) => upd({ superficie_ancho: e.target.value })}
                placeholder="Ej: 1"
              />
            </div>
            <div>
              <Label>Alto (m)</Label>
              <Input
                className={inputCls}
                type="number" step="0.01" min="0"
                value={form.superficie_alto}
                onChange={(e) => upd({ superficie_alto: e.target.value })}
                placeholder="Ej: 2.5"
              />
            </div>
          </div>
          <div>
            <Label>Beneficiario</Label>
            <Input
                className={inputCls}
              value={form.beneficiario}
              onChange={(e) => upd({ beneficiario: e.target.value })}
              placeholder="Nombre del beneficiario"
            />
          </div>
        </TabsContent>

        {/* Pestaña 3: Notas */}
        <TabsContent value="notas" className="space-y-3 mt-2">
          <div>
            <Label>Observaciones</Label>
            <Textarea
                className="text-base"
              rows={3}
              value={form.observaciones}
              onChange={(e) => upd({ observaciones: e.target.value })}
              placeholder="Notas generales sobre el estado, mantenimiento, etc."
            />
          </div>
          <div>
            <Label>Notas del libro</Label>
            <Textarea
                className="text-base"
              rows={3}
              value={form.notas_libro}
              onChange={(e) => upd({ notas_libro: e.target.value })}
              placeholder="Anotaciones adicionales del libro de registros"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-2 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={guardando}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={guardando || submitDisabled || !form.numero.trim()}>
          {guardando ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
