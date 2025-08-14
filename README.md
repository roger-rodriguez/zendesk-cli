# Zendesk CLI (`zd`)

A small TypeScript CLI for exploring Zendesk tickets from your terminal. Inspired by the UX of GitHub CLI.

## Features

- View ticket metadata and optionally include comments
- Output as pretty text or JSON
- Filter JSON by fields (supports dotted paths and array selectors like `comments[].id`)
- List available JSON fields for quick discovery
- Open a ticket in the browser

## Requirements

- Node.js >= 22

## Installation (local development)

```bash
# install dependencies
npm install

# link the CLI locally so `zd` is on your PATH
npm link
```

Alternatively, you can run any command with tsx without linking:

```bash
npx tsx src/index.ts --help
```

## Configuration

`zd` reads configuration from a `.env` file at the project root and validates it.

Required variables:

- `ZENDESK_SUB_DOMAIN` – your Zendesk subdomain (e.g., `acme` for `https://acme.zendesk.com`)
- `ZENDESK_API_KEY` – API key or token your instance accepts

Example `.env`:

```dotenv
ZENDESK_SUB_DOMAIN=acme
ZENDESK_API_KEY=xxxxxx
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

## Development

- Code entrypoint: `src/index.ts` (bin is `zd` via shebang `npx -y tsx`)
- Commands live in `src/commands/`
- API client lives in `src/libs/zendesk.ts`
- Config loader + validation lives in `src/libs/config.ts`

Scripts:

```bash
# unit tests (vitest)
npm test

# format with prettier
npm run format
```

## Notes on authentication

This CLI currently sends the API key via the `Authorization` header (the server must accept the configured scheme). If your Zendesk instance requires a different method, we can add a toggle to the config and client.

---
