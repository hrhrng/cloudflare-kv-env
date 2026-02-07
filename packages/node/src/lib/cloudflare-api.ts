import type { KvListKeyItem } from "../types.js";

interface ApiError {
  code: number;
  message: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  errors: ApiError[];
  result: T;
  result_info?: {
    cursor?: string;
    page?: number;
    per_page?: number;
    count?: number;
    total_count?: number;
    total_pages?: number;
  };
}

interface VerifyTokenResult {
  id: string;
  status: string;
}

interface KvNamespaceSummary {
  id: string;
  title: string;
}

interface CloudflareApiClientOptions {
  requestTimeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  userAgent?: string;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfter(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) {
    return null;
  }

  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }

  const retryDate = Date.parse(retryAfterHeader);
  if (Number.isNaN(retryDate)) {
    return null;
  }

  const ms = retryDate - Date.now();
  if (ms <= 0) {
    return null;
  }

  return ms;
}

function jitteredExponentialBackoff(baseMs: number, attempt: number): number {
  const exponential = baseMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * baseMs);
  return Math.min(exponential + jitter, 30_000);
}

function normalizeHeaders(input?: HeadersInit): Record<string, string> {
  if (!input) {
    return {};
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input);
  }
  if (input instanceof Headers) {
    const result: Record<string, string> = {};
    for (const [key, value] of input.entries()) {
      result[key] = value;
    }
    return result;
  }
  return { ...input };
}

export class CloudflareApiClient {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly baseUrl = "https://api.cloudflare.com/client/v4";
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly userAgent: string;

  constructor(input: { accountId: string; apiToken: string } & CloudflareApiClientOptions) {
    this.accountId = input.accountId;
    this.apiToken = input.apiToken;
    this.requestTimeoutMs = input.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxRetries = input.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = input.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.userAgent = input.userAgent ?? "cfenv-kv-sync/0.1.0";
  }

  async verifyToken(): Promise<VerifyTokenResult> {
    const url = `${this.baseUrl}/user/tokens/verify`;
    return this.requestJson<VerifyTokenResult>(url, { method: "GET" });
  }

  async putValue(namespaceId: string, key: string, value: string): Promise<void> {
    const url = this.accountUrl(`/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/values/${encodeURIComponent(key)}`);
    const response = await this.executeFetch(url, {
      method: "PUT",
      headers: this.authHeaders({
        "Content-Type": "text/plain; charset=utf-8"
      }),
      body: value
    });

    if (!response.ok) {
      throw new Error(await this.extractError(response));
    }
  }

  async getValue(namespaceId: string, key: string): Promise<string | null> {
    const url = this.accountUrl(`/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/values/${encodeURIComponent(key)}`);
    const response = await this.executeFetch(url, {
      method: "GET",
      headers: this.authHeaders()
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await this.extractError(response));
    }
    return response.text();
  }

  async deleteValue(namespaceId: string, key: string): Promise<void> {
    const url = this.accountUrl(`/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/values/${encodeURIComponent(key)}`);
    const response = await this.executeFetch(url, {
      method: "DELETE",
      headers: this.authHeaders()
    });

    if (!response.ok) {
      throw new Error(await this.extractError(response));
    }
  }

  async listKeys(namespaceId: string, prefix: string, limit = 1000): Promise<KvListKeyItem[]> {
    const results: KvListKeyItem[] = [];
    let cursor: string | undefined;

    do {
      const url = new URL(
        this.accountUrl(`/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/keys`)
      );
      url.searchParams.set("prefix", prefix);
      url.searchParams.set("limit", String(limit));
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const response = await this.requestEnvelope<KvListKeyItem[]>(url.toString(), { method: "GET" });
      results.push(...response.result);
      cursor = response.result_info?.cursor;
    } while (cursor);

    return results;
  }

  async listNamespaces(perPage = 100): Promise<KvNamespaceSummary[]> {
    const results: KvNamespaceSummary[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = new URL(this.accountUrl("/storage/kv/namespaces"));
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(perPage));

      const response = await this.requestEnvelope<KvNamespaceSummary[]>(url.toString(), { method: "GET" });
      results.push(...response.result);
      totalPages = response.result_info?.total_pages ?? page;
      page += 1;
    }

    return results;
  }

  async createNamespace(title: string): Promise<KvNamespaceSummary> {
    if (!title.trim()) {
      throw new Error("Namespace title cannot be empty.");
    }

    const url = this.accountUrl("/storage/kv/namespaces");
    return this.requestJson<KvNamespaceSummary>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title })
    });
  }

  private accountUrl(pathname: string): string {
    return `${this.baseUrl}/accounts/${encodeURIComponent(this.accountId)}${pathname}`;
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "User-Agent": this.userAgent,
      ...extra
    };
  }

  private async requestJson<T>(url: string, init: RequestInit): Promise<T> {
    const envelope = await this.requestEnvelope<T>(url, init);
    return envelope.result;
  }

  private async requestEnvelope<T>(url: string, init: RequestInit): Promise<ApiEnvelope<T>> {
    const response = await this.executeFetch(url, {
      ...init,
      headers: this.authHeaders(normalizeHeaders(init.headers))
    });

    let payload: ApiEnvelope<T>;
    try {
      payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
      throw new Error(`Cloudflare API returned non-JSON response (${response.status}).`);
    }

    if (!response.ok || !payload.success) {
      const apiMessage = payload.errors?.map((err) => err.message).join("; ");
      throw new Error(apiMessage || `Cloudflare API request failed with HTTP ${response.status}.`);
    }

    return payload;
  }

  private async executeFetch(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!this.shouldRetryResponse(response) || attempt >= this.maxRetries) {
          return response;
        }

        const waitMs = parseRetryAfter(response.headers.get("retry-after"))
          ?? jitteredExponentialBackoff(this.retryBaseDelayMs, attempt);
        await sleep(waitMs);
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        if (!this.shouldRetryError(error) || attempt >= this.maxRetries) {
          throw this.toNetworkError(error);
        }

        const waitMs = jitteredExponentialBackoff(this.retryBaseDelayMs, attempt);
        await sleep(waitMs);
      }
    }

    throw this.toNetworkError(lastError);
  }

  private shouldRetryResponse(response: Response): boolean {
    return response.status === 408 || response.status === 429 || response.status >= 500;
  }

  private shouldRetryError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    if (error.name === "AbortError") {
      return true;
    }

    // Undici/network failures in Node fetch commonly show as TypeError.
    if (error instanceof TypeError) {
      return true;
    }

    return /fetch failed|network/i.test(error.message);
  }

  private toNetworkError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return new Error(`Cloudflare API request timed out after ${this.requestTimeoutMs}ms.`);
      }
      return new Error(`Cloudflare API network error: ${error.message}`);
    }
    return new Error("Cloudflare API network error.");
  }

  private async extractError(response: Response): Promise<string> {
    try {
      const payload = (await response.json()) as ApiEnvelope<unknown>;
      const apiMessage = payload.errors?.map((err) => err.message).join("; ");
      if (apiMessage) {
        return apiMessage;
      }
    } catch {
      const text = await response.text().catch(() => "");
      if (text) {
        return text;
      }
    }

    return `Cloudflare API request failed with HTTP ${response.status}.`;
  }
}
