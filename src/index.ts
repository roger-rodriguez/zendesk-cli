#!/usr/bin/env node

import { Command } from "commander";
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

import { ticketCmd } from "./commands/ticket";

function createProgram(): Command {
  const program = new Command();
  program.name("zd").description("CLI to manage Zendesk").version("1.0.0");
  program.addCommand(ticketCmd);
  // Throw a CommanderError instead of calling process.exit() on --help,
  // --version, or parse errors. Without this, any of those paths would
  // kill the caller's process outright when `run()` is imported and
  // invoked in-process instead of run as a standalone CLI.
  program.exitOverride();
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
