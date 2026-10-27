import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureTextControls } from "./FeatureTextControls";

afterEach(cleanup);

function Harness({ initial = 1, heightMm = 23 }: { initial?: number; heightMm?: number }) {
  const [scale, setScale] = useState(initial);
  return <FeatureTextControls scale={scale} heightMm={heightMm} onChange={setScale} />;
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

describe("selling point text controls", () => {
  it("starts at the approved size and says how large that prints", () => {
    render(<Harness />);
    expect(field("Selling point text size slider").value).toBe("100");
    expect(screen.getByText("100%", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText(/about/i).textContent).toContain("6.0 pt (2.1 mm)");
    expect(screen.getByRole("button", { name: /reset to 100%/i })).toHaveProperty("disabled", true);
  });

  it("makes the text larger from the slider and updates the printed size", () => {
    render(<Harness />);
    fireEvent.change(field("Selling point text size slider"), { target: { value: "140" } });
    expect(field("Selling point text size in percent").value).toBe("140");
    expect(screen.getByText(/about/i).textContent).toContain("8.3 pt (2.9 mm)");
  });

  it("takes the label height into account", () => {
    render(<Harness initial={1.5} heightMm={30} />);
    expect(screen.getByText(/about/i).textContent).toContain("30 mm tall");
    expect(screen.getByText(/about/i).textContent).toContain("11.6 pt (4.1 mm)");
  });

  it("jumps to a quick size", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "130%" }));
    expect(field("Selling point text size slider").value).toBe("130");
    expect(screen.getByRole("button", { name: "130%" }).className).toContain("is-current");
  });

  it("applies a typed number once it is valid and clamps one outside 80–170% when leaving the field", () => {
    render(<Harness />);
    fireEvent.change(field("Selling point text size in percent"), { target: { value: "140" } });
    expect(field("Selling point text size slider").value).toBe("140");

    fireEvent.change(field("Selling point text size in percent"), { target: { value: "999" } });
    fireEvent.blur(field("Selling point text size in percent"));
    expect(field("Selling point text size in percent").value).toBe("170");

    fireEvent.change(field("Selling point text size in percent"), { target: { value: "10" } });
    fireEvent.blur(field("Selling point text size in percent"));
    expect(field("Selling point text size in percent").value).toBe("80");
  });

  it("shows the approved size when it is given no usable value", () => {
    render(<FeatureTextControls scale={undefined as unknown as number} heightMm={23} onChange={() => undefined} />);
    expect(field("Selling point text size slider").value).toBe("100");
    expect(field("Selling point text size in percent").value).toBe("100");
  });

  it("goes back to the approved size on reset", () => {
    render(<Harness initial={1.4} />);
    fireEvent.click(screen.getByRole("button", { name: /reset to 100%/i }));
    expect(field("Selling point text size slider").value).toBe("100");
  });
});
