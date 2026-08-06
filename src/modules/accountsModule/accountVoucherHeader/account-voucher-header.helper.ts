// import { BadRequestException, NotFoundException } from '@nestjs/common';
// import { AccVoucherHeader, AccVoucherType, Prisma, VoucherStatus } from '@prisma/client';
// import { PrismaService } from '../../../database/prisma/prisma.service';
// const ACCOUNT_VOUCHER_NO_LOCK_NAMESPACE = 'accounts.acc_voucher_header.voucher_no';
// const ACCOUNT_VOUCHER_SLNO_LOCK_NAMESPACE = 'accounts.acc_voucher_header.voucher_slno';
// const INITIAL_VOUCHER_SEQUENCE = BigInt(1);
// export type AccountVoucherHeaderWriteClient = Prisma.TransactionClient | PrismaService;
// export type CreateAccountVoucherHeaderPayload = Omit<
//   Prisma.AccVoucherHeaderUncheckedCreateInput,
//   'avhVoucherId' | 'avhVoucherNo' | 'avhVoucherSlno' | 'avhVoucherRefno' | 'avhBillRefno'
// >;
// export type UpdateAccountVoucherHeaderPayload = Partial<
//   Omit<
//     Prisma.AccVoucherHeaderUncheckedCreateInput,
//     | 'avhVoucherId'
//     | 'avhVoucherNo'
//     | 'avhVoucherSlno'
//     | 'avhVoucherRefno'
//     | 'avhCreatedOn'
//     | 'avhCreatedBy'
//     | 'avhUpdatedOn'
//     | 'avhIsDeleted'
//   >
// >;
// export type SoftDeleteAccountVoucherHeaderPayload = {
//   avhUpdatedBy?: string | null;
//   avhStatusBy?: string | null;
//   avhCancelReason?: string | null;
// };
// type VoucherNumberScope = Pick<
//   CreateAccountVoucherHeaderPayload,
//   'avhAccYear' | 'avhCompanyId' | 'avhBranchId' | 'avhVoucherTypeId'
// >;
// type VoucherTypeCodeLookup = Pick<AccVoucherType, 'vchrTypeId' | 'vchrTypeCode'>;
// export async function createAccountVoucherHeader(
//   client: AccountVoucherHeaderWriteClient,
//   payload: CreateAccountVoucherHeaderPayload,
// ): Promise<AccVoucherHeader> {
//   if (isPrismaService(client)) {
//     return client.$transaction((tx) => createAccountVoucherHeader(tx, payload));
//   }
//   const data = await buildAccountVoucherHeaderCreateInput(client, payload);
//   return client.accVoucherHeader.create({ data });
// }
// export async function updateAccountVoucherHeader(
//   client: AccountVoucherHeaderWriteClient,
//   avhVoucherId: string,
//   payload: UpdateAccountVoucherHeaderPayload,
// ): Promise<AccVoucherHeader> {
//   if (isPrismaService(client)) {
//     return client.$transaction((tx) => updateAccountVoucherHeader(tx, avhVoucherId, payload));
//   }
//   const data = await buildAccountVoucherHeaderUpdateInput(client, avhVoucherId, payload);
//   return client.accVoucherHeader.update({
//     where: {
//       avhVoucherId,
//     },
//     data,
//   });
// }
// export async function softDeleteAccountVoucherHeader(
//   client: AccountVoucherHeaderWriteClient,
//   avhVoucherId: string,
//   payload: SoftDeleteAccountVoucherHeaderPayload = {},
// ): Promise<AccVoucherHeader> {
//   if (isPrismaService(client)) {
//     return client.$transaction((tx) => softDeleteAccountVoucherHeader(tx, avhVoucherId, payload));
//   }
//   await getActiveVoucherHeader(client, avhVoucherId);
//   const now = new Date();
//   const data: Prisma.AccVoucherHeaderUncheckedUpdateInput = {
//     avhIsActive: false,
//     avhIsDeleted: true,
//     avhVoucherStatus: VoucherStatus.CANCELLED,
//     avhStatusOn: now,
//     avhUpdatedOn: now,
//   };
//   if (Object.prototype.hasOwnProperty.call(payload, 'avhUpdatedBy')) {
//     data.avhUpdatedBy = payload.avhUpdatedBy;
//   }
//   if (Object.prototype.hasOwnProperty.call(payload, 'avhStatusBy')) {
//     data.avhStatusBy = payload.avhStatusBy;
//   } else if (Object.prototype.hasOwnProperty.call(payload, 'avhUpdatedBy')) {
//     data.avhStatusBy = payload.avhUpdatedBy;
//   }
//   if (Object.prototype.hasOwnProperty.call(payload, 'avhCancelReason')) {
//     data.avhCancelReason = payload.avhCancelReason;
//   }
//   return client.accVoucherHeader.update({
//     where: {
//       avhVoucherId,
//     },
//     data,
//   });
// }
// export async function buildAccountVoucherHeaderCreateInput(
//   client: AccountVoucherHeaderWriteClient,
//   payload: CreateAccountVoucherHeaderPayload,
// ): Promise<Prisma.AccVoucherHeaderUncheckedCreateInput> {
//   if (isPrismaService(client)) {
//     throw new BadRequestException(
//       'buildAccountVoucherHeaderCreateInput must be called with a transaction client. Use createAccountVoucherHeader when you want the helper to manage the transaction.',
//     );
//   }
//   validateVoucherScope(payload);
//   // Keep lock order stable so concurrent writers cannot deadlock each other.
//   await acquireScopedLock(client, ACCOUNT_VOUCHER_NO_LOCK_NAMESPACE, buildVoucherNoScope(payload));
//   await acquireScopedLock(
//     client,
//     ACCOUNT_VOUCHER_SLNO_LOCK_NAMESPACE,
//     buildVoucherSlnoScope(payload),
//   );
//   const voucherType = await getVoucherTypeCode(client, payload.avhVoucherTypeId);
//   const avhVoucherNo = await getNextVoucherNo(client, payload);
//   const avhVoucherSlno = await getNextVoucherSlno(client, payload);
//   const avhVoucherRefno = buildVoucherRefno(voucherType.vchrTypeCode, avhVoucherSlno);
//   return {
//     ...syncBillDateWithVoucherDate(payload),
//     avhVoucherNo,
//     avhVoucherSlno,
//     avhVoucherRefno,
//     avhBillRefno: avhVoucherRefno,
//   };
// }
// export async function buildAccountVoucherHeaderUpdateInput(
//   client: AccountVoucherHeaderWriteClient,
//   avhVoucherId: string,
//   payload: UpdateAccountVoucherHeaderPayload,
// ): Promise<Prisma.AccVoucherHeaderUncheckedUpdateInput> {
//   if (isPrismaService(client)) {
//     throw new BadRequestException(
//       'buildAccountVoucherHeaderUpdateInput must be called with a transaction client. Use updateAccountVoucherHeader when you want the helper to manage the transaction.',
//     );
//   }
//   const existing = await getActiveVoucherHeader(client, avhVoucherId);
//   const nextScope = resolveVoucherScope(existing, payload);
//   validateVoucherScope(nextScope);
//   const voucherNoScopeChanged = hasVoucherNoScopeChanged(existing, nextScope);
//   const voucherSlnoScopeChanged =
//     voucherNoScopeChanged || existing.avhVoucherTypeId !== nextScope.avhVoucherTypeId;
//   const data: Prisma.AccVoucherHeaderUncheckedUpdateInput = {
//     ...syncBillDateWithVoucherDate(payload),
//     avhUpdatedOn: new Date(),
//   };
//   if (voucherNoScopeChanged) {
//     await acquireScopedLock(
//       client,
//       ACCOUNT_VOUCHER_NO_LOCK_NAMESPACE,
//       buildVoucherNoScope(nextScope),
//     );
//   }
//   if (!voucherSlnoScopeChanged) {
//     return data;
//   }
//   await acquireScopedLock(
//     client,
//     ACCOUNT_VOUCHER_SLNO_LOCK_NAMESPACE,
//     buildVoucherSlnoScope(nextScope),
//   );
//   const voucherType = await getVoucherTypeCode(client, nextScope.avhVoucherTypeId);
//   const avhVoucherSlno = await getNextVoucherSlno(client, nextScope);
//   if (voucherNoScopeChanged) {
//     data.avhVoucherNo = await getNextVoucherNo(client, nextScope);
//   }
//   data.avhVoucherSlno = avhVoucherSlno;
//   data.avhVoucherRefno = buildVoucherRefno(voucherType.vchrTypeCode, avhVoucherSlno);
//   data.avhBillRefno = data.avhVoucherRefno;
//   return data;
// }
// function syncBillDateWithVoucherDate<
//   T extends { avhVoucherDate?: Date | string | null; avhBillDate?: Date | string | null },
// >(payload: T): T {
//   if (
//     !Object.prototype.hasOwnProperty.call(payload, 'avhVoucherDate') ||
//     payload.avhVoucherDate == null
//   ) {
//     return payload;
//   }
//   return {
//     ...payload,
//     avhBillDate: payload.avhVoucherDate,
//   };
// }
// function isPrismaService(client: AccountVoucherHeaderWriteClient): client is PrismaService {
//   return '$transaction' in client;
// }
// function validateVoucherScope(payload: VoucherNumberScope): void {
//   ensureRequiredString(payload.avhAccYear, 'avhAccYear');
//   ensureRequiredString(payload.avhCompanyId, 'avhCompanyId');
//   ensureRequiredString(payload.avhBranchId, 'avhBranchId');
//   if (!Number.isInteger(payload.avhVoucherTypeId) || payload.avhVoucherTypeId <= 0) {
//     throw new BadRequestException('avhVoucherTypeId must be a positive integer.');
//   }
// }
// function ensureRequiredString(value: string, fieldName: string): void {
//   if (!value?.trim()) {
//     throw new BadRequestException(`${fieldName} is required.`);
//   }
// }
// async function getActiveVoucherHeader(
//   client: Prisma.TransactionClient,
//   avhVoucherId: string,
// ): Promise<AccVoucherHeader> {
//   ensureRequiredString(avhVoucherId, 'avhVoucherId');
//   const voucherHeader = await client.accVoucherHeader.findFirst({
//     where: {
//       avhVoucherId,
//       avhIsDeleted: false,
//     },
//   });
//   if (!voucherHeader) {
//     throw new NotFoundException(`Voucher header ${avhVoucherId} was not found.`);
//   }
//   return voucherHeader;
// }
// async function acquireScopedLock(
//   client: Prisma.TransactionClient,
//   namespace: string,
//   scope: string,
// ): Promise<void> {
//   await client.$queryRaw<Array<{ locked: number }>>`
//     WITH advisory_lock AS (
//       SELECT pg_advisory_xact_lock(hashtext(${namespace}), hashtext(${scope}))
//     )
//     SELECT 1::int AS locked
//   `;
// }
// async function getVoucherTypeCode(
//   client: Prisma.TransactionClient,
//   avhVoucherTypeId: number,
// ): Promise<VoucherTypeCodeLookup> {
//   // Caller modules pass only the voucher type id; the helper is responsible for
//   // resolving the current type code from accounts.acc_voucher_types.
//   const voucherType = await client.accVoucherType.findFirst({
//     where: {
//       vchrTypeId: avhVoucherTypeId,
//     },
//     select: {
//       vchrTypeId: true,
//       vchrTypeCode: true,
//     },
//   });
//   if (!voucherType) {
//     throw new NotFoundException(`Voucher type ${avhVoucherTypeId} was not found.`);
//   }
//   if (!voucherType.vchrTypeCode.trim()) {
//     throw new BadRequestException(
//       `Voucher type ${avhVoucherTypeId} does not have a usable vchrTypeCode.`,
//     );
//   }
//   return voucherType;
// }
// async function getNextVoucherNo(
//   client: Prisma.TransactionClient,
//   payload: VoucherNumberScope,
// ): Promise<bigint> {
//   const latestVoucher = await client.accVoucherHeader.findFirst({
//     where: {
//       avhAccYear: payload.avhAccYear,
//       avhCompanyId: payload.avhCompanyId,
//       avhBranchId: payload.avhBranchId,
//     },
//     orderBy: {
//       avhVoucherNo: 'desc',
//     },
//     select: {
//       avhVoucherNo: true,
//     },
//   });
//   return (latestVoucher?.avhVoucherNo ?? BigInt(0)) + INITIAL_VOUCHER_SEQUENCE;
// }
// async function getNextVoucherSlno(
//   client: Prisma.TransactionClient,
//   payload: VoucherNumberScope,
// ): Promise<bigint> {
//   const latestVoucher = await client.accVoucherHeader.findFirst({
//     where: {
//       avhAccYear: payload.avhAccYear,
//       avhCompanyId: payload.avhCompanyId,
//       avhBranchId: payload.avhBranchId,
//       avhVoucherTypeId: payload.avhVoucherTypeId,
//     },
//     orderBy: {
//       avhVoucherSlno: 'desc',
//     },
//     select: {
//       avhVoucherSlno: true,
//     },
//   });
//   return (latestVoucher?.avhVoucherSlno ?? BigInt(0)) + INITIAL_VOUCHER_SEQUENCE;
// }
// function buildVoucherRefno(vchrTypeCode: string, avhVoucherSlno: bigint): string {
//   return `${vchrTypeCode.trim()}-${avhVoucherSlno.toString()}`;
// }
// function resolveVoucherScope(
//   existing: VoucherNumberScope,
//   payload: UpdateAccountVoucherHeaderPayload,
// ): VoucherNumberScope {
//   return {
//     avhAccYear: payload.avhAccYear ?? existing.avhAccYear,
//     avhCompanyId: payload.avhCompanyId ?? existing.avhCompanyId,
//     avhBranchId: payload.avhBranchId ?? existing.avhBranchId,
//     avhVoucherTypeId: payload.avhVoucherTypeId ?? existing.avhVoucherTypeId,
//   };
// }
// function hasVoucherNoScopeChanged(
//   existing: VoucherNumberScope,
//   nextScope: VoucherNumberScope,
// ): boolean {
//   return (
//     existing.avhAccYear !== nextScope.avhAccYear ||
//     existing.avhCompanyId !== nextScope.avhCompanyId ||
//     existing.avhBranchId !== nextScope.avhBranchId
//   );
// }
// function buildVoucherNoScope(payload: VoucherNumberScope): string {
//   return [payload.avhAccYear, payload.avhCompanyId, payload.avhBranchId].join('::');
// }
// function buildVoucherSlnoScope(payload: VoucherNumberScope): string {
//   return [...buildVoucherNoScope(payload).split('::'), String(payload.avhVoucherTypeId)].join('::');
// }