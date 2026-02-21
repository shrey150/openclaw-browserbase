import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const SKILLS_REPO_RAW_BASE = "https://raw.githubusercontent.com/browserbase/skills";
const DEFAULT_SKILLS_REF = "main";

const SKILL_FILE_MAP = [
  {
    sourcePath: "skills/browser-automation/SKILL.md",
    destinationPath: path.join("browser-automation", "SKILL.md"),
  },
  {
    sourcePath: "skills/browser-automation/EXAMPLES.md",
    destinationPath: path.join("browser-automation", "EXAMPLES.md"),
  },
  {
    sourcePath: "skills/browser-automation/REFERENCE.md",
    destinationPath: path.join("browser-automation", "REFERENCE.md"),
  },
  {
    sourcePath: "skills/browser-automation/setup.json",
    destinationPath: path.join("browser-automation", "setup.json"),
  },
  {
    sourcePath: "skills/functions/SKILL.md",
    destinationPath: path.join("functions", "SKILL.md"),
  },
] as const;

export type SkillSyncResult = {
  targetRoot: string;
  ref: string;
  filesWritten: string[];
};

export function defaultSkillsRoot(): string {
  return path.join(os.homedir(), ".openclaw", "skills");
}

export function resolveSkillsRoot(explicitPath?: string): string {
  if (typeof explicitPath === "string" && explicitPath.trim()) {
    return path.resolve(process.cwd(), explicitPath.trim());
  }

  return defaultSkillsRoot();
}

export function expectedSkillFiles(targetRoot = defaultSkillsRoot()): string[] {
  return SKILL_FILE_MAP.map((entry) => path.join(targetRoot, entry.destinationPath));
}

export function hasBrowserbaseSkills(targetRoot = defaultSkillsRoot()): boolean {
  return expectedSkillFiles(targetRoot).every((filePath) => fs.existsSync(filePath));
}

function normalizeRef(ref?: string): string {
  if (typeof ref !== "string" || !ref.trim()) {
    return DEFAULT_SKILLS_REF;
  }

  return ref.trim();
}

async function downloadText(fetchImpl: typeof fetch, url: string): Promise<string> {
  const response = await fetchImpl(url, {
    headers: {
      "user-agent": "openclaw-browserbase-plugin",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tempPath, content, "utf8");
  await fsp.rename(tempPath, filePath);
}

export async function syncBrowserbaseSkills(options?: {
  targetRoot?: string;
  ref?: string;
  fetchImpl?: typeof fetch;
}): Promise<SkillSyncResult> {
  const targetRoot = resolveSkillsRoot(options?.targetRoot);
  const ref = normalizeRef(options?.ref);
  const fetchImpl = options?.fetchImpl ?? fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is not available in this runtime.");
  }

  const filesWritten: string[] = [];

  for (const entry of SKILL_FILE_MAP) {
    const sourceUrl = `${SKILLS_REPO_RAW_BASE}/${ref}/${entry.sourcePath}`;
    const content = await downloadText(fetchImpl, sourceUrl);

    if (!content.trim()) {
      throw new Error(`Received empty content for ${sourceUrl}`);
    }

    const destination = path.join(targetRoot, entry.destinationPath);
    await writeFileAtomic(destination, content);
    filesWritten.push(destination);
  }

  return {
    targetRoot,
    ref,
    filesWritten,
  };
}
