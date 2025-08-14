import { describe, it, expect } from "vitest";
import { collectKeyPaths, getPath } from "../utils/jsonPaths";
import { buildTicketSearchQuery } from "../utils/searchQuery";

describe("ticket command utilities", () => {
  it("collectKeyPaths should list nested keys and array markers", () => {
    const sample = {
      ticket: {
        id: 1,
        subject: "Hello",
        nested: { a: 1, b: { c: 2 } },
        arr: [{ x: 1, y: 2 }],
      },
      comments: [
        { id: 10, author_id: 1, body: "A" },
        { id: 11, author_id: 2, body: "B" },
      ],
    };

    const fields = Array.from(collectKeyPaths(sample)).sort();

    expect(fields).toContain("ticket");
    expect(fields).toContain("ticket.id");
    expect(fields).toContain("ticket.subject");
    expect(fields).toContain("ticket.nested");
    expect(fields).toContain("ticket.nested.a");
    expect(fields).toContain("ticket.nested.b");
    expect(fields).toContain("ticket.nested.b.c");
    expect(fields).toContain("ticket.arr");
    expect(fields).toContain("ticket.arr[]");
    expect(fields).toContain("ticket.arr[].x");
    expect(fields).toContain("comments");
    expect(fields).toContain("comments[]");
    expect(fields).toContain("comments[].id");
    expect(fields).toContain("comments[].author_id");
  });

  it("getPath should resolve dotted paths including array placeholders", () => {
    const sample = {
      ticket: {
        id: 1,
        subject: "Hello",
        arr: [{ x: 42 }],
      },
      comments: [{ id: 10, author_id: 1 }],
    };

    expect(getPath(sample, "ticket.id")).toBe(1);
    expect(getPath(sample, "ticket.arr[].x")).toBe(42);
    expect(getPath(sample, "comments[].id")).toBe(10);
    expect(getPath(sample, "missing.key")).toBeUndefined();
  });

  it("buildTicketSearchQuery emits defaults when no filters provided", () => {
    const { tokens, query } = buildTicketSearchQuery({});
    expect(tokens).toContain("type:ticket");
    expect(tokens).toContain("assignee:me");
    expect(tokens).toContain("status:new");
    expect(tokens).toContain("status:open");
    expect(tokens).toContain("status:pending");
    expect(tokens).toContain("status:on-hold");
    expect(query).toContain("type:ticket");
  });

  it("buildTicketSearchQuery respects explicit filters and quotes group names", () => {
    const { tokens, query } = buildTicketSearchQuery({
      group: "technical support",
      status: "open,pending",
    });
    // no default assignee when explicit filters exist
    expect(tokens.find((t) => t.startsWith("assignee:"))).toBeUndefined();
    expect(tokens).toContain('group:"technical support"');
    expect(tokens).toContain("status:open");
    expect(tokens).toContain("status:pending");
    expect(query).toContain('group:"technical support"');
  });
});
