# @browserbasehq/openclaw-browserbase

Browserbase plugin for OpenClaw (with legacy ClawdBot compatibility).

It provides:

- interactive Browserbase credential setup,
- config status/env helpers,
- bundled Browserbase skills under `skills/`.

## Install

```bash
openclaw plugins install @browserbasehq/openclaw-browserbase
```

For local development:

```bash
openclaw plugins install -l .
```

Note: current OpenClaw plugin docs recommend npm/local specs for installs.

## Setup

```bash
openclaw browserbase setup
```

This writes plugin config into your OpenClaw config (typically `~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "entries": {
      "browserbase": {
        "enabled": true,
        "config": {
          "apiKey": "bb_...",
          "projectId": "proj_..."
        }
      }
    }
  }
}
```

## Commands

```bash
openclaw browserbase setup                     # prompt for API key + project ID
openclaw browserbase status                    # show configuration status
openclaw browserbase status --json             # machine-readable status
openclaw browserbase env --format shell        # export commands
openclaw browserbase env --format dotenv       # dotenv output
openclaw browserbase env --format json         # JSON output
openclaw browserbase where                     # config file path used
```

Legacy CLI alias support remains:

```bash
clawdbot browserbase setup
```

## Skills shipped with this plugin

- `skills/browser-automation`
- `skills/functions`

These are registered in `openclaw.plugin.json` via the `skills` field so they load with the plugin.

## Development

```bash
npm install
npm run check-types
npm test
```

## References

- OpenClaw Skills: https://docs.openclaw.ai/tools/skills
- OpenClaw Skills Config: https://docs.openclaw.ai/tools/skills-config
- OpenClaw Plugin System: https://docs.openclaw.ai/tools/plugin
- OpenClaw Plugin Manifest: https://docs.openclaw.ai/plugins/manifest
- Browserbase skills reference: https://github.com/browserbase/skills
- Example plugin reference: https://github.com/pepicrft/clawd-plugin-ralph
