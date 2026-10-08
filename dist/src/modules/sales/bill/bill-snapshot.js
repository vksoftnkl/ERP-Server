"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotFromRows = snapshotFromRows;
exports.snapshotFromDto = snapshotFromDto;
exports.isCreditTender = isCreditTender;
exports.settledByTenders = settledByTenders;
exports.cashTendered = cashTendered;
exports.setOffAmtOf = setOffAmtOf;
exports.partyDebitOf = partyDebitOf;
exports.decimal = decimal;
const client_1 = require("@prisma/client");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const bill_temp_credit_1 = require("./bill-temp-credit");
function snapshotFromRows(bill, items, charges, tenders) {
    return {
        sbId: bill.sbId,
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        accYear: bill.sbAccYear,
        refno: bill.sbBillRefno,
        slno: bill.sbBillSlno,
        usrRefno: bill.sbUsrRefno,
        billDate: (0, sales_doc_utils_1.isoDate)(bill.sbBillDate) ?? (0, sales_doc_utils_1.isoToday)(),
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
        grossAmt: (0, sales_doc_utils_1.num)(bill.sbGrossAmt),
        itemDisc: (0, sales_doc_utils_1.num)(bill.sbItemDisc),
        splDisc: (0, sales_doc_utils_1.num)(bill.sbSplDisc),
        schDisc: (0, sales_doc_utils_1.num)(bill.sbSchDisc),
        billSchDisc: (0, sales_doc_utils_1.num)(bill.sbBillSchDisc),
        cashDisc: (0, sales_doc_utils_1.num)(bill.sbCashDisc),
        taxableAmt: (0, sales_doc_utils_1.num)(bill.sbTaxableAmt),
        cgstAmt: (0, sales_doc_utils_1.num)(bill.sbCgstAmt),
        sgstAmt: (0, sales_doc_utils_1.num)(bill.sbSgstAmt),
        igstAmt: (0, sales_doc_utils_1.num)(bill.sbIgstAmt),
        cessAmt: (0, sales_doc_utils_1.num)(bill.sbCessAmt),
        taxAmt: (0, sales_doc_utils_1.num)(bill.sbTaxAmt),
        roundOff: (0, sales_doc_utils_1.num)(bill.sbRoundOff),
        tcsAmt: (0, sales_doc_utils_1.num)(bill.sbTcsAmt),
        billAmt: (0, sales_doc_utils_1.num)(bill.sbBillAmt),
        advanceAmt: (0, sales_doc_utils_1.num)(bill.sbAdvanceAmt),
        noteAdjAmt: (0, sales_doc_utils_1.num)(bill.sbNoteAdjAmt),
        paidAmt: (0, sales_doc_utils_1.num)(bill.sbPaidAmt),
        tenderAmt: (0, sales_doc_utils_1.num)(bill.sbTenderAmt),
        items: items.map((i) => ({
            sbiId: i.sbiId,
            lineNo: i.sbiLineNo,
            splitNo: i.sbiSplitNo,
            itemId: i.sbiItemId,
            itemUnitId: i.sbiItemUnitId,
            godownId: i.sbiGodownId,
            lotId: i.sbiLotId,
            bucket: i.sbiBucket ?? 'SALEABLE',
            qty: (0, sales_doc_utils_1.num)(i.sbiBillQty),
            isFree: i.sbiIsFree,
            freeType: i.sbiFreeType,
            isService: i.sbiIsService,
            rate: (0, sales_doc_utils_1.num)(i.sbiRate),
            ratePreTax: (0, sales_doc_utils_1.num)(i.sbiRatePreTax),
            minPrice: i.sbiMinPrice === null ? null : (0, sales_doc_utils_1.num)(i.sbiMinPrice),
            maxPrice: i.sbiMaxPrice === null ? null : (0, sales_doc_utils_1.num)(i.sbiMaxPrice),
            costPrice: i.sbiCostPrice === null ? null : (0, sales_doc_utils_1.num)(i.sbiCostPrice),
            grossAmt: (0, sales_doc_utils_1.num)(i.sbiGrossAmt),
            taxableAmt: (0, sales_doc_utils_1.num)(i.sbiTaxableAmt),
            netAmt: (0, sales_doc_utils_1.num)(i.sbiNetAmt),
            taxId: i.sbiTaxId,
            taxPerc: (0, sales_doc_utils_1.num)(i.sbiTaxPerc),
            cgstPerc: (0, sales_doc_utils_1.num)(i.sbiCgstPerc),
            sgstPerc: (0, sales_doc_utils_1.num)(i.sbiSgstPerc),
            igstPerc: (0, sales_doc_utils_1.num)(i.sbiIgstPerc),
            cessPerc: (0, sales_doc_utils_1.num)(i.sbiCessPerc),
            cgstAmt: (0, sales_doc_utils_1.num)(i.sbiCgstAmt),
            sgstAmt: (0, sales_doc_utils_1.num)(i.sbiSgstAmt),
            igstAmt: (0, sales_doc_utils_1.num)(i.sbiIgstAmt),
            cessAmt: (0, sales_doc_utils_1.num)(i.sbiCessAmt),
            acessAmt: (0, sales_doc_utils_1.num)(i.sbiAcessAmt),
            hsnCode: i.sbiHsnCode,
            itemDiscPerc: (0, sales_doc_utils_1.num)(i.sbiItemDiscPerc),
            itemDiscAmt: (0, sales_doc_utils_1.num)(i.sbiItemDiscAmt),
            splDiscAmt: (0, sales_doc_utils_1.num)(i.sbiSplDiscAmt),
            schDiscAmt: (0, sales_doc_utils_1.num)(i.sbiSchDiscAmt),
            billSchAmt: (0, sales_doc_utils_1.num)(i.sbiBillSchAmt),
            schemeId: i.sbiSchemeId,
            srcDocType: i.sbiSrcDocType,
            srcDocId: i.sbiSrcDocId,
            srcDocYear: i.sbiSrcDocYear?.trim() ?? null,
            srcItemId: i.sbiSrcItemId,
            batchNo: i.sbiBatchNo,
            batchDate: (0, sales_doc_utils_1.isoDate)(i.sbiBatchDate),
            expiryDate: (0, sales_doc_utils_1.isoDate)(i.sbiExpiryDate),
            serialNo: i.sbiSerialNo,
            toBaseFactor: (0, sales_doc_utils_1.num)(i.sbiToBaseFactor) || null,
            weightQty: i.sbiWeightQty === null ? null : (0, sales_doc_utils_1.num)(i.sbiWeightQty),
        })),
        charges: charges.map((c) => ({
            cdId: c.cdId,
            ledgerId: c.cdLedgerCode,
            name: c.cdChgName,
            amount: (0, sales_doc_utils_1.num)(c.cdAmount),
            separatelyPosted: c.cdSepPost,
            beforeTax: c.cdBeforeTax,
            cgst: (0, sales_doc_utils_1.num)(c.cdCgstAmt),
            sgst: (0, sales_doc_utils_1.num)(c.cdSgstAmt),
            igst: (0, sales_doc_utils_1.num)(c.cdIgstAmt),
            cess: (0, sales_doc_utils_1.num)(c.cdCessAmt),
            srcChargeId: c.cdSrcCdId ?? null,
            srcAccYear: c.cdSrcAccYear?.trim() ?? null,
            carryBasis: c.cdCarryBasis ?? null,
        })),
        tenders: tenders.map((t) => ({
            tdId: t.tdId,
            tenderId: t.tdTenderId,
            tenderTypeId: Number(t.tdTenderTypeId),
            tenderLedgerId: t.tdTenderLedgerId,
            name: t.tdTenderName,
            amount: (0, sales_doc_utils_1.num)(t.tdAmount),
            unitsUsed: (0, sales_doc_utils_1.num)(t.tdUnitsUsed),
            isPdc: t.tdIsPdc,
            tempCredit: (0, bill_temp_credit_1.decodeTempCredit)({
                tdTenderTypeId: t.tdTenderTypeId,
                tdBankName: t.tdBankName,
                tdRefNo: t.tdRefNo,
                tdPayerVpa: t.tdPayerVpa,
                tdNotes: t.tdNotes,
            }),
        })),
    };
}
function transportFromDto(dto) {
    if (dto.sbTransporterId === undefined &&
        dto.sbTransporterName === undefined &&
        dto.sbLrNo === undefined) {
        return undefined;
    }
    return {
        transporterId: dto.sbTransporterId ?? null,
        transporterName: dto.sbTransporterName ?? null,
        lrNo: dto.sbLrNo ?? null,
    };
}
function snapshotFromDto(dto, tenderMasters) {
    const billDate = dto.sbBillDate ?? (0, sales_doc_utils_1.isoToday)();
    return {
        transport: transportFromDto(dto),
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
        grossAmt: (0, sales_doc_utils_1.num)(dto.sbGrossAmt),
        itemDisc: (0, sales_doc_utils_1.num)(dto.sbItemDisc),
        splDisc: (0, sales_doc_utils_1.num)(dto.sbSplDisc),
        schDisc: (0, sales_doc_utils_1.num)(dto.sbSchDisc),
        billSchDisc: (0, sales_doc_utils_1.num)(dto.sbBillSchDisc),
        cashDisc: (0, sales_doc_utils_1.num)(dto.sbCashDisc),
        taxableAmt: (0, sales_doc_utils_1.num)(dto.sbTaxableAmt),
        cgstAmt: (0, sales_doc_utils_1.num)(dto.sbCgstAmt),
        sgstAmt: (0, sales_doc_utils_1.num)(dto.sbSgstAmt),
        igstAmt: (0, sales_doc_utils_1.num)(dto.sbIgstAmt),
        cessAmt: (0, sales_doc_utils_1.num)(dto.sbCessAmt),
        taxAmt: (0, sales_doc_utils_1.num)(dto.sbTaxAmt),
        roundOff: (0, sales_doc_utils_1.num)(dto.sbRoundOff),
        tcsAmt: (0, sales_doc_utils_1.num)(dto.sbTcsAmt),
        billAmt: (0, sales_doc_utils_1.num)(dto.sbBillAmt),
        advanceAmt: (0, sales_doc_utils_1.num)(dto.sbAdvanceAmt),
        noteAdjAmt: (0, sales_doc_utils_1.num)(dto.sbNoteAdjAmt),
        paidAmt: (0, sales_doc_utils_1.num)(dto.sbPaidAmt),
        tenderAmt: (0, sales_doc_utils_1.num)(dto.sbTenderAmt),
        items: (dto.items ?? []).map((i, idx) => ({
            sbiId: i.sbiId ?? null,
            lineNo: i.sbiLineNo ?? idx + 1,
            splitNo: i.sbiSplitNo ?? 1,
            itemId: i.sbiItemId,
            itemUnitId: i.sbiItemUnitId,
            godownId: i.sbiGodownId,
            lotId: i.sbiLotId ?? null,
            bucket: i.sbiBucket ?? 'SALEABLE',
            qty: (0, sales_doc_utils_1.num)(i.sbiBillQty),
            isFree: i.sbiIsFree ?? false,
            freeType: i.sbiFreeType ?? null,
            isService: i.sbiIsService ?? false,
            rate: (0, sales_doc_utils_1.num)(i.sbiRate),
            ratePreTax: (0, sales_doc_utils_1.num)(i.sbiRatePreTax),
            minPrice: i.sbiMinPrice === null || i.sbiMinPrice === undefined ? null : (0, sales_doc_utils_1.num)(i.sbiMinPrice),
            maxPrice: i.sbiMaxPrice === null || i.sbiMaxPrice === undefined ? null : (0, sales_doc_utils_1.num)(i.sbiMaxPrice),
            costPrice: i.sbiCostPrice === null || i.sbiCostPrice === undefined ? null : (0, sales_doc_utils_1.num)(i.sbiCostPrice),
            grossAmt: (0, sales_doc_utils_1.num)(i.sbiGrossAmt),
            taxableAmt: (0, sales_doc_utils_1.num)(i.sbiTaxableAmt),
            netAmt: (0, sales_doc_utils_1.num)(i.sbiNetAmt),
            taxId: i.sbiTaxId ?? null,
            taxPerc: (0, sales_doc_utils_1.num)(i.sbiTaxPerc),
            cgstPerc: (0, sales_doc_utils_1.num)(i.sbiCgstPerc),
            sgstPerc: (0, sales_doc_utils_1.num)(i.sbiSgstPerc),
            igstPerc: (0, sales_doc_utils_1.num)(i.sbiIgstPerc),
            cessPerc: (0, sales_doc_utils_1.num)(i.sbiCessPerc),
            cgstAmt: (0, sales_doc_utils_1.num)(i.sbiCgstAmt),
            sgstAmt: (0, sales_doc_utils_1.num)(i.sbiSgstAmt),
            igstAmt: (0, sales_doc_utils_1.num)(i.sbiIgstAmt),
            cessAmt: (0, sales_doc_utils_1.num)(i.sbiCessAmt),
            acessAmt: (0, sales_doc_utils_1.num)(i.sbiAcessAmt),
            hsnCode: i.sbiHsnCode ?? null,
            itemDiscPerc: (0, sales_doc_utils_1.num)(i.sbiItemDiscPerc),
            itemDiscAmt: (0, sales_doc_utils_1.num)(i.sbiItemDiscAmt),
            splDiscAmt: (0, sales_doc_utils_1.num)(i.sbiSplDiscAmt),
            schDiscAmt: (0, sales_doc_utils_1.num)(i.sbiSchDiscAmt),
            billSchAmt: (0, sales_doc_utils_1.num)(i.sbiBillSchAmt),
            schemeId: i.sbiSchemeId ?? null,
            srcDocType: i.sbiSrcDocType ?? null,
            srcDocId: i.sbiSrcDocId ?? null,
            srcDocYear: i.sbiSrcDocYear ?? null,
            srcItemId: i.sbiSrcItemId ?? null,
            batchNo: i.sbiBatchNo ?? null,
            batchDate: i.sbiBatchDate ?? null,
            expiryDate: i.sbiExpiryDate ?? null,
            serialNo: i.sbiSerialNo ?? null,
            toBaseFactor: (0, sales_doc_utils_1.num)(i.sbiToBaseFactor) || null,
            weightQty: i.sbiWeightQty === null || i.sbiWeightQty === undefined ? null : (0, sales_doc_utils_1.num)(i.sbiWeightQty),
        })),
        charges: (dto.charges ?? []).map((c) => ({
            cdId: c.cdId ?? null,
            ledgerId: c.cdLedgerCode ?? null,
            name: c.cdChgName ?? null,
            amount: (0, sales_doc_utils_1.num)(c.cdAmount),
            separatelyPosted: c.cdSepPost ?? false,
            beforeTax: c.cdBeforeTax ?? false,
            cgst: (0, sales_doc_utils_1.num)(c.cdCgstAmt),
            sgst: (0, sales_doc_utils_1.num)(c.cdSgstAmt),
            igst: (0, sales_doc_utils_1.num)(c.cdIgstAmt),
            cess: (0, sales_doc_utils_1.num)(c.cdCessAmt),
            srcChargeId: c.cdSrcCdId ?? null,
            srcAccYear: c.cdSrcAccYear ?? null,
            carryBasis: c.cdCarryBasis ?? null,
        })),
        tenders: (dto.tenders ?? []).map((t) => {
            const master = t.tdTenderId ? tenderMasters.get(t.tdTenderId) : undefined;
            const typeId = t.tdTenderTypeId !== undefined ? Number(t.tdTenderTypeId) : (master?.tnd_type_id ?? 0);
            return {
                tdId: t.tdId ?? null,
                tenderId: t.tdTenderId ?? null,
                tenderTypeId: typeId,
                tenderLedgerId: t.tdTenderLedgerId ?? master?.tnd_ledger_id ?? null,
                name: master?.tnd_name ?? null,
                amount: (0, sales_doc_utils_1.num)(t.tdAmount),
                unitsUsed: (0, sales_doc_utils_1.num)(t.tdUnitsUsed),
                isPdc: t.tdIsPdc ?? false,
                tempCredit: typeId === sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT && t.tempCredit
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
function isCreditTender(t) {
    return t.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.CREDIT || t.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT;
}
function settledByTenders(snap) {
    return (0, sales_doc_utils_1.round2)(snap.tenders.filter((t) => !isCreditTender(t)).reduce((s, t) => s + t.amount, 0));
}
function cashTendered(snap) {
    return (0, sales_doc_utils_1.round2)(snap.tenders
        .filter((t) => t.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.CASH)
        .reduce((s, t) => s + t.amount, 0));
}
function setOffAmtOf(snap) {
    return (0, sales_doc_utils_1.round2)(snap.advanceAmt + snap.noteAdjAmt);
}
function partyDebitOf(snap, schemeSeparately) {
    const tax = snap.items.reduce((s, i) => s + i.cgstAmt + i.sgstAmt + i.igstAmt + i.cessAmt + i.acessAmt, 0);
    const charges = snap.charges
        .filter((c) => c.separatelyPosted)
        .reduce((s, c) => s + c.amount + c.cgst + c.sgst + c.igst + c.cess, 0);
    return (0, sales_doc_utils_1.round2)(snap.taxableAmt +
        tax +
        charges +
        snap.roundOff +
        snap.tcsAmt -
        snap.cashDisc -
        (schemeSeparately ? snap.schDisc + snap.billSchDisc : 0));
}
function decimal(v) {
    return new client_1.Prisma.Decimal((0, sales_doc_utils_1.round2)(v).toFixed(2));
}
//# sourceMappingURL=bill-snapshot.js.map