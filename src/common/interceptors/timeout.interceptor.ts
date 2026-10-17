import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private static readonly REQUEST_TIMEOUT_MS = 15000;
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // A server-sent-events stream is meant to stay open (see
    // common/data-changes); the timeout would cut it after 15 s of quiet.
    if (Reflect.getMetadata(SSE_METADATA, context.getHandler()) === true) {
      return next.handle();
    }
    return next.handle().pipe(
      timeout(TimeoutInterceptor.REQUEST_TIMEOUT_MS),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('Request timed out'));
        }
        return throwError(() => error);
      }),
    );
  }
}
