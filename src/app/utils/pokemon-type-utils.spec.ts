import { getDefensiveTypeMultiplier } from "./pokemon-type-utils";

describe("pokemon-type-utils", () => {
  it("treats immunities as a clamped 4x resistance", () => {
    expect(getDefensiveTypeMultiplier(["ground", "flying"], "electric")).toBe(0.25);
    expect(getDefensiveTypeMultiplier(["dragon", "ground"], "electric")).toBe(0.25);
  });

  it("stacks non-immune resistances and weaknesses normally", () => {
    expect(getDefensiveTypeMultiplier(["fire", "flying"], "grass")).toBe(0.25);
    expect(getDefensiveTypeMultiplier(["rock", "ground"], "water")).toBe(4);
  });

  it("falls back to neutral without types", () => {
    expect(getDefensiveTypeMultiplier(undefined, "fire")).toBe(1);
  });
});
