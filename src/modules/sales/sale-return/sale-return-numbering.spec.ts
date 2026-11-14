import { allocateSaleReturnNumber } from './sale-return-numbering';

/** Plan v5 D16 / D43 — SRT/<year>/<device code>/00001, per device, under an advisory lock. */
describe('allocateSaleReturnNumber', () => {
  const DEVICE = '019ea5d1-261f-7f3d-b350-93a30c147788';
  const tx = () => ({
    deviceMaster: {
      findFirst: jest.fn().mockResolvedValue({
        devCode: 'D8',
        devIsActive: true,
        devIsBlocked: false,
        devBlockReason: null,
      }),
    },
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ..._values: unknown[]) =>
      strings.join('?').includes('pg_advisory_xact_lock') ? [{ locked: 1 }] : [{ n: 3n }],
    ),
  });
  const q = { companyId: 'co', branchId: 'br', accYear: '2026-2027', deviceId: DEVICE };

  it("numbers from the device's own series, padded, with the device code in the refno", async () => {
    await expect(allocateSaleReturnNumber(tx() as never, q)).resolves.toEqual({
      lastNo: 3n,
      refno: 'SRT/2026-2027/D8/00003',
    });
  });

  it('takes the lock for this series before it reads MAX, and counts only this device', async () => {
    const t = tx();
    await allocateSaleReturnNumber(t as never, q);

    const [lock, max] = t.$queryRaw.mock.calls;
    expect((lock[0] as unknown as string[]).join('?')).toContain('pg_advisory_xact_lock');
    expect(lock[1]).toBe(`SRT|co|br|2026-2027|${DEVICE}`);
    expect((max[0] as unknown as string[]).join('?')).toContain('sr_device_id = ?');
    expect(max.slice(1)).toEqual(['co', 'br', '2026-2027', DEVICE]);
  });
});
