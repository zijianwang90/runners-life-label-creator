import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clampCopies, MAX_COPIES } from "../utils/cart";

interface QuantityStepperProps {
  value: number;
  /** Names the label in the buttons' accessible names, e.g. "Endorphin Speed 5". */
  name: string;
  onChange: (value: number) => void;
  /** When given, the decrease button at 1 calls this instead of being disabled. */
  onRemove?: () => void;
}

/** Copies of one label, 1–99. The field may be empty while typing; leaving it restores the value. */
export function QuantityStepper({ value, name, onChange, onRemove }: QuantityStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const removes = value <= 1 && onRemove !== undefined;
  const step = (next: number) => { setDraft(null); onChange(clampCopies(next)); };
  return (
    <div className="quantity-stepper" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label={removes ? `Remove ${name} from print list` : `Decrease ${name} copies`} disabled={value <= 1 && !removes}
        onClick={() => removes ? onRemove() : step(value - 1)}><Minus size={15} /></button>
      <input
        aria-label={`${name} print copies`}
        type="number"
        min="1"
        max={MAX_COPIES}
        value={draft ?? value}
        onChange={(event) => {
          setDraft(event.target.value);
          if (event.target.value.trim() !== "") onChange(clampCopies(event.target.value));
        }}
        onBlur={() => setDraft(null)}
      />
      <button type="button" aria-label={`Increase ${name} copies`} disabled={value >= MAX_COPIES} onClick={() => step(value + 1)}><Plus size={15} /></button>
    </div>
  );
}
