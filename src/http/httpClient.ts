// GuildPass SDK: Pull in package or module bindings.
import { GuildPassError } from '../errors/GuildPassError';
// GuildPass SDK: Import external module dependencies.
import { GuildPassErrorCode } from '../errors/errorCodes';
// GuildPass SDK: Pull in package or module bindings.
import { HttpRequestOptions, HttpResponse, HttpHooks, RequestHookPayload } from './http.types';

// GuildPass SDK: Exposed interface structure.
export class HttpClient {
  // GuildPass SDK: Class member structure property or constructor.
  private readonly baseUrl: string;
  // GuildPass SDK: Class member structure property or constructor.
  private readonly apiKey?: string;
  // GuildPass SDK: Class member structure property or constructor.
  private readonly timeoutMs: number;
  // GuildPass SDK: Class member structure property or constructor.
  private readonly hooks?: HttpHooks;

  // GuildPass SDK: Class member structure property or constructor.
  constructor(baseUrl: string, apiKey?: string, timeoutMs = 10000, hooks?: HttpHooks) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.hooks = hooks;
    // GuildPass SDK: End of logic containment structure block.
  }

  // GuildPass SDK: Class member structure property or constructor.
  public async get<T>(
    path: string,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    // GuildPass SDK: Variable binding initialization.
    const response = await this.request<T>(path, { ...options, method: 'GET' });
    // GuildPass SDK: Terminate function block execution and return.
    return response.data;
    // GuildPass SDK: End of logic containment structure block.
  }

  // GuildPass SDK: Class member structure property or constructor.
  public async post<T>(
    path: string,
    body?: any,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    // GuildPass SDK: Local block-scoped constant reference.
    const response = await this.request<T>(path, { ...options, method: 'POST', body });
    // GuildPass SDK: Send back computed results to the caller.
    return response.data;
    // GuildPass SDK: End of logic containment structure block.
  }

  // GuildPass SDK: Class member structure property or constructor.
  private async request<T>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse<T>> {
    // GuildPass SDK: Define internal reference identifier.
    const { method = 'GET', headers = {}, body, params, timeoutMs = this.timeoutMs } = options;

    // GuildPass SDK: Variable binding initialization.
    const startTime = Date.now();
    const hookPayload: RequestHookPayload = { method, path };

    if (this.hooks?.onRequest) {
      try {
        await this.hooks.onRequest(hookPayload);
      } catch (err) {
        console.error('GuildPass SDK: onRequest hook failed', err);
      }
    }

    // GuildPass SDK: Variable binding initialization.
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    // GuildPass SDK: Verify constraint requirements before proceeding.
    if (params) {
      // GuildPass SDK: Execution block boundary initialization.
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
        // GuildPass SDK: End of logic containment structure block.
      });
      // GuildPass SDK: End of logic containment structure block.
    }

    // GuildPass SDK: Local block-scoped constant reference.
    const controller = new AbortController();
    // GuildPass SDK: Define internal reference identifier.
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // GuildPass SDK: Variable binding initialization.
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
      // GuildPass SDK: End of logic containment structure block.
    };

    // GuildPass SDK: Evaluate branch condition logic.
    if (this.apiKey) {
      requestHeaders['X-API-Key'] = this.apiKey;
      // GuildPass SDK: End of logic containment structure block.
    }

    // GuildPass SDK: Execution block boundary initialization.
    try {
      // GuildPass SDK: Local block-scoped constant reference.
      const response = await fetch(url.toString(), {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        // GuildPass SDK: End of logic containment structure block.
      });

      clearTimeout(timeoutId);

      // GuildPass SDK: Conditional check guard path.
      if (!response.ok) {
        // GuildPass SDK: Define internal reference identifier.
        let errorData;
        // GuildPass SDK: Execution block boundary initialization.
        try {
          errorData = await response.json();
          // GuildPass SDK: Execution block boundary initialization.
        } catch {
          errorData = null;
          // GuildPass SDK: End of logic containment structure block.
        }
        throw GuildPassError.fromHttpError(response.status, errorData);
        // GuildPass SDK: End of logic containment structure block.
      }

      // GuildPass SDK: Variable binding initialization.
      const data = await response.json();
      const durationMs = Date.now() - startTime;

      if (this.hooks?.onResponse) {
        try {
          await this.hooks.onResponse({ ...hookPayload, status: response.status, durationMs });
        } catch (err) {
          console.error('GuildPass SDK: onResponse hook failed', err);
        }
      }
      // GuildPass SDK: Return evaluated output value.
      return {
        data,
        status: response.status,
        headers: response.headers,
        // GuildPass SDK: End of logic containment structure block.
      };
      // GuildPass SDK: Execution block boundary initialization.
    } catch (error: any) {
      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;
      let finalError = error;

      // GuildPass SDK: Verify constraint requirements before proceeding.
      if (error.name === 'AbortError') {
        finalError = new GuildPassError(
          `Request timed out after ${timeoutMs}ms`,
          GuildPassErrorCode.TIMEOUT,
        );
      } else if (!(error instanceof GuildPassError)) {
        finalError = new GuildPassError(
          error.message || 'Unknown network error',
          GuildPassErrorCode.HTTP_ERROR,
          undefined,
          error,
        );
      }

      // GuildPass SDK: Evaluate branch condition logic.
      if (this.hooks?.onError) {
        // GuildPass SDK: Execution block boundary initialization.
        try {
          await this.hooks.onError({ ...hookPayload, error: finalError, durationMs });
        } catch (hookErr) {
          console.error('GuildPass SDK: onError hook failed', hookErr);
          // GuildPass SDK: End of logic containment structure block.
        }
        // GuildPass SDK: End of logic containment structure block.
      }

      throw finalError;
    }
    // GuildPass SDK: End of logic containment structure block.
  }
  // GuildPass SDK: End of logic containment structure block.
}
