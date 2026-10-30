import { Prisma } from '@prisma/client';
import type { SaveReceiptTenderDto } from './dto/save-receipt.dto';
import type { ReceiptWriteClient } from './receipt.guards';
import { normaliseTenders } from './receipt-lines';

/**
 * Notes 107 / 127 §4 — a percentage surcharge is INSIDE the tender:
 * surchargeAmt = round2(tdAmount × perc / (100 + perc)). 200 + 1% UPI comes in
 * as 202.00 with 2.00 of it surcharge, the same as on the sale bill — not
 * 202 × 1% = 2.02.
 */

const COMPANY = '00000000-0000-0000-0000-0000000000c1';
const BRANCH = '00000000-0000-0000-0000-0000000000b1';
const UPI_TENDER = '00000000-0000-0000-0000-00000000a001';
const UPI_TYPE_ID = 3;

const d = (value: number | string): Prisma.Decimal => new Prisma.Decimal(value);

function clientWith(master: {
  perc: number;
  flat?: number;
  editSurcharge?: boolean;
}): ReceiptWriteClient {
  const row = {
    tndId: UPI_TENDER,
    tndName: 'UPI',
    tndCompanyId: COMPANY,
    tndBranchId: null,
    tndTypeId: UPI_TYPE_ID,
    tndLedgerId: '00000000-0000-0000-0000-00000000f001',
    tndSettlementLedgerId: null,
    tndSurchargeLedgerId: '00000000-0000-0000-0000-00000000f002',
    tndSurchargePerc: d(master.perc),
    tndSurchargeAmount: d(master.flat ?? 0),
    tndEditLedger: false,
    tndEditSurcharge: master.editSurcharge ?? false,
    tndIsActive: true,
    tenderType: { ttmTypeId: UPI_TYPE_ID, ttmTypeName: 'UPI', ttmIsCash: false },
  };
  return {
    accTenderMaster: { findMany: jest.fn().mockResolvedValue([row]) },
  } as unknown as ReceiptWriteClient;
}

async function surchargeOf(
  client: ReceiptWriteClient,
  tender: Partial<SaveReceiptTenderDto> & { tdAmount: number },
): Promise<string> {
  const [row] = await normaliseTenders(client, {
    tenders: [
      {
        tdRowNo: 1,
        tdTenderId: UPI_TENDER,
        tdTenderTypeId: UPI_TYPE_ID,
        ...tender,
      } as SaveReceiptTenderDto,
    ],
    companyId: COMPANY,
    branchId: BRANCH,
    receiptDate: new Date('2026-10-16T00:00:00.000Z'),
  });
  return row.surchargeAmt.toFixed(2);
}

describe('normaliseTenders — percentage surcharge inside the tender (notes 127 §4)', () => {
  it('200 + 1% UPI is 202.00, of which 2.00 is surcharge', async () => {
    expect(await surchargeOf(clientWith({ perc: 1 }), { tdAmount: 202 })).toBe('2.00');
  });

  it('rounds the inside share to 2 places', async () => {
    // 1000 × 2 / 102 = 19.6078…
    expect(await surchargeOf(clientWith({ perc: 2 }), { tdAmount: 1000 })).toBe('19.61');
    // 101.50 × 1.5 / 101.5 = 1.50 exactly
    expect(await surchargeOf(clientWith({ perc: 1.5 }), { tdAmount: 101.5 })).toBe('1.50');
  });

  it('no percentage: the master’s flat surcharge amount', async () => {
    expect(await surchargeOf(clientWith({ perc: 0, flat: 5 }), { tdAmount: 205 })).toBe('5.00');
  });

  it('a master that lets the surcharge be edited takes the client’s amount', async () => {
    expect(
      await surchargeOf(clientWith({ perc: 1, editSurcharge: true }), {
        tdAmount: 202,
        tdSurchargeAmt: 3,
      }),
    ).toBe('3.00');
  });
});
