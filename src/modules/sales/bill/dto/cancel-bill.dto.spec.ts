import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CancelBillDto } from './cancel-bill.dto';

const BILL_ID = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const COMPANY_ID = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const BRANCH_ID = '019f659c-3942-7237-89b0-c4899603dd7a';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const transform = (payload: Record<string, unknown>): Promise<CancelBillDto> =>
  validationPipe.transform(
    {
      sbId: BILL_ID,
      sbCompanyId: COMPANY_ID,
      sbBranchId: BRANCH_ID,
      sbAccYear: '2026-2027',
      remarks: 'Customer cancelled the balance',
      username: 'karthik',
      ...payload,
    },
    { type: 'body', metatype: CancelBillDto },
  ) as Promise<CancelBillDto>;

describe('CancelBillDto', () => {
  it('accepts the identifiers plus a reason and an actor', async () => {
    await expect(transform({})).resolves.toMatchObject({
      sbId: BILL_ID,
      sbAccYear: '2026-2027',
      remarks: 'Customer cancelled the balance',
      username: 'karthik',
    });
  });

  // The two fields the cancellation exists to record. A cancel with no stated
  // reason is what ck_tsl_reason_required is there to stop reaching the trail,
  // and one with no actor leaves so_modified_by naming whoever the request
  // context guessed — so both are refused here, before any of it is written.
  it.each(['remarks', 'username'])('rejects a missing %s', async (field) => {
    await expect(transform({ [field]: undefined })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['remarks', 'username'])('rejects a blank %s', async (field) => {
    await expect(transform({ [field]: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trims what it keeps, so the trailing spaces of a typed reason are not stored', async () => {
    await expect(transform({ remarks: '  out of stock  ' })).resolves.toMatchObject({
      remarks: 'out of stock',
    });
  });

  // soi_cancel_reason is VarChar(250). Over-long is a 400 naming the field
  // rather than a 22001 that would roll the cancellation back mid-write.
  it('rejects a reason longer than the column it lands in', async () => {
    await expect(transform({ remarks: 'x'.repeat(251) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(transform({ remarks: 'x'.repeat(250) })).resolves.toMatchObject({
      remarks: 'x'.repeat(250),
    });
  });

  // ... and the created_by / modified_by columns are VarChar(50).
  it('rejects a username longer than the columns it is written to', async () => {
    await expect(transform({ username: 'u'.repeat(51) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an sbId that is not a uuid', async () => {
    await expect(transform({ sbId: 'not-a-uuid' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
