import { CallHandler, ExecutionContext, RequestTimeoutException } from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { NEVER, Observable, firstValueFrom, of, throwError } from 'rxjs';
import { TimeoutInterceptor } from './timeout.interceptor';

const plainHandler = () => undefined;
const sseHandler = () => undefined;
Reflect.defineMetadata(SSE_METADATA, true, sseHandler);

const contextFor = (handler: () => unknown) =>
  ({ getHandler: () => handler }) as unknown as ExecutionContext;
const handling = (source: Observable<unknown>): CallHandler => ({ handle: () => source });

describe('TimeoutInterceptor', () => {
  const interceptor = new TimeoutInterceptor();

  afterEach(() => jest.useRealTimers());

  it('passes a response that arrives in time straight through', async () => {
    await expect(
      firstValueFrom(interceptor.intercept(contextFor(plainHandler), handling(of({ ok: 1 })))),
    ).resolves.toEqual({ ok: 1 });
  });

  it('turns 15 s of silence into a 408 RequestTimeoutException', async () => {
    jest.useFakeTimers();
    const result = firstValueFrom(interceptor.intercept(contextFor(plainHandler), handling(NEVER)));

    jest.advanceTimersByTime(15_000);

    await expect(result).rejects.toBeInstanceOf(RequestTimeoutException);
    await expect(result).rejects.toThrow('Request timed out');
  });

  it('does not fire a millisecond early', () => {
    jest.useFakeTimers();
    const errors: unknown[] = [];
    const subscription = interceptor
      .intercept(contextFor(plainHandler), handling(NEVER))
      .subscribe({ error: (e: unknown) => errors.push(e) });

    jest.advanceTimersByTime(14_999);
    expect(errors).toEqual([]);

    subscription.unsubscribe();
  });

  it("rethrows the handler's own error untouched", async () => {
    const own = new Error('db down');

    await expect(
      firstValueFrom(
        interceptor.intercept(
          contextFor(plainHandler),
          handling(throwError(() => own)),
        ),
      ),
    ).rejects.toBe(own);
  });

  // common/data-changes: an SSE stream stays open and quiet for long stretches.
  it('leaves a server-sent-events handler without a timeout', () => {
    const source = NEVER;

    expect(interceptor.intercept(contextFor(sseHandler), handling(source))).toBe(source);
  });
});
