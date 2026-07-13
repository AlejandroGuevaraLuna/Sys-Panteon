import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, X } from "lucide-react";
import type { Fosa } from "@/types";

interface Props {
  fosa: Fosa;
  onCancel: () => void;
  onSave: (data: Fosa) => Promise<void>;
}

export default function FosaForm({ fosa, onCancel, onSave }: Props) {
  const [data, setData] = useState<Fosa>(fosa);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try { await onSave(data); }
    finally { setGuardando(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Editar fosa</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Número de fosa *</Label>
            <Input value={data.numero} onChange={(e) => setData({ ...data, numero: e.target.value })} />
          </div>
          <div>
            <Label>Capacidad de gavetas</Label>
            <Input type="number" min="1" max="50"
              value={data.capacidad_gavetas}
              onChange={(e) => setData({ ...data, capacidad_gavetas: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Libro, registro, titular, mantenimiento, predial, sepultaciones y exhumaciones se capturan dentro de cada gaveta.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onCancel}><X className="mr-2 h-4 w-4" /> Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            <Save className="mr-2 h-4 w-4" /> {guardando ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}