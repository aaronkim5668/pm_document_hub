import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

describe("Prisma Decimal comparison", () => {
  it("documents why Decimal must not be compared to number with ===", () => {
    const value = new Prisma.Decimal(0);

    expect(value === (0 as unknown)).toBe(false);
    expect(value.toNumber() === 0).toBe(true);
  });
});
