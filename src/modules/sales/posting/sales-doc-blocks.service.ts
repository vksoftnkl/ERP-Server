import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { StatutoryService } from './statutory.service';
import { loadDayClosed } from './sales.guards';
import { isoDateTime } from './sales-doc.utils';
import type { GstDocStatus, LocksBlock, PostingBlock } from './types/posting.types';

/**
 * §1.2 `posting` and §1.3 `locks` — assembled HERE for every document, so the
 * bill screen and the challan screen get one shape.
 *
 * Nothing in either block is stored. `irnLive` / `ewbLive` are read off
 * `gde_status` / `gdw_status` at the moment of the request; the two windows
 * come from the statutory pack on the document's date; `editable` is derived
 * from the status and the two GST rows. A column for any of these would be a
 * second source of truth that drifts.
 */
export interface DocPostingFacts {
  status: string;
  companyId: string;
  branchId: string;
  accYear: string;
  docDate: string;
  voucherId: string | null;
  registerId: string | null;
  cogsAmt: number;
  loyaltyEarned?: number;
  loyaltyRedeemed?: number;
  /** Bills only: returns and allocations against the balance row. */
  returns?: number;
  allocations?: number;
  /** Documents with NO amend verb at all (a DC return) say so. */
  amendable?: boolean;
}

interface GstRows {
  irn: PostingBlock['irn'];
  ewb: PostingBlock['ewb'];
  irnGeneratedOn: Date | null;
  ewbGeneratedOn: Date | null;
  ewbValidUpto: Date | null;
}

@Injectable()
export class SalesDocBlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statutory: StatutoryService,
  ) {}

  async build(
    facts: DocPostingFacts,
    client?: Prisma.TransactionClient,
  ): Promise<{ posting: PostingBlock; locks: LocksBlock }> {
    const c = client ?? this.prisma;
    const [gst, voucher, dayClosed] = await Promise.all([
      this.gstRows(c, facts.registerId, facts.accYear),
      this.voucher(c, facts.voucherId, facts.accYear),
      loadDayClosed(c, facts.companyId, facts.branchId, facts.docDate),
    ]);

    const irnLive = gst.irn.status === 'GENERATED';
    const ewbLive = gst.ewb.status === 'GENERATED';

    let irnCancelWindowUntil: string | null = null;
    if (irnLive && gst.irnGeneratedOn) {
      const w = await this.statutory.withinCancelWindow(
        facts.companyId,
        'IRN',
        gst.irnGeneratedOn,
        facts.docDate,
        new Date(),
        c,
      );
      irnCancelWindowUntil =
        w.limit?.value != null
          ? new Date(gst.irnGeneratedOn.getTime() + w.limit.value * 3_600_000).toISOString()
          : null;
    }

    const posted = facts.status === 'POSTED';
    const declared = irnLive || ewbLive;

    return {
      posting: {
        voucherId: facts.voucherId,
        voucherRefno: voucher?.refno ?? null,
        postedOn: isoDateTime(voucher?.postedOn ?? null),
        registerId: facts.registerId,
        cogsAmt: facts.cogsAmt,
        loyaltyEarned: facts.loyaltyEarned ?? 0,
        loyaltyRedeemed: facts.loyaltyRedeemed ?? 0,
        irn: gst.irn,
        ewb: gst.ewb,
      },
      locks: {
        returns: facts.returns ?? 0,
        allocations: facts.allocations ?? 0,
        dayClosed,
        irnLive,
        ewbLive,
        irnCancelWindowUntil,
        ewbValidUpto: isoDateTime(gst.ewbValidUpto),
        editable: {
          // Lock 1: the document's content freezes at POSTED. A DRAFT is open;
          // a CANCELLED document is not editable either way.
          document: facts.status === 'DRAFT' && facts.amendable !== false,
          // The band stays open after POSTED and closes at lock 2.
          transportBand: (facts.status === 'DRAFT' || posted) && !declared,
        },
      },
    };
  }

  /** Both GST rows for a register, or NA blocks when there is no register yet. */
  async gstRows(
    c: Prisma.TransactionClient,
    gdrId: string | null,
    accYear: string,
  ): Promise<GstRows> {
    const na: GstRows = {
      irn: { status: 'NA', number: null, ackNo: null, ackOn: null, message: null },
      ewb: {
        status: 'NA',
        number: null,
        generatedOn: null,
        validUpto: null,
        message: null,
        vehicleNo: null,
      },
      irnGeneratedOn: null,
      ewbGeneratedOn: null,
      ewbValidUpto: null,
    };
    if (!gdrId) {
      return na;
    }
    const [row] = await c.$queryRaw<
      {
        gde_status: string | null;
        gde_irn: string | null;
        gde_ack_no: string | null;
        gde_ack_on: Date | null;
        gde_last_message: string | null;
        gdw_status: string | null;
        gdw_no: string | null;
        gdw_vehicle_no: string | null;
        gdw_generated_on: Date | null;
        gdw_valid_upto: Date | null;
        gdw_extended_upto: Date | null;
        gdw_last_message: string | null;
      }[]
    >`
      SELECT e.gde_status, e.gde_irn, e.gde_ack_no, e.gde_ack_on, e.gde_last_message,
             w.gdw_status, w.gdw_no, w.gdw_generated_on, w.gdw_valid_upto, w.gdw_extended_upto,
             w.gdw_last_message, w.gdw_vehicle_no
        FROM (SELECT 1) x
        LEFT JOIN accounts.acc_voucher_doc_einvoice e
               ON e.gde_gdr_id = ${gdrId}::uuid AND e.gde_acc_year = ${accYear}::char(9)
              AND e.gde_is_deleted = false
        LEFT JOIN accounts.acc_voucher_doc_ewaybill w
               ON w.gdw_gdr_id = ${gdrId}::uuid AND w.gdw_acc_year = ${accYear}::char(9)
              AND w.gdw_is_deleted = false
       LIMIT 1`;
    if (!row) {
      return na;
    }
    const validUpto = row.gdw_extended_upto ?? row.gdw_valid_upto;
    return {
      irn: {
        status: gstStatus(row.gde_status),
        number: row.gde_irn,
        ackNo: row.gde_ack_no,
        ackOn: isoDateTime(row.gde_ack_on),
        message: row.gde_last_message,
      },
      ewb: {
        status: gstStatus(row.gdw_status),
        number: row.gdw_no,
        generatedOn: isoDateTime(row.gdw_generated_on),
        validUpto: isoDateTime(validUpto),
        message: row.gdw_last_message,
        vehicleNo: row.gdw_vehicle_no,
      },
      irnGeneratedOn: row.gde_ack_on,
      ewbGeneratedOn: row.gdw_generated_on,
      ewbValidUpto: validUpto,
    };
  }

  private async voucher(
    c: Prisma.TransactionClient,
    voucherId: string | null,
    accYear: string,
  ): Promise<{ refno: string | null; postedOn: Date | null } | null> {
    if (!voucherId) {
      return null;
    }
    const [row] = await c.$queryRaw<
      { avh_voucher_refno: string | null; avh_posted_on: Date | null }[]
    >`
      SELECT avh_voucher_refno, avh_posted_on
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${accYear}::char(9)`;
    return row ? { refno: row.avh_voucher_refno, postedOn: row.avh_posted_on } : null;
  }
}

const GST_STATUSES: readonly GstDocStatus[] = [
  'NA',
  'PENDING',
  'GENERATED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REJECTED',
];

function gstStatus(v: string | null): GstDocStatus {
  const u = (v ?? 'NA').toUpperCase();
  return (GST_STATUSES as readonly string[]).includes(u) ? (u as GstDocStatus) : 'NA';
}
