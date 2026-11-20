"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WaSendService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaSendService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const txn_status_log_helper_1 = require("../../common/txn-status-log/txn-status-log.helper");
const print_render_service_1 = require("../settings/print-render/print-render.service");
const app_setting_value_service_1 = require("../settings/appSettings/app-setting-value.service");
const wa_doc_facts_1 = require("./wa-doc-facts");
const wa_errors_1 = require("./wa-errors");
const wa_language_1 = require("./wa-language");
const wa_phone_1 = require("./wa-phone");
const wa_relay_client_1 = require("./wa-relay.client");
const wa_settings_service_1 = require("./wa-settings.service");
const wa_store_service_1 = require("./wa-store.service");
const wa_constants_1 = require("./wa.constants");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYSTEM_ACTOR = { userId: null, userName: 'SYSTEM', deviceId: null, branchId: null };
let WaSendService = WaSendService_1 = class WaSendService {
    store;
    settings;
    relay;
    print;
    appSettings;
    logger = new common_1.Logger(WaSendService_1.name);
    inFlight = new Set();
    constructor(store, settings, relay, print, appSettings) {
        this.store = store;
        this.settings = settings;
        this.relay = relay;
        this.print = print;
        this.appSettings = appSettings;
    }
    async prepareDocument(p, tx) {
        const onPost = p.trigger === 'ON_POST';
        const settings = await this.settings.read(p.companyId);
        const conn = await this.store.row(p.companyId);
        if (this.store.offlineSite() || !conn || conn.wacState !== 'CONNECTED') {
            if (onPost) {
                return { notConnected: true, fallbackClickToChat: settings.fallbackClickToChat };
            }
            this.store.assertMainServer();
            this.refuseNotConnected(conn);
        }
        const doc = await (0, wa_doc_facts_1.readDocFacts)(this.store.prisma, {
            companyId: p.companyId,
            docType: p.docType,
            docId: p.docId,
            accYear: p.docAccYear,
        });
        if (doc.cancelled) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.DOC_CANCELLED, `${doc.refno} is cancelled, so it is not sent`, 'docId');
        }
        if (!doc.posted) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.DOC_NOT_POSTED, `${doc.refno || doc.docId} is ${doc.status}: only a posted document is sent`, 'docId');
        }
        const kind = doc.kind;
        const templateName = wa_constants_1.WA_TEMPLATE_OF_KIND[kind];
        const party = doc.partyId ? await (0, wa_doc_facts_1.readParty)(this.store.prisma, doc.partyId) : null;
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
        if (p.bodyPhone && !(0, wa_phone_1.normalisePhone)(p.bodyPhone).ok) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.BAD_NUMBER, `${p.bodyPhone} is not a full mobile number`, 'phone');
        }
        const choice = (0, wa_phone_1.choosePhone)((0, wa_phone_1.phoneCandidates)({
            ledger: party,
            docPhone: doc.docPhone,
            bodyPhone: p.bodyPhone,
            walkIn,
        }));
        if (!choice.ok) {
            return this.writeSkipOrFail({
                ...base,
                status: 'SKIPPED',
                errorCode: choice.code,
                errorText: choice.code === wa_constants_1.WA_CODES.NO_NUMBER
                    ? walkIn
                        ? 'Walk-in: no number typed on the document'
                        : 'No mobile number on the customer or the document'
                    : `Not a mobile number (${choice.tried.join(', ')})`,
            }, tx);
        }
        const popupPhone = choice.source === 'TYPED' && !!p.bodyPhone;
        if (party?.allOffOn && !walkIn) {
            if (!onPost) {
                (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.OPTED_OUT, `${party.name} asked for no WhatsApp messages (STOP)`, 'docId');
            }
            return this.writeSkipOrFail({
                ...base,
                phone: choice.phone,
                phoneSource: choice.source,
                popupPhone,
                status: 'SKIPPED',
                errorCode: wa_constants_1.WA_CODES.OPTED_OUT,
                errorText: 'The customer said STOP',
            }, tx);
        }
        const templates = await this.store.templates(p.companyId);
        const pick = (0, wa_language_1.pickLanguage)({
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
                    filename: (0, wa_doc_facts_1.pdfName)('Order', doc.refno),
                }
                : null;
        return prepared;
    }
    async prepareTest(p, tx) {
        const conn = await this.store.row(p.companyId);
        if (!conn || conn.wacState !== 'CONNECTED')
            this.refuseNotConnected(conn);
        const v = (0, wa_phone_1.normalisePhone)(p.phone);
        if (!v.ok) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.BAD_NUMBER, `${p.phone} is not a full mobile number`, 'phone');
        }
        const settings = await this.settings.read(p.companyId);
        const templateName = wa_constants_1.WA_TEMPLATE_OF_KIND.TEST;
        const accYear = await this.store.accYearOn(p.companyId, this.store.istToday());
        const base = {
            accYear,
            companyId: p.companyId,
            branchId: p.actor.branchId,
            kind: 'TEST',
            trigger: (p.retryOf ? 'RETRY' : 'TEST'),
            partyId: null,
            partyName: null,
            phone: v.phone,
            phoneSource: 'TYPED',
            templateName,
            tryNo: p.tryNo,
            retryOf: p.retryOf ?? null,
            settings,
            actor: p.actor,
        };
        const pick = (0, wa_language_1.pickLanguage)({ kind: 'TEST', templateName, templates: await this.store.templates(p.companyId) });
        if (!pick.ok) {
            return this.writeSkipOrFail({ ...base, langWanted: wa_constants_1.WA_TEST_LANG, status: 'FAILED', errorCode: pick.code, errorText: pick.note }, tx);
        }
        return this.writeRow({ ...base, langWanted: wa_constants_1.WA_TEST_LANG, langSent: wa_constants_1.WA_TEST_LANG, langNote: null, params: {}, status: 'SENDING' }, tx);
    }
    refuseNotConnected(conn) {
        if (!conn) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.NOT_ACTIVATED, 'WhatsApp is not activated for this company', 'companyId');
        }
        (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.NOT_CONNECTED, `This company's WhatsApp is ${conn.wacState}, not CONNECTED: use the chat button instead`, 'companyId', { state: conn.wacState });
    }
    async isWalkIn(doc) {
        if (!doc.partyId || doc.docType === 'RECEIPT')
            return false;
        const effective = await this.appSettings.resolveEffective({ companyId: doc.companyId, branchId: doc.branchId });
        const walkIn = (effective.find((i) => i.asdKey === 'sales.default_customer_id')?.value ?? '').trim();
        return walkIn !== '' && walkIn.toLowerCase() === doc.partyId.toLowerCase();
    }
    async docParams(doc, template, partyName) {
        const phone = await (0, wa_doc_facts_1.shopPhone)(this.store.prisma, doc.companyId, doc.branchId);
        return (0, wa_doc_facts_1.templateParams)(template.params, {
            customer_name: partyName ?? 'Customer',
            branch_phone: phone ?? 'our shop number',
            order_no: doc.refno,
            order_date: (0, wa_doc_facts_1.dmy)(doc.date),
            order_amount: (0, wa_doc_facts_1.inr)(doc.amount),
        });
    }
    async writeSkipOrFail(input, tx) {
        return this.writeRow({
            phone: null,
            phoneSource: null,
            langWanted: null,
            langSent: null,
            langNote: null,
            params: null,
            ...input,
        }, tx);
    }
    async writeRow(r, tx) {
        const client = tx ?? this.store.prisma;
        const now = new Date();
        const stored = r.popupPhone ? { ...(r.params ?? {}), [wa_constants_1.WA_POPUP_PHONE_MARK]: true } : r.params;
        let created;
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
                    wmlParams: stored === null ? client_1.Prisma.JsonNull : stored,
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
        }
        catch (error) {
            const what = r.doc ? `${r.doc.docType} ${r.doc.docId} (${r.doc.refno || 'no refno'})` : `${r.kind} to ${r.phone ?? '-'}`;
            this.logger.error(`WhatsApp log row NOT written for ${what}, company ${r.companyId}, log year ${r.accYear}: ${String(error).slice(0, 300)}. ` +
                `A year with no fiscal year row usually lacks its partition too: ensure_acc_year_partitions('${r.accYear}').`);
            throw error;
        }
        const prepared = {
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
        if (r.status === 'FAILED' && r.doc) {
            if (tx)
                prepared.pendingStep = true;
            else
                await this.statusStep(prepared, 'FAILED');
        }
        return prepared;
    }
    async deliver(p) {
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
                return await this.fail(p, wa_constants_1.WA_CODES.NOT_CONNECTED, `WhatsApp is ${conn?.wacState ?? 'not activated'}, not CONNECTED`);
            }
            let pdf = null;
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
                    return await this.fail(p, rendered.reason === 'NO_DESIGN' ? wa_constants_1.WA_CODES.PDF_NO_DESIGN : wa_constants_1.WA_CODES.PDF_FAILED, rendered.message);
                }
                await this.store.prisma.$executeRaw `
          UPDATE public.wa_message_log
             SET wml_pdf_version_id = ${rendered.versionId}::uuid, wml_pdf_bytes = ${rendered.bytes.length}::int,
                 wml_pdf_filename = ${p.pdf.filename}, wml_modified_on = now()
           WHERE wml_id = ${p.wmlId}::uuid AND wml_acc_year = ${p.accYear}::bpchar`;
                if (rendered.bytes.length > wa_constants_1.WA_PDF_MAX_BYTES) {
                    return await this.fail(p, wa_constants_1.WA_CODES.PDF_TOO_BIG, `The PDF is ${rendered.bytes.length} bytes, over 10 MB`);
                }
                pdf = { bytes: rendered.bytes, filename: p.pdf.filename };
            }
            let key;
            try {
                key = this.store.keyOf(conn);
            }
            catch {
                return await this.fail(p, wa_constants_1.WA_CODES.KEY_MISSING, 'The WhatsApp key cannot be read on this server (WA_CRED_KEY)');
            }
            try {
                const res = await this.relay.send(conn.wacRelayUrl, key, {
                    clientRef: p.wmlId,
                    to: p.phone ?? '',
                    templateName: p.templateName,
                    lang: p.lang ?? 'en',
                    params: p.params,
                    ...(pdf ? { documentFilename: pdf.filename } : {}),
                }, pdf);
                const acceptedAt = new Date(res.acceptedAt ?? Date.now());
                await this.store.prisma.$executeRaw `
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
            }
            catch (error) {
                if (error instanceof wa_errors_1.WaRelayError && error.unconfirmed) {
                    this.logger.warn(`WhatsApp send ${p.wmlId}: the relay has not confirmed it yet (left SENDING)`);
                    const relayMsgId = error.relay.relayMsgId && UUID.test(error.relay.relayMsgId) ? error.relay.relayMsgId : null;
                    if (relayMsgId) {
                        await this.store.prisma.$executeRaw `
              UPDATE public.wa_message_log
                 SET wml_relay_msg_id = COALESCE(wml_relay_msg_id, ${relayMsgId}::uuid), wml_modified_on = now()
               WHERE wml_id = ${p.wmlId}::uuid AND wml_acc_year = ${p.accYear}::bpchar`;
                    }
                    await this.store.fastPoll(p.companyId);
                    return this.outcome(p);
                }
                if (error instanceof wa_errors_1.WaRelayError) {
                    await this.store.noteRelayError(conn, error, p.actor.userName);
                    return await this.fail(p, error.waCode, error.message, error.relay.metaCode ?? null);
                }
                throw error;
            }
        }
        catch (error) {
            this.logger.error(`WhatsApp send ${p.wmlId} broke: ${error instanceof Error ? error.stack : String(error)}`);
            return this.fail(p, wa_constants_1.WA_CODES.RELAY_ERROR, `The send stopped on a server error: ${String(error).slice(0, 200)}`).catch(() => this.outcome(p));
        }
        finally {
            this.inFlight.delete(p.wmlId);
        }
    }
    async deliverForAnswer(p, ms = wa_constants_1.WA_SYNC_ANSWER_MS) {
        let timer;
        const late = new Promise((resolve) => {
            timer = setTimeout(() => resolve(null), ms);
        });
        try {
            const done = await Promise.race([this.deliver(p), late]);
            if (done)
                return done;
            this.logger.warn(`WhatsApp send ${p.wmlId}: no result in ${ms / 1000} s, answered ${p.status}; the send runs on`);
            return this.outcome(p);
        }
        finally {
            clearTimeout(timer);
        }
    }
    async fail(p, code, text, metaCode = null) {
        await this.store.prisma.$executeRaw `
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
    outcome(p) {
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
    async statusStep(p, result) {
        const doc = p.doc;
        if (!doc)
            return;
        const docType = doc.docType === 'SALE_BILL'
            ? txn_status_log_helper_1.TxnStatusDocType.SALE_BILL
            : doc.docType === 'SALES_ORDER'
                ? txn_status_log_helper_1.TxnStatusDocType.SALES_ORDER
                : txn_status_log_helper_1.TxnStatusDocType.RECEIPT;
        try {
            await this.store.prisma.$transaction(async (tx) => {
                const filed = await tx.txnStatusLog.findFirst({
                    where: {
                        tslSrcDocType: docType,
                        tslSrcDocId: doc.docId,
                        tslAccYear: doc.accYear,
                        tslNotifyRef: p.wmlId,
                        tslEvent: { in: [txn_status_log_helper_1.TxnStatusEvent.WHATSAPP_SENT, txn_status_log_helper_1.TxnStatusEvent.WHATSAPP_FAILED] },
                    },
                    select: { tslSeqNo: true },
                });
                if (filed)
                    return;
                await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                    companyId: doc.companyId,
                    branchId: doc.branchId,
                    accYear: doc.accYear,
                    srcModule: doc.docType === 'RECEIPT' ? txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS : txn_status_log_helper_1.TxnStatusSrcModule.SALES,
                    srcDocType: docType,
                    srcDocId: doc.docId,
                    srcDocRefno: doc.refno,
                    event: result === 'SENT' ? txn_status_log_helper_1.TxnStatusEvent.WHATSAPP_SENT : txn_status_log_helper_1.TxnStatusEvent.WHATSAPP_FAILED,
                    fromStatus: doc.status,
                    toStatus: doc.status,
                    changedBy: p.actor.userId ?? p.actor.userName,
                    remarks: result === 'SENT'
                        ? `WhatsApp ${p.templateName} (${p.lang ?? ''}) to ${p.phone ?? ''}`
                        : `WhatsApp not sent: ${p.errorCode ?? ''} ${p.errorText ?? ''}`.trim(),
                    deviceId: doc.deviceId,
                    notifyChannel: txn_status_log_helper_1.TxnStatusNotifyChannel.WHATSAPP,
                    notifiedOn: new Date(),
                    notifyRef: p.wmlId,
                });
            });
        }
        catch (error) {
            this.logger.warn(`WhatsApp status step for ${doc.docType} ${doc.refno} not written: ${String(error)}`);
        }
    }
    async statusStepForRow(wmlId, accYear, result) {
        try {
            const [r] = await this.store.prisma.$queryRaw `
        SELECT wml_company_id, wml_src_doc_type, wml_src_doc_id, wml_src_acc_year, wml_template_name,
               wml_lang_sent, wml_phone, wml_error_code, wml_error_text
          FROM public.wa_message_log
         WHERE wml_id = ${wmlId}::uuid AND wml_acc_year = ${accYear}::bpchar`;
            if (!r?.wml_src_doc_type || !r.wml_src_doc_id || !r.wml_src_acc_year)
                return;
            const doc = await (0, wa_doc_facts_1.readDocFacts)(this.store.prisma, {
                companyId: r.wml_company_id,
                docType: r.wml_src_doc_type,
                docId: r.wml_src_doc_id,
                accYear: r.wml_src_acc_year.trim(),
            });
            await this.statusStep({
                wmlId,
                templateName: r.wml_template_name ?? '',
                lang: r.wml_lang_sent,
                phone: r.wml_phone,
                errorCode: r.wml_error_code,
                errorText: r.wml_error_text,
                doc,
                actor: SYSTEM_ACTOR,
            }, result);
        }
        catch (error) {
            this.logger.warn(`WhatsApp status step for message ${wmlId} not written: ${String(error)}`);
        }
    }
};
exports.WaSendService = WaSendService;
exports.WaSendService = WaSendService = WaSendService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [wa_store_service_1.WaStore,
        wa_settings_service_1.WaSettingsService,
        wa_relay_client_1.WaRelayClient,
        print_render_service_1.PrintRenderService,
        app_setting_value_service_1.AppSettingValueService])
], WaSendService);
//# sourceMappingURL=wa-send.service.js.map