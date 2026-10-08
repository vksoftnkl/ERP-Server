import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { as, bootIdentityApp, TESTER } from './helpers/identity-app';
import {
  grantMenuRights,
  restoreMenuRights,
  TESTER1,
  type MenuRightsMemo,
} from './helpers/menu-rights';
import {
  ACC_YEAR,
  BRANCH,
  COMPANY,
  expectStatus,
  PaymentFixtures,
  prisma,
} from './helpers/payment-e2e';

/**
 * Non-cash tender control — till/plan-noncash-tender-control.md, over HTTP
 * against the dev database.
 *
 *   §3    a money-in card row carries the card's last 4 (a 4-digit reference is
 *         taken for it); a repeated approval code + last 4 + amount is refused
 *   §4    a card count names its terminal when there are two; the slip check
 *         lists one terminal's rows and records a SLIP_CHECK
 *   §5    a statement imported with the tender's column map: AUTH matched,
 *         AMOUNT_TIME suggested, money with no row unmatched; one TSet per
 *         payout; a posted payout voided puts its rows back
 *   §6    an unexplained line resolved INCOME, a row that never got its money
 *         written off LOSS — each refused without OVERRIDE on menu 278
 *
 * The suite owns two card terminals (tender masters), their bank and clearing
 * ledgers, a counter, a safe, a session and every row and voucher it writes.
 *
 *     npm run test:e2e -- tender-settlement-http --runInBand
 */

jest.setTimeout(300_000);

const TILL_MENUS = [271, 272, 273, 274, 275, 276];
const RCPV_MENU = 260;
const SETTLEMENT_MENU = 278;
const GROUP = {
  BANK: '019eee86-f34b-7e27-8aee-2b5930314c8a',
  CURRENT_ASSETS: '019eee86-f34b-7dcc-8789-214f1ffa3929',
  INDIRECT_INCOMES: '019eee86-f34b-7eb7-a296-0d3ce4f6fed1',
  CUSTOMERS: '019f081c-6764-73b0-b397-3f30a6efe73e',
};
const CARD_TYPE = 2;

const tag = Date.now().toString(36).toUpperCase().slice(-6);
const today = new Date().toISOString().slice(0, 10);
let app: INestApplication;
const rights: MenuRightsMemo[] = [];
const payments = new PaymentFixtures();
let tillPc: string;
let officePc: string;
let bank: string;
let clearing: string;
let income: string;
let customer: string;
let T1: string;
let T2: string;
let reasonNotPaid: string;
let reasonUnbilled: string;
let safeId: string;
let counterId: string;
let session: { tssId: string; tssAccYear: string; tssDayId: string };
let dayCreated = false;
const docIds: string[] = [];
let rowAuth: string;
let rowTime: string;
let rowLost: string;
let firstImport: { asiId: string; accYear: string };

const http = () => request(app.getHttpServer());
const postAs = (device: string, path: string, body: object, who = 'tester1') =>
  http().post(`/api/v1/${path}`).set('Authorization', as(who, device)).send(body);
const getAs = (device: string, path: string, query: object, who = 'tester1') =>
  http().get(`/api/v1/${path}`).set('Authorization', as(who, device)).query(query);
const upload = (path: string, fields: Record<string, string>, csv: string, name: string) => {
  let req = http().post(`/api/v1/${path}`).set('Authorization', as('tester1', officePc));
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  return req.attach('file', Buffer.from(csv, 'utf8'), name);
};
const codes = (res: request.Response): string[] =>
  (res.body.errors ?? []).map((e: { code?: string }) => e.code);
const scope = { companyId: COMPANY, branchId: BRANCH };

/** One money-in tender row through the shared writer (POST /tender-details/create). */
function tenderRow(over: Record<string, unknown>) {
  const docId = randomUUID();
  docIds.push(docId);
  return postAs(officePc, 'tender-details/create', {
    tdSrcModule: 'ACCOUNTS',
    tdSrcDocType: 'OTHER',
    tdSrcDocId: docId,
    tdCompanyId: COMPANY,
    tdBranchId: BRANCH,
    tdAccYear: ACC_YEAR,
    tdDocDate: today,
    tdPartyLedgerId: customer,
    tdUserId: TESTER1,
    tdDrCr: 'DR',
    tdTenderId: T1,
    tdTenderTypeId: CARD_TYPE,
    tdAmount: 100,
    ...over,
  });
}

/** Now, as a provider prints it (IST). */
function istStamp(d = new Date()): string {
  const ist = new Date(d.getTime() + 330 * 60_000).toISOString();
  return `${ist.slice(8, 10)}/${ist.slice(5, 7)}/${ist.slice(0, 4)} ${ist.slice(11, 16)}`;
}

async function setOverride(on: boolean): Promise<void> {
  await prisma.$executeRaw`
    UPDATE public.user_menus SET um_can_override = ${on}
     WHERE um_user_id = ${TESTER1}::uuid AND um_menu_id = ${SETTLEMENT_MENU}::int AND um_is_deleted = false`;
}

async function ledger(name: string, group: string, party = false): Promise<string> {
  const row = await prisma.accLedgerMaster.create({
    data: {
      ledName: `E2E-TS-${tag} ${name}`,
      ledGroupId: group,
      ledCompanyId: COMPANY,
      ...(party ? { ledLedgerType: 'PARTY', ledIsBillByBill: true } : {}),
    },
  });
  return row.ledId;
}

const FORMAT = {
  version: 1,
  source: 'CARD',
  provider: 'E2E BANK',
  columns: {
    txnOn: 'Txn Date',
    kind: 'Type',
    terminalId: 'TID',
    refNo: 'RRN',
    authCode: 'Auth',
    cardLast4: 'Card',
    gross: 'Amount',
    fee: 'MDR',
    tax: 'GST',
    net: 'Net',
    payoutRef: 'UTR',
    payoutDate: 'Settled',
  },
  kindMap: { SALE: ['Sale'], REFUND: ['Refund'], CHARGEBACK: ['CB'], FEE: ['Rental'] },
  dateFormat: 'DD/MM/YYYY HH:mm',
};
const HEADER = 'Txn Date,Type,TID,RRN,Auth,Card,Amount,MDR,GST,Net,UTR,Settled';

beforeAll(async () => {
  const device = async (name: string) => {
    const [row] = await prisma.$queryRaw<{ dev_id: string }[]>`
      INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
      VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-ts-${tag}-${name}`}, ${`E2E TS ${name}`}, 'Desktop')
      RETURNING dev_id::text`;
    return row.dev_id;
  };
  tillPc = await device('till');
  officePc = await device('office');
  bank = await ledger('Card Bank', GROUP.BANK);
  clearing = await ledger('Card Clearing', GROUP.CURRENT_ASSETS);
  income = await ledger('Unbilled Card Income', GROUP.INDIRECT_INCOMES);
  customer = await ledger('Card Customer', GROUP.CUSTOMERS, true);
  payments.parties.push(customer);
  const terminal = async (n: string) =>
    (
      await prisma.accTenderMaster.create({
        data: {
          tndCompanyId: COMPANY,
          tndBranchId: BRANCH,
          tndTypeId: CARD_TYPE,
          tndName: `E2E-TS-${tag} CARD ${n}`,
          tndShortName: `TS${n}`,
          tndLedgerId: clearing,
          tndSettlementLedgerId: bank,
          tndSettlementDays: 1,
          tndTerminalId: `E2E${n}${tag}`,
          tndNeedsRef: true,
          tndIsActive: true,
          tndCreatedBy: 'e2e-ts',
        },
      })
    ).tndId;
  T1 = await terminal('T1');
  T2 = await terminal('T2');
  const reasons = await prisma.tillReason.findMany({
    where: { trsCategory: 'NONCASH', trsCompanyId: null, trsIsDeleted: false },
    select: { trsId: true, trsCode: true },
  });
  reasonNotPaid = reasons.find((r) => r.trsCode === 'NOT_PAID')!.trsId;
  reasonUnbilled = reasons.find((r) => r.trsCode === 'UNBILLED_PAYMENT')!.trsId;
  const [day] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM accounts.till_business_day
     WHERE tbd_company_id = ${COMPANY}::uuid AND tbd_branch_id = ${BRANCH}::uuid AND tbd_is_deleted = false`;
  dayCreated = day.n === 0;

  rights.push(await grantMenuRights(prisma, [...TILL_MENUS, RCPV_MENU, SETTLEMENT_MENU], TESTER1));
  rights.push(await grantMenuRights(prisma, TILL_MENUS, TESTER));
  app = await bootIdentityApp();

  const safe = await postAs(officePc, 'till/safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: BRANCH,
    tsfCode: `E2ETS${tag}`,
    tsfName: 'E2E settlement safe',
    tsfIsDefault: true,
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const [counter] = await prisma.$queryRaw<{ tcn_id: string }[]>`
    INSERT INTO accounts.till_counter (tcn_company_id, tcn_branch_id, tcn_code, tcn_name, tcn_device_id, tcn_safe_id, tcn_created_by)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`E2ETS${tag}`}, 'E2E settlement counter', ${tillPc}::uuid, ${safeId}::uuid, 'e2e-ts')
    RETURNING tcn_id::text`;
  counterId = counter.tcn_id;
  const open = await postAs(tillPc, 'till/sessions/open', {
    companyId: COMPANY,
    branchId: BRANCH,
    floatMode: 'NONE',
    lines: [],
  });
  expectStatus(open, 201);
  session = open.body.data;
});

afterAll(async () => {
  const tenders = [T1, T2].filter(Boolean);
  const imports = await prisma.accSettlementImport.findMany({
    where: { asiTenderId: { in: tenders } },
    select: { asiId: true },
  });
  const asiIds = imports.map((i) => i.asiId);
  const lines = await prisma.accSettlementLine.findMany({
    where: { aslImportId: { in: asiIds } },
    select: { aslId: true },
  });
  const rows = await prisma.accTenderDetail.findMany({
    where: { tdTenderId: { in: tenders } },
    select: { tdId: true },
  });
  const srcIds = [...asiIds, ...lines.map((l) => l.aslId), ...rows.map((r) => r.tdId)];
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_src_doc_id = ANY(${[...asiIds, ...docIds]}::uuid[])`;
  await prisma.$executeRaw`
    DELETE FROM accounts.till_event WHERE tev_payload->>'tenderId' = ANY(${tenders}::text[])
       OR tev_payload->>'tdId' = ANY(${rows.map((r) => r.tdId)}::text[])`;
  await prisma.$executeRaw`DELETE FROM accounts.acc_settlement_line WHERE asl_import_id = ANY(${asiIds}::uuid[])`;
  await prisma.$executeRaw`DELETE FROM accounts.acc_settlement_import WHERE asi_id = ANY(${asiIds}::uuid[])`;
  if (srcIds.length) {
    const own = await prisma.$queryRaw<{ id: string; rev: string | null }[]>`
      SELECT avh_voucher_id::text AS id, avh_reversal_voucher_id::text AS rev
        FROM accounts.acc_voucher_header WHERE avh_src_doc_id = ANY(${srcIds}::uuid[])`;
    const ids = [
      ...new Set([
        ...own.map((o) => o.id),
        ...own.map((o) => o.rev).filter((r): r is string => !!r),
      ]),
    ];
    const mirrors = await prisma.$queryRaw<{ id: string }[]>`
      SELECT avh_voucher_id::text AS id FROM accounts.acc_voucher_header WHERE avh_against_voucher_id = ANY(${ids}::uuid[])`;
    const all = [...new Set([...ids, ...mirrors.map((m) => m.id)])];
    await prisma.$executeRaw`
      UPDATE accounts.acc_voucher_header SET avh_reversal_voucher_id = NULL, avh_reversal_acc_year = NULL
       WHERE avh_voucher_id = ANY(${all}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_vouchers WHERE av_voucher_id = ANY(${all}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_voucher_id = ANY(${all}::uuid[]) AND avh_against_voucher_id IS NOT NULL`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_voucher_id = ANY(${all}::uuid[])`;
  }
  await prisma.$executeRaw`DELETE FROM accounts.acc_tender_detail WHERE td_src_doc_id = ANY(${docIds}::uuid[])`;
  await payments.teardown();
  await prisma.$executeRaw`DELETE FROM accounts.acc_tender_detail WHERE td_tender_id = ANY(${tenders}::uuid[])`;
  if (session) {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`
      DELETE FROM accounts.till_count_line WHERE tcl_count_id IN (
        SELECT tct_id FROM accounts.till_count WHERE tct_session_id = ${session.tssId}::uuid)`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_session WHERE tss_id = ${session.tssId}::uuid`;
    if (dayCreated) {
      await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_day_id = ${session.tssDayId}::uuid`;
      await prisma.$executeRaw`
        DELETE FROM accounts.till_business_day d WHERE d.tbd_id = ${session.tssDayId}::uuid
           AND NOT EXISTS (SELECT 1 FROM accounts.till_session s WHERE s.tss_day_id = d.tbd_id)`;
    }
  }
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_device_id IN (${tillPc ?? null}::uuid, ${officePc ?? null}::uuid)`;
  await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_id = ${counterId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.till_safe WHERE tsf_id = ${safeId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.acc_tender_master WHERE tnd_id = ANY(${tenders}::uuid[])`;
  await prisma.$executeRaw`
    DELETE FROM accounts.acc_ledger_master WHERE led_id IN (${bank ?? null}::uuid, ${clearing ?? null}::uuid, ${income ?? null}::uuid)`;
  await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_id IN (${tillPc ?? null}::uuid, ${officePc ?? null}::uuid)`;
  for (const memo of rights.reverse()) {
    await restoreMenuRights(prisma, memo);
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('§3 · the reference at billing', () => {
  it('a money-in card row needs the last 4; a 4-digit reference is taken for it; money out is never asked', async () => {
    const bare = await tenderRow({ tdAmount: 777 });
    expectStatus(bare, 422);
    expect(codes(bare)).toEqual(['TENDER_REF_REQUIRED']);

    const keyed = await tenderRow({ tdAmount: 777, tdRefNo: '4432' });
    expectStatus(keyed, 201);
    rowLost = keyed.body.data.tdId;
    const [stored] = await prisma.$queryRaw<{ last4: string; status: string; expected: string }[]>`
      SELECT td_card_last4 AS last4, td_settle_status AS status, td_expected_settle_on::text AS expected
        FROM accounts.acc_tender_detail WHERE td_id = ${rowLost}::uuid`;
    expect(stored.last4).toBe('4432');
    expect(stored.status).toBe('PENDING');
    expect(stored.expected > today).toBe(true);

    const out = await tenderRow({ tdAmount: 50, tdDrCr: 'CR' });
    expectStatus(out, 201);
  });

  it('the same approval code + last 4 + amount on another document is TENDER_REF_DUPLICATE, journalled', async () => {
    const first = await tenderRow({ tdAmount: 1250, tdAuthCode: 'A81K2Z', tdCardLast4: '4432' });
    expectStatus(first, 201);
    rowAuth = first.body.data.tdId;
    const twin = await tenderRow({ tdAmount: 1250, tdAuthCode: 'a81k2z', tdCardLast4: '4432' });
    expectStatus(twin, 409);
    expect(codes(twin)).toEqual(['TENDER_REF_DUPLICATE']);
    const [event] = await prisma.$queryRaw<{ other: string }[]>`
      SELECT tev_payload->>'otherTdId' AS other FROM accounts.till_event
       WHERE tev_event_code = 'DUPLICATE_REF_BLOCKED' AND tev_payload->>'tenderId' = ${T1}`;
    expect(event.other).toBe(rowAuth);

    const timed = await tenderRow({ tdAmount: 300, tdRefNo: '5555' });
    expectStatus(timed, 201);
    rowTime = timed.body.data.tdId;
  });
});

describe('§5 · a statement: column map, import, match, post', () => {
  it('the column map is checked in full, saved, and tried on a sample', async () => {
    const bad = await postAs(officePc, 'tender-settlement/format', {
      companyId: COMPANY,
      tenderId: T1,
      format: { version: 1, source: 'CARD', columns: { amount: 'X' } },
    });
    expectStatus(bad, 422);
    expect(codes(bad)).toContain('SETTLEMENT_FORMAT_INVALID');
    for (const tenderId of [T1, T2]) {
      const saved = await postAs(officePc, 'tender-settlement/format', {
        companyId: COMPANY,
        tenderId,
        format: FORMAT,
      });
      expectStatus(saved, 200);
    }
    const read = await getAs(officePc, 'tender-settlement/format', {
      companyId: COMPANY,
      tenderId: T1,
    });
    expect(read.body.data.format.provider).toBe('E2E BANK');
    const tried = await http()
      .post('/api/v1/tender-settlement/format/test')
      .set('Authorization', as('tester1', officePc))
      .field('companyId', COMPANY)
      .field('tenderId', T1)
      .attach(
        'file',
        Buffer.from(`${HEADER}\n${istStamp()},Sale,x,R9,,,10.00,0,0,10.00,U,${istStamp()}\n`),
        'sample.csv',
      );
    expectStatus(tried, 200);
    expect(tried.body.data.lines).toHaveLength(1);
  });

  it('imports one payout: AUTH matched, AMOUNT_TIME suggested, the other terminal’s money unmatched; the same file is refused', async () => {
    const csv = [
      HEADER,
      `${istStamp()},Sale,E2ET1${tag},R1${tag},A81K2Z,XXXXXXXXXXXX4432,"1,250.00",25.00,4.50,1220.50,E2E-UTR-${tag},${istStamp()}`,
      `${istStamp()},Sale,E2ET1${tag},R2${tag},,5555,300.00,6.00,1.08,292.92,E2E-UTR-${tag},${istStamp()}`,
      `${istStamp()},Sale,E2ET2${tag},R3${tag},,9876,500.00,10.00,1.80,488.20,E2E-UTR-${tag},${istStamp()}`,
      `${istStamp()},Rental,E2ET1${tag},,,,0,100.00,18.00,-118.00,E2E-UTR-${tag},${istStamp()}`,
    ].join('\n');
    const res = await upload(
      'tender-settlement/import',
      { ...scope, tenderId: T1 },
      csv,
      `e2e-${tag}.csv`,
    );
    expectStatus(res, 201);
    expect(res.body.data.imports).toHaveLength(1);
    const imp = res.body.data.imports[0];
    firstImport = { asiId: imp.asiId, accYear: imp.accYear };
    expect(imp).toEqual(
      expect.objectContaining({
        status: 'IMPORTED',
        payoutRef: `E2E-UTR-${tag}`,
        totalGross: 2050,
        totalFee: 141,
        totalTax: 25.38,
        totalNet: 1883.62,
      }),
    );
    const byRow = (n: number) => imp.lines.find((l: { rowNo: number }) => l.rowNo === n);
    expect(byRow(1)).toEqual(
      expect.objectContaining({ matchStatus: 'MATCHED', matchRule: 'AUTH' }),
    );
    expect(byRow(1).tenderRow.tdId).toBe(rowAuth);
    expect(byRow(2)).toEqual(
      expect.objectContaining({ matchStatus: 'SUGGESTED', matchRule: 'AMOUNT_TIME' }),
    );
    expect(byRow(2).tenderRow.tdId).toBe(rowTime);
    expect(byRow(3)).toEqual(expect.objectContaining({ matchStatus: 'UNMATCHED', tenderId: T2 }));
    expect(byRow(4)).toEqual(expect.objectContaining({ kind: 'FEE', matchStatus: 'UNMATCHED' }));

    const again = await upload(
      'tender-settlement/import',
      { ...scope, tenderId: T1 },
      csv,
      `e2e-${tag}.csv`,
    );
    expectStatus(again, 409);
    expect(codes(again)).toEqual(['SETTLEMENT_FILE_DUPLICATE']);
  });

  it('posts only once the suggestion is decided: one TSet, the matched rows SETTLED', async () => {
    const key = { ...scope, accYear: firstImport.accYear, asiId: firstImport.asiId };
    const early = await postAs(officePc, 'tender-settlement/post', key);
    expectStatus(early, 409);
    expect(codes(early)).toEqual(['SETTLEMENT_SUGGESTIONS_OPEN']);

    const got = await getAs(officePc, 'tender-settlement/get', key);
    const suggested = got.body.data.lines.find(
      (l: { matchStatus: string }) => l.matchStatus === 'SUGGESTED',
    );
    const confirmed = await postAs(officePc, 'tender-settlement/confirm', {
      ...scope,
      accYear: firstImport.accYear,
      aslId: suggested.aslId,
    });
    expectStatus(confirmed, 200);

    const posted = await postAs(officePc, 'tender-settlement/post', key);
    expectStatus(posted, 201);
    expect(posted.body.data.status).toBe('POSTED');
    const legs = posted.body.data.legs as {
      drCr: string;
      ledgerId: string;
      role: string | null;
      amount: number;
    }[];
    const leg = (pred: (l: (typeof legs)[number]) => boolean) => legs.find(pred);
    expect(leg((l) => l.ledgerId === bank)).toEqual(
      expect.objectContaining({ drCr: 'DR', amount: 1883.62 }),
    );
    expect(leg((l) => l.role === 'BANK_CHARGES')).toEqual(
      expect.objectContaining({ drCr: 'DR', amount: 141 }),
    );
    expect(leg((l) => l.role === 'GST_ON_CHARGES_PENDING')).toEqual(
      expect.objectContaining({ drCr: 'DR', amount: 25.38 }),
    );
    expect(leg((l) => l.ledgerId === clearing)).toEqual(
      expect.objectContaining({ drCr: 'CR', amount: 1550 }),
    );
    expect(leg((l) => l.role === 'TENDER_SUSPENSE')).toEqual(
      expect.objectContaining({ drCr: 'CR', amount: 500 }),
    );

    const settled = await prisma.$queryRaw<{ status: string; amount: string; voucher: string }[]>`
      SELECT td_settle_status AS status, td_settle_amount::text AS amount, td_settle_voucher_id::text AS voucher
        FROM accounts.acc_tender_detail WHERE td_id IN (${rowAuth}::uuid, ${rowTime}::uuid) ORDER BY td_total_amt DESC`;
    expect(settled.map((s) => [s.status, Number(s.amount), s.voucher])).toEqual([
      ['SETTLED', 1250, posted.body.data.voucherId],
      ['SETTLED', 300, posted.body.data.voucherId],
    ]);

    const [grid] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT grid_id::text AS id FROM fixed.grid_details WHERE grid_name = 'TENDER SETTLEMENT - UNEXPLAINED'`;
    const list = await getAs(officePc, 'configured-grid-sql/run', {
      grid_id: grid.id,
      limit: '100',
      grid_param: JSON.stringify({ iasi_company_id: COMPANY, iasi_branch_id: BRANCH }),
      search: `R3${tag}`,
    });
    expectStatus(list, 200);
    expect((list.body.data.items as { asl_ref_no: string }[]).map((r) => r.asl_ref_no)).toEqual([
      `R3${tag}`,
    ]);
  });
});

describe('§6.2 · money, no row', () => {
  it('resolve needs OVERRIDE; INCOME books the line out of suspense; a payout built on is not voided', async () => {
    const key = { ...scope, accYear: firstImport.accYear, asiId: firstImport.asiId };
    const got = await getAs(officePc, 'tender-settlement/get', key);
    const line = got.body.data.lines.find((l: { rowNo: number }) => l.rowNo === 3);
    const body = {
      ...scope,
      accYear: firstImport.accYear,
      aslId: line.aslId,
      resolution: 'INCOME',
      reasonId: reasonUnbilled,
      incomeLedgerId: income,
    };
    await setOverride(false);
    const refused = await postAs(officePc, 'tender-settlement/resolve', body);
    await setOverride(true);
    expectStatus(refused, 403);
    expect(codes(refused)).toEqual(['SETTLEMENT_RESOLVE_NEEDS_APPROVAL']);

    const done = await postAs(officePc, 'tender-settlement/resolve', body);
    expectStatus(done, 200);
    expect(done.body.data.line).toEqual(
      expect.objectContaining({ matchStatus: 'RESOLVED', resolution: 'INCOME' }),
    );
    expect(
      (done.body.data.legs as { drCr: string; ledgerId: string; amount: number }[]).map((l) => [
        l.drCr,
        l.ledgerId === income,
        l.amount,
      ]),
    ).toEqual([
      ['DR', false, 500],
      ['CR', true, 500],
    ]);

    const voided = await postAs(officePc, 'tender-settlement/void', { ...key, reason: 'e2e' });
    expectStatus(voided, 409);
    expect(codes(voided)).toEqual(['SETTLEMENT_POSTED_LOCKED']);
  });
});

describe('§6.1 · our row, no money', () => {
  it('write-off needs OVERRIDE; LOSS posts a TVar and fails the row; a settled row is locked', async () => {
    const body = {
      ...scope,
      tdId: rowLost,
      tdAccYear: ACC_YEAR,
      treatment: 'LOSS',
      reasonId: reasonNotPaid,
    };
    await setOverride(false);
    const refused = await postAs(officePc, 'tender-settlement/write-off', body);
    await setOverride(true);
    expectStatus(refused, 403);
    expect(codes(refused)).toEqual(['NONCASH_WRITE_OFF_NEEDS_APPROVAL']);

    const done = await postAs(officePc, 'tender-settlement/write-off', body);
    expectStatus(done, 200);
    expect(done.body.data).toEqual(
      expect.objectContaining({
        amount: 777,
        creditLedgerId: clearing,
        voucherId: expect.any(String),
      }),
    );
    const [row] = await prisma.$queryRaw<{ status: string; voucher: string }[]>`
      SELECT td_settle_status AS status, td_settle_voucher_id::text AS voucher
        FROM accounts.acc_tender_detail WHERE td_id = ${rowLost}::uuid`;
    expect(row).toEqual({ status: 'FAILED', voucher: done.body.data.voucherId });
    expect(
      await prisma.tillEvent.count({
        where: {
          tevEventCode: 'NONCASH_WRITTEN_OFF',
          tevPayload: { path: ['tdId'], equals: rowLost },
        },
      }),
    ).toBe(1);

    const settled = await postAs(officePc, 'tender-settlement/write-off', {
      ...body,
      tdId: rowAuth,
    });
    expectStatus(settled, 409);
    expect(codes(settled)).toEqual(['SETTLEMENT_POSTED_LOCKED']);
  });
});

describe('§5.5 · void', () => {
  it('a posted payout voids: its TSet reversed, its row PENDING again, the file readable again', async () => {
    const row = await tenderRow({ tdAmount: 400, tdAuthCode: 'B22222', tdCardLast4: '9999' });
    expectStatus(row, 201);
    const tdId = row.body.data.tdId;
    const csv = [
      HEADER,
      `${istStamp()},Sale,E2ET1${tag},V1${tag},B22222,9999,400.00,8.00,1.44,390.56,E2E-UTR2-${tag},${istStamp()}`,
    ].join('\n');
    const imported = await upload(
      'tender-settlement/import',
      { ...scope, tenderId: T1 },
      csv,
      `e2e-v-${tag}.csv`,
    );
    expectStatus(imported, 201);
    const imp = imported.body.data.imports[0];
    expect(imp.status).toBe('MATCHED');
    const key = { ...scope, accYear: imp.accYear, asiId: imp.asiId };
    expectStatus(await postAs(officePc, 'tender-settlement/post', key), 201);

    const voided = await postAs(officePc, 'tender-settlement/void', {
      ...key,
      reason: 'wrong file',
    });
    expectStatus(voided, 200);
    expect(voided.body.data.status).toBe('VOIDED');
    const [back] = await prisma.$queryRaw<{ status: string; voucher: string | null }[]>`
      SELECT td_settle_status AS status, td_settle_voucher_id::text AS voucher
        FROM accounts.acc_tender_detail WHERE td_id = ${tdId}::uuid`;
    expect(back).toEqual({ status: 'PENDING', voucher: null });

    const reread = await upload(
      'tender-settlement/import',
      { ...scope, tenderId: T1 },
      csv,
      `e2e-v-${tag}.csv`,
    );
    expectStatus(reread, 201);
    const second = reread.body.data.imports[0];
    expectStatus(
      await postAs(officePc, 'tender-settlement/void', {
        ...scope,
        accYear: second.accYear,
        asiId: second.asiId,
        reason: 'e2e',
      }),
      200,
    );
  });
});

describe('§4 · the close: one line per terminal, the slip check', () => {
  it('a card count names its terminal; the approver lists the rows and records a SLIP_CHECK; the cashier may not', async () => {
    const receipt = await postAs(tillPc, 'vouchers/post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'RcpV',
        date: today,
        remarks: `E2E-TS-${tag} card receipts`,
        employeeIds: [],
      },
      lines: [
        {
          rowNo: 1,
          drCr: 'CR',
          ledgerId: customer,
          amount: 1250,
          instrument: { tenderId: T1, refNo: '4432' },
        },
        {
          rowNo: 2,
          drCr: 'CR',
          ledgerId: customer,
          amount: 300,
          instrument: { tenderId: T2, refNo: '1111' },
        },
      ],
    });
    expectStatus(receipt, 201);
    payments.vouchers.push(receipt.body.data.voucherId ?? receipt.body.data.header?.voucherId);
    const key = { ...scope, accYear: session.tssAccYear, tssId: session.tssId };
    expectStatus(await postAs(tillPc, 'till/sessions/end-billing', key), 200);

    const unnamed = await postAs(tillPc, 'till/sessions/count', {
      ...key,
      lines: [{ tenderTypeId: CARD_TYPE, qty: 2, enteredAmount: 1550 }],
    });
    expectStatus(unnamed, 422);
    expect(codes(unnamed)).toEqual(['TILL_COUNT_INVALID']);
    expect(unnamed.body.errors[0].field).toBe('lines.0.tenderId');

    const counted = await postAs(tillPc, 'till/sessions/count', {
      ...key,
      lines: [
        { tenderTypeId: CARD_TYPE, tenderId: T1, qty: 1, enteredAmount: 1000, batchRef: '0031' },
        { tenderTypeId: CARD_TYPE, tenderId: T2, qty: 1, enteredAmount: 300, batchRef: '0007' },
      ],
    });
    expect([200, 201]).toContain(counted.status);
    expect(counted.body.data.outcome).toBe('RECOUNT_REQUIRED');

    const blind = await getAs(tillPc, 'till/sessions/slip-check', { ...key, tenderId: T1 });
    expectStatus(blind, 403);
    expect(codes(blind)).toEqual(['TILL_BLIND_CLOSE']);

    const rows = await getAs(
      officePc,
      'till/sessions/slip-check',
      { ...key, tenderId: T1 },
      'tester',
    );
    expectStatus(rows, 200);
    expect(rows.body.data).toEqual(
      expect.objectContaining({
        expected: 1250,
        batchTotal: 1000,
        batchRef: '0031',
        difference: -250,
      }),
    );
    expect(
      rows.body.data.rows.map((r: { amount: number; cardLast4: string }) => [
        r.amount,
        r.cardLast4,
      ]),
    ).toEqual([[1250, '4432']]);

    const recorded = await postAs(
      officePc,
      'till/sessions/slip-check',
      {
        ...key,
        tenderId: T1,
        ticked: 1,
        noSlip: [],
        amountDiffers: [],
        slipsWithoutRow: [{ amount: 250, cardLast4: '0001' }],
        notes: 'one slip with no row',
      },
      'tester',
    );
    expectStatus(recorded, 200);
    expect(recorded.body.data).toEqual(expect.objectContaining({ ticked: 1, slipsWithoutRow: 1 }));
    expect(
      await prisma.tillEvent.count({
        where: { tevEventCode: 'SLIP_CHECK', tevSessionId: session.tssId },
      }),
    ).toBe(1);
  });
});
