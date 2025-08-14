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
        "Missing required environment variable: ZENDESK_SUB_DOMAIN",
      );
    }

    if (!apiToken) {
      throw new Error("Missing required environment variable: ZENDESK_API_KEY");
    }

    return new ZendeskClient({ subdomain, apiToken });
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

  private getAuthorizationHeader(): string {
    return `Basic ${this.apiToken}`;
  }
}
