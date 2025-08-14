import { Command } from "commander";
import chalk from "chalk";

import { ZendeskClient } from "../libs/zendesk";
import { collectKeyPaths, getPath } from "../utils/jsonPaths";

export const ticketCmd = new Command("ticket").description("Ticket command");

// path helpers moved to ../utils/jsonPaths

const viewTicketCmd = new Command("view")
  .description("Display the title, body, and other information about a ticket")
  .argument("<id>", "Ticket id")
  .option("-j, --json", "Output raw JSON")
  .option("-c, --comments", "Include ticket comments")
  .option("-w, --web", "Open the ticket in the browser")
  .option(
    "--fields <fields>",
    "Comma-separated fields to include in JSON output",
  )
  .option(
    "-t, --template <string>",
    "Format JSON output using a template expression",
  )
  .option(
    "--list-fields",
    "List available JSON field paths based on the fetched payload",
  )
  .action(
    async (
      id: string,
      options: {
        json?: boolean;
        comments?: boolean;
        web?: boolean;
        fields?: string;
        template?: string;
        listFields?: boolean;
      },
    ) => {
      let client: ZendeskClient;
      try {
        client = ZendeskClient.fromEnv();
      } catch (err) {
        console.error(
          chalk.red(
            `${(err as Error).message}\nExpected env: ZENDESK_SUB_DOMAIN and ZENDESK_API_KEY`,
          ),
        );
        process.exitCode = 1;
        return;
      }

      try {
        if (options.web) {
          const url = client.getAgentTicketUrl(id);
          await import("node:child_process").then(({ exec }) =>
            exec(
              `${process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"} ${url}`,
            ),
          );
          return;
        }

        const data = await client.getTicket(id);
        let payload: any = { ...data };

        if (options.comments) {
          const comments = await client.getTicketComments(id);
          payload = { ...payload, comments: comments.comments ?? [] };
        }

        if (options.listFields) {
          const root = payload.ticket ?? payload;
          const set = collectKeyPaths(root);
          if (payload.comments) {
            for (const p of collectKeyPaths(payload.comments, "comments"))
              set.add(p);
          }
          console.log(Array.from(set).sort().join("\n"));
          return;
        }

        if (options.json) {
          let output = payload;
          if (options.fields) {
            const requested = options.fields
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const root = payload.ticket ?? payload;
            const filtered: Record<string, unknown> = {};
            for (const path of requested) {
              const value = path.includes(".")
                ? getPath(payload, path)
                : root?.[path];
              if (value !== undefined) filtered[path] = value;
            }
            output = filtered;
          }
          // simple template replacement: {{field}}
          if (options.template && typeof output === "object") {
            const template = options.template;
            const root = payload.ticket ?? payload;
            const rendered = template.replace(
              /\{\{\s*([\w.]+)\s*\}\}/g,
              (_, path) => {
                const parts = String(path).split(".");
                let cur: any = root;
                for (const p of parts) cur = cur?.[p];
                return cur == null ? "" : String(cur);
              },
            );
            console.log(rendered);
            return;
          }
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        const t = payload.ticket ?? data.ticket;
        if (!t) {
          console.log(chalk.yellow("No ticket payload received."));
          return;
        }

        console.log(
          [
            `${chalk.bold("ID:")} ${t.id ?? "-"}`,
            `${chalk.bold("Subject:")} ${t.subject ?? "-"}`,
            `${chalk.bold("Status:")} ${t.status ?? "-"}`,
            `${chalk.bold("Priority:")} ${t.priority ?? "-"}`,
            `${chalk.bold("Assignee ID:")} ${t.assignee_id ?? "-"}`,
            `${chalk.bold("Requester ID:")} ${t.requester_id ?? "-"}`,
            `${chalk.bold("Created:")} ${t.created_at ?? "-"}`,
            `${chalk.bold("Updated:")} ${t.updated_at ?? "-"}`,
          ].join("\n"),
        );

        if (options.comments) {
          const comments = (payload.comments as unknown[]) ?? [];
          if (comments.length > 0) {
            console.log("\n" + chalk.bold("Comments:"));
            for (const c of comments as any[]) {
              console.log(
                [
                  `- ${chalk.bold(String(c.id ?? "-"))} by ${c.author_id ?? "-"} at ${c.created_at ?? "-"}`,
                  `  ${String(c.body ?? "").slice(0, 200)}`,
                ].join("\n"),
              );
            }
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
        process.exitCode = 1;
      }
    },
  );

ticketCmd.addCommand(viewTicketCmd);
