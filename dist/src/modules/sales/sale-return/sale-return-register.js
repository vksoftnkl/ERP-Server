"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.returnRegisterDoc = returnRegisterDoc;
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const sale_return_money_1 = require("./sale-return-money");
function returnRegisterDoc(row, money, voucherId, voucherNo, actor) {
    const t = money.totals;
    const nature = money.nature;
    let other = sale_return_money_1.ZERO;
    let deduction = sale_return_money_1.ZERO;
    const add = (v) => {
        if (v.gte(0)) {
            other = other.plus(v);
        }
        else {
            deduction = deduction.minus(v);
        }
    };
    for (const c of money.charges.filter((x) => x.kind === 'CARRIED')) {
        add((0, sale_return_money_1.signed)(c, c.back.amount));
    }
    const inLines = money.charges.filter((x) => x.kind === 'IN_LINES');
    let explained = sale_return_money_1.ZERO;
    for (const c of inLines) {
        const v = (0, sale_return_money_1.signed)(c, c.back.amount);
        explained = explained.plus(v);
        add(v);
    }
    const lineBeforeTax = money.lines.reduce((s, l) => s.plus(l.parts.chrgBeforeTax), sale_return_money_1.ZERO);
    const rest = lineBeforeTax.toDecimalPlaces(2).minus(explained);
    if (!rest.isZero()) {
        add(rest);
    }
    const lines = money.lines
        .filter((l) => l.qtyBase.gt(0))
        .map((l) => {
        const p = l.parts;
        const tax = l.taxAmt;
        return {
            rowNo: l.lineNo,
            itemId: l.itemId,
            hsnCode: l.copy?.hsnCode ?? null,
            unitId: l.itemUnitId,
            qty: (0, sale_return_money_1.n)(l.qty),
            rate: (0, sale_return_money_1.n)(l.perUnit.rate ?? sale_return_money_1.ZERO),
            discount: (0, sale_return_money_1.n)(p.itemDiscAmt.plus(p.splDiscAmt).plus(p.schDiscAmt).plus(p.billSchAmt)),
            isService: l.copy?.isService ?? false,
            taxableValue: (0, sale_return_money_1.n)(p.taxableAmt),
            taxId: l.copy?.taxId ?? null,
            totalTaxRate: (0, sale_return_money_1.n)(l.percent.taxPerc),
            cgstRate: (0, sale_return_money_1.n)(l.percent.cgstPerc),
            sgstRate: (0, sale_return_money_1.n)(l.percent.sgstPerc),
            igstRate: (0, sale_return_money_1.n)(l.percent.igstPerc),
            cessRate: (0, sale_return_money_1.n)(l.percent.cessPerc),
            cgstAmount: (0, sale_return_money_1.n)(p.cgstAmt),
            sgstAmount: (0, sale_return_money_1.n)(p.sgstAmt),
            igstAmount: (0, sale_return_money_1.n)(p.igstAmt),
            cessAmount: (0, sale_return_money_1.n)(p.cessAmt),
            otherAmount: 0,
            totalValue: (0, sale_return_money_1.n)(l.netAmt),
            billValue: (0, sale_return_money_1.n)(l.netAmt),
            taxability: tax.gt(0) || l.percent.taxPerc.gt(0) ? 'TAXABLE' : 'EXEMPT',
            supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
        };
    });
    const taxed = lines.filter((l) => l.taxability === 'TAXABLE').length;
    return {
        companyId: row.srCompanyId,
        branchId: row.srBranchId,
        accYear: row.srAccYear,
        voucherId,
        voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.SALE_RETURN,
        voucherNo,
        voucherDate: (0, sales_doc_utils_1.isoDate)(row.srReturnDate),
        voucherRefno: row.srReturnRefno,
        sourceDocId: row.srId,
        docType: 'CREDIT_NOTE',
        tranNature: 'SALES_RETURN',
        docFlow: 'OUTWARD',
        docSign: -1,
        docNo: row.srReturnRefno,
        docDate: (0, sales_doc_utils_1.isoDate)(row.srReturnDate),
        docRefNo: row.srBillRefno ?? row.srUsrRefno,
        taxability: taxed === 0 ? 'EXEMPT' : taxed === lines.length ? 'TAXABLE' : 'MIXED',
        supplyClass: 'GOODS',
        supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
        placeOfSupplyCode: row.srPosStcd,
        placeOfSupplyName: row.srStateName,
        partyId: row.srCustId,
        partyName: row.srCustName,
        partyAddr1: row.srCustAddr,
        partyLocation: row.srCustPlace,
        partyPin: row.srCustPin,
        partyStateCode: row.srCustStcd,
        partyStateName: row.srStateName,
        partyGstType: row.srCustGstType,
        partyGstin: (row.srCustGstin ?? '').trim() || null,
        grossValue: (0, sale_return_money_1.n)(t.gross),
        discountValue: (0, sale_return_money_1.n)(t.discAmt.plus(deduction).toDecimalPlaces(2)),
        taxableValue: (0, sale_return_money_1.n)(t.taxable),
        cgstValue: (0, sale_return_money_1.n)(t.cgst),
        sgstValue: (0, sale_return_money_1.n)(t.sgst),
        igstValue: (0, sale_return_money_1.n)(t.igst),
        cessValue: (0, sale_return_money_1.n)(t.cess),
        stateCessValue: 0,
        tcsValue: 0,
        otherCharge: (0, sale_return_money_1.n)(other.toDecimalPlaces(2)),
        roundOff: (0, sale_return_money_1.n)(t.roundOff),
        billValue: (0, sale_return_money_1.n)(t.creditNote),
        remarks: row.srReturnReason,
        createdBy: actor,
        lines,
    };
}
//# sourceMappingURL=sale-return-register.js.map