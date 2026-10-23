import type { TxnAdjacentQueryDto } from './dto/txn-adjacent-query.dto';
import { TxnAdjacentController } from './txn-adjacent.controller';
import type { TxnAdjacentPayload, TxnAdjacentService } from './txn-adjacent.service';

const q = {
  docType: 'SALE_BILL',
  companyId: '019c6f6c-be87-7a11-8905-36092c46d001',
  branchId: '019c6f6c-be87-7a11-8905-36092c46d002',
  accYear: '2026-2027',
  direction: 'prev',
} as TxnAdjacentQueryDto;

const payload = (doc: TxnAdjacentPayload['doc']): TxnAdjacentPayload => ({
  docType: 'SALE_BILL',
  direction: 'prev',
  fromDocId: null,
  doc,
});

describe('TxnAdjacentController', () => {
  let adjacent: jest.Mock;
  let controller: TxnAdjacentController;

  beforeEach(() => {
    adjacent = jest.fn();
    controller = new TxnAdjacentController({ adjacent } as unknown as TxnAdjacentService);
  });

  it('names the neighbour, a draft as (draft)', async () => {
    adjacent.mockResolvedValueOnce(
      payload({
        docId: '019c6f6c-be87-7a11-8905-36092c46d005',
        companyId: q.companyId,
        branchId: q.branchId,
        accYear: q.accYear,
        typeCode: 'TAX_INVOICE',
        refno: null,
        date: '2026-10-23',
        status: 'DRAFT',
      }),
    );

    const out = await controller.adjacent(q);

    expect(adjacent).toHaveBeenCalledWith(q);
    expect(out).toMatchObject({ success: true, message: '(draft) is the prev sale bill' });
  });

  it('says so at the end of the list', async () => {
    adjacent.mockResolvedValueOnce(payload(null));

    const out = await controller.adjacent(q);

    expect(out).toEqual({
      success: true,
      message: 'No prev sale bill — this is the end of the list',
      data: payload(null),
    });
  });
});
