import { allocateDeliveryNoteNumber, deliveryNoteRefno } from './delivery-note-numbering';

jest.mock('../../stocks/stock-voucher/stock-voucher-numbering.helper', () => ({
  resolveDeviceCode: jest.fn().mockResolvedValue('D3'),
}));

describe('Delivery Note numbering (Q19, per device)', () => {
  it('formats DN/<year>/<device>/<00000>', () => {
    expect(deliveryNoteRefno('2026-2027', 'D3', BigInt(42))).toBe('DN/2026-2027/D3/00042');
    expect(deliveryNoteRefno('2026-2027 ', 'MAIN', 123456)).toBe('DN/2026-2027/MAIN/123456');
  });

  it('takes MAX + 1 of THIS device\'s series under an advisory lock keyed by the series', async () => {
    const calls: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?');
        calls.push(sql);
        if (sql.includes('pg_advisory_xact_lock')) {
          expect(values[0]).toBe('DN|co|br|2026-2027|dev-1');
          return [{ locked: 1 }];
        }
        expect(sql).toContain('sdn_device_id');
        return [{ n: BigInt(7) }];
      }),
    };
    const n = await allocateDeliveryNoteNumber(tx as never, {
      companyId: 'co',
      branchId: 'br',
      accYear: '2026-2027',
      deviceId: 'dev-1',
    });
    expect(n).toEqual({ lastNo: BigInt(7), refno: 'DN/2026-2027/D3/00007', deviceCode: 'D3' });
    expect(calls[0]).toContain('pg_advisory_xact_lock');
  });
});
