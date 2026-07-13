import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Box, AlertTriangle, Plus } from "lucide-react";
import { gavetasService } from "@/features/gavetas/service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineaId?: number;
  defaultNumero?: number;
  onCreated?: (gavetaId: number) => void;
}

/**
 * Dialog para crear una nueva gaveta en una línea determinada.
 * La gaveta es INDEPENDIENTE — no requiere fosa padre.
 */
export default function NuevaGaveta({
  open, onOpenChange, lineaId, defaultNumero, onCreated,
}: Props) {
  const [numero, setNumero] = useState<number>(defaultNumero ?? 1);
  const [libro, setLibro] = useState("");
  const [registro, setRegistro] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (defaultNumero !== undefined) setNumero(defaultNumero);
    else setNumero(1);
    setLibro(""); setRegistro("");
  }, [open, defaultNumero]);

  const guardar = async () => {
    if (!lineaId) { console.warn("Falta el ID de la línea"); return; }
    if (!numero || numero < 1) { console.warn("Número inválido"); return; }

    setGuardando(true);
    try {
      const newId = await gavetasService.crear({
        linea_id: lineaId,
        numero,
        libro: libro || "",
        registro: registro || "",
      });
      onCreated?.(newId);
      onOpenChange(false);
    } catch (e) {
      const err = e as Error;
      const msg = (err && err.message) ? err.message : String(e);
      console.error("[NuevaGaveta] ERROR:", err);
      if (msg.includes("UNIQUE")) {
        alert(`Ya existe la gaveta #${numero} en esta línea.`);
      } else {
        alert("Error: " + msg);
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" /> Nueva gaveta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Número *</Label>
            <Input
              type="number" min="1"
              value={numero}
              onChange={(e) => setNumero(Math.max(1, Number(e.target.value) || 1))}
              autoFocus
            />
          </div>
          <div>
            <Label>Notas</Label>
            <Input value={libro} onChange={(e) => setLibro(e.target.value)}
              placeholder="Notas" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Libro</Label>
              <Input value={libro} onChange={(e) => setLibro(e.target.value)} />
            </div>
            <div>
              <Label>Registro</Label>
              <Input value={registro} inputMode="numeric"
                onChange={(e) => setRegistro(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
            ℹ️ Después de crear la gaveta puedes capturar el titular, título, mantenimiento,
            predial, sepultaciones y exhumaciones desde la ficha de la gaveta.
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={guardando}>Cancelar</Button></DialogClose>
          <Button onClick={guardar} disabled={guardando || !lineaId || !numero}>
            <Save className="mr-2 h-4 w-4" />
            {guardando ? "Creando..." : "Crear gaveta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook helper.
 */
export function useNuevaGaveta() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
