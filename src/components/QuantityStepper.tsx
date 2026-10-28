import { Minus, Plus } from "lucide-react";
import { clampCopies, MAX_COPIES } from "../utils/cart";

interface QuantityStepperProps {
  value: number;
  /** Names the label in the buttons' accessible names, e.g. "Endorphin Speed 5". */
  name: string;
  onChange: (value: number) => void;
}

/** Copies of one label, 1–99. */
export function QuantityStepper({ value, name, onChange }: QuantityStepperProps) {
  return (
    <div className="quantity-stepper" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label={`Decrease ${name} copies`} disabled={value <= 1} onClick={() => onChange(clampCopies(value - 1))}><Minus size={15} /></button>
      <input aria-label={`${name} print copies`} type="number" min="1" max={MAX_COPIES} value={value} onChange={(event) => onChange(clampCopies(event.target.value))} />
      <button type="button" aria-label={`Increase ${name} copies`} disabled={value >= MAX_COPIES} onClick={() => onChange(clampCopies(value + 1))}><Plus size={15} /></button>
    </div>
  );
}
