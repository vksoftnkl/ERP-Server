import { Injectable, NestMiddleware } from '@nestjs/common';
import { isIP } from 'node:net';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from '../request-context/request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    this.requestContextService.run(
      {
        ipAddress: this.extractClientIp(request),
        userId: this.extractUserIdHeader(request),
      },
      next,
    );
  }

  private extractClientIp(request: Request): string | null {
    const headerValue = request.headers['x-forwarded-for'];
    if (typeof headerValue === 'string') {
      const firstForwardedIp = headerValue
        .split(',')
        .map((value) => value.trim())
        .find((value) => value.length > 0);
      const normalizedForwardedIp = this.normalizeIpAddress(firstForwardedIp);
      if (normalizedForwardedIp) {
        return normalizedForwardedIp;
      }
    }

    const realIpHeader = request.headers['x-real-ip'];
    if (typeof realIpHeader === 'string') {
      const normalizedRealIp = this.normalizeIpAddress(realIpHeader.trim());
      if (normalizedRealIp) {
        return normalizedRealIp;
      }
    }

    const directIp =
      this.normalizeIpAddress(request.ip) ?? this.normalizeIpAddress(request.socket.remoteAddress);
    return directIp ?? null;
  }

  private extractUserIdHeader(request: Request): string | null {
    const headerValue = request.headers['x-user-id'];
    if (typeof headerValue !== 'string') {
      return null;
    }

    const trimmed = headerValue.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeIpAddress(ipAddress: string | undefined): string | null {
    if (!ipAddress) {
      return null;
    }

    const normalizedIp = ipAddress.trim().replace(/^\[|\]$/g, '');
    if (!normalizedIp) {
      return null;
    }

    return isIP(normalizedIp) === 0 ? null : normalizedIp;
  }
}
