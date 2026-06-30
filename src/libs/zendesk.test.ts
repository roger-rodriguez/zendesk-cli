import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZendeskClient } from "./zendesk";

// Capture the Authorization header sent by any fetch call
function mockFetchWithResponse(body: unknown, status = 200) {
  const capturedHeaders: Record<string, string> = {};
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  // Wrap so we can inspect what headers were passed
  const spy = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    Object.assign(capturedHeaders, headers);
    return fetchMock(url, init);
  });

  return { spy, capturedHeaders };
}

describe("ZendeskClient constructor", () => {
  it("throws when neither apiToken nor oauthToken is provided", () => {
    expect(
      () => new ZendeskClient({ subdomain: "acme" })
    ).toThrow("Either apiToken or oauthToken must be provided");
  });

  it("accepts apiToken alone", () => {
    expect(
      () => new ZendeskClient({ subdomain: "acme", apiToken: "key123" })
    ).not.toThrow();
  });

  it("accepts oauthToken alone", () => {
    expect(
      () => new ZendeskClient({ subdomain: "acme", oauthToken: "tok123" })
    ).not.toThrow();
  });

  it("accepts both apiToken and oauthToken", () => {
    expect(
      () =>
        new ZendeskClient({
          subdomain: "acme",
          apiToken: "key123",
          oauthToken: "tok123",
        })
    ).not.toThrow();
  });
});

describe("ZendeskClient Authorization header", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Basic header when using apiToken", async () => {
    const { capturedHeaders } = mockFetchWithResponse({ ticket: { id: 1 } });
    const client = new ZendeskClient({ subdomain: "acme", apiToken: "mykey" });
    await client.getTicket(1);
    expect(capturedHeaders["Authorization"]).toBe("Basic mykey");
  });

  it("sends Bearer header when using oauthToken", async () => {
    const { capturedHeaders } = mockFetchWithResponse({ ticket: { id: 1 } });
    const client = new ZendeskClient({ subdomain: "acme", oauthToken: "mytoken" });
    await client.getTicket(1);
    expect(capturedHeaders["Authorization"]).toBe("Bearer mytoken");
  });

  it("prefers oauthToken over apiToken when both are present", async () => {
    const { capturedHeaders } = mockFetchWithResponse({ ticket: { id: 1 } });
    const client = new ZendeskClient({
      subdomain: "acme",
      apiToken: "mykey",
      oauthToken: "mytoken",
    });
    await client.getTicket(1);
    expect(capturedHeaders["Authorization"]).toBe("Bearer mytoken");
  });
});
