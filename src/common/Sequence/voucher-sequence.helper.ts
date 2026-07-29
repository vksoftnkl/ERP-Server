import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccVoucherSeq, AccVoucherType, Prisma, VoucherResetFreq } from '@prisma/client';
// Held for the life of the transaction so the find-or-create below cannot race a
// concurrent first allocation on the same scope (the unique constraint would
// otherwise turn a simultaneous first save into a 500).
const VOUCHER_SEQ_LOCK_NAMESPACE = 'accounts.acc_voucher_seq.allocate';
const DEFAULT_DEVICE_CODE = 'MAIN';
// Period key used by voucher types that never reset their counter.
const NO_RESET_PERIOD_KEY = 'ALL';
// acc_voucher_seq.seq_last_refno / most document refno columns are VarChar(100).
const REFNO_MAX_LENGTH = 100;
const INITIAL_LAST_NO = BigInt(0);
type VoucherTypeFormat = Pick<
  AccVoucherType,
  'vchrTypeId' | 'vchrNoPrefix' | 'vchrNoSuffix' | 'vchrNoWidth' | 'vchrResetFreq'
>;
export interface VoucherNumberScope {
  vchrTypeId: number;
  companyId: string;
  branchId: string;
  accYear: string;
  // The counter is kept per device/counter inside the scope; callers that do not
  // number per device leave this alone and share the default 'MAIN' counter.
  deviceCode?: string | null;
  // Drives the reset period key for DAILY / MONTHLY voucher types. Pass the date
  // the document is dated on, not the save time; defaults to now.
  documentDate?: Date | null;
}
export interface AllocatedVoucherNumber {
  // The consumed running number — acc_voucher_seq.seq_last_no after the increment.
  lastNo: bigint;
  // voucherPrefix + zero-padded lastNo + voucherSuffix, also written back to
  // acc_voucher_seq.seq_last_refno.
  refno: string;
  // The reset bucket the number was drawn from, resolved from the voucher type.
  periodKey: string;
}
// Consumes the next number for `scope` from accounts.acc_voucher_seq and returns
// it together with the printable reference number. The sequence row is created
// on first use, seeded from the voucher type's numbering format.
//
// Must be called with a transaction client: the advisory lock and the increment
// only stay consistent while the caller's transaction is open, so the document
// insert has to commit alongside the number it consumed.
export async function allocateVoucherNumber(
  tx: Prisma.TransactionClient,
  scope: VoucherNumberScope,
): Promise<AllocatedVoucherNumber> {
  const vchrTypeId = scope.vchrTypeId;
  if (!Number.isInteger(vchrTypeId) || vchrTypeId <= 0) {
    throw new BadRequestException('vchrTypeId must be a positive integer.');
  }
  const companyId = requireText(scope.companyId, 'companyId');
  const branchId = requireText(scope.branchId, 'branchId');
  const accYear = requireText(scope.accYear, 'accYear');
  const deviceCode = scope.deviceCode?.trim() || DEFAULT_DEVICE_CODE;
  const voucherType = await tx.accVoucherType.findFirst({
    where: {
      vchrTypeId,
    },
    select: {
      vchrTypeId: true,
      vchrNoPrefix: true,
      vchrNoSuffix: true,
      vchrNoWidth: true,
      vchrResetFreq: true,
    },
  });
  if (!voucherType) {
    throw new NotFoundException(`Voucher type ${vchrTypeId} was not found.`);
  }
  const periodKey = buildPeriodKey(voucherType.vchrResetFreq, accYear, scope.documentDate);
  const resolvedScope = {
    vchrTypeId,
    companyId,
    branchId,
    accYear,
    deviceCode,
    periodKey,
  };
  await acquireScopeLock(tx, resolvedScope);
  const sequence = await findOrCreateSequence(tx, resolvedScope, voucherType);
  // Relative increment rather than a read-then-write of a value we already read:
  // the row lock it takes keeps the counter correct even against the admin CRUD
  // path, which guards a different advisory lock.
  const consumed = await tx.accVoucherSeq.update({
    where: {
      id: sequence.id,
    },
    data: {
      lastNo: {
        increment: 1,
      },
    },
  });
  const refno = buildRefno(consumed);
  await tx.accVoucherSeq.update({
    where: {
      id: sequence.id,
    },
    data: {
      lastRefno: refno,
      modifiedOn: new Date(),
    },
  });
  return {
    lastNo: consumed.lastNo,
    refno,
    periodKey,
  };
}
// prefix + zero-padded number + suffix. The company / branch codes on the row are
// a format snapshot only; the company and branch are already part of the scope
// the counter runs in, so repeating them in the printed number adds nothing.
export function buildRefno(sequence: AccVoucherSeq): string {
  const prefix = sequence.voucherPrefix?.trim() ?? '';
  const suffix = sequence.voucherSuffix?.trim() ?? '';
  const digits = sequence.lastNo.toString();
  // A counter that outgrows its configured width keeps counting rather than
  // truncating to a number that has already been issued.
  const width = Math.max(sequence.noWidth, digits.length);
  const refno = `${prefix}${digits.padStart(width, '0')}${suffix}`;
  if (refno.length > REFNO_MAX_LENGTH) {
    throw new BadRequestException(
      `Generated reference number "${refno}" exceeds ${REFNO_MAX_LENGTH} characters. Shorten the prefix, suffix, or number width on voucher type ${sequence.vchrTypeId}.`,
    );
  }
  return refno;
}
async function findOrCreateSequence(
  tx: Prisma.TransactionClient,
  scope: Required<Pick<VoucherNumberScope, 'vchrTypeId' | 'companyId' | 'branchId' | 'accYear'>> & {
    deviceCode: string;
    periodKey: string;
  },
  voucherType: VoucherTypeFormat,
): Promise<AccVoucherSeq> {
  const existing = await tx.accVoucherSeq.findFirst({
    where: {
      vchrTypeId: scope.vchrTypeId,
      companyId: scope.companyId,
      branchId: scope.branchId,
      accYear: scope.accYear,
      deviceCode: scope.deviceCode,
      periodKey: scope.periodKey,
    },
  });
  if (existing) {
    // isActive / isDeleted are deliberate admin switches — quietly reviving the
    // row would undo them, so the save fails with something actionable instead.
    if (existing.isDeleted || !existing.isActive) {
      throw new BadRequestException(
        `Voucher sequence ${existing.id} for voucher type ${scope.vchrTypeId} is inactive. Reactivate it before creating documents in ${scope.accYear}.`,
      );
    }
    return existing;
  }
  const [company, branch] = await Promise.all([
    tx.company.findFirst({
      where: {
        compId: scope.companyId,
        compIsDeleted: false,
      },
      select: {
        compCode: true,
      },
    }),
    tx.branchMaster.findFirst({
      where: {
        brId: scope.branchId,
        brCompId: scope.companyId,
        brIsDeleted: false,
      },
      select: {
        brCode: true,
      },
    }),
  ]);
  if (!company) {
    throw new BadRequestException(`No active company found with id ${scope.companyId}.`);
  }
  if (!branch) {
    throw new BadRequestException(
      `No active branch found with id ${scope.branchId} for company ${scope.companyId}.`,
    );
  }
  return tx.accVoucherSeq.create({
    data: {
      ...scope,
      lastNo: INITIAL_LAST_NO,
      // Format snapshot: editing the voucher type later never rewrites numbers
      // already issued from this row.
      voucherPrefix: voucherType.vchrNoPrefix,
      voucherSuffix: voucherType.vchrNoSuffix,
      noWidth: voucherType.vchrNoWidth,
      companyCode: company.compCode,
      branchCode: branch.brCode,
    },
  });
}
// The bucket the counter resets in: 'ALL' when it never resets, the accounting
// year when it resets yearly, otherwise the document's month or day.
function buildPeriodKey(
  resetFreq: VoucherResetFreq,
  accYear: string,
  documentDate: Date | null | undefined,
): string {
  const reference =
    documentDate && !Number.isNaN(documentDate.getTime()) ? documentDate : new Date();
  const year = String(reference.getUTCFullYear());
  const month = String(reference.getUTCMonth() + 1).padStart(2, '0');
  const day = String(reference.getUTCDate()).padStart(2, '0');
  switch (resetFreq) {
    case VoucherResetFreq.NEVER:
      return NO_RESET_PERIOD_KEY;
    case VoucherResetFreq.DAILY:
      return `${year}-${month}-${day}`;
    case VoucherResetFreq.MONTHLY:
      return `${year}-${month}`;
    case VoucherResetFreq.YEARLY:
    default:
      return accYear;
  }
}
async function acquireScopeLock(
  tx: Prisma.TransactionClient,
  scope: {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceCode: string;
    periodKey: string;
  },
): Promise<void> {
  const lockKey = [
    scope.vchrTypeId,
    scope.companyId,
    scope.branchId,
    scope.accYear,
    scope.deviceCode,
    scope.periodKey,
  ].join('|');
  await tx.$queryRaw<Array<{ locked: number }>>`
    WITH advisory_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtext(${VOUCHER_SEQ_LOCK_NAMESPACE}),
        hashtext(${lockKey})
      )
    )
    SELECT 1::int AS locked
  `;
}
function requireText(value: string | null | undefined, fieldName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException(`${fieldName} is required.`);
  }
  return trimmed;
}
