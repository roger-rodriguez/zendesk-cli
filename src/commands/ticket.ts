import { Command } from "commander";
import chalk from "chalk";

import { ZendeskClient } from "../libs/zendesk";
import { collectKeyPaths, getPath } from "../utils/jsonPaths";
import { buildTicketSearchQuery } from "../utils/searchQuery";

export const ticketCmd = new Command("ticket").description("Ticket command");

const listTicketCmd = new Command("list")
  .description("List tickets using Zendesk search filters")
  .option("--assignee <me|email|id>", "Filter by assignee")
  .option("--group <id|name>", "Filter by group")
  .option(
    "--status <list>",
    "Comma separated statuses: new,open,pending,on-hold,solved,closed"
  )
  .option("--updated-since <ISO>", "Only tickets updated since ISO date")
  .option("--query <string>", "Additional free-text query")
  .option("--sort <field>", "Sort by created|updated|priority", "updated")
  .option("--order <order>", "asc|desc", "desc")
  .option("--limit <N>", "Results per page", "30")
  .option("--page <N>", "Page number", "1")
  .option("-j, --json", "Output raw JSON")
  .option("--fields <fields>", "Comma-separated fields for JSON output")
  .option("-t, --template <string>", "Format JSON using a template")
  .option("-w, --web", "Open the search in the browser")
  .action(async (options) => {
    let client: ZendeskClient;
    try {
      client = ZendeskClient.fromEnv();
    } catch (err) {
      console.error(
        chalk.red(
          `${(err as Error).message}\nExpected env: ZENDESK_SUB_DOMAIN and ZENDESK_API_KEY`
        )
      );
      process.exitCode = 1;
      return;
    }

    // Resolve group name to id if possible, otherwise leave it to the query builder to quote
    let groupFilter: string | undefined = options.group;
    if (groupFilter && !/^\d+$/.test(String(groupFilter))) {
      const resolved = await client.getGroupIdByName(String(groupFilter));
      if (resolved) groupFilter = String(resolved);
    }

    const { query } = buildTicketSearchQuery({
      assignee: options.assignee,
      group: groupFilter ?? options.group,
      status: options.status,
      updatedSince: options.updatedSince,
      query: options.query,
    });

    if (options.web) {
      const url = client.toWebSearchUrl(query);
      await import("node:child_process").then(({ exec }) =>
        exec(
          `${process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"} ${url}`
        )
      );
      return;
    }

    const sortBy = ["created", "updated", "priority"].includes(
      String(options.sort)
    )
      ? (options.sort as "created" | "updated" | "priority")
      : "updated";
    const order = String(options.order) === "asc" ? "asc" : "desc";
    const perPage = Number.parseInt(String(options.limit), 10) || 30;
    const page = Number.parseInt(String(options.page), 10) || 1;

    const result = await client.searchTickets({
      query,
      page,
      perPage,
      sortBy,
      order,
    });

    if (options.json) {
      const payload: any = result;
      if (options.fields) {
        const requested = String(options.fields)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const filtered = result.results.map((r) => {
          const out: Record<string, unknown> = {};
          for (const f of requested) {
            if (f in r) out[f] = (r as any)[f];
          }
          return out;
        });
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    // Pretty table-like output
    const rows = result.results.map((r) => {
      const cols = [
        String(r.id ?? "-").padEnd(8),
        String(r.status ?? "-").padEnd(9),
        String(r.priority ?? "-").padEnd(8),
        String(r.assignee_id ?? "-").padEnd(12),
        String(r.updated_at ?? "-").padEnd(24),
        String(r.subject ?? "-")
          .replace(/\n/g, " ")
          .slice(0, 80),
      ];
      return cols.join("  ");
    });
    if (rows.length === 0) {
      console.log(chalk.yellow("No tickets found."));
      return;
    }
    console.log(
      [
        [
          "ID".padEnd(8),
          "STATUS".padEnd(9),
          "PRIORITY".padEnd(8),
          "ASSIGNEE".padEnd(12),
          "UPDATED AT".padEnd(24),
          "SUBJECT",
        ].join("  "),
        ...rows,
      ].join("\n")
    );
  });
// path helpers moved to ../utils/jsonPaths

const viewTicketCmd = new Command("view")
  .description("Display the title, body, and other information about a ticket")
  .argument("<id>", "Ticket id")
  .option("-j, --json", "Output raw JSON")
  .option("-c, --comments", "Include ticket comments")
  .option("-w, --web", "Open the ticket in the browser")
  .option(
    "--fields <fields>",
    "Comma-separated fields to include in JSON output"
  )
  .option(
    "-t, --template <string>",
    "Format JSON output using a template expression"
  )
  .option(
    "--list-fields",
    "List available JSON field paths based on the fetched payload"
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
      }
    ) => {
      let client: ZendeskClient;
      try {
        client = ZendeskClient.fromEnv();
      } catch (err) {
        console.error(
          chalk.red(
            `${(err as Error).message}\nExpected env: ZENDESK_SUB_DOMAIN and ZENDESK_API_KEY`
          )
        );
        process.exitCode = 1;
        return;
      }

      try {
        if (options.web) {
          const url = client.getAgentTicketUrl(id);
          await import("node:child_process").then(({ exec }) =>
            exec(
              `${process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"} ${url}`
            )
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
              }
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
          ].join("\n")
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
                ].join("\n")
              );
            }
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
        process.exitCode = 1;
      }
    }
  );

ticketCmd.addCommand(viewTicketCmd);
ticketCmd.addCommand(listTicketCmd);
