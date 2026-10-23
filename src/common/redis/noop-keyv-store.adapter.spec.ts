import { NoopKeyvStoreAdapter } from './noop-keyv-store.adapter';

// The store used when Redis is off: every write "succeeds" and nothing is ever kept.
describe('NoopKeyvStoreAdapter', () => {
  const adapter = new NoopKeyvStoreAdapter();

  it('never finds anything, even right after a set', async () => {
    await expect(adapter.set()).resolves.toBe(true);
    await expect(adapter.get()).resolves.toBeUndefined();
  });

  it('reports delete and clear as done', async () => {
    await expect(adapter.delete()).resolves.toBe(true);
    await expect(adapter.clear()).resolves.toBeUndefined();
  });
});
