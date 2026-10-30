import { Prisma } from '@prisma/client';
import { poApprovalStatus, poDocStatus, poLineStatus } from './purchase-order';

const D = (v: number) => new Prisma.Decimal(v);

describe('PO line / document status (derived)', () => {
  it('line: OPEN → PART → DONE, and SHORT_CLOSED when the rest is closed', () => {
    expect(poLineStatus(D(10), D(0), D(0))).toBe('OPEN');
    expect(poLineStatus(D(10), D(4), D(0))).toBe('PART');
    expect(poLineStatus(D(10), D(10), D(0))).toBe('DONE');
    expect(poLineStatus(D(10), D(12), D(0))).toBe('DONE');
    expect(poLineStatus(D(10), D(4), D(6))).toBe('SHORT_CLOSED');
    expect(poLineStatus(D(10), D(0), D(10))).toBe('SHORT_CLOSED');
  });
  it('document: draft / cancelled / approval first, then by the lines', () => {
    expect(poDocStatus('DRAFT', 'NOT_REQUIRED', ['OPEN'])).toBe('DRAFT');
    expect(poDocStatus('CANCELLED', 'NOT_REQUIRED', ['OPEN'])).toBe('CANCELLED');
    expect(poDocStatus('POSTED', 'AWAITING', ['OPEN'])).toBe('AWAITING_APPROVAL');
    expect(poDocStatus('POSTED', 'REJECTED', ['OPEN'])).toBe('NOT_APPROVED');
    expect(poDocStatus('POSTED', 'APPROVED', ['OPEN', 'OPEN'])).toBe('CONFIRMED');
    expect(poDocStatus('POSTED', 'NOT_REQUIRED', ['PART', 'OPEN'])).toBe('PART_RECEIVED');
    expect(poDocStatus('POSTED', 'NOT_REQUIRED', ['DONE', 'OPEN'])).toBe('PART_RECEIVED');
    expect(poDocStatus('POSTED', 'NOT_REQUIRED', ['DONE', 'DONE'])).toBe('RECEIVED');
    expect(poDocStatus('POSTED', 'NOT_REQUIRED', ['DONE', 'SHORT_CLOSED'])).toBe('CLOSED');
  });
});

describe('PO approval — on the goods value only (user 2026-10-29)', () => {
  const goods = (taxable: number, tax: number) => ({ taxable: D(taxable), cgst: D(tax / 2), sgst: D(tax / 2), igst: D(0), cess: D(0) });
  const base = { limit: D(10000), confirming: true, amending: false, current: null, currentGoodsValue: null };
  it('goods 9,440 under a 10,000 limit with 2,000 of charges: no approval (charges never count)', () => {
    const r = poApprovalStatus({ ...base, goods: goods(8000, 1440), chargesEstimate: D(2000) });
    expect(r.value.toString()).toBe('9440');
    expect(r.status).toBe('NOT_REQUIRED');
  });
  it('goods 11,800 over the limit waits, whatever the charges', () => {
    expect(poApprovalStatus({ ...base, goods: goods(10000, 1800), chargesEstimate: D(0) }).status).toBe('AWAITING');
    expect(poApprovalStatus({ ...base, goods: goods(10000, 1800), chargesEstimate: D(-5000) }).status).toBe('AWAITING');
  });
  it('limit 0 = off', () => {
    expect(poApprovalStatus({ ...base, limit: D(0), goods: goods(1e6, 0), chargesEstimate: D(0) }).status).toBe('NOT_REQUIRED');
  });
  it('amend: an approved PO stays approved unless its goods value rises; a charge rise alone never asks again', () => {
    const am = { ...base, confirming: false, amending: true, current: 'APPROVED', currentGoodsValue: D(11800) };
    expect(poApprovalStatus({ ...am, goods: goods(10000, 1800), chargesEstimate: D(9999) }).status).toBe('APPROVED');
    expect(poApprovalStatus({ ...am, goods: goods(10100, 1818), chargesEstimate: D(0) }).status).toBe('AWAITING');
    expect(poApprovalStatus({ ...am, goods: goods(5000, 900), chargesEstimate: D(0) }).status).toBe('NOT_REQUIRED');
  });
});
