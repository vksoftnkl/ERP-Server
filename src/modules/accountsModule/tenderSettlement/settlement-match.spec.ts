import { Prisma } from '@prisma/client';
import { matchLines, type MatchCandidate, type MatchLine } from './settlement-match';
import {
  SettlementLineKind,
  SettlementMatchRule,
  SettlementMatchStatus,
} from './types/tender-settlement-enum';

const T1 = 'tender-t1';
const T2 = 'tender-t2';
const d = (v: number | string) => new Prisma.Decimal(v);
const at = (iso: string) => new Date(iso);

function line(over: Partial<MatchLine> & { aslId: string }): MatchLine {
  return {
    kind: SettlementLineKind.SALE,
    tenderId: T1,
    refNo: null,
    authCode: null,
    cardLast4: null,
    gross: d(100),
    txnOn: null,
    ...over,
  };
}

function row(over: Partial<MatchCandidate> & { tdId: string }): MatchCandidate {
  return {
    tdAccYear: '2026-2027',
    tenderId: T1,
    drCr: 'DR',
    settleStatus: 'PENDING',
    refNo: null,
    authCode: null,
    cardLast4: null,
    amount: d(100),
    docDate: '2026-10-08',
    createdOn: at('2026-10-08T05:00:00Z'),
    ...over,
  };
}

const opts = { tolerance: d(0), windowMinutes: 30 };

describe('matchLines', () => {
  it('REF matches on the reference within tolerance; over it, nothing', () => {
    const verdicts = matchLines(
      [line({ aslId: 'a', refNo: 'utr1' }), line({ aslId: 'b', refNo: 'UTR2', gross: d(101) })],
      [row({ tdId: 'x', refNo: 'UTR1' }), row({ tdId: 'y', refNo: 'UTR2' })],
      opts,
    );
    expect(verdicts[0]).toEqual(
      expect.objectContaining({
        status: SettlementMatchStatus.MATCHED,
        rule: SettlementMatchRule.REF,
        tdId: 'x',
      }),
    );
    expect(verdicts[1].status).toBe(SettlementMatchStatus.UNMATCHED);
    const tolerant = matchLines(
      [line({ aslId: 'b', refNo: 'UTR2', gross: d(101) })],
      [row({ tdId: 'y', refNo: 'UTR2' })],
      {
        ...opts,
        tolerance: d(1),
      },
    );
    expect(tolerant[0]).toEqual(expect.objectContaining({ tdId: 'y' }));
    expect(tolerant[0].diff.toFixed(2)).toBe('1.00');
  });

  it('AUTH matches card code + last 4 + amount within a day', () => {
    const verdicts = matchLines(
      [
        line({
          aslId: 'a',
          authCode: 'a81k2z',
          cardLast4: '4432',
          txnOn: at('2026-10-08T06:00:00Z'),
        }),
      ],
      [
        row({ tdId: 'other-card', authCode: 'A81K2Z', cardLast4: '1111' }),
        row({ tdId: 'x', authCode: 'A81K2Z', cardLast4: '4432' }),
      ],
      opts,
    );
    expect(verdicts[0]).toEqual(
      expect.objectContaining({ rule: SettlementMatchRule.AUTH, tdId: 'x' }),
    );
  });

  it('AMOUNT_TIME only suggests, and only when each side has exactly one', () => {
    const one = matchLines(
      [line({ aslId: 'a', txnOn: at('2026-10-08T05:10:00Z') })],
      [row({ tdId: 'x' }), row({ tdId: 'far', createdOn: at('2026-10-08T09:00:00Z') })],
      opts,
    );
    expect(one[0]).toEqual(
      expect.objectContaining({
        status: SettlementMatchStatus.SUGGESTED,
        rule: SettlementMatchRule.AMOUNT_TIME,
        tdId: 'x',
      }),
    );
    const two = matchLines(
      [line({ aslId: 'a', txnOn: at('2026-10-08T05:10:00Z') })],
      [row({ tdId: 'x' }), row({ tdId: 'y', createdOn: at('2026-10-08T05:20:00Z') })],
      opts,
    );
    expect(two[0].status).toBe(SettlementMatchStatus.UNMATCHED);
    const twoLines = matchLines(
      [
        line({ aslId: 'a', txnOn: at('2026-10-08T05:10:00Z') }),
        line({ aslId: 'b', txnOn: at('2026-10-08T05:15:00Z') }),
      ],
      [row({ tdId: 'x' })],
      opts,
    );
    expect(twoLines.map((v) => v.status)).toEqual([
      SettlementMatchStatus.UNMATCHED,
      SettlementMatchStatus.UNMATCHED,
    ]);
  });

  it('never gives one row to two lines, never crosses terminals, and keeps rows others hold', () => {
    const verdicts = matchLines(
      [
        line({ aslId: 'a', refNo: 'U1' }),
        line({ aslId: 'b', refNo: 'U1' }),
        line({ aslId: 'c', refNo: 'U9', tenderId: T2 }),
        line({ aslId: 'd', refNo: 'U5' }),
      ],
      [
        row({ tdId: 'x', refNo: 'U1' }),
        row({ tdId: 'z', refNo: 'U9' }),
        row({ tdId: 'h', refNo: 'U5' }),
      ],
      { ...opts, taken: new Set(['SALE|h']) },
    );
    expect(verdicts.map((v) => v.tdId)).toEqual(['x', null, null, null]);
  });

  it('a refund takes a money-out row; a chargeback a settled money-in row', () => {
    const verdicts = matchLines(
      [
        line({ aslId: 'r', kind: SettlementLineKind.REFUND, refNo: 'R1' }),
        line({ aslId: 'c', kind: SettlementLineKind.CHARGEBACK, refNo: 'S1' }),
        line({ aslId: 'f', kind: SettlementLineKind.FEE, refNo: 'S1' }),
      ],
      [
        row({ tdId: 'in', refNo: 'R1' }),
        row({ tdId: 'out', refNo: 'R1', drCr: 'CR' }),
        row({ tdId: 'pending', refNo: 'S1' }),
        row({ tdId: 'settled', refNo: 'S1', settleStatus: 'SETTLED' }),
      ],
      opts,
    );
    expect(verdicts.map((v) => v.tdId)).toEqual(['out', 'settled', null]);
  });
});
