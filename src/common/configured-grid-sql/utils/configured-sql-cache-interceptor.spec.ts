import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfiguredGridCacheInterceptor } from './configured-sql-cache-interceptor';

const contextFor = (req: { method?: string; path?: string; query?: Record<string, unknown> }) =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

describe('ConfiguredGridCacheInterceptor.trackBy', () => {
  // trackBy reads only the request, so the cache store and reflector are never touched.
  const interceptor = new ConfiguredGridCacheInterceptor({}, new Reflector());
  const PATH = '/api/v1/configured-grid-sql/run';

  it.each(['POST', 'PUT', 'DELETE', undefined])('skips the cache for a %s request', (method) => {
    expect(interceptor.trackBy(contextFor({ method, path: PATH, query: { grid_id: 7 } }))).toBe(
      undefined,
    );
  });

  it('keys a GET on the path and every parameter that shapes the result', () => {
    const key = interceptor.trackBy(
      contextFor({
        method: 'GET',
        path: PATH,
        query: { grid_id: '119', page: '3', limit: '50', search: 'abc', grid_param: 'p_x=1' },
      }),
    );

    expect(key).toBe(`${PATH}|grid_id=119|page=3|limit=50|search=abc|grid_param=p_x=1`);
  });

  it('defaults page to 1 and limit to 20, and blanks the missing parameters', () => {
    expect(interceptor.trackBy(contextFor({ method: 'GET', path: PATH, query: {} }))).toBe(
      `${PATH}|grid_id=|page=1|limit=20|search=|grid_param=`,
    );
  });

  it('survives a request with no query and no path', () => {
    expect(interceptor.trackBy(contextFor({ method: 'GET' }))).toBe(
      '|grid_id=|page=1|limit=20|search=|grid_param=',
    );
  });

  it('folds search case and surrounding blanks so "  ABC " and "abc" share one entry', () => {
    const loud = interceptor.trackBy(
      contextFor({ method: 'GET', path: PATH, query: { grid_id: 1, search: '  ABC ' } }),
    );
    const quiet = interceptor.trackBy(
      contextFor({ method: 'GET', path: PATH, query: { grid_id: 1, search: 'abc' } }),
    );

    expect(loud).toBe(quiet);
  });

  it('keeps grid_param exact — two parameter sets never share an entry', () => {
    const a = interceptor.trackBy(
      contextFor({ method: 'GET', path: PATH, query: { grid_id: 1, grid_param: 'p_branch=A' } }),
    );
    const b = interceptor.trackBy(
      contextFor({ method: 'GET', path: PATH, query: { grid_id: 1, grid_param: 'p_branch=B' } }),
    );

    expect(a).not.toBe(b);
  });

  it('renders numbers, booleans, arrays and objects the way a template literal would', () => {
    const key = interceptor.trackBy(
      contextFor({
        method: 'GET',
        path: PATH,
        query: { grid_id: 5, page: 2, limit: true, search: ['A', 'B'], grid_param: { p: 1 } },
      }),
    );

    expect(key).toBe(`${PATH}|grid_id=5|page=2|limit=true|search=a,b|grid_param={"p":1}`);
  });

  it('treats a null grid_id as blank, not as the text "null"', () => {
    expect(
      interceptor.trackBy(contextFor({ method: 'GET', path: PATH, query: { grid_id: null } })),
    ).toContain('|grid_id=|');
  });
});
