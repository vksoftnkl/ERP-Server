import { Prisma } from '@prisma/client';
import {
  groupByPayout,
  istDate,
  parseAmount,
  parseDateTime,
  parseStatementCsv,
  validateStatementFormat,
  type StatementFormat,
} from './settlement-format';
import { SettlementLineKind, SettlementSource } from './types/tender-settlement-enum';

const HDFC: StatementFormat = {
  version: 1,
  source: SettlementSource.CARD,
  provider: 'HDFC',
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
  kindMap: { SALE: ['Sale'], REFUND: ['Refund'], CHARGEBACK: ['CB'] },
  dateFormat: 'DD/MM/YYYY HH:mm',
  negativeIsRefund: true,
};

describe('validateStatementFormat', () => {
  it('accepts a full map and keeps it', () => {
    const { format, problems } = validateStatementFormat(HDFC);
    expect(problems).toEqual([]);
    expect(format).toEqual(HDFC);
  });

  it('lists every problem at once', () => {
    const { format, problems } = validateStatementFormat({
      version: 2,
      source: 'CHEQUE',
      columns: { amount: 'X', kind: 'Type' },
      dateFormat: 'HH:mm',
    });
    expect(format).toBeNull();
    expect(problems).toEqual(
      expect.arrayContaining([
        'version must be 1',
        expect.stringContaining('source must be one of'),
        expect.stringContaining('provider is required'),
        expect.stringContaining('columns.amount is not a field'),
        'columns.gross is required',
        expect.stringContaining('kind column needs a kindMap'),
        expect.stringContaining('dateFormat must contain'),
      ]),
    );
  });
});

describe('parseAmount / parseDateTime', () => {
  it('reads Indian statement amounts', () => {
    expect(parseAmount('1,234.50')!.toFixed(2)).toBe('1234.50');
    expect(parseAmount('₹ 160')!.toFixed(2)).toBe('160.00');
    expect(parseAmount('(160.00)')!.toFixed(2)).toBe('-160.00');
    expect(parseAmount('160.00 DR')!.toFixed(2)).toBe('-160.00');
    expect(parseAmount('160.00 CR')!.toFixed(2)).toBe('160.00');
    expect(parseAmount('abc')).toBeNull();
  });

  it('reads a local (IST) time to the instant, and refuses an impossible date', () => {
    const at = parseDateTime('08/10/2026 10:12', 'DD/MM/YYYY HH:mm')!;
    expect(at.toISOString()).toBe('2026-10-08T04:42:00.000Z');
    expect(istDate(at)).toBe('2026-10-08');
    expect(parseDateTime('08/10/2026', 'DD/MM/YYYY HH:mm')!.toISOString()).toBe(
      '2026-10-07T18:30:00.000Z',
    );
    expect(parseDateTime('2026-10-08 23:59')!.toISOString()).toBe('2026-10-08T18:29:00.000Z');
    expect(parseDateTime('31/02/2026', 'DD/MM/YYYY')).toBeNull();
    expect(parseDateTime('8/10/26', 'D/M/YY')!.toISOString()).toBe('2026-10-07T18:30:00.000Z');
  });
});

describe('parseStatementCsv', () => {
  const csv = [
    'Txn Date,Type,TID,RRN,Auth,Card,Amount,MDR,GST,Net,UTR,Settled',
    '08/10/2026 10:12,Sale,T1,628112345678,A81K2Z,XXXX XXXX XXXX 4432,"1,250.00",25.00,4.50,1220.50,UTR001,09/10/2026 08:00',
    '08/10/2026 11:40,Refund,T1,628112345679,,4432,160.00,0,0,-160.00,UTR001,09/10/2026 08:00',
    '08/10/2026 12:00,CB,T2,628112345680,B12345,1111,500.00,0,0,-500.00,UTR002,10/10/2026 08:00',
  ].join('\n');

  it('reads every line with its kind, amounts, last 4 and payout', () => {
    const { lines, problems } = parseStatementCsv(csv, HDFC);
    expect(problems).toEqual([]);
    expect(lines.map((l) => l.kind)).toEqual([
      SettlementLineKind.SALE,
      SettlementLineKind.REFUND,
      SettlementLineKind.CHARGEBACK,
    ]);
    expect(lines[0]).toEqual(
      expect.objectContaining({
        lineNo: 2,
        terminalId: 'T1',
        refNo: '628112345678',
        authCode: 'A81K2Z',
        cardLast4: '4432',
        payoutRef: 'UTR001',
        payoutDate: '2026-10-09',
      }),
    );
    expect(lines[0].net.toFixed(2)).toBe('1220.50');
    expect(lines[1].gross.toFixed(2)).toBe('160.00');
  });

  it('splits a file into one import per payout', () => {
    const { lines } = parseStatementCsv(csv, HDFC);
    const groups = groupByPayout(lines, { payoutRef: null, payoutDate: null });
    expect(groups.map((g) => [g.payoutRef, g.payoutDate, g.lines.length])).toEqual([
      ['UTR001', '2026-10-09', 2],
      ['UTR002', '2026-10-10', 1],
    ]);
  });

  it('refuses a net that is not gross − fee − tax, and a missing header, naming the line', () => {
    const bad = csv.replace('1220.50', '1220.00');
    expect(parseStatementCsv(bad, HDFC).problems).toEqual([
      { lineNo: 2, message: expect.stringContaining('net 1220.00 ≠ gross 1250.00') },
    ]);
    const noHeader = csv.replace('RRN', 'Ref');
    expect(parseStatementCsv(noHeader, HDFC).problems[0].message).toContain('no "RRN" column');
  });

  it('with no kind column, a negative gross is a refund', () => {
    const format: StatementFormat = {
      version: 1,
      source: SettlementSource.UPI,
      provider: 'PhonePe',
      columns: { gross: 'Amount', refNo: 'UTR' },
      negativeIsRefund: true,
    };
    const { lines } = parseStatementCsv('Amount,UTR\n100,111\n-40,222\n', format);
    expect(lines.map((l) => [l.kind, l.gross.toFixed(2)])).toEqual([
      [SettlementLineKind.SALE, '100.00'],
      [SettlementLineKind.REFUND, '40.00'],
    ]);
    expect(lines[1].net.equals(new Prisma.Decimal(40))).toBe(true);
  });
});
