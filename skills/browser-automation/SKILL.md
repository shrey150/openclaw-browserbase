---
name: browser-automation
description: Browser automation with Browserbase + Stagehand CLI. Use for browsing sites, clicking elements, extracting page data, taking screenshots, filling forms, and QA web flows.
homepage: https://github.com/browserbase/skills
metadata: {"openclaw":{"emoji":"🌐","homepage":"https://github.com/browserbase/skills"}}
allowed-tools: Bash
---

# Browserbase Browser Automation

Use this skill when a user requests browser navigation or browser-based automation.

## When to use

- User asks to browse a website and report findings.
- User asks to click/type/submit in a web app.
- User asks to extract structured data from web pages.
- User asks for screenshots or basic web QA.

## When not to use

- Pure API/data tasks that do not require a browser session.
- Local file/code edits that do not involve website interaction.

## First-time setup

1. Configure Browserbase credentials:

```bash
openclaw browserbase setup
```

If your runtime command is `clawdbot`, use:

```bash
clawdbot browserbase setup
```

2. Export credentials into the current shell session:

```bash
eval "$(openclaw browserbase env --format shell)"
```

3. Install the official Browserbase browser CLI (if not already installed):

```bash
npm install -g github:browserbase/skills
```

## Commands

```bash
browser navigate <url>
browser act "<action>"
browser extract "<instruction>" '{"field":"string"}'
browser observe "<query>"
browser screenshot
browser close
```

## Workflow checklist

1. Navigate first.
2. Perform actions and verify with screenshots.
3. Extract structured data when needed.
4. Close the browser at the end.
