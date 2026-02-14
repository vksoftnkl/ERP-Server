import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.on('finish', () => {
      const durationInMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.log(
        `${request.method} ${request.originalUrl} ${response.statusCode} - ${durationInMs.toFixed(1)}ms`,
      );
    });

    next();
  }
}
