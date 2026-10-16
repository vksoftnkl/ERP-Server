import { Controller, type MessageEvent, Req, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import type { AccessTokenPayload } from '../../modules/auth/token.service';
import { DataChangeService } from './data-change.service';

@ApiTags('Data Changes')
@ApiBearerAuth('access-token')
@Controller('data-changes')
export class DataChangesController {
  constructor(private readonly dataChangeService: DataChangeService) {}

  /**
   * Server-sent events: `change` after every successful write by another
   * session (`{ resource, method, at }`), a `ping` every 25 s, and `ready` once
   * on connect (`{ bootId, at }`). The web client re-reads whatever it has on screen on `change`,
   * so a record saved at one counter shows up at every other counter at once.
   *
   * Authenticated like any route (bearer token); the browser reads it with
   * `fetch`, since `EventSource` cannot send an Authorization header.
   */
  @Sse('stream')
  @SkipThrottle()
  @ApiOperation({ summary: 'Live feed of data changes made by other sessions' })
  stream(@Req() request: Request & { user?: AccessTokenPayload }): Observable<MessageEvent> {
    return this.dataChangeService.streamFor(request.user?.sid ?? null);
  }
}
