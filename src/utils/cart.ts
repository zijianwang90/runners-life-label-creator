import type { PrintCartItem, ShoeLabel } from "../types";

export const MAX_COPIES = 99;

export const clampCopies = (value: unknown): number => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(MAX_COPIES, Math.max(1, parsed)) : 1;
};

/** Adds copies of a label to the print list; a label already on it gets the extra copies, like a shopping cart. */
export function addToCart(cart: PrintCartItem[], id: string, copies: number): PrintCartItem[] {
  const existing = cart.find((item) => item.id === id);
  if (!existing) return [...cart, { id, copies: clampCopies(copies) }];
  return cart.map((item) => item.id === id ? { ...item, copies: clampCopies(item.copies + copies) } : item);
}

export const setCartCopies = (cart: PrintCartItem[], id: string, copies: number): PrintCartItem[] =>
  cart.map((item) => item.id === id ? { ...item, copies: clampCopies(copies) } : item);

export const removeFromCart = (cart: PrintCartItem[], id: string): PrintCartItem[] => cart.filter((item) => item.id !== id);

/** The print list as labels to print, each with its copies as `quantity`; lines whose label is gone are skipped. */
export function cartLabels(cart: PrintCartItem[], shoes: ShoeLabel[]): ShoeLabel[] {
  const byId = new Map(shoes.map((shoe) => [shoe.id, shoe]));
  return cart.flatMap((item) => {
    const shoe = byId.get(item.id);
    return shoe ? [{ ...shoe, quantity: item.copies }] : [];
  });
}

export const cartCopyCount = (cart: PrintCartItem[]): number => cart.reduce((sum, item) => sum + item.copies, 0);

/** Saved print list cleaned up: known labels only, each once, copies within 1–99. */
export function normalizeCart(input: unknown, shoeIds: Set<string>): PrintCartItem[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.flatMap((raw) => {
    const id = raw && typeof raw === "object" ? (raw as Partial<PrintCartItem>).id : undefined;
    if (typeof id !== "string" || !shoeIds.has(id) || seen.has(id)) return [];
    seen.add(id);
    return [{ id, copies: clampCopies((raw as Partial<PrintCartItem>).copies) }];
  });
}
