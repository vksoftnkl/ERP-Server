import { Injectable } from '@nestjs/common';
import { Prisma, SaleBill } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  appendTxnStatusLog,
  TxnStatusEvent,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import {
  TenderDrCr,
  TenderSrcDocType,
  TenderSrcModule,
} from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { LoyaltyLedgerService } from '../posting/loyalty-ledger.service';
import { SalesContextService } from '../posting/sales-context.service';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import { loadDayClosed } from '../posting/sales.guards';
import { throwSalesLocked, throwSalesRefused, throwSalesRight } from '../posting/sales.errors';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import type { SalesLeg } from '../posting/types/sales-leg.types';
import {
  SALES_MENU_ID,
  SALES_VOUCHER_TYPE,
  TENDER_TYPE,
  isoDate,
  isoToday,
  num,
  round2,
} from '../posting/sales-doc.utils';
import { BillService } from './bill.service';
import { syncBillPdcRegister } from './bill-pdc-posting.helper';
import { syncCounterAllocations } from './bill-counter-allocation.helper';
import { BillBalanceRecomputeService } from '../../accountsModule/billBalance/bill-balance-recompute.service';
import { buildDraftCheques, readDraftCheques, toDraftChequesJson } from './bill-cheque-details';
import type { SaveTenderDetailDto } from '../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { assertBooksReconcile } from '../../accountsModule/reconcile/books-reconcile.guard';
import { encodeTempCreditTenders } from './bill-temp-credit';
import type { RetenderBillDto } from './dto/bill-lifecycle.dto';
import {
  BILL_STATUS_SRC_DOC_TYPE,
  BILL_STATUS_SRC_MODULE,
  BILL_TENDER_AUDIT,
  type BillPayload,
} from './types/bill-api.types';

/**
 * HANDOVER §2.13 — `/bills/retender`: change HOW it was paid, not what was
 * sold.
 *
 * Works on DRAFT and POSTED, and on a bill with a live IRN: the tender is not
 * on the e-invoice. The voided rows keep their place (`td_is_voided`, never a
 * delete — the failed UPI happened at the counter); the new rows carry
 * `td_replaces_id`. On a POSTED bill a CONTRA voucher (`TndC`, type 22) moves
 * the money between tender ledgers, DR what really happened / CR what did not,
 * so the party balance never moves and the bill stays settled throughout.
 */
interface TenderRow {
  td_id: string;
  td_tender_id: string;
  td_tender_type_id: number;
  td_tender_ledger_id: string | null;
  td_amount: Prisma.Decimal;
  td_is_pdc: boolean;
  td_settle_status: string | null;
  td_is_voided: boolean;
  tnd_name: string | null;
  // The cheque register row's status, when the tender is a registered cheque
  // (notes 46). Anything but HELD means the bank has it.
  apd_status: string | null;
}

@Injectable()
export class BillRetenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bills: BillService,
    private readonly salesContext: SalesContextService,
    private readonly tenders: TenderDetailService,
    private readonly legs: VoucherPostingService,
    private readonly loyalty: LoyaltyLedgerService,
    private readonly audit: AuditLogService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  async retender(dto: RetenderBillDto): Promise<BillPayload> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const bill = await this.bills.lockHeader(tx, dto);
      if (bill.sbStatus === 'CANCELLED') {
        throwSalesLocked('This bill is CANCELLED', SALES_ERROR_CODES.BILL_CANCELLED, 'sbId');
      }
      const ctx = await this.salesContext.resolve(
        { companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId },
        SALES_MENU_ID.SALE_BILL,
        tx,
      );
      // Its own flag, NOT um_can_amend.
      if (!ctx.rights.retender) {
        throwSalesRight(
          'This user may not re-tender on this menu (um_can_retender is false)',
          SALES_ERROR_CODES.RIGHT_RETENDER,
        );
      }
      const docDate = isoDate(bill.sbBillDate) ?? isoToday();
      if (await loadDayClosed(tx, bill.sbCompanyId, bill.sbBranchId, docDate)) {
        // The drawer has been counted with the wrong figure: a day-book
        // correction, not this.
        throwSalesLocked(
          `The books for ${docDate} are closed — correct the day book instead`,
          SALES_ERROR_CODES.DAY_CLOSED,
          'sbBillDate',
        );
      }

      const voidIds = [...new Set(dto.voids.map((v) => v.tdId))];
      if (voidIds.length === 0) {
        throwSalesRefused('Nothing to void', SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH, 'voids');
      }
      const rows = await tx.$queryRaw<TenderRow[]>`
        SELECT t.td_id, t.td_tender_id, t.td_tender_type_id, t.td_tender_ledger_id, t.td_amount, t.td_is_pdc,
               t.td_settle_status, t.td_is_voided, m.tnd_name,
               (SELECT p.apd_status FROM accounts.acc_pdc_register p
                 WHERE p.apd_tender_id = t.td_id AND p.apd_is_deleted = false
                   AND p.apd_status <> 'CANCELLED'
                 LIMIT 1) AS apd_status
          FROM accounts.acc_tender_detail t
          LEFT JOIN accounts.acc_tender_master m ON m.tnd_id = t.td_tender_id
         WHERE t.td_id = ANY(${voidIds}::uuid[]) AND t.td_acc_year = ${bill.sbAccYear}::char(9)
           AND t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL' AND t.td_src_doc_id = ${bill.sbId}::uuid
           AND t.td_is_deleted = false
         -- Lock the tender rows only: the master is on the nullable side of the
         -- join, and Postgres refuses FOR UPDATE there (0A000).
         FOR UPDATE OF t`;
      if (rows.length !== voidIds.length) {
        throwSalesRefused(
          'One or more tender rows are not on this bill',
          SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH,
          'voids',
        );
      }
      for (const r of rows) {
        if (r.td_is_voided) {
          throwSalesLocked(
            `Tender ${r.td_id} is already voided`,
            SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH,
            'voids',
          );
        }
        if (
          (r.apd_status !== null && r.apd_status !== 'HELD') ||
          (r.td_is_pdc && ['SETTLED', 'PARTIAL'].includes((r.td_settle_status ?? '').toUpperCase()))
        ) {
          throwSalesLocked(
            `Tender ${r.tnd_name ?? r.td_id} is a cheque that has already moved at the bank — that is a bounce (/cheques), not a re-tender`,
            SALES_ERROR_CODES.RETENDER_PDC_MOVED,
            'voids',
          );
        }
      }
      const voidedTotal = round2(rows.reduce((t, r) => t + num(r.td_amount), 0));
      const newTotal = round2(dto.tenders.reduce((t, x) => t + num(x.tdAmount), 0));
      if (Math.abs(voidedTotal - newTotal) > 0.01) {
        throwSalesRefused(
          `The new tenders total ${newTotal.toFixed(2)} against ${voidedTotal.toFixed(2)} voided — a different amount is a part payment or a refund, not a re-tender`,
          SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH,
          'tenders',
        );
      }

      const actor = ctx.actor;
      const reasonById = new Map(dto.voids.map((v) => [v.tdId, v.reason]));

      // 1 · void the rows that did not happen. They keep their place.
      for (const r of rows) {
        await tx.$executeRaw`
          UPDATE accounts.acc_tender_detail
             SET td_is_voided = true, td_void_reason = ${reasonById.get(r.td_id) ?? 'OTHER'},
                 td_voided_on = ${now}, td_voided_by = ${isUuid(actor) ? actor : null}::uuid,
                 td_modified_on = ${now}, td_modified_by = ${actor}
           WHERE td_id = ${r.td_id}::uuid AND td_acc_year = ${bill.sbAccYear}::char(9)`;
        // A voided LOYALTY tender gives the points back.
        if (r.td_tender_type_id === TENDER_TYPE.LOYALTY) {
          await this.loyalty.reverseRedeemForTender(
            tx,
            {
              docId: bill.sbId,
              accYear: bill.sbAccYear,
              docType: 'SALE_BILL',
              docRefno: bill.sbBillRefno,
              tenderId: r.td_id,
            },
            { reason: `Tender voided: ${reasonById.get(r.td_id) ?? 'OTHER'}`, createdBy: actor },
          );
        }
        // A voided TEMP_CR clears its acc_temp_credit row.
        if (r.td_tender_type_id === TENDER_TYPE.TEMP_CREDIT) {
          await tx.accTempCredit.updateMany({
            where: { atcTenderId: r.td_id, atcTenderAccYear: bill.sbAccYear, atcIsDeleted: false },
            data: {
              atcStatus: 'CANCELLED',
              atcBalanceAmount: 0,
              atcRemarks: dto.remark,
              atcModifiedOn: now,
              atcModifiedBy: actor,
            },
          });
        }
      }

      // 2 · the rows that really happened, each pointing at what it replaces.
      const replaces = rows[0].td_id;
      const scope = this.tenderScope(bill);
      const existing = await this.tenders.getByDocument(
        TenderSrcModule.SALES,
        TenderSrcDocType.SALE_BILL,
        bill.sbId,
        tx,
      );
      const keep = existing.map((t) => ({ tdId: t.tdId }) as never);
      const created = await this.tenders.syncDocumentTenders(
        tx,
        scope,
        [...keep, ...(encodeTempCreditTenders(dto.tenders) ?? [])],
        actor,
        BILL_TENDER_AUDIT,
      );
      const newRows = created.filter((t) => !existing.some((e) => e.tdId === t.tdId));
      // notes (48) — a new cheque row's drawer / branch / IFSC / MICR, by td_id.
      // Positions line up with the array the sync was given, so the rows kept
      // above (no `cheque`) are skipped and each new row finds its own.
      const chequeDetails =
        buildDraftCheques([...keep, ...dto.tenders] as SaveTenderDetailDto[], created, {}) ?? {};
      if (bill.sbStatus !== 'POSTED' && Object.keys(chequeDetails).length > 0) {
        // A DRAFT registers nothing yet: the details wait for /post with the rest.
        await tx.saleBill.update({
          where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
          data: {
            sbDraftCheques: toDraftChequesJson({
              ...readDraftCheques(bill.sbDraftCheques),
              ...chequeDetails,
            }),
          },
        });
      }
      for (const t of newRows) {
        await tx.$executeRaw`
          UPDATE accounts.acc_tender_detail SET td_replaces_id = ${replaces}::uuid
           WHERE td_id = ${t.tdId}::uuid AND td_acc_year = ${bill.sbAccYear}::char(9)`;
      }

      // 3 · on a POSTED bill, the CONTRA: DR the tender that happened, CR the one that did not.
      let contraVoucherId: string | null = null;
      if (bill.sbStatus === 'POSTED' && bill.sbCustId) {
        const legs: SalesLeg[] = [];
        for (const t of newRows) {
          const typeId = Number(t.tdTenderTypeId);
          if (typeId === TENDER_TYPE.CREDIT || typeId === TENDER_TYPE.TEMP_CREDIT) {
            // Now on credit: the party takes the debit back.
            legs.push({
              ledgerId: bill.sbCustId,
              drCr: 'DR',
              amount: num(t.tdAmount),
              remarks: `Re-tendered to ${t.tdTenderName ?? 'credit'}`,
            });
          } else if (typeId === TENDER_TYPE.LOYALTY) {
            legs.push({
              role: 'LOYALTY_REDEMPTION',
              roleTag: 'LOYALTY_REDEMPTION',
              drCr: 'DR',
              amount: num(t.tdAmount),
              field: 'tenders',
            });
          } else {
            legs.push({
              ledgerId: t.tdTenderLedgerId,
              drCr: 'DR',
              amount: num(t.tdAmount),
              remarks: t.tdTenderName ?? null,
            });
          }
        }
        for (const r of rows) {
          if (
            r.td_tender_type_id === TENDER_TYPE.CREDIT ||
            r.td_tender_type_id === TENDER_TYPE.TEMP_CREDIT
          ) {
            legs.push({
              ledgerId: bill.sbCustId,
              drCr: 'CR',
              amount: num(r.td_amount),
              remarks: `Was on ${r.tnd_name ?? 'credit'}`,
            });
          } else if (r.td_tender_type_id === TENDER_TYPE.LOYALTY) {
            legs.push({
              role: 'LOYALTY_REDEMPTION',
              roleTag: 'LOYALTY_REDEMPTION',
              drCr: 'CR',
              amount: num(r.td_amount),
              field: 'tenders',
            });
          } else {
            legs.push({
              ledgerId: r.td_tender_ledger_id,
              drCr: 'CR',
              amount: num(r.td_amount),
              remarks: r.tnd_name ?? null,
            });
          }
        }
        // Each re-tender is its OWN document. `ux_avh_src` and `ux_avh_doc_refno`
        // admit one live voucher per source and per party+refno, so a contra
        // keyed on the bill left room for exactly one re-tender: the second
        // answered 23505. The source is the tender row this event voided — a
        // row can be voided once, so no two contras share it, and it leads back
        // to the bill through td_src_doc_id — and the refno counts the bill's
        // re-tenders. The first form (src = the bill) is still counted.
        const [prior] = await tx.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*) AS n FROM accounts.acc_voucher_header h
           WHERE h.avh_company_id = ${bill.sbCompanyId}::uuid
             AND h.avh_acc_year = ${bill.sbAccYear}::char(9)
             AND h.avh_src_module = 'SALES' AND h.avh_src_doc_type = 'SALE_BILL_RETENDER'
             AND h.avh_is_deleted = false
             AND (h.avh_src_doc_id = ${bill.sbId}::uuid
                  OR h.avh_src_doc_id IN (
                    SELECT t.td_id FROM accounts.acc_tender_detail t
                     WHERE t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL'
                       AND t.td_src_doc_id = ${bill.sbId}::uuid
                       AND t.td_acc_year = ${bill.sbAccYear}::char(9)))`;
        const round = Number(prior?.n ?? 0) + 1;
        const contra = await this.legs.postLegs(tx, {
          header: {
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            tenantId: bill.sbTenantId,
            accYear: bill.sbAccYear,
            voucherTypeId: SALES_VOUCHER_TYPE.TENDER_CHANGE,
            voucherDate: isoToday(),
            srcModule: 'SALES',
            srcDocType: 'SALE_BILL_RETENDER',
            srcDocId: replaces,
            docRefno: bill.sbBillRefno ? `${bill.sbBillRefno}/RT${round}` : null,
            docDate: docDate,
            docAmount: newTotal,
            partyId: bill.sbCustId,
            userId: isUuid(bill.sbUserId) ? bill.sbUserId : actor,
            sessionId: bill.sbSessionId,
            deviceType: bill.sbDeviceType,
            remarks: dto.remark,
            createdBy: actor,
          },
          legs,
        });
        // The cheque register follows the tenders: a voided cheque's row is
        // cancelled, a new cheque is registered against THIS contra — the
        // voucher that debited Cheques In Hand for it — and the cheques the
        // re-tender left alone keep the bill's voucher.
        await syncBillPdcRegister(
          tx,
          bill,
          { voucherId: contra.voucherId, accYear: bill.sbAccYear },
          actor,
          now,
          { keepStoredVoucher: true, details: chequeDetails },
        );
        contraVoucherId = contra.voucherId;
        // The receivable follows: a credit tender now leaves a balance; a cash
        // one settles it. Through the counter rows (notes 49 item 2), not by
        // overwriting abl_alloc_amount — the old overwrite set it to the
        // tenders alone and so also wiped every receipt and set-off already
        // against the bill. The voided tenders' rows go, the new tenders'
        // rows come in naming this contra, and the recompute re-derives the
        // figure from every row.
        const [abl] = await tx.$queryRaw<{ abl_id: string; abl_acc_year: string }[]>`
          SELECT abl_id, abl_acc_year FROM accounts.acc_bill_balance
           WHERE abl_src_doc_id = ${bill.sbId}::uuid AND abl_acc_year = ${bill.sbAccYear}::char(9)
             AND abl_src_doc_type = 'SALE_BILL' AND abl_is_deleted = false
           LIMIT 1`;
        if (abl) {
          const newIds = new Set(newRows.map((t) => t.tdId));
          await syncCounterAllocations(tx, {
            bill,
            abl: { ablId: abl.abl_id, ablAccYear: abl.abl_acc_year },
            partyId: bill.sbCustId,
            voucherFor: (tdId) =>
              newIds.has(tdId)
                ? { voucherId: contra.voucherId, accYear: bill.sbAccYear }
                : bill.sbPostedVoucherId
                  ? { voucherId: bill.sbPostedVoucherId, accYear: bill.sbAccYear }
                  : null,
            actor,
            now,
          });
          await this.recompute.recomputeBills(tx, [
            { billId: abl.abl_id, accYear: abl.abl_acc_year },
          ]);
        }
      }

      // 4 · the header's tender caches, from the LIVE rows.
      const live = await tx.$queryRaw<
        { tendered: Prisma.Decimal | null; settled: Prisma.Decimal | null }[]
      >`
        SELECT SUM(td_amount) AS tendered,
               SUM(CASE WHEN td_tender_type_id IN (${TENDER_TYPE.CREDIT}, ${TENDER_TYPE.TEMP_CREDIT}) THEN 0 ELSE td_amount END) AS settled
          FROM accounts.acc_tender_detail
         WHERE td_src_module = 'SALES' AND td_src_doc_type = 'SALE_BILL' AND td_src_doc_id = ${bill.sbId}::uuid
           AND td_acc_year = ${bill.sbAccYear}::char(9) AND td_is_deleted = false AND td_is_voided = false`;
      const paid = round2(num(live[0]?.settled) + num(bill.sbAdvanceAmt) + num(bill.sbNoteAdjAmt));
      const balance = round2(num(bill.sbBillAmt) - paid);
      await tx.saleBill.update({
        where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
        data: {
          sbTenderAmt: new Prisma.Decimal(num(live[0]?.tendered).toFixed(2)),
          sbPaidAmt: new Prisma.Decimal(paid.toFixed(2)),
          sbBalanceAmt: new Prisma.Decimal(balance.toFixed(2)),
          sbPayStatus: balance <= 0.005 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
          sbModifiedOn: now,
          sbModifiedBy: ctx.actorName,
        },
      });
      await appendTxnStatusLog(tx, {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        accYear: bill.sbAccYear,
        srcModule: BILL_STATUS_SRC_MODULE,
        srcDocType: BILL_STATUS_SRC_DOC_TYPE,
        srcDocId: bill.sbId,
        srcDocRefno: bill.sbBillRefno,
        event: 'RETENDERED' as TxnStatusEvent,
        fromStatus: bill.sbStatus,
        toStatus: bill.sbStatus,
        changedOn: now,
        changedBy: actor,
        remarks: dto.remark,
        deviceId: bill.sbDeviceId,
        sessionId: bill.sbSessionId,
      });
      await this.audit.logEntityChange(
        {
          action: 'update',
          tableName: 'acc_tender_detail',
          screenName: 'Sale Bill',
          screenType: 'transaction',
          pk: bill.sbId,
          displayName: bill.sbBillRefno || bill.sbId,
          originalRecord: {
            voided: rows.map((r) => ({
              tdId: r.td_id,
              amount: num(r.td_amount),
              tender: r.tnd_name,
            })),
          },
          modifiedRecord: {
            tenders: newRows.map((t) => ({
              tdId: t.tdId,
              amount: num(t.tdAmount),
              tender: t.tdTenderName,
            })),
          },
          userId: actor,
          notes: `Re-tendered: ${dto.remark}`,
        },
        tx,
      );
      // The trial check (notes 47), after every write.
      await assertBooksReconcile(tx, {
        companyId: bill.sbCompanyId,
        accYear: bill.sbAccYear,
        ledgerIds: [bill.sbCustId],
        vouchers: contraVoucherId ? [{ voucherId: contraVoucherId, accYear: bill.sbAccYear }] : [],
      });
    });
    return this.bills.getById(dto.sbId, dto.sbCompanyId, dto.sbBranchId, dto.sbAccYear);
  }

  private tenderScope(bill: SaleBill) {
    return {
      tdSrcModule: TenderSrcModule.SALES,
      tdSrcDocType: TenderSrcDocType.SALE_BILL,
      tdSrcDocId: bill.sbId,
      tdCompanyId: bill.sbCompanyId,
      tdBranchId: bill.sbBranchId,
      tdTenantId: bill.sbTenantId,
      tdAccYear: bill.sbAccYear,
      tdDocDate: bill.sbBillDate,
      tdPartyLedgerId: bill.sbCustId,
      tdUserId: bill.sbUserId,
      tdSessionId: bill.sbSessionId,
      tdDeviceId: bill.sbDeviceId,
      tdDrCr: TenderDrCr.DR,
    };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}
