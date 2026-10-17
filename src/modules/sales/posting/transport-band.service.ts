import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { assertBandWritable } from './sales.guards';

/**
 * §2.12 — the transport band, `public.txn_transport_detail`, one row per
 * document (`ux_ttd_doc`).
 *
 * It is written by `/create` (from the flat `sbShip*` / `sbDispatch*` /
 * `sbTransport*` fields) and by the document's own `PUT /transport` verb, and
 * it is refused the moment an IRN or an e-way bill is GENERATED — after that
 * a vehicle change is a portal operation recorded on `gdw_`, not here.
 */
export type TransportDocType =
  | 'SALE_BILL'
  | 'DELIVERY_CHALLAN'
  | 'SALE_RETURN'
  | 'DC_RETURN'
  | 'STOCK_TRANSFER';

export interface TransportEnd {
  godownId?: string | null;
  branchId?: string | null;
  addrId?: string | null;
  name?: string | null;
  addr?: string | null;
  place?: string | null;
  pin?: string | null;
  phone?: string | null;
  stcd?: string | null;
  gstin?: string | null;
}

export interface TransportBandInput {
  direction: 'OUTWARD' | 'INWARD';
  from?: TransportEnd | null;
  to?: TransportEnd | null;
  mode?: string | null;
  transporterId?: string | null;
  transporterName?: string | null;
  transporterGstin?: string | null;
  lrNo?: string | null;
  lrDate?: string | null;
  distanceKm?: number | null;
  remarks?: string | null;
}

export interface TransportBandRow extends TransportBandInput {
  ttdId: string;
  from: TransportEnd;
  to: TransportEnd;
}

export interface TransportDocRef {
  docType: TransportDocType;
  docId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  docRefno?: string | null;
}

@Injectable()
export class TransportBandService {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    ref: Pick<TransportDocRef, 'docType' | 'docId' | 'accYear'>,
    client?: Prisma.TransactionClient,
  ): Promise<TransportBandRow | null> {
    const c = client ?? this.prisma;
    const row = await c.txnTransportDetail.findFirst({
      where: {
        ttdDocType: ref.docType,
        ttdDocId: ref.docId,
        ttdAccYear: ref.accYear,
        ttdIsDeleted: false,
      },
    });
    return row ? toRow(row) : null;
  }

  /**
   * Upsert the band. `gdrId` is the document's register row, so lock 2 can be
   * checked — pass null for a DRAFT, which has none and is always writable.
   */
  async write(
    tx: Prisma.TransactionClient,
    ref: TransportDocRef,
    input: TransportBandInput,
    actor: string,
    opts: { gdrId: string | null; now?: Date },
  ): Promise<TransportBandRow> {
    await assertBandWritable(tx, opts.gdrId);
    const now = opts.now ?? new Date();
    const existing = await tx.txnTransportDetail.findFirst({
      where: {
        ttdDocType: ref.docType,
        ttdDocId: ref.docId,
        ttdAccYear: ref.accYear,
        ttdIsDeleted: false,
      },
      select: { ttdId: true },
    });
    const from = input.from ?? {};
    const to = input.to ?? {};
    const data = {
      ttdDirection: input.direction,
      ttdDocRefno: ref.docRefno ?? null,
      ttdFromGodownId: from.godownId ?? null,
      ttdFromBranchId: from.branchId ?? null,
      ttdFromAddrId: from.addrId ?? null,
      ttdFromName: from.name ?? null,
      ttdFromAddr: from.addr ?? null,
      ttdFromPlace: from.place ?? null,
      ttdFromPin: from.pin ?? null,
      ttdFromPhone: from.phone ?? null,
      ttdFromStcd: from.stcd ?? null,
      ttdFromGstin: from.gstin ?? null,
      ttdToGodownId: to.godownId ?? null,
      ttdToBranchId: to.branchId ?? null,
      ttdToAddrId: to.addrId ?? null,
      ttdToName: to.name ?? null,
      ttdToAddr: to.addr ?? null,
      ttdToPlace: to.place ?? null,
      ttdToPin: to.pin ?? null,
      ttdToPhone: to.phone ?? null,
      ttdToStcd: to.stcd ?? null,
      ttdToGstin: to.gstin ?? null,
      ttdTransportMode: input.mode ?? null,
      ttdTransporterId: input.transporterId ?? null,
      ttdTransporterName: input.transporterName ?? null,
      ttdTransporterGstin: input.transporterGstin ?? null,
      ttdLrNo: input.lrNo ?? null,
      ttdLrDate: input.lrDate ? new Date(`${input.lrDate}T00:00:00Z`) : null,
      ttdDistanceKm: input.distanceKm ?? null,
      ttdRemarks: input.remarks ?? null,
    };
    const row = existing
      ? await tx.txnTransportDetail.update({
          where: { ttdId_ttdAccYear: { ttdId: existing.ttdId, ttdAccYear: ref.accYear } },
          data: { ...data, ttdModifiedOn: now, ttdModifiedBy: actor },
        })
      : await tx.txnTransportDetail.create({
          data: {
            ...data,
            ttdCompanyId: ref.companyId,
            ttdBranchId: ref.branchId,
            ttdTenantId: ref.tenantId ?? null,
            ttdAccYear: ref.accYear,
            ttdDocType: ref.docType,
            ttdDocId: ref.docId,
            ttdCreatedOn: now,
            ttdCreatedBy: actor,
          },
        });
    return toRow(row);
  }

  /** Soft-delete the band when a DRAFT is deleted. Never on a POSTED document. */
  async remove(
    tx: Prisma.TransactionClient,
    ref: Pick<TransportDocRef, 'docType' | 'docId' | 'accYear'>,
    actor: string,
  ): Promise<void> {
    await tx.txnTransportDetail.updateMany({
      where: {
        ttdDocType: ref.docType,
        ttdDocId: ref.docId,
        ttdAccYear: ref.accYear,
        ttdIsDeleted: false,
      },
      data: { ttdIsDeleted: true, ttdModifiedOn: new Date(), ttdModifiedBy: actor },
    });
  }

  /** Does the band say ANYTHING? A body with every field blank writes no row. */
  static hasContent(input: TransportBandInput | null | undefined): boolean {
    if (!input) {
      return false;
    }
    const ends = [input.from ?? {}, input.to ?? {}];
    const endHas = ends.some((e) =>
      Object.values(e).some((v) => v !== null && v !== undefined && v !== ''),
    );
    return (
      endHas ||
      !!input.mode ||
      !!input.transporterId ||
      !!input.transporterName ||
      !!input.transporterGstin ||
      !!input.lrNo ||
      !!input.lrDate ||
      (input.distanceKm ?? null) !== null
    );
  }
}

function toRow(r: {
  ttdId: string;
  ttdDirection: string;
  ttdFromGodownId: string | null;
  ttdFromBranchId: string | null;
  ttdFromAddrId: string | null;
  ttdFromName: string | null;
  ttdFromAddr: string | null;
  ttdFromPlace: string | null;
  ttdFromPin: string | null;
  ttdFromPhone: string | null;
  ttdFromStcd: string | null;
  ttdFromGstin: string | null;
  ttdToGodownId: string | null;
  ttdToBranchId: string | null;
  ttdToAddrId: string | null;
  ttdToName: string | null;
  ttdToAddr: string | null;
  ttdToPlace: string | null;
  ttdToPin: string | null;
  ttdToPhone: string | null;
  ttdToStcd: string | null;
  ttdToGstin: string | null;
  ttdTransportMode: string | null;
  ttdTransporterId: string | null;
  ttdTransporterName: string | null;
  ttdTransporterGstin: string | null;
  ttdLrNo: string | null;
  ttdLrDate: Date | null;
  ttdDistanceKm: number | null;
  ttdRemarks: string | null;
}): TransportBandRow {
  return {
    ttdId: r.ttdId,
    direction: r.ttdDirection === 'INWARD' ? 'INWARD' : 'OUTWARD',
    from: {
      godownId: r.ttdFromGodownId,
      branchId: r.ttdFromBranchId,
      addrId: r.ttdFromAddrId,
      name: r.ttdFromName,
      addr: r.ttdFromAddr,
      place: r.ttdFromPlace,
      pin: r.ttdFromPin,
      phone: r.ttdFromPhone,
      stcd: r.ttdFromStcd,
      gstin: r.ttdFromGstin,
    },
    to: {
      godownId: r.ttdToGodownId,
      branchId: r.ttdToBranchId,
      addrId: r.ttdToAddrId,
      name: r.ttdToName,
      addr: r.ttdToAddr,
      place: r.ttdToPlace,
      pin: r.ttdToPin,
      phone: r.ttdToPhone,
      stcd: r.ttdToStcd,
      gstin: r.ttdToGstin,
    },
    mode: r.ttdTransportMode,
    transporterId: r.ttdTransporterId,
    transporterName: r.ttdTransporterName,
    transporterGstin: r.ttdTransporterGstin,
    lrNo: r.ttdLrNo,
    lrDate: r.ttdLrDate ? r.ttdLrDate.toISOString().slice(0, 10) : null,
    distanceKm: r.ttdDistanceKm,
    remarks: r.ttdRemarks,
  };
}
