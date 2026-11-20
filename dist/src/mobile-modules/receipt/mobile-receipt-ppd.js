"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ppdScheduleOf = ppdScheduleOf;
const client_1 = require("@prisma/client");
const ppd_slab_1 = require("../../modules/accountsModule/receipt/ppd-slab");
const DAY_MS = 86_400_000;
function ppdScheduleOf(params) {
    const { docDate, onDate, pendingAmount, slabs } = params;
    if (slabs.length === 0 || pendingAmount.lessThanOrEqualTo(0)) {
        return [];
    }
    const days = [...new Set(slabs.map((slab) => slab.days))].sort((a, b) => a - b);
    const steps = days
        .map((day) => {
        const tillDate = new Date(docDate.getTime() + day * DAY_MS);
        const best = Math.max(...slabs.filter((slab) => slab.days >= day).map((slab) => slab.perc));
        return {
            tillDate,
            perc: best,
            amount: (0, ppd_slab_1.suggestPpdDiscount)({ docDate, onDate: tillDate, pendingAmount, slabs }),
        };
    })
        .filter((step) => step.tillDate.getTime() >= onDate.getTime());
    return steps
        .filter((step, index) => index === steps.length - 1 || steps[index + 1].perc !== step.perc)
        .map((step) => ({
        tillDate: step.tillDate.toISOString().slice(0, 10),
        perc: new client_1.Prisma.Decimal(step.perc).toFixed(3),
        amount: step.amount.toFixed(2),
    }));
}
//# sourceMappingURL=mobile-receipt-ppd.js.map