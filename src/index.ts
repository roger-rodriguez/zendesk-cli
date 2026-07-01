#!/usr/bin/env node

import { Command } from "commander";
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

import { ticketCmd } from "./commands/ticket";

// Commander's addCommand() does NOT copy the parent's settings (including
// _exitCallback) onto the subcommand the way `.command()` does — that only
// happens for commands built with `.command()`. Since ticketCmd/viewCmd/
// listCmd are all wired up via addCommand(), calling exitOverride() only on
// the root `program` leaves every subcommand's _exitCallback unset. Any
// error raised from a subcommand (e.g. a missing required <id> argument)
// then falls straight through to process.exit(), killing the whole host
// process — exactly the failure this function exists to prevent. So we
// walk the whole command tree and call exitOverride() on every node.
function applyExitOverride(cmd: Command): void {
  cmd.exitOverride();
  for (const sub of cmd.commands) applyExitOverride(sub);
}

function createProgram(): Command {
  const program = new Command();
  program.name("zd").description("CLI to manage Zendesk").version("1.0.0");
  program.addCommand(ticketCmd);
  applyExitOverride(program);
  return program;
}

/**
 * Programmatic entry point: run the CLI against an argv array and get back
 * an exit code, without ever calling process.exit(). Output still goes
 * through console.log/console.error as before — callers that need to
 * capture it (rather than let it hit the real stdout/stderr) should
 * temporarily redirect those streams around this call.
 */
export async function run(argv: string[]): Promise<number> {
  const program = createProgram();
  const priorExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    await program.parseAsync(argv, { from: "user" });
    return process.exitCode ?? 0;
  } catch (err) {
    const exitCode = (err as { exitCode?: number } | undefined)?.exitCode;
    return typeof exitCode === "number" ? exitCode : 1;
  } finally {
    process.exitCode = priorExitCode;
  }
}

// Standalone CLI usage (`zd ticket view 123 --json`) still works exactly
// as before — this only runs when the file is executed directly, not when
// another module imports `run`.
//
// process.argv[1] is resolved through realpathSync() before comparing:
// when this file is run via a symlink (e.g. node_modules/.bin/zd ->
// ../zendesk-cli/dist/index.js, exactly how `zd` is normally invoked),
// argv[1] is the symlink path but import.meta.url is Node's resolved real
// path — comparing them directly always mismatches and this check would
// silently never fire, i.e. the CLI would appear to do nothing.
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return (
      import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
    );
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  run(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
