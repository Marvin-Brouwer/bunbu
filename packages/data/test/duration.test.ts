import { describe, expect, it } from "vitest";
import { secondsOf } from "../src";

describe("secondsOf", () => {
  it("adds up hours, minutes and seconds", () => {
    expect(secondsOf("45s")).toBe(45);
    expect(secondsOf("3m")).toBe(180);
    expect(secondsOf("1m30s")).toBe(90);
    expect(secondsOf("1h")).toBe(3600);
    expect(secondsOf("1h2m3s")).toBe(3723);
  });

  it("is undefined for what isn't a duration, or no time at all", () => {
    for (const text of ["", "30", "30s1m", "1.5m", "0s", "0h0m", `${"9".repeat(400)}s`]) expect(secondsOf(text)).toBeUndefined();
  });
});
