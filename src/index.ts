#!/usr/bin/env node

import { Command } from "commander";

import { ticketCmd } from "./commands/ticket";

const program = new Command();

program.name("zd").description("CLI to manage Zendesk").version("1.0.0");

program.addCommand(ticketCmd);

// Parse the arguments passed to the script
program.parse(process.argv);
