import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WA_HOUSE_CODES, waRefuse } from './wa-errors';
import { WaSendService, type PreparedSend, type WaSendOutcome } from './wa-send.service';
import { WaStore } from './wa-store.service';
import { WA_CODES, WA_MENU, WA_MENU_OF_DOC, WA_POPUP_PHONE_MARK, type WaDocType } from './wa.constants';

type Raw = Pick<Prisma.TransactionClient, '$queryRaw'>;

/** The kinds this build sends again (scope cut 17/11): the test and the Sales Order confirmation. */
const RESENT_KINDS = ['TEST', 'ORDER'];
/** A retry's one transaction: the root lock is held while steps 1–6 read and write the new try. */
const RETRY_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

interface LogRow {
  wml_id: string;
  wml_acc_year: string;
  wml_company_id: string;
  wml_branch_id: string | null;
  wml_kind: string;
  wml_trigger: string;
  wml_batch_id: string | null;
  wml_src_doc_type: string | null;
  wml_src_doc_id: string | null;
  wml_src_acc_year: string | null;
  wml_src_doc_refno: string | null;
  wml_vchr_type_id: number | null;
  wml_party_id: string | null;
  wml_party_name: string | null;
  wml_as_on: Date | null;
  wml_phone: string | null;
  wml_phone_source: string | null;
  wml_template_name: string | null;
  wml_lang_wanted: string | null;
  wml_lang_sent: string | null;
  wml_lang_note: string | null;
  wml_params: unknown;
  wml_pdf_version_id: string | null;
  wml_pdf_bytes: number | null;
  wml_pdf_filename: string | null;
  wml_status: string;
  wml_sending_on: Date | null;
  wml_sent_on: Date | null;
  wml_delivered_on: Date | null;
  wml_read_on: Date | null;
  wml_failed_on: Date | null;
  wml_error_code: string | null;
  wml_meta_error_code: number | null;
  wml_error_text: string | null;
  wml_meta_message_id: string | null;
  wml_try_no: number;
  wml_retry_of: string | null;
  wml_reply: string | null;
  wml_reply_on: Date | null;
  wml_gap_override: boolean;
  wml_override_reason: string | null;
  wml_cost_rate: Prisma.Decimal | null;
  wml_cost_gst_pct: Prisma.Decimal | null;
  wml_user_name: string | null;
  wml_purged_on: Date | null;
  wml_created_on: Date;
  doc_status: string | null;
}

/**
 * Plan §5.3 "Documents" (scope cut 17/11): a hand send of a Sales Order
 * (Print on menu 11) and a retry from the log (309 Post). The log itself is
 * read through the registered grid 222 (/configured-grid-sql/run).
 */
@Injectable()
export class WaMessagesService {
  constructor(
    private readonly store: WaStore,
    private readonly sends: WaSendService,
  ) {}

  /** POST /messages/send — synchronous: the answer is the row as it ended. */
  async send(dto: {
    companyId: string;
    branchId: string;
    docType: WaDocType;
    docId: string;
    docAccYear: string;
    phone?: string | null;
    lang?: string | null;
  }): Promise<WaSendOutcome> {
    await this.store.right(WA_MENU_OF_DOC[dto.docType], 'print', 'send this document (Print right)');
    this.store.assertMainServer();
    const actor = await this.store.actor();
    const prepared = await this.sends.prepareDocument({
      companyId: dto.companyId,
      docType: dto.docType,
      docId: dto.docId,
      docAccYear: dto.docAccYear,
      trigger: 'MANUAL',
      bodyPhone: dto.phone?.trim() || null,
      lang: dto.lang ?? null,
      actor,
    });
    if ('notConnected' in prepared) {
      waRefuse(WA_CODES.NOT_CONNECTED, 'WhatsApp is not connected', 'companyId');
    }
    return this.sends.deliverForAnswer(prepared);
  }

  /**
   * POST /messages/retry — a new try (wml_retry_of = the row retried, try no + 1)
   * that sends the document AS IT NOW STANDS (Q19).
   *
   * Review S4 — judged on the LATEST try of the chain, in ONE transaction that
   * holds the chain's first row FOR UPDATE until the new try is written: a
   * double click, or a retry of an old FAILED try after a later one went,
   * waits for the other and then sees its try. Latest SENDING → 409
   * WA_RETRY_NOT_ALLOWED; latest DELIVERED / READ → 409 WA_ALREADY_DELIVERED
   * unless confirmResend. The PDF and the relay run after the commit.
   *
   * Review S5 — a number typed in the send popup goes again as the popup number
   * (before the master numbers); a number typed on the order is read from the
   * order as it now stands.
   */
  async retry(dto: { companyId: string; wmlId: string; accYear: string; confirmResend?: boolean }): Promise<WaSendOutcome> {
    await this.store.right(WA_MENU.LOG, 'post', 'resend WhatsApp messages');
    this.store.assertMainServer();
    const actor = await this.store.actor();
    const prepared = await this.store.prisma.$transaction(async (tx): Promise<PreparedSend> => {
      const row = await this.loadRow(dto.companyId, dto.wmlId, dto.accYear, tx);
      if (!RESENT_KINDS.includes(row.wml_kind)) {
        // Review N9 — scope cut 17/11: this build resends test messages and Sales Order confirmations only.
        waRefuse(
          WA_HOUSE_CODES.KIND_NOT_SENT,
          `A ${row.wml_kind} message cannot be resent by this server version (only ${RESENT_KINDS.join(', ')})`,
          'wmlId',
          { kind: row.wml_kind },
        );
      }
      await this.lockRoot(tx, row);
      const chain = await this.chain(tx, row);
      const latest = chain.reduce<LogRow>(
        (a, r) => (r.wml_try_no > a.wml_try_no || (r.wml_try_no === a.wml_try_no && r.wml_created_on > a.wml_created_on) ? r : a),
        row,
      );
      const which = latest.wml_id === row.wml_id ? 'This message' : `Its latest try (${latest.wml_try_no})`;
      if (latest.wml_status === 'SENDING') {
        waRefuse(WA_CODES.RETRY_NOT_ALLOWED, `${which} is still being sent`, 'wmlId', {
          status: latest.wml_status,
          latestWmlId: latest.wml_id,
          latestAccYear: latest.wml_acc_year,
        });
      }
      if ((latest.wml_status === 'DELIVERED' || latest.wml_status === 'READ') && dto.confirmResend !== true) {
        waRefuse(
          WA_CODES.ALREADY_DELIVERED,
          `${which} is already ${latest.wml_status}: send confirmResend: true to send it again`,
          'confirmResend',
          { status: latest.wml_status, latestWmlId: latest.wml_id, latestAccYear: latest.wml_acc_year },
        );
      }
      const tryNo = latest.wml_try_no + 1;
      if (row.wml_kind === 'TEST') {
        return this.sends.prepareTest(
          { companyId: dto.companyId, phone: row.wml_phone ?? '', tryNo, retryOf: row.wml_id, actor },
          tx,
        );
      }
      const next = await this.sends.prepareDocument(
        {
          companyId: dto.companyId,
          docType: row.wml_src_doc_type as WaDocType,
          docId: row.wml_src_doc_id as string,
          docAccYear: (row.wml_src_acc_year as string).trim(),
          trigger: 'RETRY',
          tryNo,
          retryOf: row.wml_id,
          bodyPhone: typedInPopup(row) ? row.wml_phone : null,
          lang: row.wml_lang_wanted,
          actor,
        },
        tx,
      );
      if ('notConnected' in next) {
        waRefuse(WA_CODES.NOT_CONNECTED, 'WhatsApp is not connected', 'companyId');
      }
      return next;
    }, RETRY_TX_OPTIONS);
    return this.sends.deliverForAnswer(prepared);
  }

  async loadRow(companyId: string, wmlId: string, accYear: string, client: Raw = this.store.prisma): Promise<LogRow> {
    const [row] = await client.$queryRaw<LogRow[]>`
      SELECT l.*, COALESCE(sb.sb_status, so.so_status, vh.avh_voucher_status) AS doc_status
        FROM public.wa_message_log l
        LEFT JOIN sales.sale_bill sb ON l.wml_src_doc_type = 'SALE_BILL' AND sb.sb_id = l.wml_src_doc_id
                                    AND sb.sb_acc_year = l.wml_src_acc_year
        LEFT JOIN sales.sale_order so ON l.wml_src_doc_type = 'SALES_ORDER' AND so.so_id = l.wml_src_doc_id
                                     AND so.so_acc_year = l.wml_src_acc_year
        LEFT JOIN accounts.acc_voucher_header vh ON l.wml_src_doc_type = 'RECEIPT' AND vh.avh_voucher_id = l.wml_src_doc_id
                                                AND vh.avh_acc_year = l.wml_src_acc_year
       WHERE l.wml_id = ${wmlId}::uuid AND l.wml_acc_year = ${accYear}::bpchar
         AND l.wml_company_id = ${companyId}::uuid AND l.wml_is_deleted = false`;
    if (!row) {
      waRefuse(WA_CODES.DOC_NOT_FOUND, `No WhatsApp message ${wmlId} in ${accYear} for this company`, 'wmlId');
    }
    return row;
  }

  /**
   * Review S4 — lock the chain's first try (up the retry_of links) FOR UPDATE:
   * every retry of one message queues on that one row.
   */
  private async lockRoot(tx: Raw, row: LogRow): Promise<void> {
    await tx.$queryRaw`
      WITH RECURSIVE up AS (
             SELECT wml_id, wml_retry_of, 0 AS depth FROM public.wa_message_log
              WHERE wml_id = ${row.wml_id}::uuid AND wml_company_id = ${row.wml_company_id}::uuid
             UNION
             SELECT l.wml_id, l.wml_retry_of, up.depth + 1 FROM public.wa_message_log l
               JOIN up ON l.wml_id = up.wml_retry_of
              WHERE l.wml_company_id = ${row.wml_company_id}::uuid AND up.depth < 50)
      SELECT l.wml_id FROM public.wa_message_log l
       WHERE l.wml_id = (SELECT wml_id FROM up ORDER BY depth DESC LIMIT 1)
         AND l.wml_company_id = ${row.wml_company_id}::uuid
         FOR UPDATE OF l`;
  }

  /** Every try of one message: up the retry_of links to the first, then down. */
  private async chain(client: Raw, row: LogRow): Promise<LogRow[]> {
    return client.$queryRaw<LogRow[]>`
      WITH RECURSIVE up AS (
             SELECT wml_id, wml_retry_of, 0 AS depth FROM public.wa_message_log
              WHERE wml_id = ${row.wml_id}::uuid AND wml_company_id = ${row.wml_company_id}::uuid
             UNION
             SELECT l.wml_id, l.wml_retry_of, up.depth + 1 FROM public.wa_message_log l
               JOIN up ON l.wml_id = up.wml_retry_of
              WHERE l.wml_company_id = ${row.wml_company_id}::uuid AND up.depth < 50),
           root AS (SELECT wml_id FROM up WHERE wml_retry_of IS NULL),
           down AS (
             SELECT wml_id, 0 AS depth FROM root
             UNION
             SELECT l.wml_id, down.depth + 1 FROM public.wa_message_log l
               JOIN down ON l.wml_retry_of = down.wml_id
              WHERE l.wml_company_id = ${row.wml_company_id}::uuid
                AND l.wml_kind = ${row.wml_kind} AND down.depth < 50)
      SELECT l.*, NULL::text AS doc_status FROM public.wa_message_log l
       WHERE l.wml_id IN (SELECT wml_id FROM down) AND l.wml_company_id = ${row.wml_company_id}::uuid
       ORDER BY l.wml_try_no, l.wml_created_on`;
  }
}

/** Review S5 — the row's number was typed in the send popup (WA_POPUP_PHONE_MARK in wml_params). */
export function typedInPopup(row: { wml_phone_source: string | null; wml_phone: string | null; wml_params: unknown }): boolean {
  const params = row.wml_params;
  return (
    row.wml_phone_source === 'TYPED' &&
    !!row.wml_phone &&
    typeof params === 'object' &&
    params !== null &&
    !Array.isArray(params) &&
    (params as Record<string, unknown>)[WA_POPUP_PHONE_MARK] === true
  );
}
