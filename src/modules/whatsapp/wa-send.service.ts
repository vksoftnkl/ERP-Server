import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type WaConnection } from '@prisma/client';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusNotifyChannel,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { PrintRenderService } from '../settings/print-render/print-render.service';
import { AppSettingValueService } from '../settings/appSettings/app-setting-value.service';
import {
  dmy,
  inr,
  pdfName,
  readDocFacts,
  readParty,
  shopPhone,
  templateParams,
  type DocFacts,
} from './wa-doc-facts';
import { WaRelayError, waRefuse } from './wa-errors';
import { pickLanguage, type TemplateMirror } from './wa-language';
import { choosePhone, normalisePhone, phoneCandidates } from './wa-phone';
import { WaRelayClient } from './wa-relay.client';
import { WaSettingsService, type WaSettings } from './wa-settings.service';
import { WaStore, type WaActor } from './wa-store.service';
import {
  WA_CODES,
  WA_PDF_MAX_BYTES,
  WA_POPUP_PHONE_MARK,
  WA_SYNC_ANSWER_MS,
  WA_TEMPLATE_OF_KIND,
  WA_TEST_LANG,
  type WaDocType,
  type WaKind,
  type WaPhoneSource,
  type WaStatus,
  type WaTrigger,
} from './wa.constants';

/** What a send answers (§5.3 /messages/send, /connection/test, /messages/retry). */
export interface WaSendOutcome {
  wmlId: string;
  accYear: string;
  status: WaStatus;
  phone: string | null;
  phoneSource: WaPhoneSource | null;
  templateName: string | null;
  lang: string | null;
  langNote: string | null;
  errorCode: string | null;
  errorText: string | null;
}

/** A log row written (SENDING, SKIPPED or FAILED) and what step 7–9 need to finish it. */
export interface PreparedSend {
  wmlId: string;
  accYear: string;
  companyId: string;
  branchId: string | null;
  kind: WaKind;
  trigger: WaTrigger;
  status: WaStatus;
  phone: string | null;
  phoneSource: WaPhoneSource | null;
  templateName: string;
  lang: string | null;
  langNote: string | null;
  errorCode: string | null;
  errorText: string | null;
  params: Record<string, string>;
  /** Null for a template without a DOCUMENT header (hello_world). */
  pdf: { purposeCode: string; docId: string | null; docAccYear: string | null; params: Record<string, unknown>; filename: string } | null;
  doc: DocFacts | null;
  actor: WaActor;
  /**
   * A document row written FAILED inside the caller's transaction (a retry):
   * its WHATSAPP_FAILED step is filed by `deliver`, after that commit.
   */
  pendingStep?: boolean;
}

/** What one txn_status_log step of a send needs. */
type StepInput = Pick<PreparedSend, 'wmlId' | 'templateName' | 'lang' | 'phone' | 'errorCode' | 'errorText' | 'doc' | 'actor'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The poller / sweeper as the actor of a step it files. */
const SYSTEM_ACTOR: WaActor = { userId: null, userName: 'SYSTEM', deviceId: null, branchId: null };

interface RowInput {
  accYear: string;
  companyId: string;
  branchId: string | null;
  kind: WaKind;
  trigger: WaTrigger;
  batchId?: string | null;
  doc?: DocFacts | null;
  partyId: string | null;
  partyName: string | null;
  asOn?: string | null;
  phone: string | null;
  phoneSource: WaPhoneSource | null;
  templateName: string;
  langWanted: string | null;
  langSent: string | null;
  langNote: string | null;
  params: Record<string, string> | null;
  status: WaStatus;
  errorCode?: string | null;
  errorText?: string | null;
  tryNo?: number;
  retryOf?: string | null;
  gapOverride?: boolean;
  overrideReason?: string | null;
  /** Review S5 — the number was typed in the send popup (recorded in wml_params, WA_POPUP_PHONE_MARK). */
  popupPhone?: boolean;
  settings: WaSettings;
  actor: WaActor;
}

/**
 * Plan §5.2 — the ONE send path for ON_POST, MANUAL, RETRY and TEST (scope cut
 * 17/11: the Sales Order confirmation and the test; BULK reminders come later):
 * connection → document → number → consent → language → log row (steps 1–6,
 * `prepare*`), then PDF → relay → status step (7–9, `deliver`).
 *
 * Offline = fail at once (Q12): no queue, no HELD. A relay that cannot be
 * reached makes the row FAILED WA_RELAY_UNREACHABLE and the operator resends
 * from the log. ON_POST runs 7–9 after the post's response, so a send can never
 * hold up, block or roll back the post.
 */
@Injectable()
export class WaSendService {
  private readonly logger = new Logger(WaSendService.name);
  /** wml_ids this process is delivering right now: the SENDING sweeper leaves them alone. */
  readonly inFlight = new Set<string>();

  constructor(
    private readonly store: WaStore,
    private readonly settings: WaSettingsService,
    private readonly relay: WaRelayClient,
    private readonly print: PrintRenderService,
    private readonly appSettings: AppSettingValueService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  Steps 1–6
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * A Sales Order (scope cut 17/11). `notConnected` (ON_POST only) is what the post
   * answers when this company is not CONNECTED: nothing is logged.
   *
   * `bodyPhone` is a number typed in the send popup (MANUAL), or the popup number
   * a RETRY carries over (review S5): it goes before the master numbers. `tx`
   * (a retry) writes the log row inside the caller's transaction.
   */
  async prepareDocument(
    p: {
      companyId: string;
      docType: WaDocType;
      docId: string;
      docAccYear: string;
      trigger: WaTrigger;
      bodyPhone?: string | null;
      lang?: string | null;
      tryNo?: number;
      retryOf?: string | null;
      actor: WaActor;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<PreparedSend | { notConnected: true; fallbackClickToChat: boolean }> {
    const onPost = p.trigger === 'ON_POST';
    const settings = await this.settings.read(p.companyId);
    // 1 · connection
    const conn = await this.store.row(p.companyId);
    if (this.store.offlineSite() || !conn || conn.wacState !== 'CONNECTED') {
      if (onPost) {
        return { notConnected: true, fallbackClickToChat: settings.fallbackClickToChat };
      }
      this.store.assertMainServer();
      this.refuseNotConnected(conn);
    }
    // 2 · document
    const doc = await readDocFacts(this.store.prisma, {
      companyId: p.companyId,
      docType: p.docType,
      docId: p.docId,
      accYear: p.docAccYear,
    });
    if (doc.cancelled) {
      waRefuse(WA_CODES.DOC_CANCELLED, `${doc.refno} is cancelled, so it is not sent`, 'docId');
    }
    if (!doc.posted) {
      waRefuse(WA_CODES.DOC_NOT_POSTED, `${doc.refno || doc.docId} is ${doc.status}: only a posted document is sent`, 'docId');
    }
    const kind = doc.kind;
    const templateName = WA_TEMPLATE_OF_KIND[kind];
    const party = doc.partyId ? await readParty(this.store.prisma, doc.partyId) : null;
    const walkIn = await this.isWalkIn(doc);
    const partyName = (walkIn ? doc.docPartyName : null) || party?.name || doc.docPartyName || null;
    const accYear = await this.store.accYearOn(p.companyId, this.store.istToday());
    const base = {
      accYear,
      companyId: p.companyId,
      branchId: doc.branchId,
      kind,
      trigger: p.trigger,
      doc,
      partyId: doc.partyId,
      partyName,
      templateName,
      tryNo: p.tryNo,
      retryOf: p.retryOf ?? null,
      settings,
      actor: p.actor,
    };
    // 3 · number
    if (p.bodyPhone && !normalisePhone(p.bodyPhone).ok) {
      waRefuse(WA_CODES.BAD_NUMBER, `${p.bodyPhone} is not a full mobile number`, 'phone');
    }
    const choice = choosePhone(
      phoneCandidates({
        ledger: party,
        docPhone: doc.docPhone,
        bodyPhone: p.bodyPhone,
        walkIn,
      }),
    );
    if (!choice.ok) {
      return this.writeSkipOrFail({
        ...base,
        status: 'SKIPPED',
        errorCode: choice.code,
        errorText:
          choice.code === WA_CODES.NO_NUMBER
            ? walkIn
              ? 'Walk-in: no number typed on the document'
              : 'No mobile number on the customer or the document'
            : `Not a mobile number (${choice.tried.join(', ')})`,
      }, tx);
    }
    // A popup number is validated above and goes first, so TYPED + bodyPhone = the popup's.
    const popupPhone = choice.source === 'TYPED' && !!p.bodyPhone;
    // 4 · consent
    if (party?.allOffOn && !walkIn) {
      if (!onPost) {
        waRefuse(WA_CODES.OPTED_OUT, `${party.name} asked for no WhatsApp messages (STOP)`, 'docId');
      }
      return this.writeSkipOrFail({
        ...base,
        phone: choice.phone,
        phoneSource: choice.source,
        popupPhone,
        status: 'SKIPPED',
        errorCode: WA_CODES.OPTED_OUT,
        errorText: 'The customer said STOP',
      }, tx);
    }
    // 5 · language
    const templates = await this.store.templates(p.companyId);
    const pick = pickLanguage({
      kind,
      templateName,
      requested: p.lang,
      partyLang: walkIn ? null : party?.lang,
      companyDefault: settings.defaultLanguage,
      templates,
    });
    if (!pick.ok) {
      return this.writeSkipOrFail({
        ...base,
        phone: choice.phone,
        phoneSource: choice.source,
        popupPhone,
        langWanted: pick.wanted,
        status: 'FAILED',
        errorCode: pick.code,
        errorText: pick.note,
      }, tx);
    }
    // 6 · the row
    const params = await this.docParams(doc, pick.template, partyName);
    const prepared = await this.writeRow({
      ...base,
      phone: choice.phone,
      phoneSource: choice.source,
      popupPhone,
      langWanted: pick.wanted,
      langSent: pick.lang,
      langNote: pick.note,
      params,
      status: 'SENDING',
    }, tx);
    prepared.pdf =
      pick.template.headerKind === 'DOCUMENT'
        ? {
            purposeCode: doc.printPurposeCode,
            docId: doc.docId,
            docAccYear: doc.accYear,
            params: {},
            filename: pdfName('Order', doc.refno),
          }
        : null;
    return prepared;
  }

  /** 307 F07 — hello_world (en_US, no document) to a typed number. `tx`: a retry's transaction. */
  async prepareTest(
    p: { companyId: string; phone: string; tryNo?: number; retryOf?: string | null; actor: WaActor },
    tx?: Prisma.TransactionClient,
  ): Promise<PreparedSend> {
    const conn = await this.store.row(p.companyId);
    if (!conn || conn.wacState !== 'CONNECTED') this.refuseNotConnected(conn);
    const v = normalisePhone(p.phone);
    if (!v.ok) {
      waRefuse(WA_CODES.BAD_NUMBER, `${p.phone} is not a full mobile number`, 'phone');
    }
    const settings = await this.settings.read(p.companyId);
    const templateName = WA_TEMPLATE_OF_KIND.TEST;
    const accYear = await this.store.accYearOn(p.companyId, this.store.istToday());
    const base = {
      accYear,
      companyId: p.companyId,
      branchId: p.actor.branchId,
      kind: 'TEST' as const,
      trigger: (p.retryOf ? 'RETRY' : 'TEST') as WaTrigger,
      partyId: null,
      partyName: null,
      phone: v.phone,
      phoneSource: 'TYPED' as const,
      templateName,
      tryNo: p.tryNo,
      retryOf: p.retryOf ?? null,
      settings,
      actor: p.actor,
    };
    const pick = pickLanguage({ kind: 'TEST', templateName, templates: await this.store.templates(p.companyId) });
    if (!pick.ok) {
      return this.writeSkipOrFail({ ...base, langWanted: WA_TEST_LANG, status: 'FAILED', errorCode: pick.code, errorText: pick.note }, tx);
    }
    return this.writeRow({ ...base, langWanted: WA_TEST_LANG, langSent: WA_TEST_LANG, langNote: null, params: {}, status: 'SENDING' }, tx);
  }

  private refuseNotConnected(conn: WaConnection | null): never {
    if (!conn) {
      waRefuse(WA_CODES.NOT_ACTIVATED, 'WhatsApp is not activated for this company', 'companyId');
    }
    waRefuse(
      WA_CODES.NOT_CONNECTED,
      `This company's WhatsApp is ${conn.wacState}, not CONNECTED: use the chat button instead`,
      'companyId',
      { state: conn.wacState },
    );
  }

  /** Q4 — the sales default customer is the walk-in: only typed numbers. */
  private async isWalkIn(doc: DocFacts): Promise<boolean> {
    if (!doc.partyId || doc.docType === 'RECEIPT') return false;
    const effective = await this.appSettings.resolveEffective({ companyId: doc.companyId, branchId: doc.branchId });
    const walkIn = (effective.find((i) => i.asdKey === 'sales.default_customer_id')?.value ?? '').trim();
    return walkIn !== '' && walkIn.toLowerCase() === doc.partyId.toLowerCase();
  }

  /** nex_order_confirm_v1: customer_name, order_no, order_date, order_amount, branch_phone (§4.3). */
  private async docParams(doc: DocFacts, template: TemplateMirror, partyName: string | null): Promise<Record<string, string>> {
    const phone = await shopPhone(this.store.prisma, doc.companyId, doc.branchId);
    return templateParams(template.params, {
      customer_name: partyName ?? 'Customer',
      branch_phone: phone ?? 'our shop number',
      order_no: doc.refno,
      order_date: dmy(doc.date),
      order_amount: inr(doc.amount),
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The log row
  // ═════════════════════════════════════════════════════════════════════════

  private async writeSkipOrFail(
    input: Omit<RowInput, 'phone' | 'phoneSource' | 'langWanted' | 'langSent' | 'langNote' | 'params'> &
      Partial<Pick<RowInput, 'phone' | 'phoneSource' | 'langWanted' | 'langSent' | 'langNote' | 'params'>>,
    tx?: Prisma.TransactionClient,
  ): Promise<PreparedSend> {
    return this.writeRow(
      {
        phone: null,
        phoneSource: null,
        langWanted: null,
        langSent: null,
        langNote: null,
        params: null,
        ...input,
      },
      tx,
    );
  }

  private async writeRow(r: RowInput, tx?: Prisma.TransactionClient): Promise<PreparedSend> {
    const client = tx ?? this.store.prisma;
    const now = new Date();
    // wml_params = the template values sent, plus the S5 popup mark (never sent to the relay).
    const stored = r.popupPhone ? { ...(r.params ?? {}), [WA_POPUP_PHONE_MARK]: true } : r.params;
    let created: { wmlId: string; wmlAccYear: string };
    try {
      created = await client.waMessageLog.create({
        data: {
          wmlAccYear: r.accYear,
          wmlCompanyId: r.companyId,
          wmlBranchId: r.branchId,
          wmlKind: r.kind,
          wmlTrigger: r.trigger,
          wmlBatchId: r.batchId ?? null,
          wmlSrcDocType: r.doc?.docType ?? null,
          wmlSrcDocId: r.doc?.docId ?? null,
          wmlSrcAccYear: r.doc?.accYear ?? null,
          wmlSrcDocRefno: r.doc?.refno?.slice(0, 100) || null,
          wmlVchrTypeId: r.doc?.vchrTypeId ?? null,
          wmlPartyId: r.partyId,
          wmlPartyName: r.partyName?.slice(0, 150) ?? null,
          wmlAsOn: r.asOn ? new Date(`${r.asOn}T00:00:00Z`) : null,
          wmlPhone: r.phone?.slice(0, 16) ?? null,
          wmlPhoneSource: r.phoneSource,
          wmlTemplateName: r.templateName,
          wmlLangWanted: r.langWanted,
          wmlLangSent: r.langSent,
          wmlLangNote: r.langNote?.slice(0, 120) ?? null,
          wmlParams: stored === null ? Prisma.JsonNull : (stored as Prisma.InputJsonValue),
          wmlStatus: r.status,
          wmlSendingOn: r.status === 'SENDING' ? now : null,
          wmlFailedOn: r.status === 'FAILED' ? now : null,
          wmlErrorCode: r.errorCode ?? null,
          wmlErrorText: r.errorText?.slice(0, 300) ?? null,
          wmlTryNo: r.tryNo ?? 1,
          wmlRetryOf: r.retryOf ?? null,
          wmlGapOverride: r.gapOverride ?? false,
          wmlOverrideReason: r.overrideReason?.slice(0, 200) ?? null,
          wmlCostRate: r.settings.ratePerMessage,
          wmlCostGstPct: r.settings.rateGstPercent,
          wmlDeviceId: r.actor.deviceId,
          wmlUserId: r.actor.userId,
          wmlUserName: r.actor.userName,
          wmlCreatedOn: now,
          wmlCreatedBy: r.actor.userName,
        },
        select: { wmlId: true, wmlAccYear: true },
      });
    } catch (error) {
      // Review N8 — say which document lost its log row (an ON_POST caller swallows the throw).
      const what = r.doc ? `${r.doc.docType} ${r.doc.docId} (${r.doc.refno || 'no refno'})` : `${r.kind} to ${r.phone ?? '-'}`;
      this.logger.error(
        `WhatsApp log row NOT written for ${what}, company ${r.companyId}, log year ${r.accYear}: ${String(error).slice(0, 300)}. ` +
          `A year with no fiscal year row usually lacks its partition too: ensure_acc_year_partitions('${r.accYear}').`,
      );
      throw error;
    }
    const prepared: PreparedSend = {
      wmlId: created.wmlId,
      accYear: created.wmlAccYear,
      companyId: r.companyId,
      branchId: r.branchId,
      kind: r.kind,
      trigger: r.trigger,
      status: r.status,
      phone: r.phone,
      phoneSource: r.phoneSource,
      templateName: r.templateName,
      lang: r.langSent,
      langNote: r.langNote,
      errorCode: r.errorCode ?? null,
      errorText: r.errorText ?? null,
      params: r.params ?? {},
      pdf: null,
      doc: r.doc ?? null,
      actor: r.actor,
    };
    // A FAILED-before-the-relay document send still files its status step
    // (inside a caller's transaction: by `deliver`, after the commit).
    if (r.status === 'FAILED' && r.doc) {
      if (tx) prepared.pendingStep = true;
      else await this.statusStep(prepared, 'FAILED');
    }
    return prepared;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Steps 7–9
  // ═════════════════════════════════════════════════════════════════════════

  /** PDF → relay → row → status step. Never throws: the outcome is the row. */
  async deliver(p: PreparedSend): Promise<WaSendOutcome> {
    if (p.status !== 'SENDING') {
      if (p.pendingStep) {
        p.pendingStep = false;
        await this.statusStep(p, 'FAILED');
      }
      return this.outcome(p);
    }
    this.inFlight.add(p.wmlId);
    try {
      const conn = await this.store.row(p.companyId);
      if (!conn || conn.wacState !== 'CONNECTED') {
        return await this.fail(p, WA_CODES.NOT_CONNECTED, `WhatsApp is ${conn?.wacState ?? 'not activated'}, not CONNECTED`);
      }
      // 7 · PDF
      let pdf: { bytes: Buffer; filename: string } | null = null;
      if (p.pdf) {
        const rendered = await this.print.renderForWhatsApp({
          purposeCode: p.pdf.purposeCode,
          context: {
            companyId: p.companyId,
            branchId: p.branchId,
            accYear: p.pdf.docAccYear,
            docId: p.pdf.docId,
            userId: p.actor.userId,
            deviceId: null,
          },
          params: p.pdf.params,
        });
        if (!rendered.ok) {
          return await this.fail(
            p,
            rendered.reason === 'NO_DESIGN' ? WA_CODES.PDF_NO_DESIGN : WA_CODES.PDF_FAILED,
            rendered.message,
          );
        }
        await this.store.prisma.$executeRaw`
          UPDATE public.wa_message_log
             SET wml_pdf_version_id = ${rendered.versionId}::uuid, wml_pdf_bytes = ${rendered.bytes.length}::int,
                 wml_pdf_filename = ${p.pdf.filename}, wml_modified_on = now()
           WHERE wml_id = ${p.wmlId}::uuid AND wml_acc_year = ${p.accYear}::bpchar`;
        if (rendered.bytes.length > WA_PDF_MAX_BYTES) {
          return await this.fail(p, WA_CODES.PDF_TOO_BIG, `The PDF is ${rendered.bytes.length} bytes, over 10 MB`);
        }
        pdf = { bytes: rendered.bytes, filename: p.pdf.filename };
      }
      // 8 · relay
      let key: string;
      try {
        key = this.store.keyOf(conn);
      } catch {
        return await this.fail(p, WA_CODES.KEY_MISSING, 'The WhatsApp key cannot be read on this server (WA_CRED_KEY)');
      }
      try {
        const res = await this.relay.send(
          conn.wacRelayUrl,
          key,
          {
            clientRef: p.wmlId,
            to: p.phone ?? '',
            templateName: p.templateName,
            lang: p.lang ?? 'en',
            params: p.params,
            ...(pdf ? { documentFilename: pdf.filename } : {}),
          },
          pdf,
        );
        const acceptedAt = new Date(res.acceptedAt ?? Date.now());
        await this.store.prisma.$executeRaw`
          UPDATE public.wa_message_log
             SET wml_status = CASE WHEN wml_status = 'SENDING' THEN 'SENT' ELSE wml_status END,
                 wml_sent_on = COALESCE(wml_sent_on, ${acceptedAt}),
                 wml_meta_message_id = ${res.wamid ? res.wamid.slice(0, 128) : null},
                 wml_relay_msg_id = ${res.relayMsgId ?? null}::uuid,
                 wml_modified_on = now()
           WHERE wml_id = ${p.wmlId}::uuid AND wml_acc_year = ${p.accYear}::bpchar`;
        p.status = 'SENT';
        await this.statusStep(p, 'SENT');
        await this.store.fastPoll(p.companyId);
        return this.outcome(p);
      } catch (error) {
        if (error instanceof WaRelayError && error.unconfirmed) {
          // Review S3 — the relay could not confirm in time: the message may have
          // gone. Not FAILED (no "No internet", no retry while it is SENDING): the
          // event poll settles the row by its clientRef (= wml_id), or the sweeper
          // fails it WA_SEND_INTERRUPTED after 10 minutes.
          this.logger.warn(`WhatsApp send ${p.wmlId}: the relay has not confirmed it yet (left SENDING)`);
          const relayMsgId = error.relay.relayMsgId && UUID.test(error.relay.relayMsgId) ? error.relay.relayMsgId : null;
          if (relayMsgId) {
            await this.store.prisma.$executeRaw`
              UPDATE public.wa_message_log
                 SET wml_relay_msg_id = COALESCE(wml_relay_msg_id, ${relayMsgId}::uuid), wml_modified_on = now()
               WHERE wml_id = ${p.wmlId}::uuid AND wml_acc_year = ${p.accYear}::bpchar`;
          }
          await this.store.fastPoll(p.companyId);
          return this.outcome(p);
        }
        if (error instanceof WaRelayError) {
          await this.store.noteRelayError(conn, error, p.actor.userName);
          return await this.fail(p, error.waCode, error.message, error.relay.metaCode ?? null);
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`WhatsApp send ${p.wmlId} broke: ${error instanceof Error ? error.stack : String(error)}`);
      return this.fail(p, WA_CODES.RELAY_ERROR, `The send stopped on a server error: ${String(error).slice(0, 200)}`).catch(() =>
        this.outcome(p),
      );
    } finally {
      this.inFlight.delete(p.wmlId);
    }
  }

  /**
   * `deliver` for a route that answers synchronously: the outcome, or — when the
   * send takes longer than `ms` (a slow relay; the house request timeout is
   * 15 s) — the row as it stands now (SENDING), while the send runs on.
   */
  async deliverForAnswer(p: PreparedSend, ms = WA_SYNC_ANSWER_MS): Promise<WaSendOutcome> {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    });
    try {
      const done = await Promise.race([this.deliver(p), late]);
      if (done) return done;
      this.logger.warn(`WhatsApp send ${p.wmlId}: no result in ${ms / 1000} s, answered ${p.status}; the send runs on`);
      return this.outcome(p);
    } finally {
      clearTimeout(timer);
    }
  }

  async fail(p: PreparedSend, code: string, text: string, metaCode: number | null = null): Promise<WaSendOutcome> {
    await this.store.prisma.$executeRaw`
      UPDATE public.wa_message_log
         SET wml_status = 'FAILED', wml_failed_on = COALESCE(wml_failed_on, now()),
             wml_error_code = ${code.slice(0, 30)}, wml_error_text = ${text.slice(0, 300)},
             wml_meta_error_code = ${metaCode}::int, wml_modified_on = now()
       WHERE wml_id = ${p.wmlId}::uuid AND wml_acc_year = ${p.accYear}::bpchar
         AND wml_status = 'SENDING'`;
    p.status = 'FAILED';
    p.errorCode = code;
    p.errorText = text.slice(0, 300);
    await this.statusStep(p, 'FAILED');
    return this.outcome(p);
  }

  outcome(p: PreparedSend): WaSendOutcome {
    return {
      wmlId: p.wmlId,
      accYear: p.accYear,
      status: p.status,
      phone: p.phone,
      phoneSource: p.phoneSource,
      templateName: p.templateName,
      lang: p.lang,
      langNote: p.langNote,
      errorCode: p.errorCode,
      errorText: p.errorText,
    };
  }

  /**
   * Step 9 — one txn_status_log step per document send (to_status = the
   * document's, unchanged). Once per wml_id: a send that already filed its step
   * (tsl_notify_ref) files none again.
   */
  private async statusStep(p: StepInput, result: 'SENT' | 'FAILED'): Promise<void> {
    const doc = p.doc;
    if (!doc) return;
    const docType =
      doc.docType === 'SALE_BILL'
        ? TxnStatusDocType.SALE_BILL
        : doc.docType === 'SALES_ORDER'
          ? TxnStatusDocType.SALES_ORDER
          : TxnStatusDocType.RECEIPT;
    try {
      await this.store.prisma.$transaction(async (tx) => {
        const filed = await tx.txnStatusLog.findFirst({
          where: {
            tslSrcDocType: docType,
            tslSrcDocId: doc.docId,
            tslAccYear: doc.accYear,
            tslNotifyRef: p.wmlId,
            tslEvent: { in: [TxnStatusEvent.WHATSAPP_SENT, TxnStatusEvent.WHATSAPP_FAILED] },
          },
          select: { tslSeqNo: true },
        });
        if (filed) return;
        await appendTxnStatusLog(tx, {
          companyId: doc.companyId,
          branchId: doc.branchId,
          accYear: doc.accYear,
          srcModule: doc.docType === 'RECEIPT' ? TxnStatusSrcModule.ACCOUNTS : TxnStatusSrcModule.SALES,
          srcDocType: docType,
          srcDocId: doc.docId,
          srcDocRefno: doc.refno,
          event: result === 'SENT' ? TxnStatusEvent.WHATSAPP_SENT : TxnStatusEvent.WHATSAPP_FAILED,
          fromStatus: doc.status,
          toStatus: doc.status,
          changedBy: p.actor.userId ?? p.actor.userName,
          remarks:
            result === 'SENT'
              ? `WhatsApp ${p.templateName} (${p.lang ?? ''}) to ${p.phone ?? ''}`
              : `WhatsApp not sent: ${p.errorCode ?? ''} ${p.errorText ?? ''}`.trim(),
          deviceId: doc.deviceId,
          notifyChannel: TxnStatusNotifyChannel.WHATSAPP,
          notifiedOn: new Date(),
          notifyRef: p.wmlId,
        });
      });
    } catch (error) {
      this.logger.warn(`WhatsApp status step for ${doc.docType} ${doc.refno} not written: ${String(error)}`);
    }
  }

  /**
   * The status step of a row settled away from the send path: the SENDING
   * sweeper's FAILED (review N6), and an unconfirmed send the event poll
   * settles (review S3). Reads the row and its document; never throws.
   */
  async statusStepForRow(wmlId: string, accYear: string, result: 'SENT' | 'FAILED'): Promise<void> {
    try {
      const [r] = await this.store.prisma.$queryRaw<
        {
          wml_company_id: string;
          wml_src_doc_type: string | null;
          wml_src_doc_id: string | null;
          wml_src_acc_year: string | null;
          wml_template_name: string | null;
          wml_lang_sent: string | null;
          wml_phone: string | null;
          wml_error_code: string | null;
          wml_error_text: string | null;
        }[]
      >`
        SELECT wml_company_id, wml_src_doc_type, wml_src_doc_id, wml_src_acc_year, wml_template_name,
               wml_lang_sent, wml_phone, wml_error_code, wml_error_text
          FROM public.wa_message_log
         WHERE wml_id = ${wmlId}::uuid AND wml_acc_year = ${accYear}::bpchar`;
      if (!r?.wml_src_doc_type || !r.wml_src_doc_id || !r.wml_src_acc_year) return;
      const doc = await readDocFacts(this.store.prisma, {
        companyId: r.wml_company_id,
        docType: r.wml_src_doc_type as WaDocType,
        docId: r.wml_src_doc_id,
        accYear: r.wml_src_acc_year.trim(),
      });
      await this.statusStep(
        {
          wmlId,
          templateName: r.wml_template_name ?? '',
          lang: r.wml_lang_sent,
          phone: r.wml_phone,
          errorCode: r.wml_error_code,
          errorText: r.wml_error_text,
          doc,
          actor: SYSTEM_ACTOR,
        },
        result,
      );
    } catch (error) {
      this.logger.warn(`WhatsApp status step for message ${wmlId} not written: ${String(error)}`);
    }
  }
}
