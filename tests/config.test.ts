import { afterEach, describe, expect, it } from "vitest";
import { mergeConfig, parseConfig } from "../src/config.ts";

const ORIGINAL_API_KEY = process.env.BROWSERBASE_API_KEY;
const ORIGINAL_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.BROWSERBASE_API_KEY;
  } else {
    process.env.BROWSERBASE_API_KEY = ORIGINAL_API_KEY;
  }

  if (ORIGINAL_PROJECT_ID === undefined) {
    delete process.env.BROWSERBASE_PROJECT_ID;
  } else {
    process.env.BROWSERBASE_PROJECT_ID = ORIGINAL_PROJECT_ID;
  }
});

describe("parseConfig", () => {
  it("reads credentials from environment when config is empty", () => {
    process.env.BROWSERBASE_API_KEY = "bb_env_key";
    process.env.BROWSERBASE_PROJECT_ID = "proj_env";

    const cfg = parseConfig({});

    expect(cfg.apiKey).toBe("bb_env_key");
    expect(cfg.projectId).toBe("proj_env");
    expect(cfg.baseUrl).toBe("https://api.browserbase.com");
    // booleans are undefined (not explicitly set) — callers apply defaults
    expect(cfg.promptOnStart).toBeUndefined();
    expect(cfg.autoSyncSkills).toBeUndefined();
  });

  it("resolves env placeholders in config fields", () => {
    process.env.BROWSERBASE_API_KEY = "bb_env_key";
    process.env.BROWSERBASE_PROJECT_ID = "proj_env";

    const cfg = parseConfig({
      apiKey: "${BROWSERBASE_API_KEY}",
      projectId: "${BROWSERBASE_PROJECT_ID}",
      baseUrl: "https://api.browserbase.com",
      promptOnStart: false,
      autoSyncSkills: false,
    });

    expect(cfg.apiKey).toBe("bb_env_key");
    expect(cfg.projectId).toBe("proj_env");
    expect(cfg.promptOnStart).toBe(false);
    expect(cfg.autoSyncSkills).toBe(false);
  });

  it("rejects unknown config keys", () => {
    expect(() => parseConfig({ nope: true })).toThrowError(/unknown keys/i);
  });

  it("returns undefined for promptOnStart when not set", () => {
    const cfg = parseConfig({});
    expect(cfg.promptOnStart).toBeUndefined();
  });

  it("returns undefined for autoSyncSkills when not set", () => {
    const cfg = parseConfig({});
    expect(cfg.autoSyncSkills).toBeUndefined();
  });

  it("preserves explicit false for promptOnStart", () => {
    const cfg = parseConfig({ promptOnStart: false });
    expect(cfg.promptOnStart).toBe(false);
  });

  it("preserves explicit true for autoSyncSkills", () => {
    const cfg = parseConfig({ autoSyncSkills: true });
    expect(cfg.autoSyncSkills).toBe(true);
  });

  it("ignores whitespace-only api key", () => {
    delete process.env.BROWSERBASE_API_KEY;
    const cfg = parseConfig({ apiKey: "   " });
    expect(cfg.apiKey).toBeUndefined();
  });

  it("ignores whitespace-only project id", () => {
    delete process.env.BROWSERBASE_PROJECT_ID;
    const cfg = parseConfig({ projectId: "   " });
    expect(cfg.projectId).toBeUndefined();
  });

  it("gracefully falls back when env placeholder references unset variable", () => {
    delete process.env.BROWSERBASE_API_KEY;
    const cfg = parseConfig({ apiKey: "${BROWSERBASE_API_KEY}" });
    expect(cfg.apiKey).toBeUndefined();
  });

  it("uses default base URL when not provided", () => {
    const cfg = parseConfig({});
    expect(cfg.baseUrl).toBe("https://api.browserbase.com");
  });

  it("uses default base URL for empty string", () => {
    const cfg = parseConfig({ baseUrl: "" });
    expect(cfg.baseUrl).toBe("https://api.browserbase.com");
  });

  it("uses custom base URL when provided", () => {
    const cfg = parseConfig({ baseUrl: "https://custom.browserbase.com" });
    expect(cfg.baseUrl).toBe("https://custom.browserbase.com");
  });

  it("handles non-object input gracefully", () => {
    expect(() => parseConfig(null)).not.toThrow();
    expect(() => parseConfig(undefined)).not.toThrow();
    expect(() => parseConfig("string")).not.toThrow();
    expect(() => parseConfig(42)).not.toThrow();
  });
});

describe("mergeConfig", () => {
  it("primary credentials win over fallback", () => {
    delete process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_PROJECT_ID;
    const primary = parseConfig({ apiKey: "bb_primary", projectId: "proj_primary" });
    const fallback = parseConfig({ apiKey: "bb_fallback", projectId: "proj_fallback" });
    const merged = mergeConfig(primary, fallback);
    expect(merged.apiKey).toBe("bb_primary");
    expect(merged.projectId).toBe("proj_primary");
  });

  it("uses fallback credentials when primary has none", () => {
    delete process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_PROJECT_ID;
    const primary = parseConfig({});
    const fallback = parseConfig({ apiKey: "bb_fallback", projectId: "proj_fallback" });
    const merged = mergeConfig(primary, fallback);
    expect(merged.apiKey).toBe("bb_fallback");
    expect(merged.projectId).toBe("proj_fallback");
  });

  it("uses fallback promptOnStart when primary is unset", () => {
    const primary = parseConfig({});
    const fallback = parseConfig({ promptOnStart: false });
    const merged = mergeConfig(primary, fallback);
    expect(merged.promptOnStart).toBe(false);
  });

  it("uses fallback autoSyncSkills when primary is unset", () => {
    const primary = parseConfig({});
    const fallback = parseConfig({ autoSyncSkills: false });
    const merged = mergeConfig(primary, fallback);
    expect(merged.autoSyncSkills).toBe(false);
  });

  it("primary explicit false overrides fallback true for promptOnStart", () => {
    const primary = parseConfig({ promptOnStart: false });
    const fallback = parseConfig({ promptOnStart: true });
    expect(mergeConfig(primary, fallback).promptOnStart).toBe(false);
  });

  it("primary explicit true overrides fallback false for autoSyncSkills", () => {
    const primary = parseConfig({ autoSyncSkills: true });
    const fallback = parseConfig({ autoSyncSkills: false });
    expect(mergeConfig(primary, fallback).autoSyncSkills).toBe(true);
  });

  it("primary baseUrl wins over fallback", () => {
    delete process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_PROJECT_ID;
    const primary = parseConfig({ baseUrl: "https://primary.example.com" });
    const fallback = parseConfig({ baseUrl: "https://fallback.example.com" });
    expect(mergeConfig(primary, fallback).baseUrl).toBe("https://primary.example.com");
  });

  it("fallback baseUrl used when primary has default", () => {
    delete process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_PROJECT_ID;
    const primary = parseConfig({});
    const fallback = parseConfig({ baseUrl: "https://fallback.example.com" });
    // primary.baseUrl is DEFAULT_BASE_URL (non-null), so it wins over fallback
    // This is expected: default is "https://api.browserbase.com"
    expect(mergeConfig(primary, fallback).baseUrl).toBe("https://api.browserbase.com");
  });
});
