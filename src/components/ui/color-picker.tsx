import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "@/lib/utils";
import { Palette, RotateCcw } from "lucide-react";

interface Props {
  value: string; // HSL string "222 47% 11%" o "" para default
  onChange: (hsl: string) => void;
  onReset?: () => void;
}

/**
 * Selector de color para el tema primario.
 * Internamente maneja HSL (formato usado por shadcn).
 * Conversión RGB <-> HSL básica.
 */
export function ColorPicker({ value, onChange, onReset }: Props) {
  const hsl = value || "222 47% 11%";
  const [h, s, l] = hsl.split(/\s+/).map((v) => parseFloat(v));

  const setHsl = (newH: number, newS: number, newL: number) => {
    onChange(`${Math.round(newH)} ${Math.round(newS)}% ${Math.round(newL)}%`);
  };

  const previewBg = `hsl(${h}, ${s}%, ${l}%)`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="w-16 h-16 rounded-lg border-2 shadow-sm"
          style={{ backgroundColor: previewBg }}
        />
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">Color primario actual</div>
          <div className="font-mono text-sm">{previewBg}</div>
        </div>
        {onReset && (
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="mr-2 h-3 w-3" /> Default
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Matiz</Label>
            <span className="text-xs text-muted-foreground font-mono">{Math.round(h)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={h}
            onChange={(e) => setHsl(Number(e.target.value), s, l)}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))",
            }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Saturación</Label>
            <span className="text-xs text-muted-foreground font-mono">{Math.round(s)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={s}
            onChange={(e) => setHsl(h, Number(e.target.value), l)}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(${h}, 0%, ${l}%), hsl(${h}, 100%, ${l}%))`,
            }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Luminosidad</Label>
            <span className="text-xs text-muted-foreground font-mono">{Math.round(l)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={l}
            onChange={(e) => setHsl(h, s, Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 50%), hsl(${h}, ${s}%, 100%))`,
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <span className="text-xs text-muted-foreground self-center mr-1">
          <Palette className="inline h-3 w-3 mr-1" /> Sugerencias:
        </span>
        {[
          { name: "Slate", v: "222 47% 11%" },
          { name: "Verde", v: "142 71% 45%" },
          { name: "Azul", v: "221 83% 53%" },
          { name: "Púrpura", v: "262 83% 58%" },
          { name: "Rojo", v: "0 72% 51%" },
          { name: "Ámbar", v: "38 92% 50%" },
          { name: "Teal", v: "173 80% 40%" },
        ].map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => onChange(c.v)}
            className={cn(
              "w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform",
              value === c.v ? "border-foreground" : "border-transparent"
            )}
            style={{ backgroundColor: `hsl(${c.v})` }}
            title={c.name}
          />
        ))}
      </div>
    </div>
  );
}