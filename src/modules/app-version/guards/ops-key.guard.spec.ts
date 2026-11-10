import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OpsKeyGuard, opsActorOf } from './ops-key.guard';

const contextWith = (headers: Record<string, string>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

const guardWith = (key: string | undefined): OpsKeyGuard =>
  new OpsKeyGuard({ get: () => key } as unknown as ConfigService);

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error: unknown) {
    const body = (error as { getResponse(): { errors: { code: string }[] } }).getResponse();
    return body.errors[0].code;
  }
  return undefined;
};

describe('OpsKeyGuard (Part B Step 2)', () => {
  it('403 APP_VERSION_OPS_DISABLED when OPS_API_KEY is unset or blank', () => {
    for (const key of [undefined, '', '   ']) {
      const guard = guardWith(key);
      expect(() => guard.canActivate(contextWith({ 'x-ops-key': 'anything' }))).toThrow(
        ForbiddenException,
      );
      expect(codeOf(() => guard.canActivate(contextWith({})))).toBe('APP_VERSION_OPS_DISABLED');
    }
  });

  it('401 APP_VERSION_OPS_KEY_INVALID when the header is missing or wrong', () => {
    const guard = guardWith('s3cret-key');
    expect(() => guard.canActivate(contextWith({}))).toThrow(UnauthorizedException);
    expect(codeOf(() => guard.canActivate(contextWith({ 'x-ops-key': 's3cret' })))).toBe(
      'APP_VERSION_OPS_KEY_INVALID',
    );
  });

  it('passes the right key (surrounding spaces ignored)', () => {
    expect(guardWith(' s3cret-key ').canActivate(contextWith({ 'x-ops-key': 's3cret-key' }))).toBe(
      true,
    );
  });

  it('opsActorOf names the caller only when X-Ops-Actor is a plain token', () => {
    expect(opsActorOf({ headers: {} })).toBe('ops');
    expect(opsActorOf({ headers: { 'x-ops-actor': 'ci:run-123' } })).toBe('ops:ci:run-123');
    expect(opsActorOf({ headers: { 'x-ops-actor': 'drop table; --' } })).toBe('ops');
    expect(opsActorOf({ headers: { 'x-ops-actor': 'x'.repeat(61) } })).toBe('ops');
  });
});
