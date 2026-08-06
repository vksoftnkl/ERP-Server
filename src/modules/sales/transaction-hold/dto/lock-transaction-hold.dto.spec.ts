import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConvertTransactionHoldDto, LockTransactionHoldDto } from './lock-transaction-hold.dto';
import { TransactionHoldDocType } from '../types/transaction-hold-api.types';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';

// The same options main.ts registers globally, so what these tests reject is
// what the running server rejects.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const erroredFields = (dto: object): string[] => validateSync(dto).map((error) => error.property);

describe('LockTransactionHoldDto', () => {
  it('accepts the tenant scope a lock request is keyed on', () => {
    const dto = plainToInstance(LockTransactionHoldDto, {
      thCompanyId: COMPANY_ID,
      thBranchId: BRANCH_ID,
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  // Every lock query filters on BOTH halves, so neither may be left to the
  // service to guess.
  it('requires both halves of the scope', () => {
    expect(erroredFields(plainToInstance(LockTransactionHoldDto, {}))).toEqual(
      expect.arrayContaining(['thCompanyId', 'thBranchId']),
    );
    expect(
      erroredFields(plainToInstance(LockTransactionHoldDto, { thCompanyId: COMPANY_ID })),
    ).toEqual(['thBranchId']);
  });

  it('rejects a scope id that is not a uuid', () => {
    const dto = plainToInstance(LockTransactionHoldDto, {
      thCompanyId: 'not-a-uuid',
      thBranchId: BRANCH_ID,
    });

    expect(erroredFields(dto)).toEqual(['thCompanyId']);
  });

  // The device id is the X-Device-Id header. A body field of that name would be
  // a second, disagreeing source of truth for who holds the lock.
  it('refuses a body that tries to name the device or the status itself', async () => {
    await expect(
      pipe.transform(
        { thCompanyId: COMPANY_ID, thBranchId: BRANCH_ID, thDeviceId: 'TILL-02' },
        { type: 'body', metatype: LockTransactionHoldDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      pipe.transform(
        { thCompanyId: COMPANY_ID, thBranchId: BRANCH_ID, thStatus: 'HELD' },
        { type: 'body', metatype: LockTransactionHoldDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      pipe.transform(
        { thCompanyId: COMPANY_ID, thBranchId: BRANCH_ID, thLockedBy: 'TILL-02' },
        { type: 'body', metatype: LockTransactionHoldDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ConvertTransactionHoldDto', () => {
  const validBody = {
    thCompanyId: COMPANY_ID,
    thBranchId: BRANCH_ID,
    thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
    thConvertedDocId: BILL_ID,
  };

  it('carries the scope of the lock DTO it extends', () => {
    const dto = plainToInstance(ConvertTransactionHoldDto, {
      thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
      thConvertedDocId: BILL_ID,
    });

    expect(erroredFields(dto)).toEqual(expect.arrayContaining(['thCompanyId', 'thBranchId']));
  });

  // th_converted_doc_id is polymorphic (no FK), so the pair is the only thing
  // naming the document the hold became — neither half is optional.
  it('requires the document the hold became', () => {
    expect(
      erroredFields(
        plainToInstance(ConvertTransactionHoldDto, {
          thCompanyId: COMPANY_ID,
          thBranchId: BRANCH_ID,
        }),
      ),
    ).toEqual(expect.arrayContaining(['thConvertedDocType', 'thConvertedDocId']));
  });

  it('upper-cases the document type and rejects one outside the set', () => {
    const dto = plainToInstance(ConvertTransactionHoldDto, {
      ...validBody,
      thConvertedDocType: 'sale_invoice',
    });

    expect(dto.thConvertedDocType).toBe(TransactionHoldDocType.SALE_INVOICE);
    expect(validateSync(dto)).toHaveLength(0);

    expect(
      erroredFields(
        plainToInstance(ConvertTransactionHoldDto, {
          ...validBody,
          thConvertedDocType: 'JOB_CARD',
        }),
      ),
    ).toEqual(['thConvertedDocType']);
  });

  it('treats a blank document number as no number at all', () => {
    const dto = plainToInstance(ConvertTransactionHoldDto, { ...validBody, thConvertedNo: '   ' });

    expect(dto.thConvertedNo).toBeNull();
    expect(validateSync(dto)).toHaveLength(0);
  });

  // th_converted_no is varchar(30) and th_converted_by varchar(50).
  it('holds the trace columns to their widths', () => {
    expect(
      erroredFields(
        plainToInstance(ConvertTransactionHoldDto, { ...validBody, thConvertedNo: 'N'.repeat(31) }),
      ),
    ).toEqual(['thConvertedNo']);
    expect(
      erroredFields(
        plainToInstance(ConvertTransactionHoldDto, { ...validBody, thConvertedBy: 'U'.repeat(51) }),
      ),
    ).toEqual(['thConvertedBy']);
  });

  it('accepts a full conversion body through the global pipe', async () => {
    const transformed = (await pipe.transform(
      { ...validBody, thConvertedNo: 'INV-101', thConvertedBy: 'cashier-7' },
      { type: 'body', metatype: ConvertTransactionHoldDto },
    )) as ConvertTransactionHoldDto;

    expect(transformed).toBeInstanceOf(ConvertTransactionHoldDto);
    expect(transformed.thConvertedDocId).toBe(BILL_ID);
    expect(transformed.thConvertedNo).toBe('INV-101');
  });
});
