import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { LabelSize } from "../types";
import { LabelSizeControls } from "./LabelSizeControls";

function Harness({ initial }: { initial: LabelSize }) {
  const [size, setSize] = useState(initial);
  return <LabelSizeControls size={size} onChange={setSize} />;
}

// Vitest globals are off in this project, so Testing Library does not clean up on its own.
afterEach(cleanup);

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

describe("label size controls", () => {
  it("always shows the same fixed limits, wherever the label is", () => {
    for (const initial of [{ widthMm: 220, heightMm: 23 }, { widthMm: 200, heightMm: 25 }, { widthMm: 280, heightMm: 35 }]) {
      const { unmount } = render(<Harness initial={initial} />);
      expect(screen.getByText("120–280 mm")).toBeTruthy();
      expect(screen.getByText("15–35 mm")).toBeTruthy();
      expect(field("Width slider").min).toBe("120");
      expect(field("Width slider").max).toBe("280");
      expect(field("Height slider").min).toBe("15");
      expect(field("Height slider").max).toBe("35");
      unmount();
    }
  });

  it("adjusts the other value and says so when a change would break the aspect ratio", () => {
    render(<Harness initial={{ widthMm: 200, heightMm: 25 }} />);
    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.change(field("Width slider"), { target: { value: "150" } });

    expect(field("Width in millimetres").value).toBe("150");
    expect(field("Height in millimetres").value).toBe("18.7");
    expect(screen.getByRole("status").textContent).toContain("Height changed from 25 to 18.7 mm");
    expect(screen.getByRole("status").textContent).toContain("8:1 and 12.5:1");
  });

  it("adjusts the width when the height is raised past what the width allows", () => {
    render(<Harness initial={{ widthMm: 200, heightMm: 25 }} />);
    fireEvent.change(field("Height slider"), { target: { value: "30" } });
    expect(field("Width in millimetres").value).toBe("240");
    expect(screen.getByRole("status").textContent).toContain("Width changed from 200 to 240 mm");
  });

  it("applies a typed number that moves nothing else straight away", () => {
    render(<Harness initial={{ widthMm: 220, heightMm: 23 }} />);
    type("Width in millimetres", "250");
    expect(field("Width slider").value).toBe("250");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("waits for Enter or blur before a typed number moves the other value, so typing does not jump around", () => {
    render(<Harness initial={{ widthMm: 200, heightMm: 25 }} />);
    // On the way to "185" the field passes through values that would otherwise re-shape the height.
    type("Width in millimetres", "180");
    expect(field("Height in millimetres").value).toBe("25");
    type("Width in millimetres", "185");
    expect(field("Height in millimetres").value).toBe("25");

    fireEvent.blur(field("Width in millimetres"));
    expect(field("Width in millimetres").value).toBe("185");
    expect(field("Height in millimetres").value).toBe("23.1");
    expect(screen.getByRole("status").textContent).toContain("Height changed from 25 to 23.1 mm");
  });

  it("clamps a number typed outside the fixed limits", () => {
    render(<Harness initial={{ widthMm: 220, heightMm: 23 }} />);
    type("Width in millimetres", "999");
    fireEvent.blur(field("Width in millimetres"));
    expect(field("Width in millimetres").value).toBe("280");
  });

  it("clears the notice and returns to 220 × 23 mm on reset", () => {
    render(<Harness initial={{ widthMm: 200, heightMm: 25 }} />);
    fireEvent.change(field("Width slider"), { target: { value: "150" } });
    expect(screen.getByRole("status")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /reset to 220 × 23/i }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(field("Width in millimetres").value).toBe("220");
    expect(field("Height in millimetres").value).toBe("23");
  });

  it("clears an old notice after a change that needs no adjustment", () => {
    render(<Harness initial={{ widthMm: 200, heightMm: 25 }} />);
    fireEvent.change(field("Width slider"), { target: { value: "150" } });
    expect(screen.getByRole("status")).toBeTruthy();
    fireEvent.change(field("Width slider"), { target: { value: "160" } });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
