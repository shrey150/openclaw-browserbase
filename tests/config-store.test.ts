import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  dotenvEscape,
  maskSecret,
  readPluginConfig,
  shellEscape,
  writePluginConfig,
} from "../src/config-store.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browserbase-plugin-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("writePluginConfig / readPluginConfig", () => {
  it("writes and reads plugin config", () => {
    const configPath = path.join(makeTempDir(), "openclaw.json");
    writePluginConfig(configPath, "browserbase", {
      apiKey: "bb_test_key",
      projectId: "proj_test",
    });

    const saved = readPluginConfig(configPath, "browserbase");

    expect(saved.apiKey).toBe("bb_test_key");
    expect(saved.projectId).toBe("proj_test");
  });

  it("preserves other top-level config sections on write", () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "openclaw.json");
    const initial = {
      gateway: { url: "https://example.com" },
      auth: { token: "tok_123" },
      plugins: { entries: {} },
    };
    fs.writeFileSync(configPath, JSON.stringify(initial, null, 2), "utf-8");

    writePluginConfig(configPath, "browserbase", { apiKey: "bb_k", projectId: "p" });

    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    expect((raw.gateway as any)?.url).toBe("https://example.com");
    expect((raw.auth as any)?.token).toBe("tok_123");
  });

  it("merges new fields into existing plugin config", () => {
    const configPath = path.join(makeTempDir(), "openclaw.json");
    writePluginConfig(configPath, "browserbase", { apiKey: "bb_key_1", projectId: "proj_1" });
    writePluginConfig(configPath, "browserbase", { apiKey: "bb_key_2" });

    const saved = readPluginConfig(configPath, "browserbase");
    expect(saved.apiKey).toBe("bb_key_2");
    expect(saved.projectId).toBe("proj_1"); // preserved from first write
  });

  it("creates parent directories if they do not exist", () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "deep", "nested", "openclaw.json");
    expect(() =>
      writePluginConfig(configPath, "browserbase", { apiKey: "k", projectId: "p" })
    ).not.toThrow();
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("returns empty object when config file does not exist", () => {
    const configPath = path.join(makeTempDir(), "nonexistent.json");
    const cfg = readPluginConfig(configPath, "browserbase");
    expect(cfg).toEqual({});
  });

  it("returns empty object when plugin entry is absent", () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "openclaw.json");
    fs.writeFileSync(configPath, JSON.stringify({ plugins: { entries: {} } }, null, 2), "utf-8");
    expect(readPluginConfig(configPath, "browserbase")).toEqual({});
  });

  it("sets enabled:true on new entry (does not force true when already false)", () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "openclaw.json");
    // pre-existing disabled entry
    const initial = { plugins: { entries: { browserbase: { enabled: false, config: {} } } } };
    fs.writeFileSync(configPath, JSON.stringify(initial, null, 2), "utf-8");

    writePluginConfig(configPath, "browserbase", { apiKey: "k", projectId: "p" });

    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as any;
    expect(raw.plugins.entries.browserbase.enabled).toBe(false);
  });
});

describe("maskSecret", () => {
  it("returns 'not set' for undefined", () => {
    expect(maskSecret(undefined)).toBe("not set");
  });

  it("returns 'not set' for empty string", () => {
    expect(maskSecret("")).toBe("not set");
  });

  it("masks short secrets with stars", () => {
    const result = maskSecret("short");
    expect(result).toMatch(/^\*+$/);
  });

  it("masks long secrets with head...tail", () => {
    const result = maskSecret("bb_live_abcdefghijklmnop");
    expect(result).toMatch(/^bb_l\.\.\.mnop$/);
  });

  it("does not reveal more than 8 chars of a short secret", () => {
    const result = maskSecret("12345678");
    expect(result).toMatch(/^\*+$/);
    expect(result).not.toContain("1234");
  });
});

describe("shellEscape", () => {
  it("wraps value in single quotes", () => {
    expect(shellEscape("hello")).toBe("'hello'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellEscape("it's")).toBe("'it'\"'\"'s'");
  });

  it("handles value with spaces", () => {
    expect(shellEscape("hello world")).toBe("'hello world'");
  });
});

describe("dotenvEscape", () => {
  it("returns plain value when no special characters", () => {
    expect(dotenvEscape("bb_live_abc123")).toBe("bb_live_abc123");
  });

  it("wraps in double quotes when value contains spaces", () => {
    const result = dotenvEscape("hello world");
    expect(result).toBe('"hello world"');
  });

  it("wraps in double quotes and escapes double quotes inside", () => {
    const result = dotenvEscape('say "hello"');
    expect(result).toBe('"say \\"hello\\""');
  });

  it("wraps in double quotes when value contains #", () => {
    const result = dotenvEscape("key#suffix");
    expect(result).toBe('"key#suffix"');
  });

  it("wraps in double quotes when value contains =", () => {
    const result = dotenvEscape("key=value");
    expect(result).toBe('"key=value"');
  });

  it("escapes newlines", () => {
    const result = dotenvEscape("line1\nline2");
    expect(result).toBe('"line1\\nline2"');
  });

  it("escapes carriage returns", () => {
    const result = dotenvEscape("line1\r\nline2");
    expect(result).toBe('"line1\\r\\nline2"');
  });

  it("escapes backslashes", () => {
    const result = dotenvEscape("path\\to\\thing");
    expect(result).toBe('"path\\\\to\\\\thing"');
  });
});
