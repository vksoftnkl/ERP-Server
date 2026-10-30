import { HttpException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { PendingTxnStatusQueryDto, TxnStatusController } from './txn-status.controller';
import { PendingDocumentsResult, TxnStatusService } from './txn-status.service';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46d001';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46d002';
const QUERY = { companyId: COMPANY_ID, accYear: '2026-2027' };

const pipe = createHouseValidationPipe();
const transform = (value: unknown) =>
  pipe.transform(value, {
    type: 'query',
    metatype: PendingTxnStatusQueryDto,
  }) as Promise<PendingTxnStatusQueryDto>;

/** The fields the house pipe refused; [] when it let the query through. */
async function refusedFields(value: unknown): Promise<string[]> {
  try {
    await transform(value);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map(
      (detail) => detail.field,
    );
  }
}

describe('TxnStatusController', () => {
  let service: { pending: jest.Mock<Promise<PendingDocumentsResult>, [unknown]> };
  let controller: TxnStatusController;

  beforeEach(() => {
    service = { pending: jest.fn() };
    controller = new TxnStatusController(service as unknown as TxnStatusService);
  });

  it('passes the query through and says how many documents are pending', async () => {
    const data: PendingDocumentsResult = { items: [], counts: [], total: 4 };
    service.pending.mockResolvedValue(data);

    await expect(controller.pending(QUERY as PendingTxnStatusQueryDto)).resolves.toEqual({
      success: true,
      message: '4 documents still pending',
      data,
    });
    expect(service.pending).toHaveBeenCalledWith(QUERY);
  });

  it('says nothing is pending when the total is zero', async () => {
    service.pending.mockResolvedValue({ items: [], counts: [], total: 0 });

    await expect(controller.pending(QUERY as PendingTxnStatusQueryDto)).resolves.toMatchObject({
      success: true,
      message: 'Nothing is pending',
    });
  });
});

describe('PendingTxnStatusQueryDto (through the house pipe)', () => {
  it('accepts the company and year alone', async () => {
    await expect(refusedFields(QUERY)).resolves.toEqual([]);
  });

  it('accepts every optional filter', async () => {
    await expect(
      refusedFields({
        ...QUERY,
        branchId: BRANCH_ID,
        upToDate: '2026-10-20',
        srcModule: 'SALES',
        limit: '50',
        offset: '100',
      }),
    ).resolves.toEqual([]);
  });

  it('turns query-string paging into numbers', async () => {
    const dto = await transform({ ...QUERY, limit: '50', offset: '0' });

    expect(dto.limit).toBe(50);
    expect(dto.offset).toBe(0);
  });

  it.each([
    ['no company', { accYear: '2026-2027' }, 'companyId'],
    ['a company that is not a uuid', { ...QUERY, companyId: 'company-1' }, 'companyId'],
    ['a branch that is not a uuid', { ...QUERY, branchId: 'main' }, 'branchId'],
    ['no year', { companyId: COMPANY_ID }, 'accYear'],
    ['a year not shaped YYYY-YYYY', { ...QUERY, accYear: '2026-27' }, 'accYear'],
    ['a date not shaped YYYY-MM-DD', { ...QUERY, upToDate: '20/10/2026' }, 'upToDate'],
    ['a module over 20 characters', { ...QUERY, srcModule: 'M'.repeat(21) }, 'srcModule'],
    ['a limit of 0', { ...QUERY, limit: '0' }, 'limit'],
    ['a limit over 2000', { ...QUERY, limit: '2001' }, 'limit'],
    ['a fractional limit', { ...QUERY, limit: '1.5' }, 'limit'],
    ['a negative offset', { ...QUERY, offset: '-1' }, 'offset'],
  ])('refuses %s', async (_label, query, field) => {
    await expect(refusedFields(query)).resolves.toEqual([field]);
  });
});
