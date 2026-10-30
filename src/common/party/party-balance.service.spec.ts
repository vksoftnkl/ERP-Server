import { Prisma } from '@prisma/client';
import { PartyBalanceService, formatRupees } from './party-balance.service';

describe('PartyBalanceService (party rules D1)', () => {
  it('words rupees with Indian grouping', () => {
    expect(formatRupees(new Prisma.Decimal('1250'))).toBe('1,250.00');
    expect(formatRupees(new Prisma.Decimal('125000.5'))).toBe('1,25,000.50');
    expect(formatRupees(new Prisma.Decimal('12.3'))).toBe('12.30');
  });

  const D = (v: string) => new Prisma.Decimal(v);
  /** A tx whose $queryRaw answers in call order: pairs, then one row per (company, year). */
  const txOf = (answers: unknown[][]) => {
    const queue = [...answers];
    return {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn(() => Promise.resolve(queue.shift() ?? [])),
      company: { findMany: jest.fn().mockResolvedValue([{ compId: 'c1', compName: 'Acme' }]) },
    } as unknown as Prisma.TransactionClient;
  };

  it('walks the years: a live opening replaces the carry, a stale one does not', async () => {
    const tx = txOf([
      [
        { company_id: 'c1', acc_year: '2025-2026' },
        { company_id: 'c1', acc_year: '2026-2027' },
        { company_id: 'c1', acc_year: '2027-2028' },
      ],
      [{ legs: D('100'), opening: D('50'), rows: 1, stale: false }], // 150
      [{ legs: D('-30'), opening: D('999'), rows: 1, stale: true }], // stale: 150 - 30 = 120
      [{ legs: D('0'), opening: D('120'), rows: 1, stale: false }], // live carry = 120
    ]);

    const balances = await new PartyBalanceService().balances(tx, 'led');

    expect(balances).toEqual([{ companyId: 'c1', companyName: 'Acme', amount: D('120') }]);
  });

  it('drops a company whose balance nets to 0 (a cancelled pair)', async () => {
    const tx = txOf([
      [{ company_id: 'c1', acc_year: '2026-2027' }],
      [{ legs: D('0'), opening: null, rows: 0, stale: false }],
    ]);

    await expect(new PartyBalanceService().balances(tx, 'led')).resolves.toEqual([]);
  });

  it('answers the delete check: refused with the figures, warnings counted', async () => {
    const service = new PartyBalanceService();
    jest.spyOn(service, 'balances').mockResolvedValue([
      { companyId: 'c1', companyName: 'Acme', amount: D('-1250') },
    ]);
    jest.spyOn(service, 'chequesInHand').mockResolvedValue(0);
    jest.spyOn(service, 'warnings').mockResolvedValue({ draftDocs: 2, openBills: 1 });

    const check = await service.deleteCheck({} as Prisma.TransactionClient, {
      partyId: 'p',
      role: 'CUSTOMER',
      otherRoleLive: false,
      codes: { hasBalance: 'CUSTOMER_HAS_BALANCE', hasChequeInHand: 'CUSTOMER_HAS_CHEQUE_IN_HAND' },
    });

    expect(check).toMatchObject({
      canDelete: false,
      refusalCode: 'CUSTOMER_HAS_BALANCE',
      ledgerWouldBeDeleted: true,
      balances: [{ companyId: 'c1', companyName: 'Acme', amount: '1250.00', drCr: 'CR' }],
      warnings: { draftDocs: 2, openBills: 1, chequesInHand: 0 },
    });
  });

  it('skips the balance when the other role keeps the ledger (Q2)', async () => {
    const service = new PartyBalanceService();
    const balances = jest.spyOn(service, 'balances');
    jest.spyOn(service, 'chequesInHand').mockResolvedValue(1);
    jest.spyOn(service, 'warnings').mockResolvedValue({ draftDocs: 0, openBills: 0 });

    const check = await service.deleteCheck({} as Prisma.TransactionClient, {
      partyId: 'p',
      role: 'SUPPLIER',
      otherRoleLive: true,
      codes: { hasBalance: 'A', hasChequeInHand: 'B' },
    });

    expect(balances).not.toHaveBeenCalled();
    expect(check).toMatchObject({ canDelete: true, refusalCode: null, ledgerWouldBeDeleted: false });
  });
});
