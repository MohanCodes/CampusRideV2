import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { distinctCars } = await import("./post");

describe("distinctCars", () => {
  it("keeps the newest first and drops repeats, ignoring case and spacing", () => {
    const rows = [
      { make: "Honda Civic", color: "Blue", plate: "8abc123" },
      { make: " honda civic", color: "blue", plate: "8ABC123 " },
      { make: "Toyota", color: "White", plate: "7XYZ456" },
    ];
    expect(distinctCars(rows)).toEqual([
      { make: "Honda Civic", color: "Blue", plate: "8ABC123" },
      { make: "Toyota", color: "White", plate: "7XYZ456" },
    ]);
  });
  it("skips trips with a missing plate and stops at the limit", () => {
    expect(distinctCars([{ make: "A", color: "B", plate: "" }])).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => ({ make: `M${i}`, color: "C", plate: `P${i}X` }));
    expect(distinctCars(many, 4)).toHaveLength(4);
  });
});
