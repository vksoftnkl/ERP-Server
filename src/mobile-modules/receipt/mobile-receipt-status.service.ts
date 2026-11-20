import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  PdcStatus,
  PdcTraType,
  VoucherStatus,
} from '../../modules/accountsModule/receipt/types/receipt-enum';
import { assertMobileCompany, resolveMobileDevice } from '../common/mobile-scope';
import {
  MOBILE_RECEIPT_STATUS_DEFAULT_PAGE_SIZE,
  MobileReceiptStatusQueryDto,
} from './dto/mobile-receipt.dto';
import type {
  MobileReceiptCheque,
  MobileReceiptStatus,
  MobileReceiptStatusPayload,
} from './types/mobile-receipt-api.types';

/**
 * How far behind the read `asOf` is set. A posting transaction stamps its
 * times when it starts and may run up to two minutes (POST_TRANSACTION_OPTIONS),
 * so a change can become visible after a read that began later than its stamp.
 * Reading again from five minutes back (and `since` inclusive) never misses
 * one; the phone sees a few rows twice and keeps the newer.
 */
export const MOBILE_RECEIPT_STATUS_OVERLAP_MINUTES = 5;

/** The register's cheque status, in the phone's four words. */
export function phoneChequeStatus(houseStatus: string): string {
  switch (houseStatus as PdcStatus) {
    case PdcStatus.HELD:
    case PdcStatus.DEPOSITED:
      return PdcStatus.HELD;
    case PdcStatus.CLEARED:
      return PdcStatus.CLEARED;
    case PdcStatus.BOUNCED:
      return PdcStatus.BOUNCED;
    default:
      // RETURNED (the paper went back to the party), CANCELLED, REPLACED.
      return PdcStatus.CANCELLED;
  }
}

interface StatusRow {
  avhClientUuid: string;
  avhVoucherId: string;
  avhAccYear: string;
  avhVoucherRefno: string | null;
  avhVoucherStatus: string;
  statusOn: Date | null;
  cancelReason: string | null;
  updatedOn: Date;
  total: number;
  pdc: {
    voucherId: string | null;
    voucherRefno: string | null;
    instrumentNo: string;
    chequeDate: string;
    amount: string;
    houseStatus: string;
    isPostDated: boolean;
  }[];
}

/**
 * GET /mobile/receipts/status: what became of this phone's receipts in VK Nex
 * (cancelled in the office, a cheque cleared or bounced). This phone's
 * receipts are the ones uploaded through POST /mobile/receipts/create from it:
 * a client uuid, and avh_device_id = its dev_id. A receipt's cheques are found
 * as the receipt itself finds them (receipt-cheque-links.ts): by the voucher
 * carrying them (the receipt or its own post-dated cheque vouchers) or by the
 * tender row they came in on. Read-only.
 */
@Injectable()
export class MobileReceiptStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async status(query: MobileReceiptStatusQueryDto): Promise<MobileReceiptStatusPayload> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? MOBILE_RECEIPT_STATUS_DEFAULT_PAGE_SIZE;
    await assertMobileCompany(this.prisma, query.companyId);
    const device = await resolveMobileDevice(this.prisma, query.deviceUid);
    const [clock] = await this.prisma.$queryRaw<{ asOf: Date }[]>`
      SELECT clock_timestamp() - make_interval(mins => ${MOBILE_RECEIPT_STATUS_OVERLAP_MINUTES}::int) AS "asOf"`;
    const rows = await this.rowsOf(query, device.devId, pageSize, (page - 1) * pageSize);
    // A page past the end has no row to read the count from: ask for the first one.
    const total =
      rows[0]?.total ??
      (page > 1 ? ((await this.rowsOf(query, device.devId, 1, 0))[0]?.total ?? 0) : 0);
    return {
      items: rows.map(
        (row): MobileReceiptStatus => ({
          avhClientUuid: row.avhClientUuid,
          avhVoucherId: row.avhVoucherId,
          avhAccYear: row.avhAccYear,
          avhVoucherRefno: row.avhVoucherRefno,
          avhVoucherStatus: row.avhVoucherStatus,
          cancelledOn:
            row.avhVoucherStatus === (VoucherStatus.CANCELLED as string) && row.statusOn
              ? row.statusOn.toISOString()
              : null,
          cancelReason:
            row.avhVoucherStatus === (VoucherStatus.CANCELLED as string) ? row.cancelReason : null,
          pdc: row.pdc.map(
            (cheque): MobileReceiptCheque => ({
              voucherId: cheque.voucherId,
              voucherRefno: cheque.voucherRefno,
              instrumentNo: cheque.instrumentNo,
              chequeDate: cheque.chequeDate,
              amount: cheque.amount,
              status: phoneChequeStatus(cheque.houseStatus),
              houseStatus: cheque.houseStatus,
              isPostDated: cheque.isPostDated,
            }),
          ),
          updatedOn: row.updatedOn.toISOString(),
        }),
      ),
      total,
      page,
      pageSize,
      hasMore: (page - 1) * pageSize + rows.length < total,
      companyId: query.companyId,
      asOf: clock.asOf.toISOString(),
    };
  }

  /**
   * One page of this phone's receipts changed since `since`, oldest change
   * first, each with its cheques and the count of all of them.
   */
  private rowsOf(
    query: MobileReceiptStatusQueryDto,
    devId: string,
    limit: number,
    offset: number,
  ): Promise<StatusRow[]> {
    const since = query.since
      ? Prisma.sql`WHERE x.updated_on >= ${query.since}::timestamptz`
      : Prisma.empty;
    return this.prisma.$queryRaw<StatusRow[]>`
      WITH mine AS (
        SELECT h.avh_voucher_id, h.avh_acc_year, h.avh_voucher_type_id, h.avh_voucher_date,
               h.avh_client_uuid, h.avh_voucher_refno, h.avh_voucher_status, h.avh_status_on,
               h.avh_cancel_reason, h.avh_created_on, h.avh_modified_on
          FROM accounts.acc_voucher_header h
         WHERE h.avh_company_id = ${query.companyId}::uuid
           AND h.avh_client_uuid IS NOT NULL
           AND h.avh_device_id = ${devId}
      ),
      cheques AS (
        SELECT m.avh_voucher_id AS receipt_id, p.apd_id, p.apd_voucher_id,
               p.apd_instrument_no, p.apd_instrument_date, p.apd_amount, p.apd_status,
               (p.apd_instrument_date > m.avh_voucher_date) AS is_post_dated,
               GREATEST(p.apd_created_on, p.apd_modified_on, p.apd_status_on) AS changed_on,
               v.avh_voucher_refno AS voucher_refno
          FROM mine m
          JOIN accounts.acc_pdc_register p
            ON p.apd_is_deleted = false
           AND p.apd_tra_type = ${PdcTraType.RECEIVED}
           AND (p.apd_voucher_id = m.avh_voucher_id
                OR p.apd_voucher_id IN (
                     SELECT c.avh_voucher_id
                       FROM accounts.acc_voucher_header c
                      WHERE c.avh_against_voucher_id = m.avh_voucher_id
                        AND c.avh_voucher_type_id = m.avh_voucher_type_id
                        AND c.avh_is_deleted = false)
                OR p.apd_tender_id IN (
                     SELECT t.td_id
                       FROM accounts.acc_tender_detail t
                      WHERE t.td_src_doc_id = m.avh_voucher_id))
          LEFT JOIN accounts.acc_voucher_header v
            ON v.avh_voucher_id = p.apd_voucher_id AND v.avh_acc_year = p.apd_voucher_acc_year
      ),
      x AS (
        SELECT m.*,
               GREATEST(m.avh_created_on, m.avh_modified_on, m.avh_status_on,
                        (SELECT max(c.changed_on) FROM cheques c
                          WHERE c.receipt_id = m.avh_voucher_id)) AS updated_on
          FROM mine m
      )
      SELECT x.avh_client_uuid::text AS "avhClientUuid",
             x.avh_voucher_id::text AS "avhVoucherId",
             btrim(x.avh_acc_year::text) AS "avhAccYear",
             x.avh_voucher_refno AS "avhVoucherRefno",
             x.avh_voucher_status AS "avhVoucherStatus",
             x.avh_status_on AS "statusOn",
             x.avh_cancel_reason AS "cancelReason",
             x.updated_on AS "updatedOn",
             count(*) OVER ()::int AS total,
             COALESCE((
               SELECT json_agg(json_build_object(
                        'voucherId', c.apd_voucher_id::text,
                        'voucherRefno', c.voucher_refno,
                        'instrumentNo', c.apd_instrument_no,
                        'chequeDate', c.apd_instrument_date::text,
                        'amount', to_char(c.apd_amount, 'FM9999999999990.00'),
                        'houseStatus', c.apd_status,
                        'isPostDated', c.is_post_dated)
                      ORDER BY c.apd_instrument_date, c.apd_id)
                 FROM cheques c
                WHERE c.receipt_id = x.avh_voucher_id), '[]'::json) AS pdc
        FROM x
        ${since}
       ORDER BY x.updated_on, x.avh_voucher_id
       LIMIT ${limit}::int OFFSET ${offset}::int`;
  }
}
