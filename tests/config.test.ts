import { describe, it, expect } from "vitest";
import { getVerifierId, VERIFIER_MAP } from "../src/config";

describe("getVerifierId", () => {
  it("returns mapped verifier for known github username", () => {
    expect(getVerifierId("benswift")).toBe("ben");
    expect(getVerifierId("out-of-office-cv")).toBe("khoi");
  });

  it("returns null for unknown github username", () => {
    expect(getVerifierId("random-user")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getVerifierId("")).toBeNull();
  });
});

describe("VERIFIER_MAP", () => {
  it("only contains expected verifiers", () => {
    expect(Object.keys(VERIFIER_MAP).sort()).toEqual([
      "benswift",
      "out-of-office-cv",
    ]);
  });
});
