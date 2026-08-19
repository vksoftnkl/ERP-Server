"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const stock_adjust_reasons_seed_1 = require("../../src/database/seed/seeds/stock-adjust-reasons.seed");
const prisma = new client_1.PrismaClient();
stock_adjust_reasons_seed_1.stockAdjustReasonsSeed
    .run(prisma)
    .then(() => {
    console.log('Stock adjustment reasons and GST unit UQC data seeded successfully');
})
    .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=Stock_Adjust_Reasons.js.map