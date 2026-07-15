import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

interface IncomingRequest {
  url: string;
  originalUrl?: string;
  method: string;
}

interface OutgoingResponse {
  headersSent: boolean;
  status(code: number): OutgoingResponse;
  json(body: unknown): OutgoingResponse;
}

interface ErrorEvent {
  service: string;
  message: string;
  stack: string;
  route: string;
  method: string;
  timestamp: string;
  requestId: string;
  meta: { statusCode: number };
}

/**
 * Global exception filter. Catches every unhandled exception, logs it through
 * Nest, fire-and-forget POSTs an ErrorEvent to RESPONDER_WEBHOOK_URL, and
 * returns a normal error JSON to the client. Reporting failures are logged and
 * swallowed — this filter must NEVER crash the app or block the response.
 */
@Catch()
export class ErrorReporterFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorReporter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<IncomingRequest>();
    const response = ctx.getResponse<OutgoingResponse>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? (exception.stack ?? '') : '';
    const route = request.originalUrl ?? request.url;
    const requestId = randomUUID();

    // 1) Always log through Nest — a global filter replaces Nest's default
    //    exception logging, so we must log it ourselves AND report it.
    this.logger.error(
      `${request.method} ${route} -> ${statusCode}: ${message}`,
      stack,
    );

    // 2) Fire-and-forget report. Never awaited, never allowed to throw.
    this.report({
      service: process.env.SERVICE_NAME ?? 'mini-shop',
      message,
      stack,
      route,
      method: request.method,
      timestamp: new Date().toISOString(),
      requestId,
      meta: { statusCode },
    });

    // 3) Normal error JSON to the client.
    const body =
      exception instanceof HttpException
        ? this.asObject(exception.getResponse())
        : {
            statusCode,
            error: 'Internal Server Error',
            message: 'Internal server error',
          };
    if (!response.headersSent) {
      response.status(statusCode).json({ ...body, requestId });
    }
  }

  private asObject(res: string | object): Record<string, unknown> {
    return typeof res === 'string' ? { message: res } : (res as Record<string, unknown>);
  }

  private report(event: ErrorEvent): void {
    const url = process.env.RESPONDER_WEBHOOK_URL;
    if (!url) {
      this.logger.warn(
        'RESPONDER_WEBHOOK_URL not set — skipping incident report.',
      );
      return;
    }
    // Guard the synchronous part too: a bad URL can throw before the promise.
    try {
      void fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      }).catch((err: unknown) => {
        this.logger.warn(
          `Failed to report incident ${event.requestId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    } catch (err) {
      this.logger.warn(
        `Failed to dispatch incident ${event.requestId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
