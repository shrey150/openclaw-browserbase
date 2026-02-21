import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expectedSkillFiles,
  hasBrowserbaseSkills,
  syncBrowserbaseSkills,
} from "../src/skills-sync.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browserbase-skills-test-"));
  tempDirs.push(dir);
  return dir;
}

function makeMockFetch(content = "# skill content"): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: async () => content,
  }) as unknown as typeof fetch;
}

describe("hasBrowserbaseSkills / expectedSkillFiles", () => {
  it("reports missing when files do not exist", () => {
    const dir = makeTempDir();
    expect(hasBrowserbaseSkills(dir)).toBe(false);
  });

  it("reports installed when all expected files exist", () => {
    const dir = makeTempDir();
    for (const filePath of expectedSkillFiles(dir)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "content", "utf8");
    }
    expect(hasBrowserbaseSkills(dir)).toBe(true);
  });

  it("reports missing when only some files exist", () => {
    const dir = makeTempDir();
    const files = expectedSkillFiles(dir);
    // write all but one
    for (const filePath of files.slice(0, -1)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "content", "utf8");
    }
    expect(hasBrowserbaseSkills(dir)).toBe(false);
  });

  it("expectedSkillFiles returns 5 entries", () => {
    expect(expectedSkillFiles("/tmp/fake-root")).toHaveLength(5);
  });
});

describe("syncBrowserbaseSkills", () => {
  it("downloads and writes all 5 skill files", async () => {
    const dir = makeTempDir();
    const mockFetch = makeMockFetch("# skill content");

    const result = await syncBrowserbaseSkills({
      targetRoot: dir,
      ref: "main",
      fetchImpl: mockFetch,
    });

    expect(result.filesWritten).toHaveLength(5);
    expect(result.ref).toBe("main");
    expect(result.targetRoot).toBe(dir);

    for (const filePath of result.filesWritten) {
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, "utf-8")).toBe("# skill content");
    }
  });

  it("fetches all files in parallel (all fetch calls happen)", async () => {
    const dir = makeTempDir();
    const fetchOrder: number[] = [];
    let callIndex = 0;

    const mockFetch = vi.fn().mockImplementation(async () => {
      const idx = callIndex++;
      fetchOrder.push(idx);
      return { ok: true, text: async () => `# content ${idx}` };
    }) as unknown as typeof fetch;

    await syncBrowserbaseSkills({ targetRoot: dir, fetchImpl: mockFetch });

    // All 5 files should have been fetched
    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(fetchOrder).toHaveLength(5);
  });

  it("uses correct GitHub raw URL format", async () => {
    const dir = makeTempDir();
    const mockFetch = makeMockFetch("content");
    const urls: string[] = [];

    const capturingFetch = vi.fn().mockImplementation(async (url: string) => {
      urls.push(url);
      return { ok: true, text: async () => "content" };
    }) as unknown as typeof fetch;

    await syncBrowserbaseSkills({ targetRoot: dir, ref: "v1.2.3", fetchImpl: capturingFetch });

    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/browserbase\/skills\/v1\.2\.3\//);
    }
  });

  it("defaults to 'main' ref when none provided", async () => {
    const dir = makeTempDir();
    const urls: string[] = [];
    const capturingFetch = vi.fn().mockImplementation(async (url: string) => {
      urls.push(url);
      return { ok: true, text: async () => "content" };
    }) as unknown as typeof fetch;

    const result = await syncBrowserbaseSkills({ targetRoot: dir, fetchImpl: capturingFetch });

    expect(result.ref).toBe("main");
    for (const url of urls) {
      expect(url).toContain("/main/");
    }
  });

  it("throws on HTTP 404", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    await expect(
      syncBrowserbaseSkills({ fetchImpl: mockFetch })
    ).rejects.toThrow("HTTP 404");
  });

  it("throws on HTTP 500", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    await expect(
      syncBrowserbaseSkills({ fetchImpl: mockFetch })
    ).rejects.toThrow("HTTP 500");
  });

  it("throws on empty content", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "   ",
    }) as unknown as typeof fetch;

    await expect(
      syncBrowserbaseSkills({ fetchImpl: mockFetch })
    ).rejects.toThrow(/empty content/i);
  });

  it("throws when fetch is not available", async () => {
    await expect(
      syncBrowserbaseSkills({ fetchImpl: "not-a-function" as any })
    ).rejects.toThrow("Global fetch is not available");
  });

  it("creates nested target directories automatically", async () => {
    const dir = makeTempDir();
    const deepDir = path.join(dir, "deep", "nested", "skills");
    const mockFetch = makeMockFetch("content");

    const result = await syncBrowserbaseSkills({
      targetRoot: deepDir,
      fetchImpl: mockFetch,
    });

    for (const filePath of result.filesWritten) {
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it("sends user-agent header with each request", async () => {
    const dir = makeTempDir();
    const headers: Record<string, string>[] = [];

    const capturingFetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
      headers.push((opts?.headers ?? {}) as Record<string, string>);
      return { ok: true, text: async () => "content" };
    }) as unknown as typeof fetch;

    await syncBrowserbaseSkills({ targetRoot: dir, fetchImpl: capturingFetch });

    for (const h of headers) {
      expect(h["user-agent"]).toBe("openclaw-browserbase-plugin");
    }
  });
});
