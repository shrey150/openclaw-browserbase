---
name: browserbase-functions
description: Deploy Browserbase Functions for cloud browser automation, webhooks, and scheduled jobs.
homepage: https://docs.browserbase.com
metadata: {"openclaw":{"emoji":"☁️","homepage":"https://docs.browserbase.com"}}
allowed-tools: Bash
---

# Browserbase Functions

Use this skill when automation should run in Browserbase cloud instead of locally.

## Setup

1. Configure Browserbase credentials:

```bash
openclaw browserbase setup
```

2. Export env vars for current shell:

```bash
eval "$(openclaw browserbase env --format shell)"
```

If your runtime command is `clawdbot`, replace `openclaw` with `clawdbot`.

## Typical flow

```bash
pnpm dlx @browserbasehq/sdk-functions init my-function
cd my-function
pnpm install
pnpm bb dev index.ts
pnpm bb publish index.ts
```

Use this for scheduled jobs, webhook-driven workflows, and long-running automation.
