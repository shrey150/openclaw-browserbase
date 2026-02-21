import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { expectedSkillFiles, hasBrowserbaseSkills } from "../src/skills-sync.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("skills-sync", () => {
  it("reports missing skills when files do not exist", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "browserbase-skills-test-"));
    tempDirs.push(tempDir);

    expect(hasBrowserbaseSkills(tempDir)).toBe(false);
  });

  it("reports installed skills when expected files exist", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "browserbase-skills-test-"));
    tempDirs.push(tempDir);

    for (const filePath of expectedSkillFiles(tempDir)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "content", "utf8");
    }

    expect(hasBrowserbaseSkills(tempDir)).toBe(true);
  });
});
