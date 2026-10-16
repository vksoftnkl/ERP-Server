import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { as, bootIdentityApp } from './helpers/identity-app';
import { grantMenuRights, restoreMenuRights, TESTER1, type MenuRightsMemo } from './helpers/menu-rights';
import { ACC_YEAR, BRANCH, COMPANY, data, prisma } from './helpers/payment-e2e';

/**
 * Notes 126 — every line on a cash or bank ledger carries a tender, against the
 * dev database.
 *
 *   tender master  CARD / WALLET / UPI never on a cash / bank ledger, CASH only on
 *                  a cash one, BANK only on a bank one (TENDER_LEDGER_TYPE);
 *                  TEMP_CR / CREDIT / LOYALTY need no ledger
 *   §6 register    a Journal has no money side (VCH_MONEY_LEDGER_NOT_ALLOWED); a
 *                  Receipt Voucher's money is its instrument, never a typed line
 *                  (VCH_MONEY_LINE_NO_TENDER); a Contra names a tender per side —
 *                  missing → VCH_MONEY_LINE_NO_TENDER, the wrong kind →
 *                  VCH_INSTRUMENT_TENDER; in a till branch never on till cash
 *                  (TILL_CASH_LEDGER_DIRECT); bank → bank posts with a tender row
 *                  per side
 *   §4 reports     the Day Book by tender shows the Contra under its tenders; the
 *                  no-tender list answers
 *
 * tester1 (SUPER ADMIN), no device (a back-office call, §2). The suite owns the
 * BANK tender it makes for "Test Bank Account", the TEMP_CR tender, and the Contra.
 *
 *     npm run test:e2e -- money-lines-tender-notes-126 --runInBand
 */

jest.setTimeout(180_000);

const MENUS = [103, 104, 260, 261, 284];
const KVB = '019ef849-aefe-7e27-8e8f-d4094cf5c254';
const TEST_BANK = '019ef870-0f5d-7d06-b360-87872ffac349';
const CASH_IN_HAND = '019ef844-efba-755d-ab5d-b4d7281edf19';
const CARD_CLEARING = '01a08f3d-45c8-7487-96c1-bbccb9f71010';
const BANK_CHARGES = '01a0a4c5-c5b1-7bb4-ae1a-b852289d8449';
const PARTY = '01a0d242-55c9-753f-8945-abdc4e15c0c1';
const tag = Date.now().toString(36).toUpperCase().slice(-6);
const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

let app: INestApplication;
const rights: MenuRightsMemo[] = [];
const tenders: string[] = [];
const vouchers: string[] = [];
let kvbTender: string;
let cashTender: string;
let testBankTender: string;

const http = () => request(app.getHttpServer());
const post = (path: string, body: object) =>
  http().post(`/api/v1/${path}`).set('Authorization', as('tester1', '')).send(body);
const firstError = (res: request.Response): Record<string, unknown> => res.body.errors?.[0] ?? {};
const codes = (res: request.Response): string[] =>
  (res.body.errors ?? []).map((e: { code?: string }) => e.code);
const voucher = (typeCode: string, lines: object[]) =>
  post('vouchers/post', {
    header: { companyId: COMPANY, branchId: BRANCH, accYear: ACC_YEAR, typeCode, date: today },
    lines,
  });
const tenderMaster = (body: Record<string, unknown>) =>
  post('tender-masters/create', { tndCompanyId: COMPANY, tndMinAmount: 0, ...body });

beforeAll(async () => {
  rights.push(await grantMenuRights(prisma, MENUS, TESTER1));
  app = await bootIdentityApp();
  const pick = async (typeId: number, ledgerId: string) => {
    const [row] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT tnd_id::text AS id FROM accounts.acc_tender_master
       WHERE tnd_company_id = ${COMPANY}::uuid AND tnd_type_id = ${typeId}::int
         AND tnd_ledger_id = ${ledgerId}::uuid AND tnd_is_active AND NOT tnd_is_deleted
       LIMIT 1`;
    return row.id;
  };
  kvbTender = await pick(6, KVB);
  cashTender = await pick(1, CASH_IN_HAND);
});

afterAll(async () => {
  if (vouchers.length) {
    await prisma.$executeRaw`DELETE FROM accounts.acc_tender_detail WHERE td_voucher_id = ANY(${vouchers}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM public.txn_status_log WHERE tsl_src_doc_id = ANY(${vouchers}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_vouchers WHERE av_voucher_id = ANY(${vouchers}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_voucher_id = ANY(${vouchers}::uuid[])`;
  }
  if (tenders.length) {
    await prisma.$executeRaw`DELETE FROM accounts.acc_tender_master WHERE tnd_id = ANY(${tenders}::uuid[])`;
  }
  for (const memo of rights.reverse()) {
    await restoreMenuRights(prisma, memo);
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('the tender master: the ledger fits the type (notes 126, the user’s addition)', () => {
  it.each([
    ['CARD on a bank ledger', 2, KVB],
    ['WALLET on a bank ledger', 4, KVB],
    ['CASH on a bank ledger', 1, KVB],
    ['BANK on a cash ledger', 6, CASH_IN_HAND],
    ['CHEQUE on a bank ledger', 5, KVB],
    ['CASH on a clearing ledger', 1, CARD_CLEARING],
  ])('%s → 400 TENDER_LEDGER_TYPE', async (_what, typeId, ledgerId) => {
    const res = await tenderMaster({ tndTypeId: String(typeId), tndName: `ZT126 ${tag} ${typeId}`, tndLedgerId: ledgerId });
    expect(res.status).toBe(400);
    expect(firstError(res)).toEqual(
      expect.objectContaining({ code: 'TENDER_LEDGER_TYPE', field: 'tndLedgerId' }),
    );
  });

  it('a BANK tender with no ledger → 400 TENDER_LEDGER_REQUIRED; a TEMP_CR one needs none', async () => {
    const bank = await tenderMaster({ tndTypeId: '6', tndName: `ZT126 ${tag} NOLED` });
    expect(bank.status).toBe(400);
    expect(firstError(bank).code).toBe('TENDER_LEDGER_REQUIRED');
    const temp = await tenderMaster({ tndTypeId: '8', tndName: `ZT126 ${tag} TEMPCR` });
    expect(temp.status).toBe(201);
    tenders.push(temp.body.data.tndId);
    expect(temp.body.data.tndLedgerId).toBeNull();
  });

  it('a BANK tender on its own bank saves (the second bank’s NEFT tender)', async () => {
    const res = await tenderMaster({
      tndTypeId: '6',
      tndName: `ZT126 ${tag} TESTBANK NEFT`,
      tndShortName: `ZT126${tag}`,
      tndLedgerId: TEST_BANK,
    });
    expect(res.status).toBe(201);
    testBankTender = res.body.data.tndId;
    tenders.push(testBankTender);
  });
});

describe('§6 — the money side is a tender', () => {
  it('a Journal has no money side: VCH_MONEY_LEDGER_NOT_ALLOWED, pointing at the Payment', async () => {
    const res = await voucher('Jrl', [
      { rowNo: 1, drCr: 'DR', ledgerId: BANK_CHARGES, amount: '15' },
      { rowNo: 2, drCr: 'CR', ledgerId: KVB, amount: '15' },
    ]);
    expect(res.status).toBe(422);
    expect(codes(res)).toContain('VCH_MONEY_LEDGER_NOT_ALLOWED');
    expect(JSON.stringify(res.body)).toMatch(/Payment/);
  });

  it('a Receipt Voucher’s money is its instrument, never a typed cash line: VCH_MONEY_LINE_NO_TENDER', async () => {
    const res = await voucher('RcpV', [
      { rowNo: 1, drCr: 'CR', ledgerId: PARTY, amount: '40' },
      { rowNo: 2, drCr: 'DR', ledgerId: CASH_IN_HAND, amount: '40' },
    ]);
    expect(res.status).toBe(422);
    expect(codes(res)).toContain('VCH_MONEY_LINE_NO_TENDER');
  });

  it('a Contra names a tender per side: none → VCH_MONEY_LINE_NO_TENDER, the wrong kind → VCH_INSTRUMENT_TENDER', async () => {
    const none = await voucher('Con', [
      { rowNo: 1, drCr: 'DR', ledgerId: TEST_BANK, amount: '25' },
      { rowNo: 2, drCr: 'CR', ledgerId: KVB, amount: '25' },
    ]);
    expect(none.status).toBe(422);
    expect(codes(none)).toContain('VCH_MONEY_LINE_NO_TENDER');
    const wrong = await voucher('Con', [
      { rowNo: 1, drCr: 'DR', ledgerId: TEST_BANK, amount: '25', tenderId: kvbTender },
      { rowNo: 2, drCr: 'CR', ledgerId: KVB, amount: '25', tenderId: cashTender },
    ]);
    expect(wrong.status).toBe(422);
    expect(codes(wrong)).toEqual(['VCH_INSTRUMENT_TENDER', 'VCH_INSTRUMENT_TENDER']);
  });

  it('§2 — in a branch that runs a till a Contra never touches till cash: TILL_CASH_LEDGER_DIRECT', async () => {
    const res = await voucher('Con', [
      { rowNo: 1, drCr: 'DR', ledgerId: KVB, amount: '30', tenderId: kvbTender },
      { rowNo: 2, drCr: 'CR', ledgerId: CASH_IN_HAND, amount: '30', tenderId: cashTender },
    ]);
    expect(res.status).toBe(409);
    expect(codes(res)).toEqual(['TILL_CASH_LEDGER_DIRECT']);
  });

  it('bank → bank posts, and each side carries its tender row', async () => {
    const res = await voucher('Con', [
      { rowNo: 1, drCr: 'DR', ledgerId: TEST_BANK, amount: '25', tenderId: testBankTender },
      { rowNo: 2, drCr: 'CR', ledgerId: KVB, amount: '25', tenderId: kvbTender },
    ]);
    expect(res.status).toBe(201);
    const voucherId = (res.body.data.header?.voucherId ?? res.body.data.voucherId) as string;
    vouchers.push(voucherId);
    const rows = await prisma.$queryRaw<{ tender: string; ledger: string; side: string; amt: string; src: string }[]>`
      SELECT td_tender_id::text AS tender, td_tender_ledger_id::text AS ledger, trim(td_dr_cr) AS side,
             td_amount::text AS amt, td_src_doc_type AS src
        FROM accounts.acc_tender_detail
       WHERE td_voucher_id = ${voucherId}::uuid AND NOT td_is_deleted ORDER BY td_dr_cr DESC`;
    expect(rows).toEqual([
      { tender: testBankTender, ledger: TEST_BANK, side: 'DR', amt: '25.00', src: 'VOUCHER' },
      { tender: kvbTender, ledger: KVB, side: 'CR', amt: '25.00', src: 'VOUCHER' },
    ]);
  });
});

describe('§4 — the reports', () => {
  it('the Day Book by tender shows the Contra under its two tenders, and the ledger books reconcile', async () => {
    const res = await http()
      .get('/api/v1/reports/tender-day-book')
      .query({ companyId: COMPANY, accYear: ACC_YEAR, fromDate: today, tenderIds: testBankTender })
      .set('Authorization', as('tester1', ''));
    expect(res.status).toBe(200);
    const d = data<{
      groups: { tenderId: string | null; ledgerId: string; debit: string }[];
      ledgers: { ledgerId: string; opening: string; debit: string; credit: string; closing: string }[];
      rows: { tenderId: string; voucherId: string }[];
    }>(res);
    expect(d.groups).toEqual([
      expect.objectContaining({ tenderId: testBankTender, ledgerId: TEST_BANK, debit: '25.00' }),
    ]);
    expect(d.rows.map((r) => r.voucherId)).toEqual([vouchers[0]]);
    for (const l of d.ledgers) {
      expect(Number(l.closing)).toBeCloseTo(Number(l.opening) + Number(l.debit) - Number(l.credit), 2);
    }
  });

  it('the money lines with no tender answer, by voucher type', async () => {
    const res = await http()
      .get('/api/v1/reports/tender-day-book/no-tender')
      .query({ companyId: COMPANY, accYear: ACC_YEAR, fromDate: '2026-10-08' })
      .set('Authorization', as('tester1', ''));
    expect(res.status).toBe(200);
    const d = data<{ count: number; byVoucherType: { voucherTypeCode: string; count: number }[] }>(res);
    expect(d.count).toBe(d.byVoucherType.reduce((n, t) => n + t.count, 0));
    // The Contra posted above is labelled: not on the list.
    expect(JSON.stringify(res.body)).not.toContain(vouchers[0]);
  });
});
