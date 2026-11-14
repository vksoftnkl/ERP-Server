import type { RegisterDetailLine, RegisterDoc } from '../../../common/posting/doc-register.types';
import type { DocRow } from '../posting/sales-doc-store';
import { SALES_VOUCHER_TYPE, isoDate } from '../posting/sales-doc.utils';
import { ZERO, n, signed, type Dec } from './sale-return-money';
import type { ReturnMoney } from './sale-return-preview';

/**
 * The CREDIT_NOTE register row of a posted return (sign −1), built from the
 * money the post worked out — the same figures the legs carry.
 *
 * Gap 50, the Sale Bill's rule mirrored (bill-snapshot.ts registerChargesOf):
 * the discount / other charge columns carry EVERY charge the return gives
 * back, net of its own GST — the carried rows, and the before-tax ones that
 * came back inside the lines (Σ sri_chrg_before_tax, split per bill charge so
 * a deduction and an addition on one line both show). So gross − discount +
 * other charge = taxable, as on the bill.
 */
export function returnRegisterDoc(
  row: DocRow,
  money: ReturnMoney,
  voucherId: string,
  voucherNo: bigint,
  actor: string,
): RegisterDoc {
  const t = money.totals;
  const nature = money.nature;
  let other = ZERO;
  let deduction = ZERO;
  const add = (v: Dec) => {
    if (v.gte(0)) {
      other = other.plus(v);
    } else {
      deduction = deduction.minus(v);
    }
  };
  // Carried rows: signed amount, net of the GST the tax columns already hold.
  for (const c of money.charges.filter((x) => x.kind === 'CARRIED')) {
    add(signed(c, c.back.amount));
  }
  // Before-tax rows inside the lines: per bill charge, and whatever the line
  // split leaves over (a paisa of rounding) by its own sign.
  const inLines = money.charges.filter((x) => x.kind === 'IN_LINES');
  let explained = ZERO;
  for (const c of inLines) {
    const v = signed(c, c.back.amount);
    explained = explained.plus(v);
    add(v);
  }
  const lineBeforeTax = money.lines.reduce((s, l) => s.plus(l.parts.chrgBeforeTax), ZERO);
  const rest = lineBeforeTax.toDecimalPlaces(2).minus(explained);
  if (!rest.isZero()) {
    add(rest);
  }

  const lines: RegisterDetailLine[] = money.lines
    .filter((l) => l.qtyBase.gt(0))
    .map((l): RegisterDetailLine => {
      const p = l.parts;
      const tax = l.taxAmt;
      return {
        rowNo: l.lineNo,
        itemId: l.itemId,
        hsnCode: l.copy?.hsnCode ?? null,
        unitId: l.itemUnitId,
        qty: n(l.qty)!,
        rate: n(l.perUnit.rate ?? ZERO)!,
        discount: n(p.itemDiscAmt.plus(p.splDiscAmt).plus(p.schDiscAmt).plus(p.billSchAmt))!,
        isService: l.copy?.isService ?? false,
        taxableValue: n(p.taxableAmt)!,
        taxId: l.copy?.taxId ?? null,
        totalTaxRate: n(l.percent.taxPerc)!,
        cgstRate: n(l.percent.cgstPerc)!,
        sgstRate: n(l.percent.sgstPerc)!,
        igstRate: n(l.percent.igstPerc)!,
        cessRate: n(l.percent.cessPerc)!,
        cgstAmount: n(p.cgstAmt)!,
        sgstAmount: n(p.sgstAmt)!,
        igstAmount: n(p.igstAmt)!,
        cessAmount: n(p.cessAmt)!,
        otherAmount: 0,
        totalValue: n(l.netAmt)!,
        billValue: n(l.netAmt)!,
        taxability: tax.gt(0) || l.percent.taxPerc.gt(0) ? 'TAXABLE' : 'EXEMPT',
        supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      };
    });
  const taxed = lines.filter((l) => l.taxability === 'TAXABLE').length;
  return {
    companyId: row.srCompanyId as string,
    branchId: row.srBranchId as string,
    accYear: row.srAccYear as string,
    voucherId,
    voucherTypeId: SALES_VOUCHER_TYPE.SALE_RETURN,
    // The voucher's own company serial: the return's number is per DEVICE
    // and uq_acc_voucher_doc_register_voucher has no device in it.
    voucherNo,
    voucherDate: isoDate(row.srReturnDate as Date)!,
    voucherRefno: row.srReturnRefno as string,
    sourceDocId: row.srId as string,
    docType: 'CREDIT_NOTE',
    tranNature: 'SALES_RETURN',
    docFlow: 'OUTWARD',
    docSign: -1,
    docNo: row.srReturnRefno as string,
    docDate: isoDate(row.srReturnDate as Date)!,
    docRefNo: (row.srBillRefno as string | null) ?? (row.srUsrRefno as string | null),
    taxability: taxed === 0 ? 'EXEMPT' : taxed === lines.length ? 'TAXABLE' : 'MIXED',
    supplyClass: 'GOODS',
    supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
    placeOfSupplyCode: row.srPosStcd as string | null,
    placeOfSupplyName: row.srStateName as string | null,
    partyId: row.srCustId as string,
    partyName: row.srCustName as string | null,
    partyAddr1: row.srCustAddr as string | null,
    partyLocation: row.srCustPlace as string | null,
    partyPin: row.srCustPin as string | null,
    partyStateCode: row.srCustStcd as string | null,
    partyStateName: row.srStateName as string | null,
    partyGstType: row.srCustGstType as string | null,
    partyGstin: ((row.srCustGstin as string | null) ?? '').trim() || null,
    grossValue: n(t.gross)!,
    discountValue: n(t.discAmt.plus(deduction).toDecimalPlaces(2))!,
    taxableValue: n(t.taxable)!,
    cgstValue: n(t.cgst)!,
    sgstValue: n(t.sgst)!,
    igstValue: n(t.igst)!,
    cessValue: n(t.cess)!,
    stateCessValue: 0,
    tcsValue: 0,
    otherCharge: n(other.toDecimalPlaces(2))!,
    roundOff: n(t.roundOff)!,
    billValue: n(t.creditNote)!,
    remarks: row.srReturnReason as string | null,
    createdBy: actor,
    lines,
  };
}
