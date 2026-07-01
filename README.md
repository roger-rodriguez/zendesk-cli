# Zendesk CLI (`zd`)

A small TypeScript CLI for exploring Zendesk tickets from your terminal. Inspired by the UX of GitHub CLI.

## Features

- View ticket metadata and optionally include comments
- Output as pretty text or JSON
- Filter JSON by fields (supports dotted paths and array selectors like `comments[].id`)
- List available JSON fields for quick discovery
- Open a ticket in the browser
- List tickets with flexible filters (assignee, group, status, date, query)

## Requirements

- Node.js >= 22

## Installation (local development)

```bash
# install dependencies and build dist/index.js (runs automatically via the
# "prepare" script)
npm install

# link the CLI locally so `zd` is on your PATH
npm link
```

Alternatively, you can run any command against the TypeScript source directly with tsx, without building or linking:

```bash
npm run dev -- --help
# or: npx tsx src/index.ts --help
```

## Configuration

`zd` reads configuration from a `.env` file at the project root and validates it.

Required variables:

- `ZENDESK_SUB_DOMAIN` – your Zendesk subdomain (e.g., `acme` for `https://acme.zendesk.com`)

Auth — provide **one** of:

- `ZENDESK_API_KEY` – API key/token (sent as `Basic` auth)
- `ZENDESK_OAUTH_TOKEN` – OAuth bearer token (sent as `Bearer` auth); use the `access_token` field from your OAuth credential JSON

Example `.env` using an API key:

```dotenv
ZENDESK_SUB_DOMAIN=acme
ZENDESK_API_KEY=xxxxxx
```

Example `.env` using an OAuth token:

```dotenv
ZENDESK_SUB_DOMAIN=acme
ZENDESK_OAUTH_TOKEN=af24b5e91b2516e4baf982b0...
```

The loader lives in `src/libs/config.ts` and is used by the API client in `src/libs/zendesk.ts`.

## Usage

Global help:

```bash
zd --help
```

### `ticket view`

Display metadata for a ticket, optionally including comments or opening in the browser.

```bash
zd ticket view <id> [flags]
```

Flags:

- `-j, --json` – output raw JSON
- `-c, --comments` – include comments in the payload/output
- `--fields <fields>` – comma‑separated list of fields to include in JSON output
  - Supports dotted paths and array selectors: e.g. `comments[].id,comments[].author_id`
- `-t, --template <string>` – format JSON output using a simple template (`{{field}}`), resolved against the payload root (or `ticket` root)
- `--list-fields` – print all discoverable field paths from the current payload
- `-w, --web` – open the ticket in the browser

Examples:

```bash
# pretty output
zd ticket view 309438

# include comments in pretty output
zd ticket view 309438 --comments

# raw JSON
zd ticket view 309438 --json

# JSON with only selected fields
zd ticket view 309438 --comments --json --fields "id,subject,status,comments[].id,comments[].author_id"

# discover available field paths first
zd ticket view 309438 --comments --list-fields

# simple templating
zd ticket view 309438 --template "{{id}} {{status}} {{subject}}"

# open in browser
zd ticket view 309438 --web
```

### `ticket list`

List tickets using Zendesk Search API with familiar gh-style filters.

```bash
zd ticket list [flags]
```

Flags:

- `--assignee <me|email|id>` – filter by assignee (default: `me`)
- `--group <id|name>` – filter by group (name auto-resolves to id)
- `--status <list>` – comma-separated statuses: `new,open,pending,on-hold,solved,closed` (default: `new,open,pending,on-hold`)
- `--updated-since <ISO>` – only tickets updated since date (e.g., `2025-01-01`)
- `--query <string>` – additional free-text query
- `--sort <field>` – `created|updated|priority` (default: `updated`)
- `--order <order>` – `asc|desc` (default: `desc`)
- `--limit <N>` – per page (default: `30`), `--page <N>` – page number (default: `1`)
- `-j, --json` – output raw JSON
- `--fields <fields>` – comma‑separated fields to include in JSON output
- `-t, --template <string>` – format JSON with a simple template
- `-w, --web` – open the same search in the browser

Examples:

```bash
# default: my open tickets, most recently updated
zd ticket list

# by group (name will be resolved to id)
zd ticket list --group "Support" --status open,pending --limit 20

# by assignee and updated since date
zd ticket list --assignee me --updated-since 2025-01-01

# open the same search in Zendesk agent UI
zd ticket list --group "Support" --status open --web

# JSON with selected fields
zd ticket list --json --fields "id,subject,status,assignee_id,updated_at" --limit 5
```

## Development

- Code entrypoint: `src/index.ts`
- Commands live in `src/commands/`
- API client lives in `src/libs/zendesk.ts`
- Config loader + validation lives in `src/libs/config.ts`
- `zd` (the `bin` entry) points at the built `dist/index.js`, a single bundled ESM file produced by esbuild — no `node_modules` needed at runtime

Scripts:

```bash
# bundle src/index.ts into dist/index.js (esbuild)
npm run build

# run against TypeScript source directly, no build step
npm run dev -- --help

# unit tests (vitest)
npm test

# format with prettier
npm run format
```

## Notes on authentication

This CLI currently sends the API key via the `Authorization` header (the server must accept the configured scheme). If your Zendesk instance requires a different method, we can add a toggle to the config and client.

---
