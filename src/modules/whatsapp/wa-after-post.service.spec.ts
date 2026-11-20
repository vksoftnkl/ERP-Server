import { WaPostHook } from './hook/wa-post-hook';
import { WaAfterPostService } from './wa-after-post.service';

const event = { docType: 'SALES_ORDER' as const, docId: 'so', accYear: '2026-2027', companyId: 'co', branchId: 'br', vchrTypeId: 4 };

function make(tick: boolean, prepared: unknown, setting?: { ids: number[]; defined: boolean }) {
  const hook = new WaPostHook();
  const store = {
    prisma: { $queryRaw: jest.fn() },
    actor: jest.fn().mockResolvedValue({ userId: null, userName: 'VKPOS', deviceId: null, branchId: null }),
  };
  const sends = {
    prepareDocument: jest.fn().mockResolvedValue(prepared),
    deliver: jest.fn().mockResolvedValue({}),
  };
  const settings = {
    onPostSetting: jest.fn().mockResolvedValue(setting ?? { ids: tick ? [4] : [], defined: true }),
  };
  const svc = new WaAfterPostService(hook, store as never, sends as never, settings as never);
  svc.onModuleInit();
  return { hook, sends, settings, store };
}

describe('WhatsApp on Post (decision 17) — after the commit, never in the way of the post', () => {
  it('tick off and no flag: nothing, not even a read of the order', async () => {
    const { hook, sends } = make(false, null);
    await expect(hook.fire(event)).resolves.toBeNull();
    expect(sends.prepareDocument).not.toHaveBeenCalled();
  });
  it('waOnPost false unticks this one; true sends with the tick off', async () => {
    const row = { wmlId: 'w', accYear: '2026-2027', status: 'SENDING', errorCode: null };
    const a = make(true, row);
    await expect(a.hook.fire({ ...event, waOnPost: false })).resolves.toBeNull();
    const b = make(false, row);
    await expect(b.hook.fire({ ...event, waOnPost: true })).resolves.toEqual({ wmlId: 'w', accYear: '2026-2027', status: 'SENDING', errorCode: null });
    expect(b.sends.prepareDocument).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'ON_POST', docType: 'SALES_ORDER' }));
  });
  it('not connected: the block says NOT_CONNECTED with the chat fallback, nothing logged', async () => {
    const { hook } = make(true, { notConnected: true, fallbackClickToChat: true });
    await expect(hook.fire(event)).resolves.toEqual({ wmlId: null, accYear: null, status: 'NOT_CONNECTED', fallbackClickToChat: true });
  });
  it('anything that breaks inside answers null: the post stands', async () => {
    const { hook, sends } = make(true, null);
    sends.prepareDocument.mockRejectedValue(new Error('database gone'));
    await expect(hook.fire(event)).resolves.toBeNull();
  });
  it('with no handler registered (a module without WhatsApp) fire answers null', async () => {
    await expect(new WaPostHook().fire(event)).resolves.toBeNull();
  });
  it('S7: the tick is the POSTING company\'s whatsapp.on_post_types, never the shared voucher type row', async () => {
    const row = { wmlId: 'w', accYear: '2026-2027', status: 'SENDING', errorCode: null };
    const { hook, sends, settings, store } = make(true, row);
    await expect(hook.fire(event)).resolves.toMatchObject({ status: 'SENDING' });
    expect(settings.onPostSetting).toHaveBeenCalledWith('co');
    expect(store.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(sends.prepareDocument).toHaveBeenCalledTimes(1);
  });
  it('S7: another type in the list, an empty list, or no setting on the database (migration not applied) sends nothing', async () => {
    for (const setting of [{ ids: [3, 12], defined: true }, { ids: [], defined: true }, { ids: [], defined: false }]) {
      const { hook, sends } = make(false, { wmlId: 'w' }, setting);
      await expect(hook.fire(event)).resolves.toBeNull();
      expect(sends.prepareDocument).not.toHaveBeenCalled();
    }
  });
});
