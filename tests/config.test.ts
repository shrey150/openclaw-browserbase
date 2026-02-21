import { afterEach, describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.ts";

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
    expect(cfg.promptOnStart).toBe(true);
  });

  it("resolves env placeholders in config fields", () => {
    process.env.BROWSERBASE_API_KEY = "bb_env_key";
    process.env.BROWSERBASE_PROJECT_ID = "proj_env";

    const cfg = parseConfig({
      apiKey: "${BROWSERBASE_API_KEY}",
      projectId: "${BROWSERBASE_PROJECT_ID}",
      baseUrl: "https://api.browserbase.com",
      promptOnStart: false,
    });

    expect(cfg.apiKey).toBe("bb_env_key");
    expect(cfg.projectId).toBe("proj_env");
    expect(cfg.promptOnStart).toBe(false);
  });

  it("rejects unknown config keys", () => {
    expect(() => parseConfig({ nope: true })).toThrowError(/unknown keys/i);
  });
});
