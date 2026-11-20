import { HttpException } from '@nestjs/common';
import { WaSettingsService, parseOnPostTypes } from './wa-settings.service';

/** Review S7 — "WhatsApp on Post" is the company's whatsapp.on_post_types (JSON list of voucher type ids). */
const item = (key: string, value: string | null) => ({ asdKey: key, value });

function harness(effective: { asdKey: string; value: string | null }[]) {
  const appSettings = {
    resolveEffective: jest.fn().mockResolvedValue(effective),
    save: jest.fn().mockResolvedValue([]),
  };
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ vchr_type_id: 4, vchr_type_name: 'Sales Order', vchr_parent_id: null }]),
  };
  const svc = new WaSettingsService(prisma as never, appSettings as never);
  return { svc, appSettings, prisma };
}

describe('parseOnPostTypes', () => {
  it('reads a JSON list of voucher type ids; anything else is []', () => {
    expect(parseOnPostTypes('[4]')).toEqual([4]);
    expect(parseOnPostTypes(' [12, 4, 4, 3] ')).toEqual([3, 4, 12]);
    for (const bad of [null, undefined, '', '[]', 'x', '{"4":true}', '4', '["4"]', '[4.5, -1, 0]']) {
      expect(parseOnPostTypes(bad as string | null)).toEqual([]);
    }
  });
});

describe('WaSettingsService (S7)', () => {
  it('reads the company\'s effective value (COMPANY, else GLOBAL, else the default []) — no voucher type column', async () => {
    const h = harness([item('whatsapp.on_post_types', '[4]')]);
    await expect(h.svc.onPostSetting('co')).resolves.toEqual({ ids: [4], defined: true });
    expect(h.appSettings.resolveEffective).toHaveBeenCalledWith({ companyId: 'co' });
    const got = await h.svc.get('co');
    expect(got.onPostTypes).toEqual([
      { vchrTypeId: 4, vchrTypeName: 'Sales Order', vchrParentId: null, kind: 'ORDER', templateName: 'nex_order_confirm_v1', on: true },
    ]);
    const sql = (h.prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).not.toContain('whatsapp_after_post');
  });

  it('no setting on the database (migration not applied) reads as [] — get works, tick off', async () => {
    const h = harness([]);
    await expect(h.svc.onPostSetting('co')).resolves.toEqual({ ids: [], defined: false });
    expect((await h.svc.get('co')).onPostTypes[0].on).toBe(false);
  });

  it('save writes the company\'s list through AppSettingValueService (COMPANY scope, audited there), keeping types it does not serve', async () => {
    const h = harness([item('whatsapp.on_post_types', '[3]')]);
    await h.svc.save('co', { onPostTypes: [{ vchrTypeId: 4, on: true }] });
    expect(h.appSettings.save).toHaveBeenCalledWith([
      expect.objectContaining({ asvSettingKey: 'whatsapp.on_post_types', asvScope: 'COMPANY', asvCompanyId: 'co', asvValue: '[3,4]' }),
    ]);
  });

  it('save of an unchanged tick writes nothing', async () => {
    const h = harness([item('whatsapp.on_post_types', '[4]')]);
    await h.svc.save('co', { onPostTypes: [{ vchrTypeId: 4, on: true }] });
    expect(h.appSettings.save).not.toHaveBeenCalled();
  });

  it('save while the setting is missing: 400 WA_SETTING_INVALID on onPostTypes, nothing written', async () => {
    const h = harness([]);
    const e = await h.svc.save('co', { defaultLanguage: 'en', onPostTypes: [{ vchrTypeId: 4, on: true }] }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getStatus()).toBe(400);
    expect(((e as HttpException).getResponse() as { errors: { code: string; field: string }[] }).errors).toEqual([
      expect.objectContaining({ code: 'WA_SETTING_INVALID', field: 'onPostTypes' }),
    ]);
    expect(h.appSettings.save).not.toHaveBeenCalled();
  });

  it('a type this build does not serve is refused (field onPostTypes)', async () => {
    const h = harness([item('whatsapp.on_post_types', '[]')]);
    const e = await h.svc.save('co', { onPostTypes: [{ vchrTypeId: 12, on: true }] }).catch((x: unknown) => x);
    expect(((e as HttpException).getResponse() as { errors: { field: string }[] }).errors[0].field).toBe('onPostTypes');
    expect(h.appSettings.save).not.toHaveBeenCalled();
  });
});
