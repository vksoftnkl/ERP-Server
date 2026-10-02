import { Injectable } from '@nestjs/common';

export interface GstHttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

export interface GstHttpResponse {
  status: number;
  text: string;
}

/** A call that got no HTTP reply at all: the outcome upstream is unknown. */
export class GstHttpError extends Error {
  constructor(
    readonly kind: 'TIMEOUT' | 'NETWORK',
    message: string,
  ) {
    super(message);
  }
}

/**
 * The one door to the network. Everything about a call — URL, headers, body,
 * timeout — is decided by the caller from the endpoint rows; this only sends
 * it. A provider so tests can swap it for a scripted portal.
 */
@Injectable()
export class GstHttpClient {
  async send(request: GstHttpRequest): Promise<GstHttpResponse> {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(request.timeoutMs),
      });
      return { status: response.status, text: await response.text() };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new GstHttpError('TIMEOUT', `No reply within ${request.timeoutMs} ms`);
      }
      const cause = (error as { cause?: { message?: string } })?.cause?.message;
      throw new GstHttpError(
        'NETWORK',
        `Could not reach ${new URL(request.url).host}: ${cause ?? (error instanceof Error ? error.message : String(error))}`,
      );
    }
  }
}
