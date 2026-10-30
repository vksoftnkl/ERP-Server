import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { DataChangeService } from '../data-changes/data-change.service';
import { CacheInvalidationService } from '../redis/cache-invalidation.service';
import { HttpCacheInvalidationInterceptor } from './http-cache-invalidation.interceptor';

const contextFor = (method: string, originalUrl: string, sid: string | null = 'sid-a') =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method, originalUrl, user: sid ? { sid } : undefined }),
    }),
  }) as unknown as ExecutionContext;

const handlerReturning = (value: unknown): CallHandler => ({ handle: () => of(value) });

describe('HttpCacheInvalidationInterceptor', () => {
  let order: string[];
  let invalidatePattern: jest.Mock;
  let publish: jest.Mock;
  let interceptor: HttpCacheInvalidationInterceptor;

  beforeEach(() => {
    order = [];
    invalidatePattern = jest.fn(async () => {
      order.push('purge');
    });
    publish = jest.fn(() => {
      order.push('publish');
    });
    interceptor = new HttpCacheInvalidationInterceptor(
      { invalidatePattern } as unknown as CacheInvalidationService,
      { publish } as unknown as DataChangeService,
    );
  });

  it('purges the whole cache and announces the write before releasing the response', async () => {
    const response = await firstValueFrom(
      interceptor.intercept(
        contextFor('POST', '/api/v1/customers/create'),
        handlerReturning({ ok: 1 }),
      ),
    );
    order.push('response');

    expect(response).toEqual({ ok: 1 });
    // Every cached read, not just /customers*: grid/dropdown/lookup reads span tables.
    expect(invalidatePattern).toHaveBeenCalledWith('*');
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'customers', method: 'POST', originSessionId: 'sid-a' }),
    );
    expect(order).toEqual(['purge', 'publish', 'response']);
  });

  it.each([
    '/api/v1/bills/validate',
    '/api/v1/print-render/preview',
    '/api/v1/gst/company-credentials/verify',
    '/api/v1/tender-settlement/resolve',
    '/api/v1/till/sessions/slip-check',
    '/api/v1/auth/login',
    '/api/v1/health',
  ])('leaves %s alone (reads, or not data)', async (url) => {
    await firstValueFrom(interceptor.intercept(contextFor('POST', url), handlerReturning(null)));

    expect(invalidatePattern).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('ignores reads', async () => {
    await firstValueFrom(
      interceptor.intercept(contextFor('GET', '/api/v1/customers/list'), handlerReturning([])),
    );

    expect(invalidatePattern).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('announces nothing when the write fails', async () => {
    const failing: CallHandler = { handle: () => throwError(() => new Error('rejected')) };

    await expect(
      firstValueFrom(interceptor.intercept(contextFor('DELETE', '/api/v1/cities/delete'), failing)),
    ).rejects.toThrow('rejected');
    expect(invalidatePattern).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not hold the response hostage to a hung purge', async () => {
    jest.useFakeTimers();
    try {
      invalidatePattern.mockImplementation(() => new Promise(() => undefined));
      const pending = firstValueFrom(
        interceptor.intercept(
          contextFor('PUT', '/api/v1/items-master/update'),
          handlerReturning('saved'),
        ),
      );
      await jest.advanceTimersByTimeAsync(2_000);

      await expect(pending).resolves.toBe('saved');
      expect(publish).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('DataChangeService', () => {
  it("streams other sessions' writes and filters out the listener's own", async () => {
    const service = new DataChangeService();
    const received: unknown[] = [];
    const subscription = service.streamFor('sid-a').subscribe((event) => received.push(event));

    service.publish({ resource: 'cities', method: 'POST', at: 1, originSessionId: 'sid-a' });
    service.publish({ resource: 'items-master', method: 'PUT', at: 2, originSessionId: 'sid-b' });
    subscription.unsubscribe();

    expect(received).toEqual([
      { type: 'ready', data: { bootId: expect.any(String), at: expect.any(Number) } },
      { type: 'change', data: { resource: 'items-master', method: 'PUT', at: 2 } },
    ]);
  });
});
