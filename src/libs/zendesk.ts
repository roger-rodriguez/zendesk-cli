import { getConfig } from "./config";

export interface ZendeskCredentials {
  subdomain: string;
  apiToken?: string;
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
  private readonly apiToken?: string;
  private readonly oauthToken?: string;

  constructor(credentials: ZendeskCredentials) {
    if (!credentials.apiToken && !credentials.oauthToken) {
      throw new Error("Either apiToken or oauthToken must be provided");
    }
    this.subdomain = credentials.subdomain;
    this.apiToken = credentials.apiToken;
    this.oauthToken = credentials.oauthToken;
  }

  static fromEnv(): ZendeskClient {
    const cfg = getConfig();
    return new ZendeskClient({
      subdomain: cfg.ZENDESK_SUB_DOMAIN,
      apiToken: cfg.ZENDESK_API_KEY,
      oauthToken: cfg.ZENDESK_OAUTH_TOKEN,
    });
  }

  async getTicket(ticketId: string | number): Promise<TicketResponse> {
    const url = `https://${this.subdomain}.zendesk.com/api/v2/tickets/${encodeURIComponent(
      String(ticketId),
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
        }`,
      );
    }

    const data = (await response.json()) as TicketResponse;
    return data;
  }

  async getTicketComments(
    ticketId: string | number,
  ): Promise<TicketCommentsResponse> {
    const url = `https://${this.subdomain}.zendesk.com/api/v2/tickets/${encodeURIComponent(
      String(ticketId),
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
        }`,
      );
    }

    const data = (await response.json()) as TicketCommentsResponse;
    return data;
  }

  getAgentTicketUrl(ticketId: string | number): string {
    return `https://${this.subdomain}.zendesk.com/agent/tickets/${encodeURIComponent(
      String(ticketId),
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
    if (params.sortBy) {
      // Zendesk's sort_by only accepts updated_at, created_at, priority,
      // status, or ticket_type — map our short CLI-facing names to those.
      const sortByMap: Record<string, string> = {
        created: "created_at",
        updated: "updated_at",
        priority: "priority",
      };
      qp.set("sort_by", sortByMap[params.sortBy] ?? params.sortBy);
    }
    if (params.order) qp.set("sort_order", params.order);

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
        }`,
      );
    }

    const data = (await response.json()) as TicketSearchResponse;
    return data;
  }

  async getGroupIdByName(name: string): Promise<number | undefined> {
    // Use incremental search for groups; match by case-insensitive name
    const url = `https://${this.subdomain}.zendesk.com/api/v2/groups/search.json?query=${encodeURIComponent(
      name,
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
      (g) => g.name.toLowerCase() === name.toLowerCase(),
    );
    return found?.id;
  }

  toWebSearchUrl(query: string): string {
    const q = encodeURIComponent(query);
    return `https://${this.subdomain}.zendesk.com/agent/search/1?query=${q}`;
  }

  private getAuthorizationHeader(): string {
    if (this.oauthToken) {
      return `Bearer ${this.oauthToken}`;
    }
    return `Basic ${this.apiToken}`;
  }
}
