import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { OPS_ACTOR_HEADER, OPS_KEY_HEADER } from '../app-version.constants';
import { AppVersionErrorCode, appVersionErrorBody } from '../types/app-version-error-codes';

/**
 * The release and support APIs are for CI and support tools, not for signed-in
 * users. They carry no JWT. They need `X-Ops-Key` = env OPS_API_KEY instead.
 *
 *   OPS_API_KEY unset or blank  → 403 APP_VERSION_OPS_DISABLED  (switched off)
 *   header missing / wrong      → 401 APP_VERSION_OPS_KEY_INVALID
 *
 * The key is read on every call, so a restart picks up a change. The comparison
 * runs over SHA-256 digests, so it takes the same time whatever the length.
 */
@Injectable()
export class OpsKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = (this.configService.get<string>('OPS_API_KEY') ?? '').trim();
    if (!expected) {
      throw new ForbiddenException(
        appVersionErrorBody(
          'The ops API is disabled on this server (OPS_API_KEY is not set)',
          'x-ops-key',
          AppVersionErrorCode.OPS_DISABLED,
        ),
      );
    }
    const request = context.switchToHttp().getRequest<Request>();
    const presented = firstHeader(request.headers[OPS_KEY_HEADER]);
    if (!presented || !sameSecret(presented, expected)) {
      throw new UnauthorizedException(
        appVersionErrorBody(
          'Missing or invalid X-Ops-Key header',
          'x-ops-key',
          AppVersionErrorCode.OPS_KEY_INVALID,
        ),
      );
    }
    return true;
  }
}

/**
 * Who made an ops write, for *_created_by / *_modified_by: `ops:<X-Ops-Actor>`
 * when the caller names itself (letters, digits and . _ : @ / # -, up to 60
 * characters), else plain `ops`.
 */
export function opsActorOf(request: Pick<Request, 'headers'>): string {
  const actor = firstHeader(request.headers[OPS_ACTOR_HEADER]);
  return actor && /^[A-Za-z0-9._:@/#-]{1,60}$/.test(actor) ? `ops:${actor}` : 'ops';
}

function firstHeader(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

function sameSecret(presented: string, expected: string): boolean {
  const a = createHash('sha256').update(presented, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}
