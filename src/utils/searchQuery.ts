export interface TicketListFlagsLike {
  assignee?: string | undefined;
  group?: string | undefined; // accepts id or name; name will be quoted if contains spaces
  status?: string | undefined; // comma-separated
  updatedSince?: string | undefined; // ISO date
  query?: string | undefined; // free text
}

/**
 * Build Zendesk search tokens and query string mirroring the CLI behavior.
 * - Always includes `type:ticket`
 * - If no other filters provided, defaults to `assignee:me` and open-ish statuses
 * - Multiple statuses are emitted as repeated `status:` tokens (OR behavior)
 * - Group names with spaces are quoted
 */
export function buildTicketSearchQuery(flags: TicketListFlagsLike): {
  tokens: string[];
  query: string;
} {
  const tokens: string[] = ["type:ticket"];

  const hasExplicitFilter = Boolean(
    flags.assignee ||
      flags.group ||
      flags.status ||
      flags.updatedSince ||
      flags.query
  );

  // assignee
  if (flags.assignee) {
    const a = String(flags.assignee).trim();
    if (a.toLowerCase() === "me") tokens.push("assignee:me");
    else if (/^\d+$/.test(a)) tokens.push(`assignee:${a}`);
    else tokens.push(`assignee:${a}`); // email
  } else if (!hasExplicitFilter) {
    tokens.push("assignee:me");
  }

  // status
  const statusList: string[] = flags.status
    ? String(flags.status)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : hasExplicitFilter
      ? []
      : ["new", "open", "pending", "on-hold"]; // default open-ish only when no explicit filters

  for (const s of statusList) tokens.push(`status:${s}`);

  // group
  if (flags.group) {
    const g = String(flags.group).trim();
    if (/^\d+$/.test(g)) tokens.push(`group:${g}`);
    else tokens.push(`group:"${g.replaceAll('"', '\\"')}"`);
  }

  if (flags.updatedSince) tokens.push(`updated>=${flags.updatedSince}`);
  if (flags.query) tokens.push(String(flags.query));

  return { tokens, query: tokens.join(" ") };
}
