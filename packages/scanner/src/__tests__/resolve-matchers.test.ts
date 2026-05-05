import type { MatcherPlugin } from "@deepsec/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatcherRegistry } from "../matcher-registry.js";
import { resolveMatchers } from "../index.js";

function fakeMatcher(slug: string): MatcherPlugin {
  return {
    slug,
    description: slug,
    noiseTier: "normal",
    filePatterns: ["**/*.ts"],
    match: () => [],
  };
}

function buildRegistry(slugs: string[]): MatcherRegistry {
  const r = new MatcherRegistry();
  for (const s of slugs) r.register(fakeMatcher(s));
  return r;
}

describe("resolveMatchers", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns all matchers when no CLI slugs and no config filter", () => {
    const r = buildRegistry(["xss", "rce", "ssrf"]);
    const result = resolveMatchers(r, undefined, undefined);
    expect(result.map((m) => m.slug).sort()).toEqual(["rce", "ssrf", "xss"]);
  });

  it("CLI slugs override config entirely", () => {
    const r = buildRegistry(["xss", "rce", "ssrf"]);
    const result = resolveMatchers(r, ["xss"], { exclude: ["xss"], only: ["rce"] });
    expect(result.map((m) => m.slug)).toEqual(["xss"]);
  });

  it("config exclude removes matchers (issue #36)", () => {
    const r = buildRegistry(["xss", "rce", "ssrf"]);
    const result = resolveMatchers(r, undefined, { exclude: ["xss"] });
    expect(result.map((m) => m.slug).sort()).toEqual(["rce", "ssrf"]);
  });

  it("config only restricts the base set", () => {
    const r = buildRegistry(["xss", "rce", "ssrf"]);
    const result = resolveMatchers(r, undefined, { only: ["xss", "rce"] });
    expect(result.map((m) => m.slug).sort()).toEqual(["rce", "xss"]);
  });

  it("only and exclude compose: exclude subtracts from only", () => {
    const r = buildRegistry(["xss", "rce", "ssrf"]);
    const result = resolveMatchers(r, undefined, { only: ["xss", "rce"], exclude: ["rce"] });
    expect(result.map((m) => m.slug)).toEqual(["xss"]);
  });

  it("warns on unknown slug in only and ignores it", () => {
    const r = buildRegistry(["xss", "rce"]);
    const result = resolveMatchers(r, undefined, { only: ["xss", "bogus"] });
    expect(result.map((m) => m.slug)).toEqual(["xss"]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(`unknown matcher slug "bogus"`));
  });

  it("warns on unknown slug in exclude", () => {
    const r = buildRegistry(["xss", "rce"]);
    resolveMatchers(r, undefined, { exclude: ["nope"] });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(`unknown matcher slug "nope"`));
  });

  it("empty only with exclude treats base as all matchers", () => {
    const r = buildRegistry(["xss", "rce"]);
    const result = resolveMatchers(r, undefined, { only: [], exclude: ["xss"] });
    expect(result.map((m) => m.slug)).toEqual(["rce"]);
  });
});
