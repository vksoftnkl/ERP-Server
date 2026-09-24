import { Prisma, SaleBill, SaleBillItem } from '@prisma/client';
import type { SaveBillDto } from './dto/save-bill.dto';
import type { BillChargePayload, BillTenderPayload } from './types/bill-api.types';
import { TENDER_TYPE, isoDate, isoToday, num, round2 } from '../posting/sales-doc.utils';
import { decodeTempCredit, type TempCreditDetails } from './bill-temp-credit';

/**
 * ONE shape of a bill that both `/validate` (a body the client has not saved)
 * and `/post` (a DRAFT read back from the tables) build, so the guards and the
 * leg builder run exactly the same code on either — flow §9's whole point.
 *
 * Every figure is a plain number here. Decimals, strings and nulls are
 * normalised at the edge and nowhere else.
 */
export interface BillSnapshotItem {
  sbiId: string | null;
  lineNo: number;
  splitNo: number;
  itemId: string;
  itemUnitId: string;
  godownId: string;
  lotId: string | null;
  bucket: string;
  qty: number;
  isFree: boolean;
  freeType: string | null;
  isService: boolean;
  rate: number;
  ratePreTax: number;
  minPrice: number | null;
  maxPrice: number | null;
  costPrice: number | null;
  grossAmt: number;
  taxableAmt: number;
  netAmt: number;
  taxId: string | null;
  taxPerc: number;
  cgstPerc: number;
  sgstPerc: number;
  igstPerc: number;
  cessPerc: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  cessAmt: number;
  acessAmt: number;
  hsnCode: string | null;
  itemDiscPerc: number;
  itemDiscAmt: number;
  splDiscAmt: number;
  schDiscAmt: number;
  billSchAmt: number;
  schemeId: string | null;
  srcDocType: string | null;
  srcDocId: string | null;
  srcDocYear: string | null;
  srcItemId: string | null;
  batchNo: string | null;
  batchDate: string | null;
  expiryDate: string | null;
  serialNo: string | null;
  toBaseFactor: number | null;
  weightQty: number | null;
}

export interface BillSnapshotCharge {
  cdId: string | null;
  ledgerId: string | null;
  name: string | null;
  amount: number;
  separatelyPosted: boolean;
  beforeTax: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  srcChargeId: string | null;
  srcAccYear: string | null;
  carryBasis: string | null;
}

export interface BillSnapshotTender {
  tdId: string | null;
  tenderId: string | null;
  tenderTypeId: number;
  tenderLedgerId: string | null;
  name: string | null;
  amount: number;
  unitsUsed: number;
  isPdc: boolean;
  tempCredit: TempCreditDetails | null;
}

export interface BillSnapshot {
  sbId: string | null;
  companyId: string;
  branchId: string;
  tenantId: string | null;
  accYear: string;
  refno: string | null;
  slno: bigint | null;
  usrRefno: string | null;
  billDate: string;
  billDatetime: Date;
  docType: string;
  billType: string;
  billMode: string;
  custId: string | null;
  custName: string;
  custAddr: string | null;
  custPlace: string | null;
  custPin: string | null;
  custGstin: string | null;
  custGstType: string | null;
  custStcd: string | null;
  posStcd: string | null;
  stateName: string | null;
  custPan: string | null;
  form60Ref: string | null;
  loyaltyMemberId: string | null;
  salesmanId: string[];
  deviceId: string | null;
  deviceType: string | null;
  sessionId: string | null;
  userId: string;
  remarks: string | null;
  srcDocType: string | null;
  srcDocId: string | null;
  srcDocYear: string | null;
  revisionNo: number;
  grossAmt: number;
  itemDisc: number;
  splDisc: number;
  schDisc: number;
  billSchDisc: number;
  cashDisc: number;
  taxableAmt: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  cessAmt: number;
  taxAmt: number;
  roundOff: number;
  tcsAmt: number;
  billAmt: number;
  /** ADVANCE set-offs (sb_advance_amt). */
  advanceAmt: number;
  /** Credit-note set-offs (sb_note_adj_amt). */
  noteAdjAmt: number;
  paidAmt: number;
  tenderAmt: number;
  items: BillSnapshotItem[];
  charges: BillSnapshotCharge[];
  tenders: BillSnapshotTender[];
}

export function snapshotFromRows(
  bill: SaleBill,
  items: SaleBillItem[],
  charges: BillChargePayload[],
  tenders: BillTenderPayload[],
): BillSnapshot {
  return {
    sbId: bill.sbId,
    companyId: bill.sbCompanyId,
    branchId: bill.sbBranchId,
    tenantId: bill.sbTenantId,
    accYear: bill.sbAccYear,
    refno: bill.sbBillRefno,
    slno: bill.sbBillSlno,
    usrRefno: bill.sbUsrRefno,
    billDate: isoDate(bill.sbBillDate) ?? isoToday(),
    billDatetime: bill.sbBillDatetime,
    docType: bill.sbDocType,
    billType: bill.sbBillType,
    billMode: bill.sbBillMode,
    custId: bill.sbCustId,
    custName: bill.sbCustName,
    custAddr: bill.sbCustAddr,
    custPlace: bill.sbCustPlace,
    custPin: bill.sbCustPin,
    custGstin: bill.sbCustGstin,
    custGstType: bill.sbCustGstType,
    custStcd: bill.sbCustStcd,
    posStcd: bill.sbPosStcd,
    stateName: bill.sbStateName,
    custPan: bill.sbCustPan,
    form60Ref: bill.sbForm60Ref,
    loyaltyMemberId: bill.sbLoyaltyMemberId,
    salesmanId: bill.sbSalesmanId ?? [],
    deviceId: bill.sbDeviceId,
    deviceType: bill.sbDeviceType,
    sessionId: bill.sbSessionId,
    userId: bill.sbUserId,
    remarks: bill.sbRemarks,
    srcDocType: bill.sbSrcDocType,
    srcDocId: bill.sbSrcDocId,
    srcDocYear: bill.sbSrcDocYear?.trim() ?? null,
    revisionNo: bill.sbRevisionNo,
    grossAmt: num(bill.sbGrossAmt),
    itemDisc: num(bill.sbItemDisc),
    splDisc: num(bill.sbSplDisc),
    schDisc: num(bill.sbSchDisc),
    billSchDisc: num(bill.sbBillSchDisc),
    cashDisc: num(bill.sbCashDisc),
    taxableAmt: num(bill.sbTaxableAmt),
    cgstAmt: num(bill.sbCgstAmt),
    sgstAmt: num(bill.sbSgstAmt),
    igstAmt: num(bill.sbIgstAmt),
    cessAmt: num(bill.sbCessAmt),
    taxAmt: num(bill.sbTaxAmt),
    roundOff: num(bill.sbRoundOff),
    tcsAmt: num(bill.sbTcsAmt),
    billAmt: num(bill.sbBillAmt),
    advanceAmt: num(bill.sbAdvanceAmt),
    noteAdjAmt: num(bill.sbNoteAdjAmt),
    paidAmt: num(bill.sbPaidAmt),
    tenderAmt: num(bill.sbTenderAmt),
    items: items.map((i) => ({
      sbiId: i.sbiId,
      lineNo: i.sbiLineNo,
      splitNo: i.sbiSplitNo,
      itemId: i.sbiItemId,
      itemUnitId: i.sbiItemUnitId,
      godownId: i.sbiGodownId,
      lotId: i.sbiLotId,
      bucket: i.sbiBucket ?? 'SALEABLE',
      qty: num(i.sbiBillQty),
      isFree: i.sbiIsFree,
      freeType: i.sbiFreeType,
      isService: i.sbiIsService,
      rate: num(i.sbiRate),
      ratePreTax: num(i.sbiRatePreTax),
      minPrice: i.sbiMinPrice === null ? null : num(i.sbiMinPrice),
      maxPrice: i.sbiMaxPrice === null ? null : num(i.sbiMaxPrice),
      costPrice: i.sbiCostPrice === null ? null : num(i.sbiCostPrice),
      grossAmt: num(i.sbiGrossAmt),
      taxableAmt: num(i.sbiTaxableAmt),
      netAmt: num(i.sbiNetAmt),
      taxId: i.sbiTaxId,
      taxPerc: num(i.sbiTaxPerc),
      cgstPerc: num(i.sbiCgstPerc),
      sgstPerc: num(i.sbiSgstPerc),
      igstPerc: num(i.sbiIgstPerc),
      cessPerc: num(i.sbiCessPerc),
      cgstAmt: num(i.sbiCgstAmt),
      sgstAmt: num(i.sbiSgstAmt),
      igstAmt: num(i.sbiIgstAmt),
      cessAmt: num(i.sbiCessAmt),
      acessAmt: num(i.sbiAcessAmt),
      hsnCode: i.sbiHsnCode,
      itemDiscPerc: num(i.sbiItemDiscPerc),
      itemDiscAmt: num(i.sbiItemDiscAmt),
      splDiscAmt: num(i.sbiSplDiscAmt),
      schDiscAmt: num(i.sbiSchDiscAmt),
      billSchAmt: num(i.sbiBillSchAmt),
      schemeId: i.sbiSchemeId,
      srcDocType: i.sbiSrcDocType,
      srcDocId: i.sbiSrcDocId,
      srcDocYear: i.sbiSrcDocYear?.trim() ?? null,
      srcItemId: i.sbiSrcItemId,
      batchNo: i.sbiBatchNo,
      batchDate: isoDate(i.sbiBatchDate),
      expiryDate: isoDate(i.sbiExpiryDate),
      serialNo: i.sbiSerialNo,
      toBaseFactor: num(i.sbiToBaseFactor) || null,
      weightQty: i.sbiWeightQty === null ? null : num(i.sbiWeightQty),
    })),
    charges: charges.map((c) => ({
      cdId: c.cdId,
      ledgerId: c.cdLedgerCode,
      name: c.cdChgName,
      amount: num(c.cdAmount),
      separatelyPosted: c.cdSepPost,
      beforeTax: c.cdBeforeTax,
      cgst: num(c.cdCgstAmt),
      sgst: num(c.cdSgstAmt),
      igst: num(c.cdIgstAmt),
      cess: num(c.cdCessAmt),
      srcChargeId: (c as unknown as { cdSrcCdId?: string | null }).cdSrcCdId ?? null,
      srcAccYear: (c as unknown as { cdSrcAccYear?: string | null }).cdSrcAccYear?.trim() ?? null,
      carryBasis: (c as unknown as { cdCarryBasis?: string | null }).cdCarryBasis ?? null,
    })),
    tenders: tenders.map((t) => ({
      tdId: t.tdId,
      tenderId: t.tdTenderId,
      tenderTypeId: Number(t.tdTenderTypeId),
      tenderLedgerId: t.tdTenderLedgerId,
      name: t.tdTenderName,
      amount: num(t.tdAmount),
      unitsUsed: num(t.tdUnitsUsed),
      isPdc: t.tdIsPdc,
      tempCredit: decodeTempCredit({
        tdTenderTypeId: t.tdTenderTypeId,
        tdBankName: t.tdBankName,
        tdRefNo: t.tdRefNo,
        tdPayerVpa: t.tdPayerVpa,
        tdNotes: t.tdNotes,
      }),
    })),
  };
}

/** A tender master row, for a `/validate` body whose tender rows carry only `tdTenderId`. */
export interface TenderMasterRow {
  tnd_id: string;
  tnd_name: string | null;
  tnd_type_id: number;
  tnd_ledger_id: string | null;
}

export function snapshotFromDto(
  dto: SaveBillDto,
  tenderMasters: Map<string, TenderMasterRow>,
): BillSnapshot {
  const billDate = dto.sbBillDate ?? isoToday();
  return {
    sbId: dto.sbId ?? null,
    companyId: dto.sbCompanyId,
    branchId: dto.sbBranchId,
    tenantId: dto.sbTenantId ?? null,
    accYear: dto.sbAccYear,
    refno: null,
    slno: null,
    usrRefno: dto.sbUsrRefno ?? null,
    billDate,
    billDatetime: dto.sbBillDatetime ? new Date(dto.sbBillDatetime) : new Date(),
    docType: dto.sbDocType ?? 'TAX_INVOICE',
    billType: dto.sbBillType ?? 'CASH',
    billMode: dto.sbBillMode ?? 'WHOLESALE',
    custId: dto.sbCustId ?? null,
    custName: dto.sbCustName,
    custAddr: dto.sbCustAddr ?? null,
    custPlace: dto.sbCustPlace ?? null,
    custPin: dto.sbCustPin ?? null,
    custGstin: dto.sbCustGstin ?? null,
    custGstType: dto.sbCustGstType ?? null,
    custStcd: dto.sbCustStcd ?? null,
    posStcd: dto.sbPosStcd ?? null,
    stateName: dto.sbStateName ?? null,
    custPan: dto.sbCustPan ?? null,
    form60Ref: dto.sbForm60Ref ?? null,
    loyaltyMemberId: dto.sbLoyaltyMemberId ?? null,
    salesmanId: dto.sbSalesmanId ?? [],
    deviceId: dto.sbDeviceId,
    deviceType: dto.sbDeviceType,
    sessionId: dto.sbSessionId ?? null,
    userId: dto.sbUserId,
    remarks: dto.sbRemarks ?? null,
    srcDocType: dto.sbSrcDocType ?? null,
    srcDocId: dto.sbSrcDocId ?? null,
    srcDocYear: dto.sbSrcDocYear ?? null,
    revisionNo: 1,
    grossAmt: num(dto.sbGrossAmt),
    itemDisc: num(dto.sbItemDisc),
    splDisc: num(dto.sbSplDisc),
    schDisc: num(dto.sbSchDisc),
    billSchDisc: num(dto.sbBillSchDisc),
    cashDisc: num(dto.sbCashDisc),
    taxableAmt: num(dto.sbTaxableAmt),
    cgstAmt: num(dto.sbCgstAmt),
    sgstAmt: num(dto.sbSgstAmt),
    igstAmt: num(dto.sbIgstAmt),
    cessAmt: num(dto.sbCessAmt),
    taxAmt: num(dto.sbTaxAmt),
    roundOff: num(dto.sbRoundOff),
    tcsAmt: num(dto.sbTcsAmt),
    billAmt: num(dto.sbBillAmt),
    advanceAmt: num(dto.sbAdvanceAmt),
    noteAdjAmt: num(dto.sbNoteAdjAmt),
    paidAmt: num(dto.sbPaidAmt),
    tenderAmt: num(dto.sbTenderAmt),
    items: (dto.items ?? []).map((i, idx) => ({
      sbiId: i.sbiId ?? null,
      lineNo: i.sbiLineNo ?? idx + 1,
      splitNo: i.sbiSplitNo ?? 1,
      itemId: i.sbiItemId,
      itemUnitId: i.sbiItemUnitId,
      godownId: i.sbiGodownId,
      lotId: i.sbiLotId ?? null,
      bucket: i.sbiBucket ?? 'SALEABLE',
      qty: num(i.sbiBillQty),
      isFree: i.sbiIsFree ?? false,
      freeType: i.sbiFreeType ?? null,
      isService: i.sbiIsService ?? false,
      rate: num(i.sbiRate),
      ratePreTax: num(i.sbiRatePreTax),
      minPrice: i.sbiMinPrice === null || i.sbiMinPrice === undefined ? null : num(i.sbiMinPrice),
      maxPrice: i.sbiMaxPrice === null || i.sbiMaxPrice === undefined ? null : num(i.sbiMaxPrice),
      costPrice:
        i.sbiCostPrice === null || i.sbiCostPrice === undefined ? null : num(i.sbiCostPrice),
      grossAmt: num(i.sbiGrossAmt),
      taxableAmt: num(i.sbiTaxableAmt),
      netAmt: num(i.sbiNetAmt),
      taxId: (i as unknown as { sbiTaxId?: string | null }).sbiTaxId ?? null,
      taxPerc: num(i.sbiTaxPerc),
      cgstPerc: num(i.sbiCgstPerc),
      sgstPerc: num(i.sbiSgstPerc),
      igstPerc: num(i.sbiIgstPerc),
      cessPerc: num(i.sbiCessPerc),
      cgstAmt: num(i.sbiCgstAmt),
      sgstAmt: num(i.sbiSgstAmt),
      igstAmt: num(i.sbiIgstAmt),
      cessAmt: num(i.sbiCessAmt),
      acessAmt: num((i as unknown as { sbiAcessAmt?: string | number }).sbiAcessAmt),
      hsnCode: i.sbiHsnCode ?? null,
      itemDiscPerc: num(i.sbiItemDiscPerc),
      itemDiscAmt: num(i.sbiItemDiscAmt),
      splDiscAmt: num(i.sbiSplDiscAmt),
      schDiscAmt: num(i.sbiSchDiscAmt),
      billSchAmt: num(i.sbiBillSchAmt),
      schemeId: (i as unknown as { sbiSchemeId?: string | null }).sbiSchemeId ?? null,
      srcDocType: i.sbiSrcDocType ?? null,
      srcDocId: i.sbiSrcDocId ?? null,
      srcDocYear: i.sbiSrcDocYear ?? null,
      srcItemId: i.sbiSrcItemId ?? null,
      batchNo: i.sbiBatchNo ?? null,
      batchDate: i.sbiBatchDate ?? null,
      expiryDate: i.sbiExpiryDate ?? null,
      serialNo: i.sbiSerialNo ?? null,
      toBaseFactor: num(i.sbiToBaseFactor) || null,
      weightQty:
        i.sbiWeightQty === null || i.sbiWeightQty === undefined ? null : num(i.sbiWeightQty),
    })),
    charges: (dto.charges ?? []).map((c) => ({
      cdId: c.cdId ?? null,
      ledgerId: c.cdLedgerCode ?? null,
      name: c.cdChgName ?? null,
      amount: num(c.cdAmount),
      separatelyPosted: c.cdSepPost ?? false,
      beforeTax: c.cdBeforeTax ?? false,
      cgst: num(c.cdCgstAmt),
      sgst: num(c.cdSgstAmt),
      igst: num(c.cdIgstAmt),
      cess: num(c.cdCessAmt),
      srcChargeId: c.cdSrcCdId ?? null,
      srcAccYear: c.cdSrcAccYear ?? null,
      carryBasis: c.cdCarryBasis ?? null,
    })),
    tenders: (dto.tenders ?? []).map((t) => {
      const master = t.tdTenderId ? tenderMasters.get(t.tdTenderId) : undefined;
      const typeId =
        t.tdTenderTypeId !== undefined ? Number(t.tdTenderTypeId) : (master?.tnd_type_id ?? 0);
      return {
        tdId: t.tdId ?? null,
        tenderId: t.tdTenderId ?? null,
        tenderTypeId: typeId,
        tenderLedgerId: t.tdTenderLedgerId ?? master?.tnd_ledger_id ?? null,
        name: master?.tnd_name ?? null,
        amount: num(t.tdAmount),
        unitsUsed: num(t.tdUnitsUsed),
        isPdc: t.tdIsPdc ?? false,
        tempCredit:
          typeId === TENDER_TYPE.TEMP_CREDIT && t.tempCredit
            ? {
                name: t.tempCredit.name,
                mobile: t.tempCredit.mobile,
                place: t.tempCredit.place ?? null,
                addr: t.tempCredit.addr ?? null,
                idRef: t.tempCredit.idRef ?? null,
                days: t.tempCredit.days ?? 0,
                notes: t.tempCredit.notes ?? null,
              }
            : null,
      };
    }),
  };
}

// ─── derived figures every guard and leg builder reads ─────────────────────

export function isCreditTender(t: BillSnapshotTender): boolean {
  return t.tenderTypeId === TENDER_TYPE.CREDIT || t.tenderTypeId === TENDER_TYPE.TEMP_CREDIT;
}

/** Money that actually settled the bill: every tender but CREDIT / TEMP_CR. */
export function settledByTenders(snap: BillSnapshot): number {
  return round2(snap.tenders.filter((t) => !isCreditTender(t)).reduce((s, t) => s + t.amount, 0));
}

export function cashTendered(snap: BillSnapshot): number {
  return round2(
    snap.tenders
      .filter((t) => t.tenderTypeId === TENDER_TYPE.CASH)
      .reduce((s, t) => s + t.amount, 0),
  );
}

/** Everything the bill's set-offs settle: advances plus credit notes. */
export function setOffAmtOf(snap: BillSnapshot): number {
  return round2(snap.advanceAmt + snap.noteAdjAmt);
}

/** What the party is debited for — the same arithmetic as `buildBillLegs`. */
export function partyDebitOf(snap: BillSnapshot, schemeSeparately: boolean): number {
  const tax = snap.items.reduce(
    (s, i) => s + i.cgstAmt + i.sgstAmt + i.igstAmt + i.cessAmt + i.acessAmt,
    0,
  );
  const charges = snap.charges
    .filter((c) => c.separatelyPosted)
    .reduce((s, c) => s + c.amount + c.cgst + c.sgst + c.igst + c.cess, 0);
  return round2(
    snap.taxableAmt +
      tax +
      charges +
      snap.roundOff +
      snap.tcsAmt -
      snap.cashDisc -
      (schemeSeparately ? snap.schDisc + snap.billSchDisc : 0),
  );
}

export function decimal(v: number): Prisma.Decimal {
  return new Prisma.Decimal(round2(v).toFixed(2));
}
