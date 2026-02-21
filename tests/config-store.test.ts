import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readPluginConfig, writePluginConfig } from "../src/config-store.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("config-store", () => {
  it("writes and reads plugin config", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "browserbase-plugin-test-"));
    tempDirs.push(tempDir);

    const configPath = path.join(tempDir, "clawdbot.json");
    writePluginConfig(configPath, "browserbase", {
      apiKey: "bb_test_key",
      projectId: "proj_test",
    });

    const saved = readPluginConfig(configPath, "browserbase");

    expect(saved.apiKey).toBe("bb_test_key");
    expect(saved.projectId).toBe("proj_test");
  });
});
