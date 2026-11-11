import { Logger, UnauthorizedException } from '@nestjs/common';
import type { AppVersionStateStore } from './app-version-state.store';
import { AuthEpochService } from './auth-epoch.service';

describe('AuthEpochService (Part B Step 2 Rev 2)', () => {
  let store: { readEpoch: jest.Mock };
  let service: AuthEpochService;

  beforeEach(async () => {
    store = { readEpoch: jest.fn().mockResolvedValue(3) };
    service = new AuthEpochService(store as unknown as AppVersionStateStore);
    await service.reload();
  });

  it('a token under the current epoch passes; a token from an older epoch is 401 AUTH_BACKEND_UPDATED', () => {
    expect(service.current()).toBe(3);
    expect(() => service.assertTokenEpoch(3, 'access')).not.toThrow();
    let caught: unknown;
    try {
      service.assertTokenEpoch(2, 'access');
    } catch (error: unknown) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnauthorizedException);
    expect((caught as UnauthorizedException).getResponse()).toMatchObject({
      errors: [{ field: 'authorization', code: 'AUTH_BACKEND_UPDATED' }],
    });
    expect(() => service.assertTokenEpoch(2, 'refresh')).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          errors: [expect.objectContaining({ field: 'refresh_token' })],
        }),
      }),
    );
  });

  it('a token with no ep (minted before Rev 2) reads as epoch 0', () => {
    service.set(0);
    expect(() => service.assertTokenEpoch(undefined, 'access')).not.toThrow();
    service.set(1);
    expect(() => service.assertTokenEpoch(undefined, 'access')).toThrow(UnauthorizedException);
  });

  it('a token from a NEWER epoch (another process raised it) passes and triggers a re-read', async () => {
    store.readEpoch.mockResolvedValue(4);
    expect(() => service.assertTokenEpoch(4, 'access')).not.toThrow();
    await service.reload();
    expect(service.current()).toBe(4);
    expect(() => service.assertTokenEpoch(3, 'access')).toThrow(UnauthorizedException);
  });

  it('a failed read keeps the last value and never throws', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    store.readEpoch.mockRejectedValue(new Error('connection refused'));
    await expect(service.reload()).resolves.toBeUndefined();
    expect(service.current()).toBe(3);
    warn.mockRestore();
  });

  it('a token above the epoch re-reads at most once per 5 s, never per request', async () => {
    store.readEpoch.mockClear();
    store.readEpoch.mockResolvedValue(3); // the DB stays below the token (e.g. a restore)
    for (let i = 0; i < 20; i += 1) {
      service.assertTokenEpoch(9, 'access');
      await new Promise((resolve) => setImmediate(resolve)); // let a started read finish
    }
    expect(store.readEpoch).toHaveBeenCalledTimes(1);
  });

  it('a read that started before set() cannot roll the epoch back', async () => {
    let release!: (epoch: number) => void;
    store.readEpoch.mockImplementationOnce(
      () => new Promise<number>((resolve) => (release = resolve)),
    );
    const slowRead = service.reload();
    service.set(5);
    release(3);
    await slowRead;
    expect(service.current()).toBe(5);
  });
});
