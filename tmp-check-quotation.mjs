import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const rec = await prisma.saleQuotationItem.findFirst({
  include: {
    item: { select: { itemNameEn: true } },
    itemUnitConversion: { select: { unit: { select: { unit_name: true } } } },
  },
});
console.log(JSON.stringify(rec, null, 2));
console.log('total items:', await prisma.saleQuotationItem.count());
await prisma.$disconnect();
