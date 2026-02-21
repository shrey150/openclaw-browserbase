import readline from "node:readline";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  browserbaseConfigSchema,
  mergeConfig,
  parseConfig,
  type BrowserbaseConfig,
} from "./config.js";
import {
  maskSecret,
  readPluginConfig,
  resolveConfigPath,
  shellEscape,
  writePluginConfig,
} from "./config-store.js";

const PLUGIN_ID = "browserbase";
const LEGACY_PLUGIN_IDS = [PLUGIN_ID, "clawd-plugin-browserbase", "openclaw-browserbase"];

function createLogger(api: Partial<OpenClawPluginApi>): OpenClawPluginApi["logger"] {
  if (api.logger) {
    return api.logger;
  }

  return {
    info: (msg: string) => console.log(msg),
    warn: (msg: string) => console.warn(msg),
    error: (msg: string, ...args: unknown[]) => console.error(msg, ...args),
    debug: (msg: string) => console.debug(msg),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConfigSafe(
  raw: unknown,
  logger: OpenClawPluginApi["logger"],
  label: string
): BrowserbaseConfig {
  try {
    return parseConfig(raw);
  } catch (error) {
    logger.warn(
      `browserbase: ignoring invalid ${label} (${String((error as Error)?.message ?? error)})`
    );
    return parseConfig({});
  }
}

function readLegacyPluginConfig(api: OpenClawPluginApi): unknown {
  const root = api.config;
  if (!isRecord(root)) {
    return {};
  }

  const plugins = isRecord(root.plugins) ? root.plugins : {};
  const entries = isRecord(plugins.entries) ? plugins.entries : {};

  for (const pluginId of LEGACY_PLUGIN_IDS) {
    const entry = entries[pluginId];
    if (isRecord(entry) && isRecord(entry.config)) {
      return entry.config;
    }
  }

  return {};
}

function runtimeConfig(api: OpenClawPluginApi, logger: OpenClawPluginApi["logger"]): BrowserbaseConfig {
  const fromPluginConfig = parseConfigSafe(api.pluginConfig, logger, "pluginConfig");
  const fromLegacyConfig = parseConfigSafe(readLegacyPluginConfig(api), logger, "legacy config");
  return mergeConfig(fromPluginConfig, fromLegacyConfig);
}

function loadMergedConfig(
  api: OpenClawPluginApi,
  logger: OpenClawPluginApi["logger"],
  explicitPath?: string
): { configPath: string; config: BrowserbaseConfig } {
  const configPath = resolveConfigPath(explicitPath);
  const fromRuntime = runtimeConfig(api, logger);
  let rawFileConfig: Record<string, unknown> = {};
  try {
    rawFileConfig = readPluginConfig(configPath, PLUGIN_ID);
  } catch (error) {
    logger.warn(
      `browserbase: unable to read ${configPath} (${String((error as Error)?.message ?? error)})`
    );
  }
  const fromFile = parseConfigSafe(rawFileConfig, logger, `file ${configPath}`);
  return {
    configPath,
    config: mergeConfig(fromRuntime, fromFile),
  };
}

async function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function promptYesNo(
  rl: readline.Interface,
  question: string,
  defaultYes: boolean
): Promise<boolean> {
  const answer = (await ask(rl, question)).trim().toLowerCase();
  if (!answer) {
    return defaultYes;
  }

  if (["y", "yes"].includes(answer)) {
    return true;
  }

  if (["n", "no"].includes(answer)) {
    return false;
  }

  return defaultYes;
}

async function promptAndPersistCredentials(
  configPath: string,
  defaults: { apiKey?: string; projectId?: string },
  printHeader: boolean
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    if (printHeader) {
      console.log("\nBrowserbase setup\n");
      console.log("Get credentials from https://browserbase.com/settings\n");
    }

    const apiKeyQuestion = defaults.apiKey
      ? `Browserbase API key [${maskSecret(defaults.apiKey)}]: `
      : "Browserbase API key: ";
    const projectIdQuestion = defaults.projectId
      ? `Browserbase project ID [${defaults.projectId}]: `
      : "Browserbase project ID: ";

    const apiKeyInput = (await ask(rl, apiKeyQuestion)).trim();
    const projectIdInput = (await ask(rl, projectIdQuestion)).trim();

    const apiKey = apiKeyInput || defaults.apiKey;
    const projectId = projectIdInput || defaults.projectId;

    if (!apiKey || !projectId) {
      console.log("\nSetup cancelled: both API key and project ID are required.");
      return false;
    }

    writePluginConfig(configPath, PLUGIN_ID, {
      apiKey,
      projectId,
    });

    console.log(`\nSaved Browserbase credentials to ${configPath}`);
    console.log("Restart ClawdBot/OpenClaw to apply updated plugin config.\n");
    return true;
  } finally {
    rl.close();
  }
}

function registerCli(api: OpenClawPluginApi, logger: OpenClawPluginApi["logger"]): void {
  api.registerCli(({ program }: { program: any }) => {
    const browserbase = program
      .command("browserbase")
      .description("Browserbase plugin setup and credential helpers");

    browserbase
      .command("setup")
      .description("Prompt for Browserbase API key and project ID")
      .option("--api-key <apiKey>", "Browserbase API key")
      .option("--project-id <projectId>", "Browserbase project ID")
      .option("-c, --config <path>", "Override config file path")
      .action(async (options: any) => {
        const configPath = resolveConfigPath(options.config);
        let rawExisting: Record<string, unknown> = {};
        try {
          rawExisting = readPluginConfig(configPath, PLUGIN_ID);
        } catch (error) {
          logger.warn(
            `browserbase: unable to read ${configPath} (${String((error as Error)?.message ?? error)})`
          );
        }
        const existing = parseConfigSafe(
          rawExisting,
          logger,
          `file ${configPath}`
        );

        const apiKeyFlag = typeof options.apiKey === "string" ? options.apiKey.trim() : "";
        const projectIdFlag =
          typeof options.projectId === "string" ? options.projectId.trim() : "";

        if (apiKeyFlag && projectIdFlag) {
          writePluginConfig(configPath, PLUGIN_ID, {
            apiKey: apiKeyFlag,
            projectId: projectIdFlag,
          });

          console.log(`Saved Browserbase credentials to ${configPath}`);
          console.log("Restart ClawdBot/OpenClaw to apply updated plugin config.");
          return;
        }

        await promptAndPersistCredentials(
          configPath,
          {
            apiKey: apiKeyFlag || existing.apiKey,
            projectId: projectIdFlag || existing.projectId,
          },
          true
        );
      });

    browserbase
      .command("status")
      .description("Show Browserbase credential status")
      .option("--json", "Output JSON", false)
      .option("-c, --config <path>", "Override config file path")
      .action((options: any) => {
        const { configPath, config } = loadMergedConfig(api, logger, options.config);
        const configured = Boolean(config.apiKey && config.projectId);

        const payload = {
          configured,
          configPath,
          apiKey: maskSecret(config.apiKey),
          projectId: maskSecret(config.projectId),
          baseUrl: config.baseUrl,
          promptOnStart: config.promptOnStart,
        };

        if (options.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }

        console.log(`Configured: ${configured ? "yes" : "no"}`);
        console.log(`Config file: ${configPath}`);
        console.log(`API key: ${payload.apiKey}`);
        console.log(`Project ID: ${payload.projectId}`);
        console.log(`Base URL: ${payload.baseUrl}`);
        console.log(`Prompt on startup: ${payload.promptOnStart ? "yes" : "no"}`);
      });

    browserbase
      .command("env")
      .description("Print Browserbase env vars for shell export")
      .option("-f, --format <format>", "shell|dotenv|json", "shell")
      .option("-c, --config <path>", "Override config file path")
      .action((options: any) => {
        const { config } = loadMergedConfig(api, logger, options.config);

        if (!config.apiKey || !config.projectId) {
          throw new Error("Browserbase is not configured. Run 'openclaw browserbase setup'.");
        }

        const format = String(options.format ?? "shell").toLowerCase();

        if (format === "shell") {
          console.log(`export BROWSERBASE_API_KEY=${shellEscape(config.apiKey)}`);
          console.log(`export BROWSERBASE_PROJECT_ID=${shellEscape(config.projectId)}`);
          return;
        }

        if (format === "dotenv") {
          console.log(`BROWSERBASE_API_KEY=${config.apiKey}`);
          console.log(`BROWSERBASE_PROJECT_ID=${config.projectId}`);
          return;
        }

        if (format === "json") {
          console.log(
            JSON.stringify(
              {
                BROWSERBASE_API_KEY: config.apiKey,
                BROWSERBASE_PROJECT_ID: config.projectId,
              },
              null,
              2
            )
          );
          return;
        }

        throw new Error(`Unknown format: ${format}. Use shell, dotenv, or json.`);
      });

    browserbase
      .command("where")
      .description("Show the config file path used by setup")
      .option("-c, --config <path>", "Override config file path")
      .action((options: any) => {
        console.log(resolveConfigPath(options.config));
      });
  });
}

let didStartupPrompt = false;

async function maybePromptOnStartup(
  api: OpenClawPluginApi,
  logger: OpenClawPluginApi["logger"]
): Promise<void> {
  if (didStartupPrompt) {
    return;
  }

  didStartupPrompt = true;

  const { configPath, config } = loadMergedConfig(api, logger);

  if (config.apiKey && config.projectId) {
    logger.info("browserbase: credentials loaded");
    return;
  }

  if (!config.promptOnStart) {
    logger.warn("browserbase: missing credentials. Run 'openclaw browserbase setup'.");
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    logger.warn(
      "browserbase: missing credentials in non-interactive mode. Run 'openclaw browserbase setup'."
    );
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const shouldSetup = await promptYesNo(
      rl,
      "\nBrowserbase is not configured. Configure now? [Y/n]: ",
      true
    );

    if (!shouldSetup) {
      logger.warn("browserbase: setup skipped. Run 'openclaw browserbase setup' later.");
      return;
    }
  } finally {
    rl.close();
  }

  await promptAndPersistCredentials(configPath, { apiKey: config.apiKey, projectId: config.projectId }, false);
}

export default {
  id: PLUGIN_ID,
  name: "Browserbase",
  description: "Browserbase setup helper with bundled skills",
  kind: "tool" as const,
  configSchema: browserbaseConfigSchema,
  register(api: OpenClawPluginApi) {
    const logger = createLogger(api);
    registerCli(api, logger);

    if (typeof api.registerService === "function") {
      api.registerService({
        id: "browserbase-startup-check",
        start: () => {
          void maybePromptOnStartup(api, logger);
        },
        stop: () => {},
      });
      return;
    }

    void maybePromptOnStartup(api, logger);
  },
};
