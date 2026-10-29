import { describe, expect, it } from "vitest";
import type { ShoeLabel } from "../types";
import { resolveCategory, SHOE_CATEGORIES } from "./categories";
import { composeFeatures, composeSpecs, dropText, mergeSpecs, parseDrop, parsePlate, parseSellingPointsReply, parseWeight } from "./parse";
import { buildSellingPointsPrompt, buildShoeRefs, SELLING_POINTS_SCHEMA } from "./prompt";

const shoe = (id: string, model: string, brand: ShoeLabel["brand"] = "saucony", features: ShoeLabel["features"] = ["", "", ""]): ShoeLabel => ({
  id,
  brand,
  model,
  regularPrice: 229.99,
  salePrice: null,
  features,
  summary: "",
  specs: { heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" },
  quantity: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const speed = shoe("3f9a2c1b-1111-4222-8333-444455556666", "Endorphin Speed 5");
const guide = shoe("a7c01d2e-1111-4222-8333-444455556666", "Guide 18");
const nimbus = shoe("b8d12e3f-1111-4222-8333-444455556666", "Gel-Nimbus 27", "asics");
const shoes = [speed, guide, nimbus];

describe("prompt", () => {
  const prompt = buildSellingPointsPrompt([speed, nimbus], shoes);

  it("lists every selected shoe with its brand, model and a short ref, and no others", () => {
    expect(prompt).toContain("ref: 3f9a2c1b | Saucony | Endorphin Speed 5");
    expect(prompt).toContain("ref: b8d12e3f | ASICS | Gel-Nimbus 27");
    expect(prompt).not.toContain("Guide 18");
    expect(prompt).toContain("SHOES (2)");
  });

  it("asks for the three selling points: type, drop and midsole foam", () => {
    expect(prompt).toMatch(/Shoe type.*"category"/);
    for (const category of SHOE_CATEGORIES) expect(prompt).toContain(`- ${category.id}:`);
    expect(prompt).toMatch(/drop.*"dropMm"/is);
    expect(prompt).toMatch(/Midsole foam.*"foam"/s);
    expect(prompt).not.toMatch(/highlight/i);
  });

  it("asks for one JSON block in a documented, parseable shape", () => {
    expect(prompt).toContain(SELLING_POINTS_SCHEMA);
    const example = prompt.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "";
    expect(() => JSON.parse(example)).not.toThrow();
    expect(JSON.parse(example).labels[0]).toMatchObject({ ref: expect.any(String), category: "race", dropMm: 8 });
  });

  it("tells the AI not to guess and how to report doubt", () => {
    expect(prompt).toMatch(/Never invent a spec/);
    expect(prompt).toMatch(/"confidence" to "low"/);
  });

  it("round-trips: the example in the prompt is itself a valid reply", () => {
    const example = prompt.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "";
    const outcome = parseSellingPointsReply(example.replace("example1", "3f9a2c1b"), shoes);
    expect(outcome.rows).toHaveLength(1);
    expect(outcome.rows[0].features).toEqual(["Race day", "8mm drop", "PWRRUN PB"]);
  });

  it("asks for the foam's official name, not marketing wording", () => {
    expect(prompt).toMatch(/exactly as the brand names it/);
    expect(prompt).toMatch(/not a description/);
    expect(prompt).toMatch(/no marketing wording/i);
    expect(prompt).toMatch(/"PWRRUN PB".*"FF Blast Plus Eco".*"DNA Loft v3".*"Fresh Foam X"/s);
  });
});

describe("refs", () => {
  it("uses the first 8 characters of the shoe id", () => {
    expect(buildShoeRefs(shoes).get(speed.id)).toBe("3f9a2c1b");
  });

  it("lengthens refs until they are unique", () => {
    const a = shoe("label-0001-a", "A");
    const b = shoe("label-0001-b", "B");
    const refs = buildShoeRefs([a, b]);
    expect(refs.get(a.id)).not.toBe(refs.get(b.id));
  });
});

describe("categories", () => {
  it("maps ids and common wording to the same label text", () => {
    expect(resolveCategory("race")).toBe("race");
    expect(resolveCategory("Racing")).toBe("race");
    expect(resolveCategory("Supportive")).toBe("stability");
    expect(resolveCategory("Neutral daily trainer")).toBe("neutral");
    expect(resolveCategory("max_cushion")).toBe("max-cushion");
    expect(resolveCategory("Tempo / speed")).toBe("speed");
    expect(resolveCategory("Trail")).toBe("trail");
    expect(resolveCategory("Walking")).toBeNull();
    expect(resolveCategory(42)).toBeNull();
  });
});

describe("drop", () => {
  it("reads numbers and text, and rejects the implausible", () => {
    expect(parseDrop(8)).toBe(8);
    expect(parseDrop("10 mm")).toBe(10);
    expect(parseDrop("4,5mm")).toBe(4.5);
    expect(parseDrop("Zero drop")).toBe(0);
    expect(parseDrop(null)).toBeNull();
    expect(parseDrop("unknown")).toBeNull();
    expect(parseDrop(80)).toBeNull();
    expect(parseDrop(-3)).toBeNull();
  });

  it("writes it the way it will appear on the label", () => {
    expect(dropText(8)).toBe("8mm drop");
    expect(dropText(4.5)).toBe("4.5mm drop");
    expect(dropText(0)).toBe("Zero drop");
    expect(dropText(null)).toBe("");
  });
});

describe("reading a reply", () => {
  const reply = `\`\`\`json
{
  "schema": "${SELLING_POINTS_SCHEMA}",
  "labels": [
    { "ref": "3f9a2c1b", "brand": "Saucony", "model": "Endorphin Speed 5", "category": "race", "categoryText": "", "dropMm": 8, "foam": "PWRRUN PB", "confidence": "high", "notes": "From saucony.com" },
    { "ref": "b8d12e3f", "brand": "ASICS", "model": "Gel-Nimbus 27", "category": "max-cushion", "categoryText": "", "dropMm": 8, "foam": "FF Blast Plus Eco", "confidence": "medium", "notes": "" }
  ]
}
\`\`\``;

  it("turns each entry into type, drop and midsole foam in the right order", () => {
    const outcome = parseSellingPointsReply(reply, shoes, [speed, nimbus]);
    expect(outcome.error).toBeNull();
    expect(outcome.rows.map((row) => [row.shoeId, row.features])).toEqual([
      [speed.id, ["Race day", "8mm drop", "PWRRUN PB"]],
      [nimbus.id, ["Max cushion", "8mm drop", "FF Blast Plus Eco"]]
    ]);
    expect(outcome.rows[0]).toMatchObject({ confidence: "high", notes: "From saucony.com", matchedBy: "ref" });
    expect(outcome.unmatched).toEqual([]);
    expect(outcome.notReturned).toEqual([]);
  });

  it("copes with chat around the JSON and no code fence", () => {
    const chatty = `Sure! Here are the selling points you asked for:\n\n${reply.replace(/```(json)?/g, "")}\n\nLet me know if you need anything else.`;
    expect(parseSellingPointsReply(chatty, shoes).rows).toHaveLength(2);
  });

  it("copes with smart quotes, trailing commas and comments", () => {
    const messy = `\`\`\`json
{ “labels”: [
  // first shoe
  { “ref”: “3f9a2c1b”, “category”: “race”, “dropMm”: 8, “foam”: “PWRRUN PB”, },
] }
\`\`\``;
    const outcome = parseSellingPointsReply(messy, shoes);
    expect(outcome.rows[0].features).toEqual(["Race day", "8mm drop", "PWRRUN PB"]);
  });

  it("accepts a bare array and alternative field names", () => {
    const array = JSON.stringify([{ id: "a7c01d2e", type: "Stability", drop: "10 mm", feature: "GuideRails support." }]);
    const [row] = parseSellingPointsReply(array, shoes).rows;
    expect(row.shoeId).toBe(guide.id);
    expect(row.features).toEqual(["Stability support", "10mm drop", "GuideRails support"]);
  });

  it("accepts a ready-made list of three selling points", () => {
    expect(composeFeatures({ ref: "x", sellingPoints: ["Race day", "8mm drop", "PWRRUN PB"] })).toEqual(["Race day", "8mm drop", "PWRRUN PB"]);
  });

  it("still reads the older `highlight` field and other names for the foam", () => {
    expect(composeFeatures({ category: "race", dropMm: 8, highlight: "Carbon plate" })[2]).toBe("Carbon plate");
    expect(composeFeatures({ category: "race", dropMm: 8, midsoleFoam: "Fresh Foam X" })[2]).toBe("Fresh Foam X");
    expect(composeFeatures({ category: "race", dropMm: 8, "Midsole Foam": "DNA Loft v3" })[2]).toBe("DNA Loft v3");
  });

  it("prefers `foam` over an older field when a reply contains both", () => {
    expect(composeFeatures({ highlight: "Carbon plate", foam: "PWRRUN PB" })[2]).toBe("PWRRUN PB");
    expect(composeFeatures({ foam: "PWRRUN PB", highlight: "Carbon plate" })[2]).toBe("PWRRUN PB");
  });

  it("uses categoryText for shoes outside the standard types", () => {
    expect(composeFeatures({ category: "other", categoryText: "Walking shoe", dropMm: 6, foam: "EVA foam" }))
      .toEqual(["Walking shoe", "6mm drop", "EVA foam"]);
  });

  it("leaves a slot blank rather than guessing when the AI did not know", () => {
    const unknown = JSON.stringify({ labels: [{ ref: "3f9a2c1b", category: "race", dropMm: null, foam: "PWRRUN PB", confidence: "low", notes: "Drop not published" }] });
    const [row] = parseSellingPointsReply(unknown, shoes).rows;
    expect(row.features).toEqual(["Race day", "", "PWRRUN PB"]);
    expect(row.confidence).toBe("low");
  });

  it("falls back to brand and model when the ref was changed", () => {
    const renamed = JSON.stringify({ labels: [{ ref: "1", brand: "Saucony", model: "endorphin speed 5", category: "race", dropMm: 8, foam: "PWRRUN PB" }] });
    const outcome = parseSellingPointsReply(renamed, shoes);
    expect(outcome.rows[0]).toMatchObject({ shoeId: speed.id, matchedBy: "name" });
  });

  it("reports entries it could not match and labels the reply left out", () => {
    const partial = JSON.stringify({ labels: [{ ref: "3f9a2c1b", category: "race", dropMm: 8, foam: "PWRRUN PB" }, { ref: "zzzzzzzz", brand: "Hoka", model: "Mach 6", category: "speed" }, { ref: "3f9a2c1b", category: "race" }] });
    const outcome = parseSellingPointsReply(partial, shoes, [speed, nimbus]);
    expect(outcome.rows).toHaveLength(1);
    expect(outcome.unmatched).toEqual(["Hoka Mach 6", "3f9a2c1b (listed twice)"]);
    expect(outcome.notReturned).toEqual([nimbus]);
  });

  it("explains itself when there is nothing to read", () => {
    expect(parseSellingPointsReply("", shoes)).toMatchObject({ rows: [], error: null });
    expect(parseSellingPointsReply("I could not find those shoes, sorry.", shoes).error).toMatch(/No JSON/);
    expect(parseSellingPointsReply(JSON.stringify({ labels: [{ ref: "nope", model: "Unknown" }] }), shoes).error).toMatch(/None of the entries/);
  });
});

describe("summary from the reply", () => {
  it("reads the summary and tidies it", () => {
    const reply = JSON.stringify({ labels: [{ ref: "3f9a2c1b", category: "race", summary: " For racers chasing a marathon PB. " }] });
    expect(parseSellingPointsReply(reply, shoes).rows[0].summary).toBe("For racers chasing a marathon PB");
  });

  it("accepts other names for the field and leaves it blank when missing", () => {
    expect(parseSellingPointsReply(JSON.stringify({ labels: [{ ref: "3f9a2c1b", audience: "For new runners" }] }), shoes).rows[0].summary).toBe("For new runners");
    expect(parseSellingPointsReply(JSON.stringify({ labels: [{ ref: "3f9a2c1b", category: "race" }] }), shoes).rows[0].summary).toBe("");
  });

  it("asks for the summary in the prompt", () => {
    expect(buildSellingPointsPrompt([speed])).toContain('"summary"');
  });
});

describe("specs from the reply", () => {
  it("reads stack, weight and plate", () => {
    const reply = JSON.stringify({ labels: [{ ref: "3f9a2c1b", category: "race", dropMm: 8, foam: "PWRRUN PB", heelStackMm: 36, forefootStackMm: 28, weightG: 233, plate: "nylon" }] });
    expect(parseSellingPointsReply(reply, shoes).rows[0].specs).toEqual({ heelStackMm: 36, forefootStackMm: 28, weightG: 233, plate: "nylon" });
  });

  it("tolerates units, ounces and loose plate wording", () => {
    expect(composeSpecs({ heelStack: "39 mm", forefootStack: "31mm", weight: "8.2 oz", plate: "Carbon fiber plate" }))
      .toEqual({ heelStackMm: 39, forefootStackMm: 31, weightG: 232, plate: "carbon" });
    expect(parseWeight(2450)).toBeNull();
    expect(parsePlate("none")).toBe("");
    expect(parsePlate("PEBA plate")).toBe("pebax");
    expect(parsePlate(null)).toBeNull();
  });

  it("keeps the label's own values where the AI had no answer", () => {
    const current = { heelStackMm: 40, forefootStackMm: 32, weightG: 250, plate: "carbon" as const };
    expect(mergeSpecs(current, { heelStackMm: 39, forefootStackMm: null, weightG: null, plate: null }))
      .toEqual({ heelStackMm: 39, forefootStackMm: 32, weightG: 250, plate: "carbon" });
    expect(mergeSpecs(current, { heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" }).plate).toBe("");
  });

  it("asks for the specs in the prompt", () => {
    const prompt = buildSellingPointsPrompt([speed]);
    for (const field of ["heelStackMm", "forefootStackMm", "weightG", "plate"]) expect(prompt).toContain(`"${field}"`);
  });
});
