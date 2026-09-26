import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConvertTxnHoldDto, LockTxnHoldDto } from './lock-txn-hold.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const LOCK_TOKEN = '019c6f6c-be87-7a11-8905-36092c46fe0a';
const ACC_YEAR = '2026-2027';

// The same options main.ts registers globally, so what these tests reject is
// what the running server rejects.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const erroredFields = (dto: object): string[] => validateSync(dto).map((error) => error.property);

describe('LockTxnHoldDto', () => {
  it('accepts the tenant scope a lease request is keyed on', () => {
    const dto = plainToInstance(LockTxnHoldDto, {
      txhCompanyId: COMPANY_ID,
      txhBranchId: BRANCH_ID,
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  // Every lease query filters on BOTH halves, so neither may be left to the
  // service to guess.
  it('requires both halves of the scope', () => {
    expect(erroredFields(plainToInstance(LockTxnHoldDto, {}))).toEqual(
      expect.arrayContaining(['txhCompanyId', 'txhBranchId']),
    );
    expect(erroredFields(plainToInstance(LockTxnHoldDto, { txhCompanyId: COMPANY_ID }))).toEqual([
      'txhBranchId',
    ]);
  });

  it('rejects a scope id that is not a uuid', () => {
    const dto = plainToInstance(LockTxnHoldDto, {
      txhCompanyId: 'not-a-uuid',
      txhBranchId: BRANCH_ID,
    });

    expect(erroredFields(dto)).toEqual(['txhCompanyId']);
  });

  // The accounting year is half the primary key, so sending it prunes the
  // lookup to one partition — but a till holding only a token slip has the id
  // and not the year.
  it('takes the accounting year as an optional partition hint', () => {
    const withYear = plainToInstance(LockTxnHoldDto, {
      txhCompanyId: COMPANY_ID,
      txhBranchId: BRANCH_ID,
      txhAccYear: ACC_YEAR,
    });

    expect(validateSync(withYear)).toHaveLength(0);
    expect(withYear.txhAccYear).toBe(ACC_YEAR);
    expect(
      erroredFields(
        plainToInstance(LockTxnHoldDto, {
          txhCompanyId: COMPANY_ID,
          txhBranchId: BRANCH_ID,
          txhAccYear: '2026-2027-2028',
        }),
      ),
    ).toEqual(['txhAccYear']);
  });

  // A lease that never ends is the bug the lock block exists to prevent, so the
  // TTL is bounded at both ends rather than taken on trust.
  it('holds the lease TTL inside its bounds', () => {
    const dto = plainToInstance(LockTxnHoldDto, {
      txhCompanyId: COMPANY_ID,
      txhBranchId: BRANCH_ID,
      lockTtlSeconds: 60,
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(
      erroredFields(
        plainToInstance(LockTxnHoldDto, {
          txhCompanyId: COMPANY_ID,
          txhBranchId: BRANCH_ID,
          lockTtlSeconds: 5,
        }),
      ),
    ).toEqual(['lockTtlSeconds']);
    expect(
      erroredFields(
        plainToInstance(LockTxnHoldDto, {
          txhCompanyId: COMPANY_ID,
          txhBranchId: BRANCH_ID,
          lockTtlSeconds: 90_000,
        }),
      ),
    ).toEqual(['lockTtlSeconds']);
  });

  it('accepts the lock token resume answered with', () => {
    const dto = plainToInstance(LockTxnHoldDto, {
      txhCompanyId: COMPANY_ID,
      txhBranchId: BRANCH_ID,
      txhLockToken: LOCK_TOKEN,
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(
      erroredFields(
        plainToInstance(LockTxnHoldDto, {
          txhCompanyId: COMPANY_ID,
          txhBranchId: BRANCH_ID,
          txhLockToken: 'nope',
        }),
      ),
    ).toEqual(['txhLockToken']);
  });

  // The device is the X-Device-Id header. A body field of that name would be a
  // second, disagreeing source of truth for who holds the lease.
  it('refuses a body that tries to name the device or the status itself', async () => {
    for (const extra of [
      { txhDeviceId: '019c6f6c-be87-7a11-8905-36092c46fe11' },
      { txhLockedDeviceId: '019c6f6c-be87-7a11-8905-36092c46fe11' },
      { txhStatus: 'HELD' },
    ]) {
      await expect(
        pipe.transform(
          { txhCompanyId: COMPANY_ID, txhBranchId: BRANCH_ID, ...extra },
          { type: 'body', metatype: LockTxnHoldDto },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

describe('ConvertTxnHoldDto', () => {
  const validBody = {
    txhCompanyId: COMPANY_ID,
    txhBranchId: BRANCH_ID,
    txhConvertedDocId: BILL_ID,
    txhConvertedAccYear: ACC_YEAR,
  };

  it('carries the scope of the lock DTO it extends', () => {
    const dto = plainToInstance(ConvertTxnHoldDto, {
      txhConvertedDocId: BILL_ID,
      txhConvertedAccYear: ACC_YEAR,
    });

    expect(erroredFields(dto)).toEqual(expect.arrayContaining(['txhCompanyId', 'txhBranchId']));
  });

  // ck_txh_converted_block wants the whole trail or none of it, and the year is
  // part of the trail because a March hold can become an April document.
  it('requires the document the hold became, and its year', () => {
    expect(
      erroredFields(
        plainToInstance(ConvertTxnHoldDto, {
          txhCompanyId: COMPANY_ID,
          txhBranchId: BRANCH_ID,
        }),
      ),
    ).toEqual(expect.arrayContaining(['txhConvertedDocId', 'txhConvertedAccYear']));
  });

  // There is deliberately NO converted doc TYPE: a hold becomes the document it
  // was parked as, so the stored txhDocType already names it.
  it('refuses a converted document type', async () => {
    await expect(
      pipe.transform(
        { ...validBody, txhConvertedDocType: 'SALE_BILL' },
        { type: 'body', metatype: ConvertTxnHoldDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('treats a blank document number as no number at all', () => {
    const dto = plainToInstance(ConvertTxnHoldDto, { ...validBody, txhConvertedRefno: '   ' });

    expect(dto.txhConvertedRefno).toBeNull();
    expect(validateSync(dto)).toHaveLength(0);
  });

  // txh_converted_refno is varchar(100); txh_converted_by is a uuid, unlike the
  // varchar(50) audit actors.
  it('holds the trail columns to their types', () => {
    expect(
      erroredFields(
        plainToInstance(ConvertTxnHoldDto, { ...validBody, txhConvertedRefno: 'N'.repeat(101) }),
      ),
    ).toEqual(['txhConvertedRefno']);
    expect(
      erroredFields(plainToInstance(ConvertTxnHoldDto, { ...validBody, txhConvertedBy: 'me' })),
    ).toEqual(['txhConvertedBy']);
  });

  it('accepts a full conversion body through the global pipe', async () => {
    const transformed = (await pipe.transform(
      { ...validBody, txhConvertedRefno: 'INV-101', txhConvertedBy: USER_ID },
      { type: 'body', metatype: ConvertTxnHoldDto },
    )) as ConvertTxnHoldDto;

    expect(transformed).toBeInstanceOf(ConvertTxnHoldDto);
    expect(transformed.txhConvertedDocId).toBe(BILL_ID);
    expect(transformed.txhConvertedAccYear).toBe(ACC_YEAR);
    expect(transformed.txhConvertedRefno).toBe('INV-101');
  });
});
