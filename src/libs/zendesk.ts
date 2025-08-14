import { getConfig } from "./config";

export interface ZendeskCredentials {
  subdomain: string;
  apiToken: string;
  oauthToken?: string;
}

export interface TicketShape {
  id?: number;
  subject?: string;
  status?: string;
  priority?: string | null;
  assignee_id?: number | null;
  requester_id?: number | null;
  updated_at?: string;
  created_at?: string;
  description?: string | null;
}

export interface TicketResponse {
  ticket?: TicketShape;
}

export interface TicketCommentShape {
  id?: number;
  body?: string;
  html_body?: string | null;
  public?: boolean;
  author_id?: number;
  created_at?: string;
  attachments?: Array<{
    id?: number;
    file_name?: string;
    content_url?: string;
    size?: number;
    content_type?: string;
  }>;
}

export interface TicketCommentsResponse {
  comments?: TicketCommentShape[];
}

export interface SearchTicketShape {
  id?: number;
  subject?: string;
  status?: string;
  priority?: string | null;
  assignee_id?: number | null;
  requester_id?: number | null;
  group_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface TicketSearchResponse {
  results: SearchTicketShape[];
  next_page?: string | null;
  previous_page?: string | null;
  count?: number;
}

export class ZendeskClient {
  private readonly subdomain: string;
  private readonly apiToken: string;

  constructor(credentials: ZendeskCredentials) {
    this.subdomain = credentials.subdomain;
    this.apiToken = credentials.apiToken;
  }

  static fromEnv(): ZendeskClient {
    const cfg = getConfig();
    const subdomain = cfg.ZENDESK_SUB_DOMAIN;
    const apiToken = cfg.ZENDESK_API_KEY;

    if (!subdomain) {
      throw new Error(
        "Missing required environment variable: ZENDESK_SUB_DOMAIN"
      );
    }

    if (!apiToken) {
      throw new Error("Missing required environment variable: ZENDESK_API_KEY");
    }

    return new ZendeskClient({ subdomain, apiToken });
  }

  async getTicket(ticketId: string | number): Promise<TicketResponse> {
    const url = `https://${this.subdomain}.zendesk.com/api/v2/tickets/${encodeURIComponent(
      String(ticketId)
    )}.json`;

    const response = await fetch(url, {
      headers: {
        Authorization: this.getAuthorizationHeader(),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(
        `Zendesk request failed (${response.status} ${response.statusText})${
          bodyText ? `: ${bodyText}` : ""
        }`
      );
    }

    const data = (await response.json()) as TicketResponse;
    return data;
  }

  async getTicketComments(
    ticketId: string | number
  ): Promise<TicketCommentsResponse> {
    const url = `https://${this.subdomain}.zendesk.com/api/v2/tickets/${encodeURIComponent(
      String(ticketId)
    )}/comments.json`;

    const response = await fetch(url, {
      headers: {
        Authorization: this.getAuthorizationHeader(),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(
        `Zendesk request failed (${response.status} ${response.statusText})${
          bodyText ? `: ${bodyText}` : ""
        }`
      );
    }

    const data = (await response.json()) as TicketCommentsResponse;
    return data;
  }

  getAgentTicketUrl(ticketId: string | number): string {
    return `https://${this.subdomain}.zendesk.com/agent/tickets/${encodeURIComponent(
      String(ticketId)
    )}`;
  }

  async searchTickets(params: {
    query: string;
    page?: number;
    perPage?: number;
    sortBy?: "created" | "updated" | "priority";
    order?: "asc" | "desc";
  }): Promise<TicketSearchResponse> {
    const qp = new URLSearchParams();
    qp.set("query", params.query);
    if (params.page) qp.set("page", String(params.page));
    if (params.perPage) qp.set("per_page", String(params.perPage));
    if (params.sortBy) qp.set("order_by", params.sortBy);
    if (params.order) qp.set("sort", params.order);

    const url = `https://${this.subdomain}.zendesk.com/api/v2/search.json?${qp.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: this.getAuthorizationHeader(),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(
        `Zendesk request failed (${response.status} ${response.statusText})${
          bodyText ? `: ${bodyText}` : ""
        }`
      );
    }

    const data = (await response.json()) as TicketSearchResponse;
    return data;
  }

  async getGroupIdByName(name: string): Promise<number | undefined> {
    // Use incremental search for groups; match by case-insensitive name
    const url = `https://${this.subdomain}.zendesk.com/api/v2/groups/search.json?query=${encodeURIComponent(
      name
    )}`;
    const response = await fetch(url, {
      headers: {
        Authorization: this.getAuthorizationHeader(),
        Accept: "application/json",
      },
    });

    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      groups?: Array<{ id: number; name: string }>;
      next_page?: string | null;
    };
    const groups = body.groups ?? [];
    const found = groups.find(
      (g) => g.name.toLowerCase() === name.toLowerCase()
    );
    return found?.id;
  }

  toWebSearchUrl(query: string): string {
    const q = encodeURIComponent(query);
    return `https://${this.subdomain}.zendesk.com/agent/search/1?query=${q}`;
  }

  private getAuthorizationHeader(): string {
    return `Basic ${this.apiToken}`;
  }
}
