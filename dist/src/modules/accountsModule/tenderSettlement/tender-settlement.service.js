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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegBook = exports.TenderSettlementService = void 0;
exports.signedTotals = signedTotals;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const till_event_service_1 = require("../../till/services/till-event.service");
const till_enum_1 = require("../../till/types/till-enum");
const ledger_map_helper_1 = require("../ledgerRole/ledger-map.helper");
const receipt_guards_1 = require("../receipt/receipt.guards");
const voucher_derive_1 = require("../vouchers/voucher-derive");
const settlement_format_1 = require("./settlement-format");
const settlement_match_1 = require("./settlement-match");
const tender_settlement_errors_1 = require("./tender-settlement-errors");
const tender_settlement_settings_1 = require("./tender-settlement.settings");
const tender_settlement_enum_1 = require("./types/tender-settlement-enum");
const ZERO = new client_1.Prisma.Decimal(0);
const TX = { maxWait: 15_000, timeout: 120_000 };
const CASH_TENDER_TYPE_ID = 1;
const CANDIDATE_DAYS_BACK = 60;
const iso = (d) => d.toISOString().slice(0, 10);
const dateOnly = (s) => new Date(`${s}T00:00:00Z`);
const num = (d) => d === null || d === undefined ? 0 : Number(new client_1.Prisma.Decimal(d).toFixed(2));
let TenderSettlementService = class TenderSettlementService {
    prisma;
    requestContext;
    posting;
    appSettings;
    events;
    constructor(prisma, requestContext, posting, appSettings, events) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.posting = posting;
        this.appSettings = appSettings;
        this.events = events;
    }
    async getFormat(companyId, tenderId) {
        const tender = await this.loadTender(this.prisma, companyId, null, tenderId);
        const stored = tender.tndStatementFormat
            ? (0, settlement_format_1.validateStatementFormat)(tender.tndStatementFormat).format
            : null;
        return this.formatPayload(tender, stored);
    }
    async saveFormat(dto) {
        const caller = await this.caller();
        const tender = await this.loadTender(this.prisma, dto.companyId, null, dto.tenderId);
        let format = null;
        if (dto.format) {
            const checked = (0, settlement_format_1.validateStatementFormat)(dto.format);
            if (!checked.format) {
                (0, tender_settlement_errors_1.throwSettlementDetails)(tender_settlement_enum_1.SettlementErrorCode.FORMAT_INVALID, 'The statement format cannot be used', checked.problems.map((message) => ({ field: 'format', message })));
            }
            format = checked.format;
        }
        await this.prisma.accTenderMaster.update({
            where: { tndId: tender.tndId },
            data: {
                tndStatementFormat: format ? format : client_1.Prisma.DbNull,
                tndModifiedOn: new Date(),
                tndModifiedBy: caller.actorName,
            },
        });
        return this.formatPayload(tender, format);
    }
    async testFormat(companyId, tenderId, file) {
        const tender = await this.loadTender(this.prisma, companyId, null, tenderId);
        const format = this.requireFormat(tender);
        const parsed = (0, settlement_format_1.parseStatementCsv)(this.fileText(file), format);
        const payouts = (0, settlement_format_1.groupByPayout)(parsed.lines, { payoutRef: null, payoutDate: null });
        return {
            lines: parsed.lines.slice(0, 200).map((l) => ({
                lineNo: l.lineNo,
                kind: l.kind,
                txnOn: l.txnOn?.toISOString() ?? null,
                terminalId: l.terminalId,
                refNo: l.refNo,
                authCode: l.authCode,
                cardLast4: l.cardLast4,
                gross: num(l.gross),
                fee: num(l.fee),
                tax: num(l.tax),
                net: num(l.net),
                payoutRef: l.payoutRef,
                payoutDate: l.payoutDate,
            })),
            problems: parsed.problems,
            payouts: payouts.map((p) => ({
                payoutRef: p.payoutRef,
                payoutDate: p.payoutDate,
                lines: p.lines.length,
                net: num(signedTotals(p.lines).net),
            })),
        };
    }
    async import(dto, file) {
        const caller = await this.caller();
        const text = this.fileText(file);
        const fileName = (file?.originalname ?? 'statement.csv').slice(0, 250);
        const fileSha = (0, node_crypto_1.createHash)('sha256').update(file.buffer).digest('hex');
        const settings = await this.settings(dto.companyId, dto.branchId);
        const ids = await this.prisma.$transaction(async (tx) => {
            const tender = await this.loadTender(tx, dto.companyId, dto.branchId, dto.tenderId);
            const format = this.requireFormat(tender);
            if (!tender.tndSettlementLedgerId) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.BANK_MISSING, `${tender.tndName} names no settlement ledger: the bank its payouts reach (Tender master)`, 'tenderId');
            }
            const parsed = (0, settlement_format_1.parseStatementCsv)(text, format);
            if (parsed.problems.length > 0) {
                (0, tender_settlement_errors_1.throwSettlementDetails)(tender_settlement_enum_1.SettlementErrorCode.FILE_INVALID, `${parsed.problems.length} row(s) of the file cannot be read`, parsed.problems.slice(0, 200).map((p) => ({
                    field: 'file',
                    message: `Line ${p.lineNo}: ${p.message}`,
                    lineNo: p.lineNo,
                })));
            }
            if (parsed.lines.length === 0) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.FILE_INVALID, 'The file has no lines', 'file');
            }
            if (parsed.lines.length > tender_settlement_enum_1.IMPORT_MAX_LINES) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.FILE_INVALID, `The file has ${parsed.lines.length} lines; split it (${tender_settlement_enum_1.IMPORT_MAX_LINES} at most)`, 'file');
            }
            const bank = format.source === tender_settlement_enum_1.SettlementSource.BANK;
            if (bank && parsed.lines.some((l) => l.fee.gt(0) || l.tax.gt(0))) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.FILE_INVALID, 'A bank-statement import (source BANK) carries no fee or tax: the bank credited each line in full', 'file');
            }
            const groups = (0, settlement_format_1.groupByPayout)(parsed.lines, {
                payoutRef: bank ? null : (dto.payoutRef ?? null),
                payoutDate: dto.payoutDate ?? null,
            });
            for (const g of groups) {
                if (!g.payoutDate) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.FILE_INVALID, 'The file names no payout date: send payoutDate, or map columns.payoutDate', 'payoutDate');
                }
            }
            const tenderOf = await this.lineTenders(tx, dto, tender, parsed.lines);
            const created = [];
            for (const g of groups) {
                const accYear = (0, voucher_derive_1.accYearOfDate)(g.payoutDate);
                await this.assertSettlementPartition(tx, accYear);
                const key = groups.length === 1 ? '' : `|${g.payoutRef ?? ''}|${g.payoutDate}`;
                const hash = key
                    ? (0, node_crypto_1.createHash)('sha256')
                        .update(fileSha + key)
                        .digest('hex')
                    : fileSha;
                const clash = await tx.accSettlementImport.findFirst({
                    where: {
                        asiCompanyId: dto.companyId,
                        asiBranchId: dto.branchId,
                        asiFileHash: hash,
                        asiIsDeleted: false,
                        asiStatus: { not: tender_settlement_enum_1.SettlementImportStatus.VOIDED },
                    },
                    select: { asiId: true, asiAccYear: true, asiPayoutDate: true },
                });
                if (clash) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.FILE_DUPLICATE, `This file (payout of ${iso(clash.asiPayoutDate)}) was imported already; void that import to read it again`, 'file', { asiId: clash.asiId, accYear: clash.asiAccYear });
                }
                const totals = signedTotals(g.lines);
                const days = g.lines
                    .map((l) => (l.txnOn ? (0, settlement_format_1.istDate)(l.txnOn) : null))
                    .filter((d) => !!d)
                    .sort();
                const head = await tx.accSettlementImport.create({
                    data: {
                        asiCompanyId: dto.companyId,
                        asiBranchId: dto.branchId,
                        asiTenantId: null,
                        asiAccYear: accYear,
                        asiSource: format.source,
                        asiProvider: format.provider,
                        asiTenderId: tender.tndId,
                        asiFileName: fileName,
                        asiFileHash: hash,
                        asiPayoutRef: bank ? null : g.payoutRef,
                        asiPayoutDate: dateOnly(g.payoutDate),
                        asiPeriodFrom: days.length ? dateOnly(days[0]) : null,
                        asiPeriodTo: days.length ? dateOnly(days[days.length - 1]) : null,
                        asiLineCount: g.lines.length,
                        asiTotalGross: totals.gross,
                        asiTotalFee: totals.fee,
                        asiTotalTax: totals.tax,
                        asiTotalNet: totals.net,
                        asiStatus: tender_settlement_enum_1.SettlementImportStatus.IMPORTED,
                        asiBankLedgerId: tender.tndSettlementLedgerId,
                        asiImportedBy: caller.userId,
                        asiNotes: dto.notes ?? null,
                        asiCreatedBy: caller.actorName,
                    },
                    select: { asiId: true },
                });
                await tx.accSettlementLine.createMany({
                    data: g.lines.map((l, i) => ({
                        aslAccYear: accYear,
                        aslImportId: head.asiId,
                        aslRowNo: i + 1,
                        aslKind: l.kind,
                        aslTxnOn: l.txnOn,
                        aslTerminalId: l.terminalId,
                        aslVpa: l.vpa,
                        aslTenderId: tenderOf.get(l.lineNo) ?? tender.tndId,
                        aslRefNo: l.refNo,
                        aslAuthCode: l.authCode,
                        aslCardLast4: l.cardLast4,
                        aslPayer: l.payer,
                        aslGrossAmount: l.gross,
                        aslFeeAmount: l.fee,
                        aslTaxAmount: l.tax,
                        aslNetAmount: l.net,
                        aslRaw: { lineNo: l.lineNo, ...l.raw },
                    })),
                });
                await this.runMatch(tx, { asiId: head.asiId, accYear }, caller, settings);
                const after = await tx.accSettlementImport.findUniqueOrThrow({
                    where: { asiId_asiAccYear: { asiId: head.asiId, asiAccYear: accYear } },
                });
                await this.events.log(tx, {
                    companyId: dto.companyId,
                    branchId: dto.branchId,
                    accYear,
                    code: till_enum_1.TillEventCode.SETTLEMENT_IMPORTED,
                    deviceId: this.requestContext.getDeviceId() ?? null,
                    userId: caller.userId,
                    srcDocType: tender_settlement_enum_1.SETTLEMENT_SRC_DOC_TYPE,
                    srcDocId: head.asiId,
                    srcRefno: g.payoutRef,
                    amount: totals.net,
                    payload: {
                        provider: format.provider,
                        file: fileName,
                        lines: g.lines.length,
                        status: after.asiStatus,
                    },
                });
                created.push({ asiId: head.asiId, accYear });
            }
            return created;
        }, TX);
        const imports = [];
        for (const id of ids) {
            imports.push(await this.get({
                companyId: dto.companyId,
                branchId: dto.branchId,
                accYear: id.accYear,
                asiId: id.asiId,
            }));
        }
        return { imports };
    }
    async match(key) {
        const caller = await this.caller();
        const settings = await this.settings(key.companyId, key.branchId);
        await this.prisma.$transaction(async (tx) => {
            const head = await this.lockImport(tx, key);
            this.assertOpen(head);
            await this.runMatch(tx, { asiId: head.asiId, accYear: head.asiAccYear }, caller, settings);
        }, TX);
        return this.get(key);
    }
    async confirm(dto) {
        const caller = await this.caller();
        const key = await this.prisma.$transaction(async (tx) => {
            const { head, line } = await this.lockLine(tx, dto);
            this.assertOpen(head);
            if (!dto.tdId) {
                if (line.aslMatchStatus !== tender_settlement_enum_1.SettlementMatchStatus.SUGGESTED) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `Line ${line.aslRowNo} is ${line.aslMatchStatus}: only a SUGGESTED line is confirmed as it stands — name a tdId to link it by hand`, 'aslId');
                }
                await this.assertTdFree(tx, line, line.aslTdId, line.aslTdAccYear);
                await guardMatched(() => tx.accSettlementLine.update({
                    where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
                    data: {
                        aslMatchStatus: tender_settlement_enum_1.SettlementMatchStatus.MATCHED,
                        aslMatchedBy: caller.userId,
                        aslMatchedOn: new Date(),
                        aslModifiedOn: new Date(),
                    },
                }));
            }
            else {
                if (!(0, settlement_match_1.isCustomerKind)(line.aslKind)) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `Line ${line.aslRowNo} is a ${line.aslKind} line: it has no customer, so no tender row`, 'aslId');
                }
                if (line.aslMatchStatus !== tender_settlement_enum_1.SettlementMatchStatus.UNMATCHED &&
                    line.aslMatchStatus !== tender_settlement_enum_1.SettlementMatchStatus.SUGGESTED) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `Line ${line.aslRowNo} is ${line.aslMatchStatus}: unlink it first`, 'aslId');
                }
                const tdAccYear = dto.tdAccYear ?? line.aslAccYear;
                const td = await this.candidateRow(tx, head, line, dto.tdId, tdAccYear);
                await this.assertTdFree(tx, line, td.tdId, td.tdAccYear);
                await guardMatched(() => tx.accSettlementLine.update({
                    where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
                    data: {
                        aslMatchStatus: tender_settlement_enum_1.SettlementMatchStatus.MATCHED,
                        aslMatchRule: tender_settlement_enum_1.SettlementMatchRule.MANUAL,
                        aslTdId: td.tdId,
                        aslTdAccYear: td.tdAccYear,
                        aslAmountDiff: line.aslGrossAmount.minus(td.amount),
                        aslMatchedBy: caller.userId,
                        aslMatchedOn: new Date(),
                        aslModifiedOn: new Date(),
                    },
                }));
            }
            await this.refreshImport(tx, head);
            return this.keyOf(head);
        }, TX);
        return this.get(key);
    }
    async unlink(dto) {
        const key = await this.prisma.$transaction(async (tx) => {
            const { head, line } = await this.lockLine(tx, dto);
            this.assertOpen(head);
            if (line.aslMatchStatus !== tender_settlement_enum_1.SettlementMatchStatus.MATCHED &&
                line.aslMatchStatus !== tender_settlement_enum_1.SettlementMatchStatus.SUGGESTED &&
                line.aslMatchStatus !== tender_settlement_enum_1.SettlementMatchStatus.IGNORED) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `Line ${line.aslRowNo} is ${line.aslMatchStatus}: nothing to unlink`, 'aslId');
            }
            await tx.accSettlementLine.update({
                where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
                data: this.unmatchedData(),
            });
            await this.refreshImport(tx, head);
            return this.keyOf(head);
        }, TX);
        return this.get(key);
    }
    async ignore(dto) {
        const key = await this.prisma.$transaction(async (tx) => {
            const { head, line } = await this.lockLine(tx, dto);
            this.assertOpen(head);
            if (line.aslMatchStatus === tender_settlement_enum_1.SettlementMatchStatus.IGNORED) {
                return this.keyOf(head);
            }
            await tx.accSettlementLine.update({
                where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
                data: {
                    ...this.unmatchedData(),
                    aslMatchStatus: tender_settlement_enum_1.SettlementMatchStatus.IGNORED,
                    aslNotes: dto.notes,
                },
            });
            await this.refreshImport(tx, head);
            return this.keyOf(head);
        }, TX);
        return this.get(key);
    }
    async post(key) {
        const caller = await this.caller();
        await this.prisma.$transaction(async (tx) => {
            const head = await this.lockImport(tx, key);
            this.assertOpen(head);
            await (0, receipt_guards_1.assertAccYearWritable)(tx, head.asiCompanyId, head.asiAccYear, 'accYear');
            await (0, receipt_guards_1.assertVoucherPartitionExists)(tx, head.asiAccYear, 'accYear');
            const lines = await tx.accSettlementLine.findMany({
                where: { aslImportId: head.asiId, aslAccYear: head.asiAccYear },
                orderBy: { aslRowNo: 'asc' },
            });
            const suggested = lines.filter((l) => l.aslMatchStatus === tender_settlement_enum_1.SettlementMatchStatus.SUGGESTED);
            if (suggested.length > 0) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.SUGGESTIONS_OPEN, `${suggested.length} suggested match(es) wait for a person: confirm or unlink them first`, 'asiId', { rows: suggested.map((l) => l.aslRowNo) });
            }
            const live = lines.filter((l) => l.aslMatchStatus !== tender_settlement_enum_1.SettlementMatchStatus.IGNORED);
            const matched = live.filter((l) => l.aslMatchStatus === tender_settlement_enum_1.SettlementMatchStatus.MATCHED);
            const rows = await this.rowsOf(tx, matched.map((l) => ({ tdId: l.aslTdId, tdAccYear: l.aslTdAccYear })));
            for (const l of matched) {
                const row = rows.get(l.aslTdId);
                if (!row ||
                    row.isVoided ||
                    row.isDeleted ||
                    !(0, settlement_match_1.kindTakes)(l.aslKind, row)) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.TD_NOT_CANDIDATE, `Line ${l.aslRowNo}: its tender row is ${row ? (row.isVoided ? 'voided' : row.settleStatus) : 'gone'} — unlink and match it again`, 'asiId', { rowNo: l.aslRowNo, tdId: l.aslTdId });
                }
                await this.assertTdFree(tx, l, l.aslTdId, l.aslTdAccYear);
            }
            const parked = await this.parkedRows(tx, [...rows.keys()]);
            const suspense = await this.roleLedger(tx, tender_settlement_enum_1.SettlementRole.TENDER_SUSPENSE, head);
            const book = new LegBook();
            const net = new client_1.Prisma.Decimal(head.asiTotalNet);
            book.add(head.asiBankLedgerId, net.gte(0) ? 'DR' : 'CR', net.abs(), null);
            const fee = new client_1.Prisma.Decimal(head.asiTotalFee);
            const tax = new client_1.Prisma.Decimal(head.asiTotalTax);
            if (fee.gt(0)) {
                book.add(await this.roleLedger(tx, tender_settlement_enum_1.SettlementRole.BANK_CHARGES, head), 'DR', fee, tender_settlement_enum_1.SettlementRole.BANK_CHARGES);
            }
            if (tax.gt(0)) {
                book.add(await this.roleLedger(tx, tender_settlement_enum_1.SettlementRole.GST_ON_CHARGES_PENDING, head), 'DR', tax, tender_settlement_enum_1.SettlementRole.GST_ON_CHARGES_PENDING);
            }
            for (const l of live) {
                const gross = new client_1.Prisma.Decimal(l.aslGrossAmount);
                const hit = l.aslMatchStatus === tender_settlement_enum_1.SettlementMatchStatus.MATCHED && l.aslTdId
                    ? rows.get(l.aslTdId)
                    : undefined;
                switch (l.aslKind) {
                    case tender_settlement_enum_1.SettlementLineKind.SALE: {
                        const own = hit && !parked.has(hit.tdId) ? hit.ledgerId : null;
                        book.add(own ?? suspense, 'CR', gross, own ? null : tender_settlement_enum_1.SettlementRole.TENDER_SUSPENSE);
                        break;
                    }
                    case tender_settlement_enum_1.SettlementLineKind.REFUND:
                        book.add(hit ? hit.ledgerId : suspense, 'DR', gross, hit ? null : tender_settlement_enum_1.SettlementRole.TENDER_SUSPENSE);
                        break;
                    case tender_settlement_enum_1.SettlementLineKind.CHARGEBACK:
                        book.add(suspense, 'DR', gross, tender_settlement_enum_1.SettlementRole.TENDER_SUSPENSE);
                        break;
                    case tender_settlement_enum_1.SettlementLineKind.ADJUSTMENT:
                        book.add(suspense, 'CR', gross, tender_settlement_enum_1.SettlementRole.TENDER_SUSPENSE);
                        break;
                    case tender_settlement_enum_1.SettlementLineKind.FEE:
                        if (gross.gt(0))
                            book.add(suspense, 'CR', gross, tender_settlement_enum_1.SettlementRole.TENDER_SUSPENSE);
                        break;
                }
            }
            const legs = book.legs();
            const dr = legs.filter((g) => g.drCr === 'DR').reduce((s, g) => s.plus(g.amount), ZERO);
            const cr = legs.filter((g) => g.drCr === 'CR').reduce((s, g) => s.plus(g.amount), ZERO);
            if (!dr.equals(cr) || legs.length === 0) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.NOT_BALANCED, `The payout does not balance (Dr ${dr.toFixed(2)}, Cr ${cr.toFixed(2)}): its lines and totals disagree`, 'asiId');
            }
            const payoutDate = iso(head.asiPayoutDate);
            const voucher = await this.posting.postLegs(tx, {
                header: {
                    companyId: head.asiCompanyId,
                    branchId: head.asiBranchId,
                    tenantId: head.asiTenantId,
                    accYear: head.asiAccYear,
                    voucherTypeId: await this.voucherTypeId(tx, tender_settlement_enum_1.SETTLEMENT_VOUCHER_TYPE_CODE),
                    voucherDate: payoutDate,
                    srcModule: tender_settlement_enum_1.SETTLEMENT_SRC_MODULE,
                    srcDocType: tender_settlement_enum_1.SETTLEMENT_SRC_DOC_TYPE,
                    srcDocId: head.asiId,
                    docLabel: 'Tender settlement',
                    docRefno: head.asiPayoutRef,
                    docDate: payoutDate,
                    docAmount: num(net.abs()),
                    partyId: null,
                    userId: caller.userId,
                    deviceId: this.requestContext.getDeviceId() ?? null,
                    remarks: `${head.asiProvider} payout ${head.asiPayoutRef ?? payoutDate} · ${live.length} line(s)`,
                    createdBy: caller.actorName,
                },
                legs: legs.map((g) => ({
                    ledgerId: g.ledgerId,
                    drCr: g.drCr,
                    amount: num(g.amount),
                    roleTag: g.role,
                    remarks: g.role ?? null,
                })),
            });
            for (const l of matched) {
                const row = rows.get(l.aslTdId);
                const kind = l.aslKind;
                if (kind === tender_settlement_enum_1.SettlementLineKind.CHARGEBACK) {
                    await tx.$executeRaw `
            UPDATE accounts.acc_tender_detail
               SET td_settle_status = 'FAILED', td_modified_on = now(), td_modified_by = ${caller.actorName}
             WHERE td_id = ${row.tdId}::uuid AND td_acc_year = ${row.tdAccYear}::char(9)`;
                    continue;
                }
                const exact = new client_1.Prisma.Decimal(l.aslAmountDiff).isZero();
                const charges = new client_1.Prisma.Decimal(l.aslFeeAmount).plus(l.aslTaxAmount);
                const mdr = kind === tender_settlement_enum_1.SettlementLineKind.SALE &&
                    tender_settlement_enum_1.MDR_FROM_STATEMENT_DOC_TYPES.includes(row.srcDocType) &&
                    charges.gte(0)
                    ? charges
                    : null;
                await tx.$executeRaw `
          UPDATE accounts.acc_tender_detail
             SET td_settle_status     = ${exact ? 'SETTLED' : 'PARTIAL'},
                 td_settled_on        = ${payoutDate}::date,
                 td_settle_amount     = ${new client_1.Prisma.Decimal(l.aslGrossAmount)}::numeric,
                 td_settle_ref_no     = ${(head.asiPayoutRef ?? head.asiFileName).slice(0, 60)},
                 td_settle_voucher_id = ${voucher.voucherId}::uuid,
                 td_mdr_amt           = COALESCE(${mdr}::numeric, td_mdr_amt),
                 td_modified_on       = now(),
                 td_modified_by       = ${caller.actorName}
           WHERE td_id = ${row.tdId}::uuid AND td_acc_year = ${row.tdAccYear}::char(9)`;
            }
            await tx.accSettlementImport.update({
                where: { asiId_asiAccYear: { asiId: head.asiId, asiAccYear: head.asiAccYear } },
                data: {
                    asiStatus: tender_settlement_enum_1.SettlementImportStatus.POSTED,
                    asiVoucherId: voucher.voucherId,
                    asiVoucherAccYear: head.asiAccYear,
                    asiPostedBy: caller.userId,
                    asiPostedOn: new Date(),
                    asiModifiedOn: new Date(),
                    asiModifiedBy: caller.actorName,
                },
            });
            await this.events.log(tx, {
                companyId: head.asiCompanyId,
                branchId: head.asiBranchId,
                accYear: head.asiAccYear,
                code: till_enum_1.TillEventCode.SETTLEMENT_POSTED,
                deviceId: this.requestContext.getDeviceId() ?? null,
                userId: caller.userId,
                srcDocType: tender_settlement_enum_1.SETTLEMENT_SRC_DOC_TYPE,
                srcDocId: head.asiId,
                srcRefno: voucher.voucherRefno,
                amount: net,
                payload: {
                    voucherId: voucher.voucherId,
                    matched: matched.length,
                    unmatched: live.filter((l) => l.aslMatchStatus === tender_settlement_enum_1.SettlementMatchStatus.UNMATCHED).length,
                },
            });
        }, TX);
        const payload = await this.get(key);
        return { ...payload, legs: await this.legsOf(payload.voucherId, key.accYear) };
    }
    async void(dto) {
        const caller = await this.caller();
        await this.prisma.$transaction(async (tx) => {
            const head = await this.lockImport(tx, dto);
            if (head.asiStatus === tender_settlement_enum_1.SettlementImportStatus.VOIDED) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, 'This import is already VOIDED', 'asiId');
            }
            if (head.asiStatus === tender_settlement_enum_1.SettlementImportStatus.POSTED) {
                const resolved = await tx.accSettlementLine.count({
                    where: {
                        aslImportId: head.asiId,
                        aslAccYear: head.asiAccYear,
                        aslMatchStatus: tender_settlement_enum_1.SettlementMatchStatus.RESOLVED,
                    },
                });
                const movedOn = await tx.$queryRaw `
          SELECT count(*)::int AS n
            FROM accounts.acc_settlement_line l
            JOIN accounts.acc_tender_detail t
              ON t.td_id = l.asl_td_id AND t.td_acc_year = l.asl_td_acc_year
           WHERE l.asl_import_id = ${head.asiId}::uuid AND l.asl_acc_year = ${head.asiAccYear}::char(9)
             AND l.asl_match_status = 'MATCHED'
             AND (   (l.asl_kind <> 'CHARGEBACK' AND t.td_settle_voucher_id IS DISTINCT FROM ${head.asiVoucherId}::uuid)
                  OR (l.asl_kind = 'CHARGEBACK' AND EXISTS (
                        SELECT 1 FROM accounts.acc_voucher_header w
                         WHERE w.avh_voucher_id = t.td_settle_voucher_id
                           AND w.avh_src_doc_type = 'NONCASH_WRITE_OFF')))`;
                if (resolved > 0 || movedOn[0].n > 0) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.POSTED_LOCKED, 'Lines of this payout were resolved or written off since it was posted: undo those first', 'asiId', { resolved, rowsMovedOn: movedOn[0].n });
                }
                const mirror = await this.posting.reverseLegs(tx, head.asiVoucherId, head.asiVoucherAccYear, dto.reason, caller.actorName);
                if (!mirror) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, 'The payout’s voucher is not live', 'asiId');
                }
                await tx.$executeRaw `
          UPDATE accounts.acc_tender_detail
             SET td_settle_status = 'PENDING', td_settled_on = NULL, td_settle_amount = NULL,
                 td_settle_ref_no = NULL, td_settle_voucher_id = NULL,
                 td_mdr_amt = CASE WHEN td_src_doc_type = ANY(${[...tender_settlement_enum_1.MDR_FROM_STATEMENT_DOC_TYPES]}::text[])
                                   THEN 0 ELSE td_mdr_amt END,
                 td_modified_on = now(), td_modified_by = ${caller.actorName}
           WHERE td_settle_voucher_id = ${head.asiVoucherId}::uuid`;
                await tx.$executeRaw `
          UPDATE accounts.acc_tender_detail t
             SET td_settle_status = 'SETTLED', td_modified_on = now(), td_modified_by = ${caller.actorName}
            FROM accounts.acc_settlement_line l
           WHERE l.asl_import_id = ${head.asiId}::uuid AND l.asl_acc_year = ${head.asiAccYear}::char(9)
             AND l.asl_kind = 'CHARGEBACK' AND l.asl_match_status = 'MATCHED'
             AND t.td_id = l.asl_td_id AND t.td_acc_year = l.asl_td_acc_year
             AND t.td_settle_status = 'FAILED'`;
            }
            await tx.$executeRaw `
        UPDATE accounts.acc_settlement_line
           SET asl_notes = left(concat_ws(' · ', asl_notes,
                 'voided: was ' || asl_match_status || ' ' || COALESCE(asl_match_rule, '') || ' to ' || asl_td_id::text), 500),
               asl_match_status = 'UNMATCHED', asl_match_rule = NULL, asl_td_id = NULL, asl_td_acc_year = NULL,
               asl_amount_diff = 0, asl_matched_by = NULL, asl_matched_on = NULL, asl_modified_on = now()
         WHERE asl_import_id = ${head.asiId}::uuid AND asl_acc_year = ${head.asiAccYear}::char(9)
           AND asl_match_status IN ('MATCHED','SUGGESTED')`;
            await tx.accSettlementImport.update({
                where: { asiId_asiAccYear: { asiId: head.asiId, asiAccYear: head.asiAccYear } },
                data: {
                    asiStatus: tender_settlement_enum_1.SettlementImportStatus.VOIDED,
                    asiVoidReason: dto.reason,
                    asiPostedBy: null,
                    asiPostedOn: null,
                    asiModifiedOn: new Date(),
                    asiModifiedBy: caller.actorName,
                },
            });
        }, TX);
        return this.get(dto);
    }
    async get(key) {
        const head = await this.loadImport(this.prisma, key);
        const lines = await this.prisma.accSettlementLine.findMany({
            where: { aslImportId: head.asiId, aslAccYear: head.asiAccYear },
            orderBy: { aslRowNo: 'asc' },
        });
        const rows = await this.tenderRowPayloads(this.prisma, lines.filter((l) => l.aslTdId).map((l) => ({ tdId: l.aslTdId, tdAccYear: l.aslTdAccYear })));
        const extras = await this.prisma.$queryRaw `
      SELECT (SELECT led_name FROM accounts.acc_ledger_master WHERE led_id = ${head.asiBankLedgerId}::uuid) AS bank,
             (SELECT avh_voucher_refno FROM accounts.acc_voucher_header
               WHERE avh_voucher_id = ${head.asiVoucherId}::uuid
                 AND avh_acc_year = ${head.asiVoucherAccYear}::char(9)) AS refno`;
        return {
            ...this.importPayload(head, lines, extras[0]),
            lines: lines.map((l) => this.linePayload(l, l.aslTdId ? (rows.get(l.aslTdId) ?? null) : null)),
        };
    }
    async linePayloadOf(tx, line) {
        const rows = line.aslTdId
            ? await this.tenderRowPayloads(tx, [{ tdId: line.aslTdId, tdAccYear: line.aslTdAccYear }])
            : new Map();
        return this.linePayload(line, line.aslTdId ? (rows.get(line.aslTdId) ?? null) : null);
    }
    async legsOf(voucherId, accYear) {
        if (!voucherId || !accYear)
            return [];
        const legs = await this.prisma.$queryRaw `
      SELECT trim(v.av_dr_cr) AS dr_cr, v.av_ledger_id::text AS ledger_id, l.led_name, v.av_role, v.av_amount AS amount
        FROM accounts.acc_vouchers v
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = v.av_ledger_id
       WHERE v.av_voucher_id = ${voucherId}::uuid AND v.av_acc_year = ${accYear}::char(9)
         AND v.av_is_deleted = false
       ORDER BY v.av_row_no`;
        return legs.map((g) => ({
            drCr: g.dr_cr,
            ledgerId: g.ledger_id,
            ledgerName: g.led_name,
            role: g.av_role,
            amount: num(g.amount),
        }));
    }
    async caller(client = this.prisma) {
        const userId = this.requestContext.getUserId() ?? module_shared_utils_1.DEFAULT_ACTOR;
        const user = await client.userMaster.findUnique({
            where: { usrId: userId },
            select: { usrLoginName: true },
        });
        return { userId, actorName: (user?.usrLoginName ?? userId).slice(0, 50) };
    }
    async settings(companyId, branchId) {
        return (0, tender_settlement_settings_1.readTenderSettings)(await this.appSettings.resolveEffective({
            companyId,
            branchId,
            deviceId: null,
            userId: null,
        }));
    }
    async roleLedger(tx, role, scope) {
        const resolved = await (0, ledger_map_helper_1.resolveRoleLedgers)(tx, [{ role }], {
            companyId: scope.asiCompanyId,
            branchId: scope.asiBranchId,
            where: 'tender settlement',
        });
        const hit = [...resolved.values()][0];
        if (!hit) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.LEDGER_UNMAPPED, `The role ${role} has no ledger. Map it on the Ledger Map screen (menu 250).`, 'role', { role });
        }
        return hit.ledgerId;
    }
    async voucherTypeId(tx, code) {
        const type = await tx.accVoucherType.findFirst({
            where: { vchrTypeCode: code, vchrIsActive: true },
            select: { vchrTypeId: true },
        });
        if (!type) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `Voucher type ${code} is missing or inactive (migration 20261008130000 creates TSet)`, 'voucherType');
        }
        return type.vchrTypeId;
    }
    async loadImport(client, key) {
        const head = await client.accSettlementImport.findFirst({
            where: { asiId: key.asiId, asiAccYear: key.accYear, asiIsDeleted: false },
        });
        if (!head || head.asiCompanyId !== key.companyId || head.asiBranchId !== key.branchId) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.NOT_FOUND, `No settlement import ${key.asiId} in ${key.accYear} for this branch`, 'asiId');
        }
        return head;
    }
    async lockLine(tx, key) {
        const line = await tx.accSettlementLine.findFirst({
            where: { aslId: key.aslId, aslAccYear: key.accYear },
        });
        if (!line) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.NOT_FOUND, `No statement line ${key.aslId} in ${key.accYear}`, 'aslId');
        }
        const head = await this.lockImport(tx, {
            companyId: key.companyId,
            branchId: key.branchId,
            accYear: line.aslAccYear,
            asiId: line.aslImportId,
        });
        await tx.$queryRaw `
      SELECT asl_id FROM accounts.acc_settlement_line
       WHERE asl_id = ${line.aslId}::uuid AND asl_acc_year = ${line.aslAccYear}::char(9) FOR UPDATE`;
        const fresh = await tx.accSettlementLine.findUniqueOrThrow({
            where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
        });
        return { head, line: fresh };
    }
    async candidateRow(tx, head, line, tdId, tdAccYear) {
        const rows = await this.rowsOf(tx, [{ tdId, tdAccYear }]);
        const row = rows.get(tdId);
        const refuse = (why) => (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.TD_NOT_CANDIDATE, `Tender row ${tdId} cannot take line ${line.aslRowNo}: ${why}`, 'tdId');
        if (!row || row.companyId !== head.asiCompanyId || row.branchId !== head.asiBranchId) {
            return refuse('it is not a tender row of this store');
        }
        if (row.isDeleted || row.isVoided) {
            return refuse('it is voided or deleted');
        }
        if (row.tenderId !== line.aslTenderId) {
            return refuse('it is on another tender (terminal / VPA) than the line');
        }
        if (!(0, settlement_match_1.kindTakes)(line.aslKind, row)) {
            return refuse(`a ${line.aslKind} line takes ${line.aslKind === 'REFUND' ? 'a money-out' : 'a money-in'} row that is ${line.aslKind === 'CHARGEBACK' ? 'SETTLED' : 'PENDING or PARTIAL'}; this one is ${row.drCr} ${row.settleStatus}`);
        }
        return row;
    }
    async assertTdFree(tx, line, tdId, tdAccYear) {
        const [held] = await tx.$queryRaw `
      SELECT i.asi_payout_date, l.asl_row_no
        FROM accounts.acc_settlement_line l
        JOIN accounts.acc_settlement_import i
          ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
       WHERE l.asl_td_id = ${tdId}::uuid AND l.asl_td_acc_year = ${tdAccYear}::char(9)
         AND l.asl_kind = ${line.aslKind}
         AND l.asl_id <> ${line.aslId}::uuid
         AND i.asi_is_deleted = false AND i.asi_status <> 'VOIDED'
         AND (l.asl_match_status IN ('MATCHED','SUGGESTED')
              OR (l.asl_match_status = 'RESOLVED' AND l.asl_resolution = 'LINKED'))
       LIMIT 1`;
        if (held) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.TD_ALREADY_MATCHED, `That tender row is already settled by line ${held.asl_row_no} of the payout of ${iso(held.asi_payout_date)}`, 'tdId');
        }
    }
    async parkedRows(tx, tdIds) {
        if (tdIds.length === 0)
            return new Set();
        const rows = await tx.$queryRaw `
      SELECT DISTINCT r->>'td_id' AS td_id
        FROM accounts.till_variance v, jsonb_array_elements(v.tvr_rows) r
       WHERE v.tvr_rows IS NOT NULL AND v.tvr_is_deleted = false
         AND v.tvr_treatment = 'SUSPENSE' AND v.tvr_status = 'POSTED'
         AND r->>'td_id' = ANY(${tdIds}::text[])`;
        return new Set(rows.map((r) => r.td_id));
    }
    async rowsOf(tx, keys) {
        if (keys.length === 0)
            return new Map();
        const rows = await tx.$queryRaw `
      SELECT t.td_id::text, t.td_acc_year, t.td_company_id::text, t.td_branch_id::text, t.td_tender_id::text,
             t.td_tender_type_id, trim(t.td_dr_cr) AS dr_cr, t.td_settle_status, t.td_total_amt,
             t.td_settle_amount, COALESCE(t.td_settle_ledger_id, t.td_tender_ledger_id)::text AS ledger_id,
             t.td_session_id::text, t.td_src_doc_type, t.td_src_doc_id::text, t.td_settle_voucher_id::text,
             t.td_is_voided, t.td_is_deleted
        FROM accounts.acc_tender_detail t
       WHERE (t.td_id, t.td_acc_year) IN (
               SELECT k.id::uuid, k.yr::char(9)
                 FROM unnest(${keys.map((k) => k.tdId)}::text[], ${keys.map((k) => k.tdAccYear)}::text[]) AS k(id, yr))`;
        return new Map(rows.map((r) => [
            r.td_id,
            {
                tdId: r.td_id,
                tdAccYear: r.td_acc_year,
                companyId: r.td_company_id,
                branchId: r.td_branch_id,
                tenderId: r.td_tender_id,
                tenderTypeId: r.td_tender_type_id,
                drCr: r.dr_cr,
                settleStatus: r.td_settle_status,
                amount: new client_1.Prisma.Decimal(r.td_total_amt),
                settleAmount: r.td_settle_amount === null ? null : new client_1.Prisma.Decimal(r.td_settle_amount),
                ledgerId: r.ledger_id,
                sessionId: r.td_session_id,
                srcDocType: r.td_src_doc_type,
                srcDocId: r.td_src_doc_id,
                settleVoucherId: r.td_settle_voucher_id,
                isVoided: r.td_is_voided,
                isDeleted: r.td_is_deleted,
            },
        ]));
    }
    async refreshImport(tx, head) {
        const lines = await tx.accSettlementLine.findMany({
            where: { aslImportId: head.asiId, aslAccYear: head.asiAccYear },
        });
        const live = lines.filter((l) => l.aslMatchStatus !== tender_settlement_enum_1.SettlementMatchStatus.IGNORED);
        const totals = signedTotals(live.map((l) => ({
            kind: l.aslKind,
            gross: new client_1.Prisma.Decimal(l.aslGrossAmount),
            fee: new client_1.Prisma.Decimal(l.aslFeeAmount),
            tax: new client_1.Prisma.Decimal(l.aslTaxAmount),
        })));
        const waiting = live.some((l) => (0, settlement_match_1.isCustomerKind)(l.aslKind) &&
            (l.aslMatchStatus === tender_settlement_enum_1.SettlementMatchStatus.UNMATCHED ||
                l.aslMatchStatus === tender_settlement_enum_1.SettlementMatchStatus.SUGGESTED));
        const status = head.asiStatus === tender_settlement_enum_1.SettlementImportStatus.POSTED
            ? tender_settlement_enum_1.SettlementImportStatus.POSTED
            : waiting
                ? tender_settlement_enum_1.SettlementImportStatus.IMPORTED
                : tender_settlement_enum_1.SettlementImportStatus.MATCHED;
        await tx.accSettlementImport.update({
            where: { asiId_asiAccYear: { asiId: head.asiId, asiAccYear: head.asiAccYear } },
            data: {
                asiStatus: status,
                ...(head.asiStatus === tender_settlement_enum_1.SettlementImportStatus.POSTED
                    ? {}
                    : {
                        asiLineCount: live.length,
                        asiTotalGross: totals.gross,
                        asiTotalFee: totals.fee,
                        asiTotalTax: totals.tax,
                        asiTotalNet: totals.net,
                    }),
                asiModifiedOn: new Date(),
            },
        });
    }
    async runMatch(tx, key, caller, settings) {
        const head = await tx.accSettlementImport.findUniqueOrThrow({
            where: { asiId_asiAccYear: { asiId: key.asiId, asiAccYear: key.accYear } },
        });
        const all = await tx.accSettlementLine.findMany({
            where: { aslImportId: key.asiId, aslAccYear: key.accYear },
            orderBy: { aslRowNo: 'asc' },
        });
        const judged = all.filter((l) => (0, settlement_match_1.isCustomerKind)(l.aslKind) &&
            (l.aslMatchStatus === tender_settlement_enum_1.SettlementMatchStatus.UNMATCHED ||
                l.aslMatchStatus === tender_settlement_enum_1.SettlementMatchStatus.SUGGESTED));
        if (judged.length > 0) {
            const payout = iso(head.asiPayoutDate);
            const days = [
                payout,
                ...judged.map((l) => (l.aslTxnOn ? (0, settlement_format_1.istDate)(l.aslTxnOn) : payout)),
            ].sort();
            const from = shiftDays(days[0], -CANDIDATE_DAYS_BACK);
            const to = shiftDays(days[days.length - 1], 1);
            const years = [...new Set([(0, voucher_derive_1.accYearOfDate)(from), (0, voucher_derive_1.accYearOfDate)(to)])];
            const tenders = [
                ...new Set(judged.map((l) => l.aslTenderId).filter((t) => !!t)),
            ];
            const found = await tx.$queryRaw `
        SELECT t.td_id::text, t.td_acc_year, t.td_tender_id::text, trim(t.td_dr_cr) AS dr_cr,
               t.td_settle_status, t.td_ref_no, t.td_auth_code, t.td_card_last4, t.td_total_amt,
               t.td_doc_date, t.td_created_on
          FROM accounts.acc_tender_detail t
         WHERE t.td_company_id = ${head.asiCompanyId}::uuid
           AND t.td_branch_id  = ${head.asiBranchId}::uuid
           AND t.td_tender_id  = ANY(${tenders}::uuid[])
           AND t.td_acc_year   = ANY(${years}::text[])
           AND t.td_doc_date BETWEEN ${from}::date AND ${to}::date
           AND t.td_is_deleted = false AND t.td_is_voided = false
           AND t.td_settle_status IN ('PENDING','PARTIAL','SETTLED')`;
            const candidates = found.map((r) => ({
                tdId: r.td_id,
                tdAccYear: r.td_acc_year,
                tenderId: r.td_tender_id,
                drCr: r.dr_cr,
                settleStatus: r.td_settle_status,
                refNo: r.td_ref_no,
                authCode: r.td_auth_code,
                cardLast4: r.td_card_last4,
                amount: new client_1.Prisma.Decimal(r.td_total_amt),
                docDate: iso(r.td_doc_date),
                createdOn: r.td_created_on,
            }));
            const taken = await tx.$queryRaw `
        SELECT l.asl_kind, l.asl_td_id::text AS td_id
          FROM accounts.acc_settlement_line l
          JOIN accounts.acc_settlement_import i
            ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
         WHERE l.asl_td_id = ANY(${candidates.map((c) => c.tdId)}::uuid[])
           AND i.asi_is_deleted = false AND i.asi_status <> 'VOIDED'
           AND (l.asl_match_status IN ('MATCHED','SUGGESTED')
                OR (l.asl_match_status = 'RESOLVED' AND l.asl_resolution = 'LINKED'))
           AND l.asl_id <> ALL(${judged.map((l) => l.aslId)}::uuid[])`;
            const verdicts = (0, settlement_match_1.matchLines)(judged.map((l) => ({
                aslId: l.aslId,
                kind: l.aslKind,
                tenderId: l.aslTenderId,
                refNo: l.aslRefNo,
                authCode: l.aslAuthCode,
                cardLast4: l.aslCardLast4,
                gross: new client_1.Prisma.Decimal(l.aslGrossAmount),
                txnOn: l.aslTxnOn,
            })), candidates, {
                tolerance: settings.matchAmountTolerance,
                windowMinutes: settings.matchWindowMinutes,
                taken: new Set(taken.map((t) => `${t.asl_kind}|${t.td_id}`)),
            });
            const now = new Date();
            for (const v of verdicts) {
                await guardMatched(() => tx.accSettlementLine.update({
                    where: { aslId_aslAccYear: { aslId: v.aslId, aslAccYear: key.accYear } },
                    data: v.status === tender_settlement_enum_1.SettlementMatchStatus.UNMATCHED
                        ? this.unmatchedData()
                        : {
                            aslMatchStatus: v.status,
                            aslMatchRule: v.rule,
                            aslTdId: v.tdId,
                            aslTdAccYear: v.tdAccYear,
                            aslAmountDiff: v.diff,
                            aslMatchedBy: v.status === tender_settlement_enum_1.SettlementMatchStatus.MATCHED ? caller.userId : null,
                            aslMatchedOn: v.status === tender_settlement_enum_1.SettlementMatchStatus.MATCHED ? now : null,
                            aslModifiedOn: now,
                        },
                }));
            }
        }
        await this.refreshImport(tx, head);
    }
    async lineTenders(tx, dto, tender, lines) {
        const all = await tx.accTenderMaster.findMany({
            where: { tndCompanyId: dto.companyId, tndIsDeleted: false },
            select: {
                tndId: true,
                tndName: true,
                tndBranchId: true,
                tndTerminalId: true,
                tndUpiVpa: true,
            },
        });
        const byTerminal = new Map(all.filter((t) => t.tndTerminalId).map((t) => [t.tndTerminalId.trim().toUpperCase(), t]));
        const byVpa = new Map(all.filter((t) => t.tndUpiVpa).map((t) => [t.tndUpiVpa.trim().toLowerCase(), t]));
        const out = new Map();
        const unknown = [];
        const elsewhere = [];
        const unsplit = !tender.tndTerminalId && !tender.tndUpiVpa;
        for (const line of lines) {
            const hit = (line.terminalId ? byTerminal.get(line.terminalId.trim().toUpperCase()) : undefined) ??
                (line.vpa ? byVpa.get(line.vpa.trim().toLowerCase()) : undefined);
            if (!hit) {
                if ((line.terminalId || line.vpa) && !unsplit) {
                    unknown.push(`line ${line.lineNo}: ${line.terminalId ?? line.vpa}`);
                }
                out.set(line.lineNo, tender.tndId);
                continue;
            }
            if (hit.tndBranchId && hit.tndBranchId !== dto.branchId) {
                elsewhere.push(`line ${line.lineNo}: ${hit.tndName}`);
            }
            out.set(line.lineNo, hit.tndId);
        }
        if (unknown.length > 0) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.TERMINAL_UNKNOWN, `${unknown.length} line(s) name a terminal / VPA no tender of this company carries (${unknown.slice(0, 5).join('; ')})`, 'file');
        }
        if (elsewhere.length > 0) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.OTHER_STORE, `${elsewhere.length} line(s) are another store's terminal (${elsewhere.slice(0, 5).join('; ')}): import each store's part at that store`, 'file');
        }
        return out;
    }
    async loadTender(client, companyId, branchId, tenderId) {
        const tender = await client.accTenderMaster.findFirst({
            where: { tndId: tenderId, tndCompanyId: companyId, tndIsDeleted: false },
            select: {
                tndId: true,
                tndName: true,
                tndTypeId: true,
                tndBranchId: true,
                tndTerminalId: true,
                tndUpiVpa: true,
                tndSettlementLedgerId: true,
                tndSettlementDays: true,
                tndStatementFormat: true,
            },
        });
        if (!tender) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.NOT_FOUND, `No tender ${tenderId} in this company`, 'tenderId');
        }
        if (tender.tndTypeId === CASH_TENDER_TYPE_ID) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, 'Cash has no provider statement: it is counted at the till', 'tenderId');
        }
        if (branchId && tender.tndBranchId && tender.tndBranchId !== branchId) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.OTHER_STORE, `${tender.tndName} belongs to another store: import its file there`, 'tenderId');
        }
        return tender;
    }
    requireFormat(tender) {
        if (!tender.tndStatementFormat) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.FORMAT_MISSING, `${tender.tndName} has no statement format: set its column map first (POST /tender-settlement/format)`, 'tenderId');
        }
        const checked = (0, settlement_format_1.validateStatementFormat)(tender.tndStatementFormat);
        if (!checked.format) {
            (0, tender_settlement_errors_1.throwSettlementDetails)(tender_settlement_enum_1.SettlementErrorCode.FORMAT_INVALID, `${tender.tndName}'s statement format cannot be used`, checked.problems.map((message) => ({ field: 'format', message })));
        }
        return checked.format;
    }
    formatPayload(tender, format) {
        return {
            tenderId: tender.tndId,
            tenderName: tender.tndName,
            terminalId: tender.tndTerminalId,
            upiVpa: tender.tndUpiVpa,
            settlementLedgerId: tender.tndSettlementLedgerId,
            settlementDays: tender.tndSettlementDays,
            format,
        };
    }
    fileText(file) {
        if (!file?.buffer?.length) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.FILE_INVALID, 'Attach the statement CSV as the "file" part of the form', 'file');
        }
        if (file.buffer.length > tender_settlement_enum_1.IMPORT_MAX_BYTES) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.FILE_INVALID, `The file is over ${tender_settlement_enum_1.IMPORT_MAX_BYTES / 1024 / 1024} MB: split it`, 'file');
        }
        return file.buffer.toString('utf8');
    }
    async assertSettlementPartition(tx, accYear) {
        const name = `acc_settlement_line_${accYear.replace('-', '_')}`;
        const [row] = await tx.$queryRaw `
      SELECT to_regclass(${`accounts.${name}`}) IS NOT NULL AS ok`;
        if (!row?.ok) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `The year ${accYear} is not set up for settlements: run ensure_acc_year_partitions('${accYear}')`, 'payoutDate');
        }
    }
    async lockImport(tx, key) {
        await tx.$queryRaw `
      SELECT asi_id FROM accounts.acc_settlement_import
       WHERE asi_id = ${key.asiId}::uuid AND asi_acc_year = ${key.accYear}::char(9) FOR UPDATE`;
        return this.loadImport(tx, key);
    }
    assertOpen(head) {
        if (head.asiStatus !== tender_settlement_enum_1.SettlementImportStatus.IMPORTED &&
            head.asiStatus !== tender_settlement_enum_1.SettlementImportStatus.MATCHED) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `This payout is ${head.asiStatus}: lines are matched only before it is posted`, 'asiId');
        }
    }
    unmatchedData() {
        return {
            aslMatchStatus: tender_settlement_enum_1.SettlementMatchStatus.UNMATCHED,
            aslMatchRule: null,
            aslTdId: null,
            aslTdAccYear: null,
            aslAmountDiff: ZERO,
            aslMatchedBy: null,
            aslMatchedOn: null,
            aslModifiedOn: new Date(),
        };
    }
    keyOf(head) {
        return {
            companyId: head.asiCompanyId,
            branchId: head.asiBranchId,
            accYear: head.asiAccYear,
            asiId: head.asiId,
        };
    }
    async tenderRowPayloads(client, keys) {
        if (keys.length === 0)
            return new Map();
        const rows = await client.$queryRaw `
      SELECT t.td_id::text, t.td_acc_year, t.td_src_doc_type, t.td_src_doc_id::text,
             COALESCE(b.sb_bill_refno, h.avh_voucher_refno) AS refno,
             t.td_doc_date, t.td_total_amt, t.td_ref_no, t.td_auth_code, t.td_card_last4,
             t.td_settle_status, t.td_session_id::text, t.td_created_on
        FROM accounts.acc_tender_detail t
        LEFT JOIN sales.sale_bill b
               ON t.td_src_doc_type = 'SALE_BILL' AND b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
        LEFT JOIN accounts.acc_voucher_header h
               ON h.avh_voucher_id = t.td_src_doc_id AND h.avh_acc_year = t.td_acc_year
       WHERE (t.td_id, t.td_acc_year) IN (
               SELECT k.id::uuid, k.yr::char(9)
                 FROM unnest(${keys.map((k) => k.tdId)}::text[], ${keys.map((k) => k.tdAccYear)}::text[]) AS k(id, yr))`;
        return new Map(rows.map((r) => [
            r.td_id,
            {
                tdId: r.td_id,
                tdAccYear: r.td_acc_year,
                srcDocType: r.td_src_doc_type,
                srcDocId: r.td_src_doc_id,
                docRefno: r.refno,
                docDate: iso(r.td_doc_date),
                amount: num(r.td_total_amt),
                refNo: r.td_ref_no,
                authCode: r.td_auth_code,
                cardLast4: r.td_card_last4,
                settleStatus: r.td_settle_status,
                sessionId: r.td_session_id,
                createdOn: r.td_created_on.toISOString(),
            },
        ]));
    }
    importPayload(head, lines, extras) {
        const counts = Object.fromEntries(Object.values(tender_settlement_enum_1.SettlementMatchStatus).map((s) => [s, 0]));
        for (const l of lines) {
            if ((0, settlement_match_1.isCustomerKind)(l.aslKind)) {
                counts[l.aslMatchStatus] += 1;
            }
        }
        return {
            asiId: head.asiId,
            accYear: head.asiAccYear,
            companyId: head.asiCompanyId,
            branchId: head.asiBranchId,
            source: head.asiSource,
            provider: head.asiProvider,
            tenderId: head.asiTenderId,
            fileName: head.asiFileName,
            payoutRef: head.asiPayoutRef,
            payoutDate: iso(head.asiPayoutDate),
            periodFrom: head.asiPeriodFrom ? iso(head.asiPeriodFrom) : null,
            periodTo: head.asiPeriodTo ? iso(head.asiPeriodTo) : null,
            lineCount: head.asiLineCount,
            totalGross: num(head.asiTotalGross),
            totalFee: num(head.asiTotalFee),
            totalTax: num(head.asiTotalTax),
            totalNet: num(head.asiTotalNet),
            status: head.asiStatus,
            bankLedgerId: head.asiBankLedgerId,
            bankLedgerName: extras?.bank ?? null,
            voucherId: head.asiVoucherId,
            voucherRefno: extras?.refno ?? null,
            importedOn: head.asiImportedOn.toISOString(),
            postedOn: head.asiPostedOn?.toISOString() ?? null,
            voidReason: head.asiVoidReason,
            notes: head.asiNotes,
            counts,
        };
    }
    linePayload(l, row) {
        return {
            aslId: l.aslId,
            rowNo: l.aslRowNo,
            kind: l.aslKind,
            txnOn: l.aslTxnOn?.toISOString() ?? null,
            terminalId: l.aslTerminalId,
            vpa: l.aslVpa,
            tenderId: l.aslTenderId,
            refNo: l.aslRefNo,
            authCode: l.aslAuthCode,
            cardLast4: l.aslCardLast4,
            payer: l.aslPayer,
            gross: num(l.aslGrossAmount),
            fee: num(l.aslFeeAmount),
            tax: num(l.aslTaxAmount),
            net: num(l.aslNetAmount),
            matchStatus: l.aslMatchStatus,
            matchRule: l.aslMatchRule ?? null,
            amountDiff: num(l.aslAmountDiff),
            tenderRow: row,
            resolution: l.aslResolution ?? null,
            reasonId: l.aslReasonId,
            resolutionVoucherId: l.aslResolutionVoucherId,
            notes: l.aslNotes,
        };
    }
};
exports.TenderSettlementService = TenderSettlementService;
exports.TenderSettlementService = TenderSettlementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        voucher_posting_service_1.VoucherPostingService,
        app_setting_value_service_1.AppSettingValueService,
        till_event_service_1.TillEventService])
], TenderSettlementService);
function signedTotals(lines) {
    let gross = ZERO;
    let fee = ZERO;
    let tax = ZERO;
    for (const l of lines) {
        const out = l.kind === tender_settlement_enum_1.SettlementLineKind.REFUND || l.kind === tender_settlement_enum_1.SettlementLineKind.CHARGEBACK;
        gross = out ? gross.minus(l.gross) : gross.plus(l.gross);
        fee = fee.plus(l.fee);
        tax = tax.plus(l.tax);
    }
    return { gross, fee, tax, net: gross.minus(fee).minus(tax) };
}
class LegBook {
    byLedger = new Map();
    add(ledgerId, side, amount, role) {
        if (amount.isZero())
            return;
        const entry = this.byLedger.get(ledgerId) ?? { net: ZERO, role };
        entry.net = side === 'DR' ? entry.net.plus(amount) : entry.net.minus(amount);
        entry.role = entry.role ?? role;
        this.byLedger.set(ledgerId, entry);
    }
    legs() {
        const out = [];
        for (const [ledgerId, e] of this.byLedger) {
            if (e.net.isZero())
                continue;
            out.push({
                ledgerId,
                drCr: e.net.isNegative() ? 'CR' : 'DR',
                amount: e.net.abs(),
                role: e.role,
            });
        }
        return out.sort((a, b) => (a.drCr === b.drCr ? 0 : a.drCr === 'DR' ? -1 : 1));
    }
}
exports.LegBook = LegBook;
async function guardMatched(write) {
    try {
        return await write();
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.TD_ALREADY_MATCHED, 'That tender row is already settled by another statement line', 'tdId');
        }
        throw error;
    }
}
function shiftDays(date, days) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return iso(d);
}
//# sourceMappingURL=tender-settlement.service.js.map