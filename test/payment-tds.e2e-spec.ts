import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  ACC_YEAR,
  BEARER,
  COMPANY,
  bankTender,
  bootApp,
  createAndPost,
  data,
  expectStatus,
  draftBody,
  keys,
  loadMasters,
  PaymentFixtures,
  prisma,
  ROUTES,
  type Masters,
  PAYMENT_MENU,
} from './helpers/payment-e2e';

/**
 * Plan "Payment (menu 100)" rev 2 §5 step 2 / §7 — TDS on a payment:
 *
 *   · SEEDED server-side for a TDS-applicable party from accounts.tds_rates,
 *     the same lookup the Voucher Register's PmtV uses. The operator keys the
 *     NET the bank pays; the base is grossed up; the party is discharged of
 *     the gross;
 *   · a client figure that disagrees is a 409 naming both;
 *   · no PAN → the 206AA rate (20%);
 *   · inside the section's thresholds → nothing deducted;
 *   · no rate in force → the draft is refused, not silently posted gross.
 *
 * The rates asserted against are the seeded accounts.tds_rates rows on the
 * dev database (194C: FIRM 2% with no thresholds; INDIVIDUAL 1% within
 * 30,000 / 1,00,000; no-PAN 20%). Every party is the suite's own.
 */

jest.setTimeout(240_000);

let app: INestApplication;
let masters: Masters;
const fixtures = new PaymentFixtures();

const api = () => request(app.getHttpServer());

beforeAll(async () => {
  await fixtures.grantRights([PAYMENT_MENU]);
  masters = await loadMasters();
  app = await bootApp();
});

afterAll(async () => {
  await fixtures.teardown();
  await app?.close();
  await prisma.$disconnect();
});

interface OtherLine {
  role: string | null;
  drCr: string;
  amount: number;
  settlesBill: boolean;
}

interface OpenItemsParty {
  isTdsApplicable: boolean;
  tdsSection: string | null;
  tdsRate: number | null;
  tdsRateSource: string | null;
  tdsThresholdSingle: number | null;
  tdsThresholdAnnual: number | null;
  tdsPaidThisYear: number;
  panPresent: boolean;
}

const partyOf = async (partyId: string): Promise<OpenItemsParty> => {
  const res = await api()
    .get(ROUTES.openItems)
    .query({ partyId, companyId: COMPANY })
    .set('Authorization', BEARER);
  expectStatus(res, 200);
  return data<{ party: OpenItemsParty }>(res).party;
};

describe('TDS on a payment (e2e, live DB, writes)', () => {
  it('seeds TDS_PAYABLE from the rate in force, grossed up from the net paid', async () => {
    const partyId = await fixtures.createParty('TDS-FIRM', {
      tds: { section: '194C', deducteeType: 'FIRM', pan: 'AAAFS1234A' },
    });
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000);

    const party = await partyOf(partyId);
    expect(party).toMatchObject({
      isTdsApplicable: true,
      tdsSection: '194C',
      tdsRate: 2,
      tdsRateSource: 'MASTER',
      tdsThresholdSingle: 0,
      tdsThresholdAnnual: 0,
      tdsPaidThisYear: 0,
      panPresent: true,
    });

    // 9,800 leaves the bank; 9,800 / 0.98 = 10,000 is the gross; 200 is withheld.
    const { voucherId, draft, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 9_800)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    const seeded = data<{ otherLines: OtherLine[]; expectedRoles: string[] }>(draft);
    expect(seeded.otherLines).toEqual([
      expect.objectContaining({ role: 'TDS_PAYABLE', drCr: 'CR', amount: 200, settlesBill: true }),
    ]);
    expect(seeded.expectedRoles).toEqual([]);

    // DR party 10,000 / CR bank 9,800 / CR TDS Payable 200.
    const legs = await fixtures.legsOf(voucherId);
    expect(legs).toHaveLength(3);
    expect(legs.find((leg) => leg.ledgerId === partyId)).toMatchObject({
      drCr: 'DR',
      amount: 10_000,
    });
    expect(legs.find((leg) => leg.ledgerId === masters.bankLedgerId)).toMatchObject({
      drCr: 'CR',
      amount: 9_800,
    });
    expect(legs.find((leg) => leg.role === 'TDS_PAYABLE')).toMatchObject({
      drCr: 'CR',
      ledgerId: masters.ledgerByRole('TDS_PAYABLE'),
      amount: 200,
    });

    // The bill closes for its full face: 9,800 of money and 200 withheld.
    const adjustments = await fixtures.adjustmentsOf(voucherId);
    expect(adjustments.map((a) => [a.mode, a.amount, a.drCr])).toEqual(
      expect.arrayContaining([
        ['MIXED', 9_800, 'DR'],
        ['TDS', 200, 'DR'],
      ]),
    );
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);

    // The TDS register carries the deduction, which is what the annual
    // threshold — and tdsPaidThisYear — count.
    const register = await prisma.accTdsRegister.findMany({
      where: { atdVoucherId: voucherId, atdIsDeleted: false },
      select: {
        atdDirection: true,
        atdSection: true,
        atdBaseAmount: true,
        atdTaxAmount: true,
        atdRateSource: true,
        atdReversalOfId: true,
      },
    });
    expect(register).toEqual([
      expect.objectContaining({
        atdDirection: 'DEDUCTED',
        atdSection: '194C',
        atdRateSource: 'MASTER',
        atdReversalOfId: null,
      }),
    ]);
    expect(Number(register[0].atdBaseAmount)).toBe(10_000);
    expect(Number(register[0].atdTaxAmount)).toBe(200);
    expect((await partyOf(partyId)).tdsPaidThisYear).toBe(10_000);

    // Cancel takes the deduction back out of the register too.
    const cancelled = await api()
      .post(ROUTES.cancel)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), reason: 'E2E TDS — tidy up' });
    expectStatus(cancelled, 201);
    expect(data<{ tdsReversed: number }>(cancelled).tdsReversed).toBe(1);
    expect((await partyOf(partyId)).tdsPaidThisYear).toBe(0);
    const tdsLeg = (
      await fixtures.legsOf(
        data<{ reversals: Array<{ reversalVoucherId: string }> }>(cancelled).reversals[0]
          .reversalVoucherId,
      )
    ).find((leg) => leg.role === 'TDS_PAYABLE');
    expect(tdsLeg).toMatchObject({ drCr: 'DR', amount: 200 });
  });

  it("refuses a client TDS figure that disagrees with the server's, and accepts one that agrees", async () => {
    const partyId = await fixtures.createParty('TDS-OVERRIDE', {
      tds: { section: '194C', deducteeType: 'FIRM', pan: 'AAAFS1234A' },
    });

    const disagree = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [bankTender(masters, 9_800)], {
          otherLines: [{ role: 'TDS_PAYABLE', drCr: 'CR', amount: 150, settlesBill: true }],
        }),
      );
    expectStatus(disagree, 409);
    const body = JSON.stringify(disagree.body);
    expect(body).toContain('150.00');
    expect(body).toContain('200.00');

    const agree = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [bankTender(masters, 9_800)], {
          otherLines: [{ role: 'TDS_PAYABLE', drCr: 'CR', amount: 200, settlesBill: true }],
        }),
      );
    expectStatus(agree, 201);
    fixtures.vouchers.push(data<{ header: { avhVoucherId: string } }>(agree).header.avhVoucherId);
    const lines = data<{ otherLines: OtherLine[] }>(agree).otherLines;
    expect(lines.filter((line) => line.role === 'TDS_PAYABLE')).toEqual([
      expect.objectContaining({ amount: 200, settlesBill: true }),
    ]);
  });

  it('deducts at the no-PAN rate (206AA, 20%) when the party has no PAN', async () => {
    const partyId = await fixtures.createParty('TDS-NOPAN', {
      tds: { section: '194C', deducteeType: 'FIRM', pan: null },
    });
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000);

    const party = await partyOf(partyId);
    expect(party).toMatchObject({ tdsRate: 20, tdsRateSource: 'NO_PAN', panPresent: false });

    // 8,000 net / 0.80 = 10,000 gross; 2,000 withheld.
    const { voucherId, draft, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 8_000)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);
    expect(data<{ otherLines: OtherLine[] }>(draft).otherLines).toEqual([
      expect.objectContaining({ role: 'TDS_PAYABLE', amount: 2_000 }),
    ]);
    expect(
      (await fixtures.legsOf(voucherId)).find((leg) => leg.role === 'TDS_PAYABLE'),
    ).toMatchObject({ amount: 2_000 });
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
    const register = await prisma.accTdsRegister.findFirst({
      where: { atdVoucherId: voucherId, atdIsDeleted: false },
    });
    expect(register?.atdRateSource).toBe('NO_PAN');
  });

  it('deducts nothing inside the section’s thresholds, and says so on the party', async () => {
    const partyId = await fixtures.createParty('TDS-THRESHOLD', {
      tds: { section: '194C', deducteeType: 'INDIVIDUAL', pan: 'ABCPD1234E' },
    });
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 9_900);

    const party = await partyOf(partyId);
    expect(party).toMatchObject({
      tdsRate: 1,
      tdsThresholdSingle: 30_000,
      tdsThresholdAnnual: 100_000,
    });

    // 9,900 / 0.99 = 10,000 — inside both thresholds, so nothing is withheld
    // and the bill is settled by the money alone.
    const { voucherId, draft, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 9_900)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 9_900 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);
    expect(data<{ otherLines: OtherLine[] }>(draft).otherLines).toEqual([]);
    expect((await fixtures.legsOf(voucherId)).some((leg) => leg.role === 'TDS_PAYABLE')).toBe(
      false,
    );
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
  });

  it('refuses a TDS-applicable party whose section has no rate in force', async () => {
    const partyId = await fixtures.createParty('TDS-NORATE', {
      tds: { section: '194ZZ', deducteeType: 'FIRM', pan: 'AAAFS1234A' },
    });
    const res = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(draftBody(partyId, [bankTender(masters, 1_000)]));
    expectStatus(res, 400);
    expect(JSON.stringify(res.body)).toContain('TDS rate is not configured');
  });
  const registerOf = (voucherId: string) =>
    prisma.accTdsRegister.findMany({
      where: { atdVoucherId: voucherId, atdIsDeleted: false },
      select: { atdSection: true, atdBaseAmount: true, atdTaxAmount: true },
    });

  it('posts TDS withheld on an ADVANCE — no bill at all (notes 62 A1)', async () => {
    const partyId = await fixtures.createParty('TDS-ADV', {
      tds: { section: '194C', deducteeType: 'FIRM', pan: 'AAAFA1234A' },
    });

    // 49,000 leaves the bank; 49,000 / 0.98 = 50,000 is paid ahead; 1,000 is withheld.
    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 49_000)]),
      { allocations: [], onAccount: 50_000 },
    );
    expectStatus(posted, 201);

    const payload = data<{
      totalOnAccount: number;
      advanceBills: Array<{ billId: string; billAmount: number }>;
    }>(posted);
    expect(payload.totalOnAccount).toBe(50_000);
    expect(payload.advanceBills).toEqual([expect.objectContaining({ billAmount: 50_000 })]);

    const legs = await fixtures.legsOf(voucherId);
    expect(legs.find((leg) => leg.ledgerId === partyId)).toMatchObject({
      drCr: 'DR',
      amount: 50_000,
    });
    expect(legs.find((leg) => leg.ledgerId === masters.bankLedgerId)).toMatchObject({
      drCr: 'CR',
      amount: 49_000,
    });
    expect(legs.find((leg) => leg.role === 'TDS_PAYABLE')).toMatchObject({
      drCr: 'CR',
      amount: 1_000,
    });

    const register = await registerOf(voucherId);
    expect(register).toHaveLength(1);
    expect(Number(register[0].atdBaseAmount)).toBe(50_000);
    expect(Number(register[0].atdTaxAmount)).toBe(1_000);
  });

  it('fills a bill smaller than the tax and holds the rest of the tax on account', async () => {
    const partyId = await fixtures.createParty('TDS-SMALL', {
      tds: { section: '194C', deducteeType: 'FIRM', pan: 'AAAFB1234A' },
    });
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 300);

    // Gross 50,000 as above: 300 of it settles the bill, 49,700 is ahead.
    const { posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 49_000)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 300 }],
        onAccount: 49_700,
      },
    );
    expectStatus(posted, 201);
    expect(data<{ totalOnAccount: number }>(posted).totalOnAccount).toBe(49_700);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
  });

  it('leaves interest paid out of the TDS base (notes 62 B1)', async () => {
    const partyId = await fixtures.createParty('TDS-INT', {
      tds: { section: '194C', deducteeType: 'FIRM', pan: 'AAAFC1234A' },
    });
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000);

    // 10,000 by NEFT, 200 of it interest (194A, not 194C). The supplier gets
    // 9,800 for the bill: gross 10,000, tax 200 — not 204.08 on 10,204.08.
    const { voucherId, draft, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 10_000)], {
        otherLines: [{ role: 'INTEREST_PAID', drCr: 'DR', amount: 200 }],
      }),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);
    expect(data<{ otherLines: OtherLine[] }>(draft).otherLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'TDS_PAYABLE', drCr: 'CR', amount: 200 }),
      ]),
    );
    const register = await registerOf(voucherId);
    expect(Number(register[0].atdBaseAmount)).toBe(10_000);
    expect(Number(register[0].atdTaxAmount)).toBe(200);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
  });

  it('refuses a TDS line keyed on a party whose master is not TDS-applicable (notes 62 B2)', async () => {
    const partyId = await fixtures.createParty('TDS-NONE');
    const refused = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [bankTender(masters, 9_800)], {
          otherLines: [{ role: 'TDS_PAYABLE', drCr: 'CR', amount: 200 }],
        }),
      );
    expectStatus(refused, 400);
    expect(JSON.stringify(refused.body)).toContain('not TDS-applicable');
    expect(
      await prisma.accVoucherHeader.count({ where: { avhPartyId: partyId, avhIsDeleted: false } }),
    ).toBe(0);
  });
});
