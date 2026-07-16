import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Save, Trash2, Plus, Pencil, AlertTriangle, Eye, User, Phone, MapPin,
  Hash, Calendar, Users,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fosasService } from '@/features/fosas/service';
import { gavetasService } from '@/features/gavetas/service';
import type { FosaDetalleCompleta } from '@/features/fosas/service';
import type { GavetaDetalle, CambioTitular } from '@/types';

export type Entidad = FosaDetalleCompleta | GavetaDetalle;

interface Props {
  tipo: 'fosa' | 'gaveta';
  entidad: Entidad;
  onChange: () => void;
}

/**
 * Pestañas para la ficha de una fosa o gaveta:
 *   Titular y Título, Sepultados, Exhumaciones, Mantenimiento, Cambios Titular.
 *
 * En Sepultados y Exhumaciones las notas son visibles y editables
 * (botón "Editar" por renglón).
 */
export function EntidadSecciones({ tipo, entidad, onChange }: Props) {
  const id = entidad.id;
  const {
    sepultaciones = [],
    exhumaciones = [],
    mantenimientos = [],
    cambios_titular = [],
  } = entidad;

  return (
    <Tabs
      defaultValue='titular'
      className='w-full'
    >
      <TabsList>
        <TabsTrigger value='titular'>Titular y Título</TabsTrigger>
        <TabsTrigger value='sepultaciones'>
          Sepultados ({sepultaciones.length})
        </TabsTrigger>
        <TabsTrigger value='exhumaciones'>
          Exhumaciones ({exhumaciones.length})
        </TabsTrigger>
        <TabsTrigger value='mantenimiento'>Mantenimiento</TabsTrigger>
        <TabsTrigger value='cambios'>
          Cambios titular ({cambios_titular.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value='titular'>
        <TitularSection
          tipo={tipo}
          entidad={entidad}
          onChange={onChange}
        />
      </TabsContent>

      <TabsContent value='sepultaciones'>
        <SepultacionesSection
          tipo={tipo}
          id={id}
          items={sepultaciones as any}
          onChange={onChange}
        />
      </TabsContent>

      <TabsContent value='exhumaciones'>
        <ExhumacionesSection
          tipo={tipo}
          id={id}
          items={exhumaciones as any}
          onChange={onChange}
        />
      </TabsContent>

      <TabsContent value='mantenimiento'>
        <MantenimientoSection
          tipo={tipo}
          id={id}
          items={mantenimientos as any}
          onChange={onChange}
        />
      </TabsContent>

      <TabsContent value='cambios'>
        <CambiosSection
          tipo={tipo}
          id={id}
          items={cambios_titular as any}
          entidad={entidad}
          onChange={onChange}
        />
      </TabsContent>
    </Tabs>
  );
}

// --- Sección Titular ---
function TitularSection({
  tipo,
  entidad,
  onChange,
}: {
  tipo: 'fosa' | 'gaveta';
  entidad: Entidad;
  onChange: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    titular_nombre: entidad.titular_nombre || '',
    titular_domicilio: entidad.titular_domicilio || '',
    titular_telefono: entidad.titular_telefono || '',
    numero_titulo: entidad.numero_titulo || '',
    fecha_titulo: entidad.fecha_titulo || '',
    superficie_ancho: entidad.superficie_ancho || '',
    superficie_alto: entidad.superficie_alto || '',
    beneficiario: entidad.beneficiario || '',
    libro: entidad.libro || '',
    registro: entidad.registro || '',
    observaciones: entidad.observaciones || '',
    notas_libro: entidad.notas_libro || '',
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      if (tipo === 'fosa') {
        await fosasService.actualizar(entidad.id, form);
      } else {
        await gavetasService.actualizar(entidad.id, form);
      }
      onChange();
      setEdit(false);
    } catch (e) {
      console.error(e);
      alert('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (edit) {
    return (
      <Card>
        <CardContent className='pt-6 space-y-3'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            <div>
              <Label>Nombre del titular</Label>
              <Input
                value={form.titular_nombre}
                onChange={(e) =>
                  setForm({ ...form, titular_nombre: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={form.titular_telefono}
                onChange={(e) =>
                  setForm({ ...form, titular_telefono: e.target.value })
                }
              />
            </div>
            <div className='md:col-span-2'>
              <Label>Domicilio</Label>
              <Input
                value={form.titular_domicilio}
                onChange={(e) =>
                  setForm({ ...form, titular_domicilio: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Número de título</Label>
              <Input
                value={form.numero_titulo}
                onChange={(e) =>
                  setForm({ ...form, numero_titulo: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Fecha del título</Label>
              <Input
                type='date'
                value={form.fecha_titulo}
                onChange={(e) =>
                  setForm({ ...form, fecha_titulo: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Ancho (m)</Label>
              <Input
                value={form.superficie_ancho}
                onChange={(e) =>
                  setForm({ ...form, superficie_ancho: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Largo (m)</Label>
              <Input
                value={form.superficie_alto}
                onChange={(e) =>
                  setForm({ ...form, superficie_alto: e.target.value })
                }
              />
            </div>
            <div className='md:col-span-2'>
              <Label>Beneficiario</Label>
              <Input
                value={form.beneficiario}
                onChange={(e) =>
                  setForm({ ...form, beneficiario: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Libro</Label>
              <Input
                value={form.libro}
                onChange={(e) => setForm({ ...form, libro: e.target.value })}
              />
            </div>
            <div>
              <Label>Registro</Label>
              <Input
                value={form.registro}
                onChange={(e) => setForm({ ...form, registro: e.target.value })}
              />
            </div>
            <div className='md:col-span-2'>
              <Label>Observaciones</Label>
              <Textarea
                rows={2}
                value={form.observaciones}
                onChange={(e) =>
                  setForm({ ...form, observaciones: e.target.value })
                }
              />
            </div>
            <div className='md:col-span-2'>
              <Label>Notas del libro</Label>
              <Textarea
                rows={2}
                value={form.notas_libro}
                onChange={(e) =>
                  setForm({ ...form, notas_libro: e.target.value })
                }
              />
            </div>
          </div>
          <div className='flex gap-2'>
            <Button
              onClick={guardar}
              disabled={guardando}
            >
              <Save className='mr-2 h-4 w-4' />{' '}
              {guardando ? 'Guardando...' : 'Guardar titular'}
            </Button>
            <Button
              variant='outline'
              onClick={() => setEdit(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className='pt-6 space-y-4'>
        <dl className='grid gap-4 md:grid-cols-2 text-sm'>
          <div>
            <dt className='text-muted-foreground'>Titular</dt>
            <dd className='font-medium'>{entidad.titular_nombre || '—'}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Teléfono</dt>
            <dd>{entidad.titular_telefono || '—'}</dd>
          </div>
          <div className='md:col-span-2'>
            <dt className='text-muted-foreground'>Domicilio</dt>
            <dd>{entidad.titular_domicilio || '—'}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>N° título</dt>
            <dd>{entidad.numero_titulo || '—'}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Fecha título</dt>
            <dd>{entidad.fecha_titulo || '—'}</dd>
          </div>
          <div className='md:col-span-2'>
            <dt className='text-muted-foreground'>Superficie (m)</dt>
            <dd>
              {entidad.superficie_ancho && entidad.superficie_alto
                ? `${entidad.superficie_ancho} × ${entidad.superficie_alto} m`
                : '—'}
            </dd>
          </div>
          <div className='md:col-span-2'>
            <dt className='text-muted-foreground'>Beneficiario</dt>
            <dd>{entidad.beneficiario || '—'}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Libro</dt>
            <dd className='font-mono'>{entidad.libro || '—'}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Registro</dt>
            <dd className='font-mono'>{entidad.registro || '—'}</dd>
          </div>
          <div className='md:col-span-2'>
            <dt className='text-muted-foreground'>Observaciones</dt>
            <dd className='whitespace-pre-wrap'>
              {entidad.observaciones || '—'}
            </dd>
          </div>
          <div className='md:col-span-2'>
            <dt className='text-muted-foreground'>Notas del libro</dt>
            <dd className='whitespace-pre-wrap'>
              {entidad.notas_libro || '—'}
            </dd>
          </div>
        </dl>
        <Button
          onClick={() => setEdit(true)}
          variant='outline'
        >
          Editar titular y datos
        </Button>
      </CardContent>
    </Card>
  );
}

// --- Sección Sepultaciones (alta + edición de notas) ---
function SepultacionesSection({
  tipo,
  id,
  items,
  onChange,
}: {
  tipo: 'fosa' | 'gaveta';
  id: number;
  items: any[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [fechaSep, setFechaSep] = useState('');
  const [fechaFall, setFechaFall] = useState('');
  const [edad, setEdad] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const resetForm = () => {
    setNombre('');
    setFechaSep('');
    setFechaFall('');
    setEdad('');
    setNotas('');
    setEditId(null);
  };

  const abrirNuevo = () => {
    resetForm();
    setOpen(true);
  };
  const abrirEdicion = (s: any) => {
    setEditId(s.id);
    setNombre(s.nombre || '');
    setFechaSep(s.fecha_sepultacion || '');
    setFechaFall(s.fecha_fallecimiento || '');
    setEdad(s.edad != null ? String(s.edad) : '');
    setNotas(s.notas || '');
    setOpen(true);
  };

  const guardar = async () => {
    if (!nombre.trim() || !fechaSep) {
      alert('Nombre y fecha son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        fecha_sepultacion: fechaSep,
        fecha_fallecimiento: fechaFall || null,
        edad: edad ? parseInt(edad) || null : null,
        notas: notas || null,
      };
      if (editId != null) {
        if (tipo === 'fosa')
          await fosasService.actualizarSepultacion(editId, payload);
        else await gavetasService.actualizarSepultacion(editId, payload);
      } else {
        if (tipo === 'fosa')
          await fosasService.agregarSepultacion({ ...payload, _fosa_id: id });
        else
          await gavetasService.agregarSepultacion({
            ...payload,
            _gaveta_id: id,
          });
      }
      onChange();
      setOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (sId: number) => {
    if (!confirm('¿Eliminar esta sepultación?')) return;
    if (tipo === 'fosa') await fosasService.eliminarSepultacion(sId);
    else await gavetasService.eliminarSepultacion(sId);
    onChange();
  };

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>Sepultaciones</CardTitle>
        {!open && (
          <Button onClick={abrirNuevo}>
            <Plus className='mr-2 h-4 w-4' /> Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {open && (
          <Card className='mb-4 border-primary'>
            <CardContent className='pt-4 space-y-3'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <div>
                  <Label>Nombre *</Label>
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Fecha de sepultación *</Label>
                  <Input
                    type='date'
                    value={fechaSep}
                    onChange={(e) => setFechaSep(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Fecha de defunción</Label>
                  <Input
                    type='date'
                    value={fechaFall}
                    onChange={(e) => setFechaFall(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Edad</Label>
                  <Input
                    type='number'
                    value={edad}
                    onChange={(e) => setEdad(e.target.value)}
                  />
                </div>
                <div className='md:col-span-2'>
                  <Label>Notas</Label>
                  <Textarea
                    rows={3}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder='Observaciones, condiciones, observaciones del deceso, etc.'
                  />
                </div>
              </div>
              <div className='flex gap-2'>
                <Button
                  onClick={guardar}
                  disabled={guardando}
                >
                  <Save className='mr-2 h-4 w-4' />
                  {guardando
                    ? 'Guardando...'
                    : editId != null
                      ? 'Actualizar'
                      : 'Agregar'}
                </Button>
                <Button
                  variant='outline'
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  disabled={guardando}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {items.length === 0 ? (
          <p className='text-muted-foreground text-sm text-center py-6'>
            No hay sepultaciones.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Defunción</TableHead>
                <TableHead>Sepultación</TableHead>
                <TableHead>Edad</TableHead>
                <TableHead className='w-48'>Notas</TableHead>
                <TableHead className='w-24'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className='font-medium'>{s.nombre}</TableCell>
                  <TableCell>{s.fecha_fallecimiento || '—'}</TableCell>
                  <TableCell>{s.fecha_sepultacion}</TableCell>
                  <TableCell>{s.edad ?? '—'}</TableCell>
                  <TableCell className='text-xs whitespace-pre-wrap max-w-xs'>
                    {s.notas ? (
                      s.notas
                    ) : (
                      <span className='text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='flex gap-1'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => abrirEdicion(s)}
                        title='Editar'
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => eliminar(s.id)}
                        title='Eliminar'
                      >
                        <Trash2 className='h-4 w-4 text-destructive' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// --- Sección Exhumaciones (alta + edición de notas) ---
function ExhumacionesSection({
  tipo,
  id,
  items,
  onChange,
}: {
  tipo: 'fosa' | 'gaveta';
  id: number;
  items: any[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [destino, setDestino] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const resetForm = () => {
    setNombre('');
    setFecha('');
    setDestino('');
    setNotas('');
    setEditId(null);
  };

  const abrirNuevo = () => {
    resetForm();
    setOpen(true);
  };
  const abrirEdicion = (e: any) => {
    setEditId(e.id);
    setNombre(e.nombre || '');
    setFecha(e.fecha_exhumacion || '');
    setDestino(e.destino || '');
    setNotas(e.notas || '');
    setOpen(true);
  };

  const guardar = async () => {
    if (!nombre.trim() || !fecha) {
      alert('Nombre y fecha son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        fecha_exhumacion: fecha,
        destino: destino || null,
        notas: notas || null,
      };
      if (editId != null) {
        if (tipo === 'fosa')
          await fosasService.actualizarExhumacion(editId, payload);
        else await gavetasService.actualizarExhumacion(editId, payload);
      } else {
        if (tipo === 'fosa')
          await fosasService.agregarExhumacion({ ...payload, _fosa_id: id });
        else
          await gavetasService.agregarExhumacion({
            ...payload,
            _gaveta_id: id,
          });
      }
      onChange();
      setOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id2: number) => {
    if (!confirm('¿Eliminar esta exhumación?')) return;
    if (tipo === 'fosa') await fosasService.eliminarExhumacion(id2);
    else await gavetasService.eliminarExhumacion(id2);
    onChange();
  };

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>Exhumaciones</CardTitle>
        {!open && (
          <Button onClick={abrirNuevo}>
            <Plus className='mr-2 h-4 w-4' /> Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {open && (
          <Card className='mb-4 border-primary'>
            <CardContent className='pt-4 space-y-3'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <div>
                  <Label>Nombre *</Label>
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Fecha de exhumación *</Label>
                  <Input
                    type='date'
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
                <div className='md:col-span-2'>
                  <Label>Destino</Label>
                  <Input
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    placeholder='Panteón destino, cremación, etc.'
                  />
                </div>
                <div className='md:col-span-2'>
                  <Label>Notas</Label>
                  <Textarea
                    rows={3}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder='Motivo, condiciones, observaciones, etc.'
                  />
                </div>
              </div>
              <div className='flex gap-2'>
                <Button
                  onClick={guardar}
                  disabled={guardando}
                >
                  <Save className='mr-2 h-4 w-4' />
                  {guardando
                    ? 'Guardando...'
                    : editId != null
                      ? 'Actualizar'
                      : 'Agregar'}
                </Button>
                <Button
                  variant='outline'
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  disabled={guardando}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {items.length === 0 ? (
          <p className='text-muted-foreground text-sm text-center py-6'>
            No hay exhumaciones.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className='w-64'>Notas</TableHead>
                <TableHead className='w-24'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className='font-medium'>{e.nombre}</TableCell>
                  <TableCell>{e.fecha_exhumacion}</TableCell>
                  <TableCell className='text-sm'>{e.destino || '—'}</TableCell>
                  <TableCell className='text-xs whitespace-pre-wrap max-w-md'>
                    {e.notas ? (
                      e.notas
                    ) : (
                      <span className='text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='flex gap-1'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => abrirEdicion(e)}
                        title='Editar'
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => eliminar(e.id)}
                        title='Eliminar'
                      >
                        <Trash2 className='h-4 w-4 text-destructive' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// --- Sección Mantenimiento ---
function MantenimientoSection({
  tipo,
  id,
  items,
  onChange,
}: {
  tipo: 'fosa' | 'gaveta';
  id: number;
  items: any[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [anio, setAnio] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [monto, setMonto] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const agregar = async () => {
    if (!anio || !fechaPago) {
      alert('Año y fecha son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const data = {
        anio: parseInt(anio),
        fecha_pago: fechaPago,
        monto: parseFloat(monto) || 0,
        notas: notas || null,
      };
      if (tipo === 'fosa')
        await fosasService.registrarMantenimiento({ ...data, _fosa_id: id });
      else
        await gavetasService.registrarMantenimiento({
          ...data,
          _gaveta_id: id,
        });
      onChange();
      setOpen(false);
      setAnio('');
      setFechaPago('');
      setMonto('');
      setNotas('');
    } catch (e) {
      console.error('[mantenimiento] ERROR:', e);
      alert(`Error: ${(e as Error)?.message ?? e}`);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (mid: number) => {
    if (!confirm('¿Eliminar este pago?')) return;
    if (tipo === 'fosa') await fosasService.eliminarMantenimiento(mid);
    else await gavetasService.eliminarMantenimiento(mid);
    onChange();
  };

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>Mantenimiento anual</CardTitle>
        {!open && (
          <Button onClick={() => setOpen(true)}>
            <Plus className='mr-2 h-4 w-4' /> Registrar pago
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {open && (
          <Card className='mb-4 border-primary'>
            <CardContent className='pt-4 space-y-3'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <div>
                  <Label>Año *</Label>
                  <Input
                    type='number'
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Fecha de pago *</Label>
                  <Input
                    type='date'
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Monto</Label>
                  <Input
                    type='number'
                    step='0.01'
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Notas</Label>
                  <Input
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </div>
              </div>
              <div className='flex gap-2'>
                <Button
                  onClick={agregar}
                  disabled={guardando}
                >
                  <Save className='mr-2 h-4 w-4' />{' '}
                  {guardando ? 'Guardando...' : 'Agregar'}
                </Button>
                <Button
                  variant='outline'
                  onClick={() => setOpen(false)}
                  disabled={guardando}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {items.length === 0 ? (
          <p className='text-muted-foreground text-sm text-center py-6'>
            No hay pagos de mantenimiento.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className='w-12'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Badge>{m.anio}</Badge>
                  </TableCell>
                  <TableCell>{m.fecha_pago}</TableCell>
                  <TableCell>${(m.monto ?? 0).toFixed(2)}</TableCell>
                  <TableCell className='text-xs whitespace-pre-wrap max-w-md'>
                    {m.notas ? (
                      m.notas
                    ) : (
                      <span className='text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => eliminar(m.id)}
                    >
                      <Trash2 className='h-4 w-4 text-destructive' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// --- Sección Cambios Titular ---
function CambiosSection({
  tipo,
  id,
  items,
  entidad,
  onChange,
}: {
  tipo: 'fosa' | 'gaveta';
  id: number;
  items: CambioTitular[];
  entidad: Entidad;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [numeroTitulo, setNumeroTitulo] = useState('');
  const [fechaTitulo, setFechaTitulo] = useState('');
  const [beneficiario, setBeneficiario] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Detalle del titular anterior que se muestra en el Dialog
  const [verDetalle, setVerDetalle] = useState<CambioTitular | null>(null);

  // Fuente de verdad del titular anterior: el campo `titular_nombre` ACTUAL de
  // la ficha. Este campo se actualiza en cada cambio o edición manual, así que
  // refleja siempre "el que está hoy". El historial se conserva en `items`.
  const titularAnterior = entidad.titular_nombre || '';

  const resetForm = () => {
    setNuevo('');
    setNumeroTitulo('');
    setFechaTitulo('');
    setBeneficiario('');
    setMotivo('');
  };

  const agregar = async () => {
    if (!nuevo.trim()) {
      alert('Captura el titular nuevo');
      return;
    }
    setGuardando(true);
    try {
      // Snapshot del titular ANTERIOR: pasamos los datos ACTUALES de la
      // ficha (que es lo que está hoy antes del cambio). Así la historia
      // queda preservada aunque la ficha se modifique después.
      const data: any = {
        titular_anterior_nombre: titularAnterior,
        titular_anterior_id: null,
        titular_anterior_domicilio: entidad.titular_domicilio || '',
        titular_anterior_telefono: entidad.titular_telefono || '',
        titular_anterior_numero_titulo: entidad.numero_titulo || '',
        titular_anterior_fecha_titulo: entidad.fecha_titulo || null,
        titular_anterior_beneficiario: entidad.beneficiario || '',
        titular_nuevo_nombre: nuevo.trim(),
        titular_nuevo_id: null,
        fecha_cambio: new Date().toISOString().slice(0, 10),
        motivo: motivo || null,
        // Si vienen vacíos, el service NO los aplica (mantiene el actual).
        numero_titulo: numeroTitulo.trim() || '',
        fecha_titulo: fechaTitulo || '',
        beneficiario: beneficiario.trim() || '',
      };
      if (tipo === 'fosa')
        await fosasService.registrarCambioTitular({
          ...data,
          _fosa_id: id,
        });
      else
        await gavetasService.registrarCambioTitular({
          ...data,
          _gaveta_id: id,
        });
      onChange();
      setOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert('Error');
    } finally {
      setGuardando(false);
    }
  };

  // Helpers para detectar si hay datos del titular anterior (snapshot)
  const tieneSnapshot = (c: CambioTitular) => {
    return !!(
      c.titular_anterior_domicilio ||
      c.titular_anterior_telefono ||
      c.titular_anterior_numero_titulo ||
      c.titular_anterior_fecha_titulo ||
      c.titular_anterior_beneficiario
    );
  };

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>Cambios de titular</CardTitle>
        {!open && (
          <Button onClick={() => setOpen(true)}>
            <Plus className='mr-2 h-4 w-4' /> Registrar cambio
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {open && (
          <Card className='mb-4 border-primary'>
            <CardContent className='pt-4 space-y-3'>
              <div>
                <Label>Titular anterior</Label>
                <Input
                  value={titularAnterior || '—'}
                  disabled
                />
              </div>
              <div>
                <Label>Titular nuevo *</Label>
                <Input
                  value={nuevo}
                  onChange={(e) => setNuevo(e.target.value)}
                  autoFocus
                />
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <div>
                  <Label>N° de título</Label>
                  <Input
                    value={numeroTitulo}
                    onChange={(e) => setNumeroTitulo(e.target.value)}
                    placeholder={entidad.numero_titulo || 'Sin cambios'}
                  />
                  <p className='text-[11px] text-muted-foreground mt-1'>
                    Déjalo vacío para conservar el actual.
                  </p>
                </div>
                <div>
                  <Label>Fecha del título</Label>
                  <Input
                    type='date'
                    value={fechaTitulo}
                    onChange={(e) => setFechaTitulo(e.target.value)}
                  />
                  <p className='text-[11px] text-muted-foreground mt-1'>
                    Déjalo vacío para conservar la actual.
                  </p>
                </div>
                <div className='md:col-span-2'>
                  <Label>Beneficiario (opcional)</Label>
                  <Input
                    value={beneficiario}
                    onChange={(e) => setBeneficiario(e.target.value)}
                    placeholder={entidad.beneficiario || 'Sin cambios'}
                  />
                  <p className='text-[11px] text-muted-foreground mt-1'>
                    Déjalo vacío para conservar el actual.
                  </p>
                </div>
                <div className='md:col-span-2'>
                  <Label>Motivo del cambio</Label>
                  <Input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder='Venta, herencia, donación, etc.'
                  />
                </div>
              </div>
              <div className='flex gap-2'>
                <Button
                  onClick={agregar}
                  disabled={guardando}
                >
                  <Save className='mr-2 h-4 w-4' /> Registrar
                </Button>
                <Button
                  variant='outline'
                  onClick={() => { setOpen(false); resetForm(); }}
                  disabled={guardando}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {items.length === 0 ? (
          <p className='text-muted-foreground text-sm text-center py-6'>
            No hay cambios de titular.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Anterior</TableHead>
                <TableHead>Nuevo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className='w-24'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className='whitespace-nowrap'>{c.fecha_cambio}</TableCell>
                  <TableCell>
                    <div className='font-medium'>
                      {c.titular_anterior_nombre || (
                        <span className='text-muted-foreground italic'>—</span>
                      )}
                    </div>
                    {/* Resumen compacto: si hay domicilio o N° título, los muestra en una línea */}
                    {(c.titular_anterior_domicilio || c.titular_anterior_numero_titulo) && (
                      <div className='text-xs text-muted-foreground flex flex-wrap gap-x-2 mt-0.5'>
                        {c.titular_anterior_numero_titulo && (
                          <span className='flex items-center gap-1'>
                            <Hash className='h-3 w-3' />
                            {c.titular_anterior_numero_titulo}
                          </span>
                        )}
                        {c.titular_anterior_domicilio && (
                          <span className='truncate max-w-[200px]' title={c.titular_anterior_domicilio}>
                            {c.titular_anterior_domicilio}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className='font-medium'>
                    {c.titular_nuevo_nombre}
                  </TableCell>
                  <TableCell className='text-sm'>{c.motivo || '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setVerDetalle(c)}
                      title={tieneSnapshot(c) ? 'Ver detalles del titular anterior' : 'Ver detalle (sin snapshot)'}
                    >
                      <Eye className='h-4 w-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Dialog con todos los detalles del titular anterior */}
      <Dialog open={verDetalle !== null} onOpenChange={(o) => { if (!o) setVerDetalle(null); }}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <User className='h-5 w-5' />
              Detalle del titular anterior
            </DialogTitle>
            <DialogDescription>
              {verDetalle && (
                <span>
                  Cambio del <strong>{verDetalle.fecha_cambio}</strong> · {verDetalle.motivo || 'sin motivo'}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {verDetalle && (
            <div className='space-y-3 text-sm'>
              <div>
                <div className='text-xs text-muted-foreground flex items-center gap-1 mb-0.5'>
                  <User className='h-3 w-3' /> Nombre
                </div>
                <div className='font-medium'>{verDetalle.titular_anterior_nombre || '—'}</div>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <div>
                  <div className='text-xs text-muted-foreground flex items-center gap-1 mb-0.5'>
                    <Phone className='h-3 w-3' /> Teléfono
                  </div>
                  <div className='font-mono'>
                    {verDetalle.titular_anterior_telefono || (
                      <span className='text-muted-foreground italic'>— sin capturar —</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className='text-xs text-muted-foreground flex items-center gap-1 mb-0.5'>
                    <Hash className='h-3 w-3' /> N° de título
                  </div>
                  <div className='font-mono'>
                    {verDetalle.titular_anterior_numero_titulo || (
                      <span className='text-muted-foreground italic'>— sin capturar —</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground flex items-center gap-1 mb-0.5'>
                  <MapPin className='h-3 w-3' /> Domicilio
                </div>
                <div className='whitespace-pre-wrap'>
                  {verDetalle.titular_anterior_domicilio || (
                    <span className='text-muted-foreground italic'>— sin capturar —</span>
                  )}
                </div>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <div>
                  <div className='text-xs text-muted-foreground flex items-center gap-1 mb-0.5'>
                    <Calendar className='h-3 w-3' /> Fecha del título
                  </div>
                  <div>
                    {verDetalle.titular_anterior_fecha_titulo || (
                      <span className='text-muted-foreground italic'>— sin capturar —</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className='text-xs text-muted-foreground flex items-center gap-1 mb-0.5'>
                    <Users className='h-3 w-3' /> Beneficiario
                  </div>
                  <div>
                    {verDetalle.titular_anterior_beneficiario || (
                      <span className='text-muted-foreground italic'>— sin capturar —</span>
                    )}
                  </div>
                </div>
              </div>
              {!tieneSnapshot(verDetalle) && (
                <div className='rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900'>
                  <strong>Sin snapshot:</strong> este cambio se registró antes
                  de v8, así que no hay detalle completo del titular anterior.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setVerDetalle(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
