import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';
import { withUserWordingOnNotes, wordingLangOf } from '../../common/error-wording/error-wording';

/**
 * Notes 120 — a success body whose data carries `warnings[]` / `refusals[]`
 * (every /validate answer, a post that went through with warnings): each note
 * with a code gets its `user` block, as an error does in the filters.
 */
@Injectable()
export class ErrorWordingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const lang = wordingLangOf(context.switchToHttp().getRequest<Request>());
    return next.handle().pipe(map((body: unknown) => withUserWordingOnNotes(body, lang)));
  }
}
