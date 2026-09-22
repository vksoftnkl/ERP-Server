"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBillLegs = buildBillLegs;
exports.buildReturnLegs = buildReturnLegs;
exports.buildCogsLegs = buildCogsLegs;
exports.buildTenderLegs = buildTenderLegs;
function buildBillLegs(input) {
    const legs = [];
    const partyDebit = billPartyDebit(input);
    push(legs, {
        ledgerId: input.partyLedgerId,
        drCr: 'DR',
        amount: partyDebit,
        remarks: 'Bill value',
    });
    push(legs, {
        role: 'SALES',
        roleTag: 'SALES',
        drCr: 'CR',
        amount: input.salesAmount,
        supplyNature: input.supplyNature,
        field: 'sbTaxableAmt',
    });
    pushTaxLegs(legs, input.taxes, input.supplyNature, 'CR');
    for (const charge of input.charges) {
        if (!charge.separatelyPosted || round2(charge.amount) === 0) {
            continue;
        }
        push(legs, {
            ledgerId: charge.ledgerId,
            drCr: charge.amount >= 0 ? 'CR' : 'DR',
            amount: Math.abs(charge.amount),
            remarks: charge.name ?? null,
            field: 'charges',
        });
        pushTaxLegs(legs, [
            {
                taxId: charge.taxId ?? null,
                cgst: charge.cgst ?? 0,
                sgst: charge.sgst ?? 0,
                igst: charge.igst ?? 0,
                cess: charge.cess ?? 0,
                acess: 0,
            },
        ], input.supplyNature, charge.amount >= 0 ? 'CR' : 'DR');
    }
    push(legs, {
        role: 'DISCOUNT_ALLOWED',
        roleTag: 'DISCOUNT_ALLOWED',
        drCr: 'DR',
        amount: input.cashDiscount,
        field: 'sbCashDisc',
    });
    push(legs, {
        role: 'SCHEME_DISCOUNT',
        roleTag: 'SCHEME_DISCOUNT',
        drCr: 'DR',
        amount: input.schemeDiscount,
        field: 'sbSchDisc',
    });
    if (round2(input.roundOff) !== 0) {
        push(legs, {
            role: 'ROUND_OFF',
            roleTag: 'ROUND_OFF',
            drCr: input.roundOff >= 0 ? 'CR' : 'DR',
            amount: Math.abs(input.roundOff),
            field: 'sbRoundOff',
        });
    }
    push(legs, {
        role: 'TCS_PAYABLE',
        roleTag: 'TCS_PAYABLE',
        drCr: 'CR',
        amount: input.tcsAmount,
        field: 'sbTcsAmt',
    });
    legs.push(...buildCogsLegs(input.cogsAmount));
    for (const tender of input.tenders) {
        legs.push(...buildTenderLegs(tender, input.partyLedgerId));
    }
    if (round2(input.advanceAdjusted) !== 0) {
        push(legs, {
            role: 'ADVANCE_RECEIVED',
            roleTag: 'ADVANCE_RECEIVED',
            drCr: 'DR',
            amount: input.advanceAdjusted,
            field: 'sbAdvanceAmt',
        });
        push(legs, {
            ledgerId: input.partyLedgerId,
            drCr: 'CR',
            amount: input.advanceAdjusted,
            remarks: 'Advance adjusted',
        });
    }
    return legs;
}
function buildReturnLegs(input) {
    const legs = [];
    const partyCredit = returnPartyCredit(input);
    push(legs, {
        ledgerId: input.partyLedgerId,
        drCr: 'CR',
        amount: partyCredit,
        remarks: 'Return value',
    });
    push(legs, {
        role: 'SALES_RETURN',
        roleTag: 'SALES_RETURN',
        drCr: 'DR',
        amount: input.salesAmount,
        supplyNature: input.supplyNature,
        field: 'srTaxableAmt',
    });
    pushTaxLegs(legs, input.taxes, input.supplyNature, 'DR');
    for (const charge of input.charges) {
        if (!charge.separatelyPosted || round2(charge.amount) === 0) {
            continue;
        }
        push(legs, {
            ledgerId: charge.ledgerId,
            drCr: charge.amount >= 0 ? 'DR' : 'CR',
            amount: Math.abs(charge.amount),
            remarks: charge.name ?? null,
            field: 'charges',
        });
    }
    push(legs, {
        role: 'DISCOUNT_ALLOWED',
        roleTag: 'DISCOUNT_ALLOWED',
        drCr: 'CR',
        amount: input.cashDiscount,
        field: 'srCashDisc',
    });
    push(legs, {
        role: 'SCHEME_DISCOUNT',
        roleTag: 'SCHEME_DISCOUNT',
        drCr: 'CR',
        amount: input.schemeDiscount,
        field: 'srSchDisc',
    });
    if (round2(input.roundOff) !== 0) {
        push(legs, {
            role: 'ROUND_OFF',
            roleTag: 'ROUND_OFF',
            drCr: input.roundOff >= 0 ? 'DR' : 'CR',
            amount: Math.abs(input.roundOff),
            field: 'srRoundOff',
        });
    }
    legs.push(...buildCogsLegs(input.cogsAmount, 'RETURN'));
    for (const tender of input.tenders) {
        legs.push(...buildTenderLegs(tender, input.partyLedgerId, 'RETURN'));
    }
    return legs;
}
function buildCogsLegs(cogsAmount, direction = 'ISSUE') {
    if (round2(cogsAmount) === 0) {
        return [];
    }
    const out = direction === 'ISSUE';
    return [
        {
            role: 'COGS',
            roleTag: 'COGS',
            drCr: out ? 'DR' : 'CR',
            amount: Math.abs(cogsAmount),
            field: 'cogsAmt',
        },
        {
            role: 'INVENTORY',
            roleTag: 'INVENTORY',
            drCr: out ? 'CR' : 'DR',
            amount: Math.abs(cogsAmount),
            field: 'cogsAmt',
        },
    ];
}
function buildTenderLegs(tender, partyLedgerId, direction = 'BILL') {
    if (tender.isCredit || round2(tender.amount) === 0) {
        return [];
    }
    const paying = direction === 'BILL';
    const settlement = tender.isLoyalty
        ? {
            role: 'LOYALTY_REDEMPTION',
            roleTag: 'LOYALTY_REDEMPTION',
            drCr: paying ? 'DR' : 'CR',
            amount: Math.abs(tender.amount),
            field: 'tenders',
        }
        : {
            ledgerId: tender.tenderLedgerId,
            drCr: paying ? 'DR' : 'CR',
            amount: Math.abs(tender.amount),
            remarks: tender.name ?? null,
            field: 'tenders',
        };
    return [
        settlement,
        {
            ledgerId: partyLedgerId,
            drCr: paying ? 'CR' : 'DR',
            amount: Math.abs(tender.amount),
            remarks: tender.name ?? null,
        },
    ];
}
function billPartyDebit(input) {
    const tax = input.taxes.reduce((s, t) => s + t.cgst + t.sgst + t.igst + t.cess + t.acess, 0);
    const charges = input.charges
        .filter((c) => c.separatelyPosted)
        .reduce((s, c) => s + c.amount + (c.cgst ?? 0) + (c.sgst ?? 0) + (c.igst ?? 0) + (c.cess ?? 0), 0);
    return round2(input.salesAmount +
        tax +
        charges +
        input.roundOff +
        input.tcsAmount -
        input.cashDiscount -
        input.schemeDiscount);
}
function returnPartyCredit(input) {
    const tax = input.taxes.reduce((s, t) => s + t.cgst + t.sgst + t.igst + t.cess + t.acess, 0);
    const charges = input.charges.filter((c) => c.separatelyPosted).reduce((s, c) => s + c.amount, 0);
    return round2(input.salesAmount + tax + charges + input.roundOff - input.cashDiscount - input.schemeDiscount);
}
function pushTaxLegs(legs, buckets, supplyNature, drCr) {
    for (const bucket of buckets) {
        const heads = [
            ['OUTPUT_CGST', bucket.cgst],
            ['OUTPUT_SGST', bucket.sgst],
            ['OUTPUT_IGST', bucket.igst],
            ['OUTPUT_CESS', bucket.cess],
            ['OUTPUT_ACESS', bucket.acess],
        ];
        for (const [role, amount] of heads) {
            push(legs, {
                role,
                roleTag: role,
                drCr,
                amount,
                taxId: bucket.taxId,
                supplyNature,
                field: 'taxes',
            });
        }
    }
}
function push(legs, leg) {
    if (round2(leg.amount) !== 0) {
        legs.push({ ...leg, amount: round2(leg.amount) });
    }
}
function round2(v) {
    return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}
//# sourceMappingURL=sales-leg.sources.js.map