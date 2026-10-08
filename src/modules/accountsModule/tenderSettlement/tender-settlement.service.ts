import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { VoucherPostingService } from 'src/common/posting/voucher-posting.service';
import type { VoucherLeg } from 'src/common/posting/voucher-leg.types';
import { DEFAULT_ACTOR } from 'src/common/utils/module-shared.utils';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { TillEventService } from '../../till/services/till-event.service';
import { TillEventCode } from '../../till/types/till-enum';
import { resolveRoleLedgers } from '../ledgerRole/ledger-map.helper';
import { assertAccYearWritable, assertVoucherPartitionExists } from '../receipt/receipt.guards';
import { accYearOfDate } from '../vouchers/voucher-derive';
import type {
  ConfirmSettlementLineDto,
  IgnoreSettlementLineDto,
  ImportSettlementDto,
  SaveSettlementFormatDto,
  SettlementKeyDto,
  SettlementLineKeyDto,
  VoidSettlementDto,
} from './dto/tender-settlement.dto';
import {
  groupByPayout,
  istDate,
  parseStatementCsv,
  validateStatementFormat,
  type ParsedStatementLine,
  type StatementFormat,
} from './settlement-format';
import { isCustomerKind, kindTakes, matchLines, type MatchCandidate } from './settlement-match';
import { throwSettlement, throwSettlementDetails } from './tender-settlement-errors';
import { readTenderSettings, type TenderSettings } from './tender-settlement.settings';
import type {
  SettlementFormatPayload,
  SettlementFormatTestPayload,
  SettlementImportPayload,
  SettlementImportResultPayload,
  SettlementLegPayload,
  SettlementLinePayload,
  SettlementPostPayload,
  SettlementTenderRowPayload,
} from './types/tender-settlement-api.types';
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_LINES,
  SETTLEMENT_SRC_DOC_TYPE,
  SETTLEMENT_SRC_MODULE,
  SETTLEMENT_VOUCHER_TYPE_CODE,
  SettlementErrorCode,
  SettlementImportStatus,
  SettlementLineKind,
  SettlementMatchRule,
  SettlementMatchStatus,
  SettlementRole,
  SettlementSource,
} from './types/tender-settlement-enum';

type Tx = Prisma.TransactionClient;
type Client = Tx | PrismaService;
type ImportRow = Prisma.AccSettlementImportGetPayload<object>;
type LineRow = Prisma.AccSettlementLineGetPayload<object>;

const ZERO = new Prisma.Decimal(0);
const TX = { maxWait: 15_000, timeout: 120_000 };
const CASH_TENDER_TYPE_ID = 1;
/** How far back from a statement a tender row is looked for. */
const CANDIDATE_DAYS_BACK = 60;
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const dateOnly = (s: string): Date => new Date(`${s}T00:00:00Z`);
const num = (d: Prisma.Decimal | number | null | undefined): number =>
  d === null || d === undefined ? 0 : Number(new Prisma.Decimal(d).toFixed(2));

export interface UploadedStatement {
  buffer: Buffer;
  originalname?: string;
}

export interface SettlementCaller {
  userId: string;
  actorName: string;
}

/**
 * Layer 3 of the non-cash plan (§5): a provider's statement — one payout = one
 * `acc_settlement_import`, one provider line = one `acc_settlement_line` — read
 * with the tender's column map, matched to OUR tender rows, posted as one TSet
 * per payout. The store server is the one writer of its tender rows (§5.1), so
 * everything here runs on the store's API.
 *
 * TSet (49 §8):
 *   Dr  bank (the tender's settlement ledger)       net      (Cr when negative)
 *   Dr  BANK_CHARGES                                 fee
 *   Dr  GST_ON_CHARGES_PENDING                       tax on the fee
 *   Dr  TENDER_SUSPENSE                              chargebacks + refunds no row explains
 *       Cr  each matched row's own ledger            matched sales − matched refunds
 *       Cr  TENDER_SUSPENSE                          sales no row explains + adjustments
 *                                                    (+ rows a close variance parked there)
 * A matched row gets SETTLED (PARTIAL when the provider paid a different
 * amount), the payout date, the gross, the payout ref and the voucher. The
 * provider's fee stays on the line: `td_mdr_amt` is a receipt's own
 * bank-charge split (receipt-lines rebuilds its BANK_CHARGES leg from it), so
 * writing the acquirer's fee there would double it on an amend.
 */
@Injectable()
export class TenderSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly posting: VoucherPostingService,
    private readonly appSettings: AppSettingValueService,
    private readonly events: TillEventService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  The column map (tnd_statement_format)
  // ═════════════════════════════════════════════════════════════════════════

  async getFormat(companyId: string, tenderId: string): Promise<SettlementFormatPayload> {
    const tender = await this.loadTender(this.prisma, companyId, null, tenderId);
    const stored = tender.tndStatementFormat
      ? validateStatementFormat(tender.tndStatementFormat).format
      : null;
    return this.formatPayload(tender, stored);
  }

  async saveFormat(dto: SaveSettlementFormatDto): Promise<SettlementFormatPayload> {
    const caller = await this.caller();
    const tender = await this.loadTender(this.prisma, dto.companyId, null, dto.tenderId);
    let format: StatementFormat | null = null;
    if (dto.format) {
      const checked = validateStatementFormat(dto.format);
      if (!checked.format) {
        throwSettlementDetails(
          SettlementErrorCode.FORMAT_INVALID,
          'The statement format cannot be used',
          checked.problems.map((message) => ({ field: 'format', message })),
        );
      }
      format = checked.format;
    }
    await this.prisma.accTenderMaster.update({
      where: { tndId: tender.tndId },
      data: {
        tndStatementFormat: format ? (format as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        tndModifiedOn: new Date(),
        tndModifiedBy: caller.actorName,
      },
    });
    return this.formatPayload(tender, format);
  }

  /** What the map makes of a sample file — the format editor's "test" button. Nothing is written. */
  async testFormat(
    companyId: string,
    tenderId: string,
    file: UploadedStatement | undefined,
  ): Promise<SettlementFormatTestPayload> {
    const tender = await this.loadTender(this.prisma, companyId, null, tenderId);
    const format = this.requireFormat(tender);
    const parsed = parseStatementCsv(this.fileText(file), format);
    const payouts = groupByPayout(parsed.lines, { payoutRef: null, payoutDate: null });
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

  // ═════════════════════════════════════════════════════════════════════════
  //  Import (§5.3)
  // ═════════════════════════════════════════════════════════════════════════

  async import(
    dto: ImportSettlementDto,
    file: UploadedStatement | undefined,
  ): Promise<SettlementImportResultPayload> {
    const caller = await this.caller();
    const text = this.fileText(file);
    const fileName = (file?.originalname ?? 'statement.csv').slice(0, 250);
    const fileSha = createHash('sha256').update(file!.buffer).digest('hex');
    const settings = await this.settings(dto.companyId, dto.branchId);

    const ids = await this.prisma.$transaction(async (tx) => {
      const tender = await this.loadTender(tx, dto.companyId, dto.branchId, dto.tenderId);
      const format = this.requireFormat(tender);
      if (!tender.tndSettlementLedgerId) {
        throwSettlement(
          SettlementErrorCode.BANK_MISSING,
          `${tender.tndName} names no settlement ledger: the bank its payouts reach (Tender master)`,
          'tenderId',
        );
      }
      const parsed = parseStatementCsv(text, format);
      if (parsed.problems.length > 0) {
        throwSettlementDetails(
          SettlementErrorCode.FILE_INVALID,
          `${parsed.problems.length} row(s) of the file cannot be read`,
          parsed.problems.slice(0, 200).map((p) => ({
            field: 'file',
            message: `Line ${p.lineNo}: ${p.message}`,
            lineNo: p.lineNo,
          })),
        );
      }
      if (parsed.lines.length === 0) {
        throwSettlement(SettlementErrorCode.FILE_INVALID, 'The file has no lines', 'file');
      }
      if (parsed.lines.length > IMPORT_MAX_LINES) {
        throwSettlement(
          SettlementErrorCode.FILE_INVALID,
          `The file has ${parsed.lines.length} lines; split it (${IMPORT_MAX_LINES} at most)`,
          'file',
        );
      }
      const bank = format.source === SettlementSource.BANK;
      if (bank && parsed.lines.some((l) => l.fee.gt(0) || l.tax.gt(0))) {
        throwSettlement(
          SettlementErrorCode.FILE_INVALID,
          'A bank-statement import (source BANK) carries no fee or tax: the bank credited each line in full',
          'file',
        );
      }
      const groups = groupByPayout(parsed.lines, {
        payoutRef: bank ? null : (dto.payoutRef ?? null),
        payoutDate: dto.payoutDate ?? null,
      });
      for (const g of groups) {
        if (!g.payoutDate) {
          throwSettlement(
            SettlementErrorCode.FILE_INVALID,
            'The file names no payout date: send payoutDate, or map columns.payoutDate',
            'payoutDate',
          );
        }
      }
      const tenderOf = await this.lineTenders(tx, dto, tender, parsed.lines);

      const created: { asiId: string; accYear: string }[] = [];
      for (const g of groups) {
        const accYear = accYearOfDate(g.payoutDate!);
        await this.assertSettlementPartition(tx, accYear);
        const key = groups.length === 1 ? '' : `|${g.payoutRef ?? ''}|${g.payoutDate}`;
        const hash = key
          ? createHash('sha256')
              .update(fileSha + key)
              .digest('hex')
          : fileSha;
        const clash = await tx.accSettlementImport.findFirst({
          where: {
            asiCompanyId: dto.companyId,
            asiBranchId: dto.branchId,
            asiFileHash: hash,
            asiIsDeleted: false,
            asiStatus: { not: SettlementImportStatus.VOIDED },
          },
          select: { asiId: true, asiAccYear: true, asiPayoutDate: true },
        });
        if (clash) {
          throwSettlement(
            SettlementErrorCode.FILE_DUPLICATE,
            `This file (payout of ${iso(clash.asiPayoutDate)}) was imported already; void that import to read it again`,
            'file',
            { asiId: clash.asiId, accYear: clash.asiAccYear },
          );
        }
        const totals = signedTotals(g.lines);
        const days = g.lines
          .map((l) => (l.txnOn ? istDate(l.txnOn) : null))
          .filter((d): d is string => !!d)
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
            asiPayoutDate: dateOnly(g.payoutDate!),
            asiPeriodFrom: days.length ? dateOnly(days[0]) : null,
            asiPeriodTo: days.length ? dateOnly(days[days.length - 1]) : null,
            asiLineCount: g.lines.length,
            asiTotalGross: totals.gross,
            asiTotalFee: totals.fee,
            asiTotalTax: totals.tax,
            asiTotalNet: totals.net,
            asiStatus: SettlementImportStatus.IMPORTED,
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
          code: TillEventCode.SETTLEMENT_IMPORTED,
          deviceId: this.requestContext.getDeviceId() ?? null,
          userId: caller.userId,
          srcDocType: SETTLEMENT_SRC_DOC_TYPE,
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

    const imports: SettlementImportPayload[] = [];
    for (const id of ids) {
      imports.push(
        await this.get({
          companyId: dto.companyId,
          branchId: dto.branchId,
          accYear: id.accYear,
          asiId: id.asiId,
        }),
      );
    }
    return { imports };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Matching (§5.4) — idempotent, re-runnable until the payout is posted
  // ═════════════════════════════════════════════════════════════════════════

  async match(key: SettlementKeyDto): Promise<SettlementImportPayload> {
    const caller = await this.caller();
    const settings = await this.settings(key.companyId, key.branchId);
    await this.prisma.$transaction(async (tx) => {
      const head = await this.lockImport(tx, key);
      this.assertOpen(head);
      await this.runMatch(tx, { asiId: head.asiId, accYear: head.asiAccYear }, caller, settings);
    }, TX);
    return this.get(key);
  }

  async confirm(dto: ConfirmSettlementLineDto): Promise<SettlementImportPayload> {
    const caller = await this.caller();
    const key = await this.prisma.$transaction(async (tx) => {
      const { head, line } = await this.lockLine(tx, dto);
      this.assertOpen(head);
      if (!dto.tdId) {
        if ((line.aslMatchStatus as SettlementMatchStatus) !== SettlementMatchStatus.SUGGESTED) {
          throwSettlement(
            SettlementErrorCode.STATE,
            `Line ${line.aslRowNo} is ${line.aslMatchStatus}: only a SUGGESTED line is confirmed as it stands — name a tdId to link it by hand`,
            'aslId',
          );
        }
        await this.assertTdFree(tx, line, line.aslTdId!, line.aslTdAccYear!);
        await guardMatched(() =>
          tx.accSettlementLine.update({
            where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
            data: {
              aslMatchStatus: SettlementMatchStatus.MATCHED,
              aslMatchedBy: caller.userId,
              aslMatchedOn: new Date(),
              aslModifiedOn: new Date(),
            },
          }),
        );
      } else {
        if (!isCustomerKind(line.aslKind as SettlementLineKind)) {
          throwSettlement(
            SettlementErrorCode.STATE,
            `Line ${line.aslRowNo} is a ${line.aslKind} line: it has no customer, so no tender row`,
            'aslId',
          );
        }
        if (
          (line.aslMatchStatus as SettlementMatchStatus) !== SettlementMatchStatus.UNMATCHED &&
          (line.aslMatchStatus as SettlementMatchStatus) !== SettlementMatchStatus.SUGGESTED
        ) {
          throwSettlement(
            SettlementErrorCode.STATE,
            `Line ${line.aslRowNo} is ${line.aslMatchStatus}: unlink it first`,
            'aslId',
          );
        }
        const tdAccYear = dto.tdAccYear ?? line.aslAccYear;
        const td = await this.candidateRow(tx, head, line, dto.tdId, tdAccYear);
        await this.assertTdFree(tx, line, td.tdId, td.tdAccYear);
        await guardMatched(() =>
          tx.accSettlementLine.update({
            where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
            data: {
              aslMatchStatus: SettlementMatchStatus.MATCHED,
              aslMatchRule: SettlementMatchRule.MANUAL,
              aslTdId: td.tdId,
              aslTdAccYear: td.tdAccYear,
              aslAmountDiff: line.aslGrossAmount.minus(td.amount),
              aslMatchedBy: caller.userId,
              aslMatchedOn: new Date(),
              aslModifiedOn: new Date(),
            },
          }),
        );
      }
      await this.refreshImport(tx, head);
      return this.keyOf(head);
    }, TX);
    return this.get(key);
  }

  /** MATCHED / SUGGESTED / IGNORED → UNMATCHED: the line waits again (an ignored line rejoins the totals). */
  async unlink(dto: SettlementLineKeyDto): Promise<SettlementImportPayload> {
    const key = await this.prisma.$transaction(async (tx) => {
      const { head, line } = await this.lockLine(tx, dto);
      this.assertOpen(head);
      if (
        (line.aslMatchStatus as SettlementMatchStatus) !== SettlementMatchStatus.MATCHED &&
        (line.aslMatchStatus as SettlementMatchStatus) !== SettlementMatchStatus.SUGGESTED &&
        (line.aslMatchStatus as SettlementMatchStatus) !== SettlementMatchStatus.IGNORED
      ) {
        throwSettlement(
          SettlementErrorCode.STATE,
          `Line ${line.aslRowNo} is ${line.aslMatchStatus}: nothing to unlink`,
          'aslId',
        );
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

  /** Not part of this payout: out of the totals (and so out of the voucher). */
  async ignore(dto: IgnoreSettlementLineDto): Promise<SettlementImportPayload> {
    const key = await this.prisma.$transaction(async (tx) => {
      const { head, line } = await this.lockLine(tx, dto);
      this.assertOpen(head);
      if ((line.aslMatchStatus as SettlementMatchStatus) === SettlementMatchStatus.IGNORED) {
        return this.keyOf(head);
      }
      await tx.accSettlementLine.update({
        where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
        data: {
          ...this.unmatchedData(),
          aslMatchStatus: SettlementMatchStatus.IGNORED,
          aslNotes: dto.notes,
        },
      });
      await this.refreshImport(tx, head);
      return this.keyOf(head);
    }, TX);
    return this.get(key);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Post (§5.5) — one TSet per payout; no approval: it records what the bank did
  // ═════════════════════════════════════════════════════════════════════════

  async post(key: SettlementKeyDto): Promise<SettlementPostPayload> {
    const caller = await this.caller();
    await this.prisma.$transaction(async (tx) => {
      const head = await this.lockImport(tx, key);
      this.assertOpen(head);
      await assertAccYearWritable(tx, head.asiCompanyId, head.asiAccYear, 'accYear');
      await assertVoucherPartitionExists(tx, head.asiAccYear, 'accYear');
      const lines = await tx.accSettlementLine.findMany({
        where: { aslImportId: head.asiId, aslAccYear: head.asiAccYear },
        orderBy: { aslRowNo: 'asc' },
      });
      const suggested = lines.filter(
        (l) => (l.aslMatchStatus as SettlementMatchStatus) === SettlementMatchStatus.SUGGESTED,
      );
      if (suggested.length > 0) {
        throwSettlement(
          SettlementErrorCode.SUGGESTIONS_OPEN,
          `${suggested.length} suggested match(es) wait for a person: confirm or unlink them first`,
          'asiId',
          { rows: suggested.map((l) => l.aslRowNo) },
        );
      }
      const live = lines.filter(
        (l) => (l.aslMatchStatus as SettlementMatchStatus) !== SettlementMatchStatus.IGNORED,
      );
      const matched = live.filter(
        (l) => (l.aslMatchStatus as SettlementMatchStatus) === SettlementMatchStatus.MATCHED,
      );
      const rows = await this.rowsOf(
        tx,
        matched.map((l) => ({ tdId: l.aslTdId!, tdAccYear: l.aslTdAccYear! })),
      );
      for (const l of matched) {
        const row = rows.get(l.aslTdId!);
        if (
          !row ||
          row.isVoided ||
          row.isDeleted ||
          !kindTakes(l.aslKind as SettlementLineKind, row)
        ) {
          throwSettlement(
            SettlementErrorCode.TD_NOT_CANDIDATE,
            `Line ${l.aslRowNo}: its tender row is ${row ? (row.isVoided ? 'voided' : row.settleStatus) : 'gone'} — unlink and match it again`,
            'asiId',
            { rowNo: l.aslRowNo, tdId: l.aslTdId },
          );
        }
        await this.assertTdFree(tx, l, l.aslTdId!, l.aslTdAccYear!);
      }
      const parked = await this.parkedRows(tx, [...rows.keys()]);

      const suspense = await this.roleLedger(tx, SettlementRole.TENDER_SUSPENSE, head);
      const book = new LegBook();
      const net = new Prisma.Decimal(head.asiTotalNet);
      book.add(head.asiBankLedgerId!, net.gte(0) ? 'DR' : 'CR', net.abs(), null);
      const fee = new Prisma.Decimal(head.asiTotalFee);
      const tax = new Prisma.Decimal(head.asiTotalTax);
      if (fee.gt(0)) {
        book.add(
          await this.roleLedger(tx, SettlementRole.BANK_CHARGES, head),
          'DR',
          fee,
          SettlementRole.BANK_CHARGES,
        );
      }
      if (tax.gt(0)) {
        book.add(
          await this.roleLedger(tx, SettlementRole.GST_ON_CHARGES_PENDING, head),
          'DR',
          tax,
          SettlementRole.GST_ON_CHARGES_PENDING,
        );
      }
      for (const l of live) {
        const gross = new Prisma.Decimal(l.aslGrossAmount);
        const hit =
          (l.aslMatchStatus as SettlementMatchStatus) === SettlementMatchStatus.MATCHED && l.aslTdId
            ? rows.get(l.aslTdId)
            : undefined;
        switch (l.aslKind as SettlementLineKind) {
          case SettlementLineKind.SALE: {
            // A row a close variance already parked in suspense credits suspense, not its ledger.
            const own = hit && !parked.has(hit.tdId) ? hit.ledgerId : null;
            book.add(own ?? suspense, 'CR', gross, own ? null : SettlementRole.TENDER_SUSPENSE);
            break;
          }
          case SettlementLineKind.REFUND:
            book.add(
              hit ? hit.ledgerId : suspense,
              'DR',
              gross,
              hit ? null : SettlementRole.TENDER_SUSPENSE,
            );
            break;
          case SettlementLineKind.CHARGEBACK:
            book.add(suspense, 'DR', gross, SettlementRole.TENDER_SUSPENSE);
            break;
          case SettlementLineKind.ADJUSTMENT:
            book.add(suspense, 'CR', gross, SettlementRole.TENDER_SUSPENSE);
            break;
          case SettlementLineKind.FEE:
            // Its fee and tax are in the totals; a gross on it (rare) is money with no bill.
            if (gross.gt(0)) book.add(suspense, 'CR', gross, SettlementRole.TENDER_SUSPENSE);
            break;
        }
      }
      const legs = book.legs();
      const dr = legs.filter((g) => g.drCr === 'DR').reduce((s, g) => s.plus(g.amount), ZERO);
      const cr = legs.filter((g) => g.drCr === 'CR').reduce((s, g) => s.plus(g.amount), ZERO);
      if (!dr.equals(cr) || legs.length === 0) {
        throwSettlement(
          SettlementErrorCode.NOT_BALANCED,
          `The payout does not balance (Dr ${dr.toFixed(2)}, Cr ${cr.toFixed(2)}): its lines and totals disagree`,
          'asiId',
        );
      }

      const payoutDate = iso(head.asiPayoutDate);
      const voucher = await this.posting.postLegs(tx, {
        header: {
          companyId: head.asiCompanyId,
          branchId: head.asiBranchId,
          tenantId: head.asiTenantId,
          accYear: head.asiAccYear,
          voucherTypeId: await this.voucherTypeId(tx, SETTLEMENT_VOUCHER_TYPE_CODE),
          voucherDate: payoutDate,
          srcModule: SETTLEMENT_SRC_MODULE,
          srcDocType: SETTLEMENT_SRC_DOC_TYPE,
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
        })) satisfies VoucherLeg[],
      });

      for (const l of matched) {
        const row = rows.get(l.aslTdId!)!;
        const kind = l.aslKind as SettlementLineKind;
        if (kind === SettlementLineKind.CHARGEBACK) {
          await tx.$executeRaw`
            UPDATE accounts.acc_tender_detail
               SET td_settle_status = 'FAILED', td_modified_on = now(), td_modified_by = ${caller.actorName}
             WHERE td_id = ${row.tdId}::uuid AND td_acc_year = ${row.tdAccYear}::char(9)`;
          continue;
        }
        const exact = new Prisma.Decimal(l.aslAmountDiff).isZero();
        await tx.$executeRaw`
          UPDATE accounts.acc_tender_detail
             SET td_settle_status     = ${exact ? 'SETTLED' : 'PARTIAL'},
                 td_settled_on        = ${payoutDate}::date,
                 td_settle_amount     = ${new Prisma.Decimal(l.aslGrossAmount)}::numeric,
                 td_settle_ref_no     = ${(head.asiPayoutRef ?? head.asiFileName).slice(0, 60)},
                 td_settle_voucher_id = ${voucher.voucherId}::uuid,
                 td_modified_on       = now(),
                 td_modified_by       = ${caller.actorName}
           WHERE td_id = ${row.tdId}::uuid AND td_acc_year = ${row.tdAccYear}::char(9)`;
      }
      await tx.accSettlementImport.update({
        where: { asiId_asiAccYear: { asiId: head.asiId, asiAccYear: head.asiAccYear } },
        data: {
          asiStatus: SettlementImportStatus.POSTED,
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
        code: TillEventCode.SETTLEMENT_POSTED,
        deviceId: this.requestContext.getDeviceId() ?? null,
        userId: caller.userId,
        srcDocType: SETTLEMENT_SRC_DOC_TYPE,
        srcDocId: head.asiId,
        srcRefno: voucher.voucherRefno,
        amount: net,
        payload: {
          voucherId: voucher.voucherId,
          matched: matched.length,
          unmatched: live.filter(
            (l) => (l.aslMatchStatus as SettlementMatchStatus) === SettlementMatchStatus.UNMATCHED,
          ).length,
        },
      });
    }, TX);
    const payload = await this.get(key);
    return { ...payload, legs: await this.legsOf(payload.voucherId, key.accYear) };
  }

  /**
   * An unposted import: VOIDED (the file may be read again). A posted one: its
   * TSet reversed, its rows PENDING again (a charged-back row SETTLED again) —
   * refused once anything has built on it (a resolved line's journal, a row
   * written off since): SETTLEMENT_POSTED_LOCKED.
   */
  async void(dto: VoidSettlementDto): Promise<SettlementImportPayload> {
    const caller = await this.caller();
    await this.prisma.$transaction(async (tx) => {
      const head = await this.lockImport(tx, dto);
      if ((head.asiStatus as SettlementImportStatus) === SettlementImportStatus.VOIDED) {
        throwSettlement(SettlementErrorCode.STATE, 'This import is already VOIDED', 'asiId');
      }
      if ((head.asiStatus as SettlementImportStatus) === SettlementImportStatus.POSTED) {
        const resolved = await tx.accSettlementLine.count({
          where: {
            aslImportId: head.asiId,
            aslAccYear: head.asiAccYear,
            aslMatchStatus: SettlementMatchStatus.RESOLVED,
          },
        });
        const movedOn = await tx.$queryRaw<{ n: number }[]>`
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
          throwSettlement(
            SettlementErrorCode.POSTED_LOCKED,
            'Lines of this payout were resolved or written off since it was posted: undo those first',
            'asiId',
            { resolved, rowsMovedOn: movedOn[0].n },
          );
        }
        const mirror = await this.posting.reverseLegs(
          tx,
          head.asiVoucherId!,
          head.asiVoucherAccYear!,
          dto.reason,
          caller.actorName,
        );
        if (!mirror) {
          throwSettlement(SettlementErrorCode.STATE, 'The payout’s voucher is not live', 'asiId');
        }
        await tx.$executeRaw`
          UPDATE accounts.acc_tender_detail
             SET td_settle_status = 'PENDING', td_settled_on = NULL, td_settle_amount = NULL,
                 td_settle_ref_no = NULL, td_settle_voucher_id = NULL,
                 td_modified_on = now(), td_modified_by = ${caller.actorName}
           WHERE td_settle_voucher_id = ${head.asiVoucherId}::uuid`;
        await tx.$executeRaw`
          UPDATE accounts.acc_tender_detail t
             SET td_settle_status = 'SETTLED', td_modified_on = now(), td_modified_by = ${caller.actorName}
            FROM accounts.acc_settlement_line l
           WHERE l.asl_import_id = ${head.asiId}::uuid AND l.asl_acc_year = ${head.asiAccYear}::char(9)
             AND l.asl_kind = 'CHARGEBACK' AND l.asl_match_status = 'MATCHED'
             AND t.td_id = l.asl_td_id AND t.td_acc_year = l.asl_td_acc_year
             AND t.td_settle_status = 'FAILED'`;
      }
      // A voided payout settles nothing: its lines let go of their rows, or a
      // later import could not match them (ux_asl_td_matched does not look at
      // the import's status). What each was matched to stays in its notes.
      await tx.$executeRaw`
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
          asiStatus: SettlementImportStatus.VOIDED,
          asiVoidReason: dto.reason,
          // ck_asi_posted: only a POSTED import names its poster.
          asiPostedBy: null,
          asiPostedOn: null,
          asiModifiedOn: new Date(),
          asiModifiedBy: caller.actorName,
        },
      });
    }, TX);
    return this.get(dto);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Reads
  // ═════════════════════════════════════════════════════════════════════════

  async get(key: SettlementKeyDto): Promise<SettlementImportPayload> {
    const head = await this.loadImport(this.prisma, key);
    const lines = await this.prisma.accSettlementLine.findMany({
      where: { aslImportId: head.asiId, aslAccYear: head.asiAccYear },
      orderBy: { aslRowNo: 'asc' },
    });
    const rows = await this.tenderRowPayloads(
      this.prisma,
      lines.filter((l) => l.aslTdId).map((l) => ({ tdId: l.aslTdId!, tdAccYear: l.aslTdAccYear! })),
    );
    const extras = await this.prisma.$queryRaw<{ bank: string | null; refno: string | null }[]>`
      SELECT (SELECT led_name FROM accounts.acc_ledger_master WHERE led_id = ${head.asiBankLedgerId}::uuid) AS bank,
             (SELECT avh_voucher_refno FROM accounts.acc_voucher_header
               WHERE avh_voucher_id = ${head.asiVoucherId}::uuid
                 AND avh_acc_year = ${head.asiVoucherAccYear}::char(9)) AS refno`;
    return {
      ...this.importPayload(head, lines, extras[0]),
      lines: lines.map((l) =>
        this.linePayload(l, l.aslTdId ? (rows.get(l.aslTdId) ?? null) : null),
      ),
    };
  }

  /** A line's payload, for the exception service. */
  async linePayloadOf(tx: Client, line: LineRow): Promise<SettlementLinePayload> {
    const rows = line.aslTdId
      ? await this.tenderRowPayloads(tx, [{ tdId: line.aslTdId, tdAccYear: line.aslTdAccYear! }])
      : new Map<string, SettlementTenderRowPayload>();
    return this.linePayload(line, line.aslTdId ? (rows.get(line.aslTdId) ?? null) : null);
  }

  async legsOf(voucherId: string | null, accYear: string | null): Promise<SettlementLegPayload[]> {
    if (!voucherId || !accYear) return [];
    const legs = await this.prisma.$queryRaw<
      {
        dr_cr: string;
        ledger_id: string;
        led_name: string | null;
        av_role: string | null;
        amount: Prisma.Decimal;
      }[]
    >`
      SELECT trim(v.av_dr_cr) AS dr_cr, v.av_ledger_id::text AS ledger_id, l.led_name, v.av_role, v.av_amount AS amount
        FROM accounts.acc_vouchers v
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = v.av_ledger_id
       WHERE v.av_voucher_id = ${voucherId}::uuid AND v.av_acc_year = ${accYear}::char(9)
         AND v.av_is_deleted = false
       ORDER BY v.av_row_no`;
    return legs.map((g) => ({
      drCr: g.dr_cr as 'DR' | 'CR',
      ledgerId: g.ledger_id,
      ledgerName: g.led_name,
      role: g.av_role,
      amount: num(g.amount),
    }));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Shared with TenderSettlementExceptionService
  // ═════════════════════════════════════════════════════════════════════════

  async caller(client: Client = this.prisma): Promise<SettlementCaller> {
    const userId = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    const user = await client.userMaster.findUnique({
      where: { usrId: userId },
      select: { usrLoginName: true },
    });
    return { userId, actorName: (user?.usrLoginName ?? userId).slice(0, 50) };
  }

  async settings(companyId: string, branchId: string): Promise<TenderSettings> {
    return readTenderSettings(
      await this.appSettings.resolveEffective({
        companyId,
        branchId,
        deviceId: null,
        userId: null,
      }),
    );
  }

  /** A role's ledger for the scope, or 422 SETTLEMENT_LEDGER_UNMAPPED naming it. */
  async roleLedger(
    tx: Client,
    role: string,
    scope: { asiCompanyId: string; asiBranchId: string },
  ): Promise<string> {
    const resolved = await resolveRoleLedgers(tx, [{ role }], {
      companyId: scope.asiCompanyId,
      branchId: scope.asiBranchId,
      where: 'tender settlement',
    });
    const hit = [...resolved.values()][0];
    if (!hit) {
      throwSettlement(
        SettlementErrorCode.LEDGER_UNMAPPED,
        `The role ${role} has no ledger. Map it on the Ledger Map screen (menu 250).`,
        'role',
        { role },
      );
    }
    return hit.ledgerId;
  }

  async voucherTypeId(tx: Client, code: string): Promise<number> {
    const type = await tx.accVoucherType.findFirst({
      where: { vchrTypeCode: code, vchrIsActive: true },
      select: { vchrTypeId: true },
    });
    if (!type) {
      throwSettlement(
        SettlementErrorCode.STATE,
        `Voucher type ${code} is missing or inactive (migration 20261008130000 creates TSet)`,
        'voucherType',
      );
    }
    return type.vchrTypeId;
  }

  async loadImport(client: Client, key: SettlementKeyDto): Promise<ImportRow> {
    const head = await client.accSettlementImport.findFirst({
      where: { asiId: key.asiId, asiAccYear: key.accYear, asiIsDeleted: false },
    });
    if (!head || head.asiCompanyId !== key.companyId || head.asiBranchId !== key.branchId) {
      throwSettlement(
        SettlementErrorCode.NOT_FOUND,
        `No settlement import ${key.asiId} in ${key.accYear} for this branch`,
        'asiId',
      );
    }
    return head;
  }

  async lockLine(tx: Tx, key: SettlementLineKeyDto): Promise<{ head: ImportRow; line: LineRow }> {
    const line = await tx.accSettlementLine.findFirst({
      where: { aslId: key.aslId, aslAccYear: key.accYear },
    });
    if (!line) {
      throwSettlement(
        SettlementErrorCode.NOT_FOUND,
        `No statement line ${key.aslId} in ${key.accYear}`,
        'aslId',
      );
    }
    const head = await this.lockImport(tx, {
      companyId: key.companyId,
      branchId: key.branchId,
      accYear: line.aslAccYear,
      asiId: line.aslImportId,
    });
    await tx.$queryRaw`
      SELECT asl_id FROM accounts.acc_settlement_line
       WHERE asl_id = ${line.aslId}::uuid AND asl_acc_year = ${line.aslAccYear}::char(9) FOR UPDATE`;
    const fresh = await tx.accSettlementLine.findUniqueOrThrow({
      where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
    });
    return { head, line: fresh };
  }

  /**
   * A tender row by hand (MANUAL confirm, LINKED resolve): of this company and
   * store, live, on the line's tender, on the side and in the state the line's
   * kind takes. SETTLEMENT_TD_NOT_CANDIDATE otherwise.
   */
  async candidateRow(
    tx: Client,
    head: ImportRow,
    line: LineRow,
    tdId: string,
    tdAccYear: string,
  ): Promise<SettlementRow> {
    const rows = await this.rowsOf(tx, [{ tdId, tdAccYear }]);
    const row = rows.get(tdId);
    const refuse = (why: string): never =>
      throwSettlement(
        SettlementErrorCode.TD_NOT_CANDIDATE,
        `Tender row ${tdId} cannot take line ${line.aslRowNo}: ${why}`,
        'tdId',
      );
    if (!row || row.companyId !== head.asiCompanyId || row.branchId !== head.asiBranchId) {
      return refuse('it is not a tender row of this store');
    }
    if (row.isDeleted || row.isVoided) {
      return refuse('it is voided or deleted');
    }
    if (row.tenderId !== line.aslTenderId) {
      return refuse('it is on another tender (terminal / VPA) than the line');
    }
    if (!kindTakes(line.aslKind as SettlementLineKind, row)) {
      return refuse(
        `a ${line.aslKind} line takes ${line.aslKind === 'REFUND' ? 'a money-out' : 'a money-in'} row that is ${line.aslKind === 'CHARGEBACK' ? 'SETTLED' : 'PENDING or PARTIAL'}; this one is ${row.drCr} ${row.settleStatus}`,
      );
    }
    return row;
  }

  /** A row already settled by another line (any year, any import not voided) → SETTLEMENT_TD_ALREADY_MATCHED. */
  async assertTdFree(tx: Client, line: LineRow, tdId: string, tdAccYear: string): Promise<void> {
    const [held] = await tx.$queryRaw<{ asi_payout_date: Date; asl_row_no: number }[]>`
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
      throwSettlement(
        SettlementErrorCode.TD_ALREADY_MATCHED,
        `That tender row is already settled by line ${held.asl_row_no} of the payout of ${iso(held.asi_payout_date)}`,
        'tdId',
      );
    }
  }

  /** Rows a posted close variance parked in Tender suspense (till_variance.tvr_rows, 49 §1b). */
  async parkedRows(tx: Client, tdIds: string[]): Promise<Set<string>> {
    if (tdIds.length === 0) return new Set();
    const rows = await tx.$queryRaw<{ td_id: string }[]>`
      SELECT DISTINCT r->>'td_id' AS td_id
        FROM accounts.till_variance v, jsonb_array_elements(v.tvr_rows) r
       WHERE v.tvr_rows IS NOT NULL AND v.tvr_is_deleted = false
         AND v.tvr_treatment = 'SUSPENSE' AND v.tvr_status = 'POSTED'
         AND r->>'td_id' = ANY(${tdIds}::text[])`;
    return new Set(rows.map((r) => r.td_id));
  }

  async rowsOf(
    tx: Client,
    keys: { tdId: string; tdAccYear: string }[],
  ): Promise<Map<string, SettlementRow>> {
    if (keys.length === 0) return new Map();
    const rows = await tx.$queryRaw<
      {
        td_id: string;
        td_acc_year: string;
        td_company_id: string;
        td_branch_id: string;
        td_tender_id: string;
        td_tender_type_id: number;
        dr_cr: string;
        td_settle_status: string;
        td_total_amt: Prisma.Decimal;
        td_settle_amount: Prisma.Decimal | null;
        ledger_id: string;
        td_session_id: string | null;
        td_src_doc_type: string;
        td_src_doc_id: string;
        td_settle_voucher_id: string | null;
        td_is_voided: boolean;
        td_is_deleted: boolean;
      }[]
    >`
      SELECT t.td_id::text, t.td_acc_year, t.td_company_id::text, t.td_branch_id::text, t.td_tender_id::text,
             t.td_tender_type_id, trim(t.td_dr_cr) AS dr_cr, t.td_settle_status, t.td_total_amt,
             t.td_settle_amount, COALESCE(t.td_settle_ledger_id, t.td_tender_ledger_id)::text AS ledger_id,
             t.td_session_id::text, t.td_src_doc_type, t.td_src_doc_id::text, t.td_settle_voucher_id::text,
             t.td_is_voided, t.td_is_deleted
        FROM accounts.acc_tender_detail t
       WHERE (t.td_id, t.td_acc_year) IN (
               SELECT k.id::uuid, k.yr::char(9)
                 FROM unnest(${keys.map((k) => k.tdId)}::text[], ${keys.map((k) => k.tdAccYear)}::text[]) AS k(id, yr))`;
    return new Map(
      rows.map((r) => [
        r.td_id,
        {
          tdId: r.td_id,
          tdAccYear: r.td_acc_year,
          companyId: r.td_company_id,
          branchId: r.td_branch_id,
          tenderId: r.td_tender_id,
          tenderTypeId: r.td_tender_type_id,
          drCr: r.dr_cr as 'DR' | 'CR',
          settleStatus: r.td_settle_status,
          amount: new Prisma.Decimal(r.td_total_amt),
          settleAmount: r.td_settle_amount === null ? null : new Prisma.Decimal(r.td_settle_amount),
          ledgerId: r.ledger_id,
          sessionId: r.td_session_id,
          srcDocType: r.td_src_doc_type,
          srcDocId: r.td_src_doc_id,
          settleVoucherId: r.td_settle_voucher_id,
          isVoided: r.td_is_voided,
          isDeleted: r.td_is_deleted,
        },
      ]),
    );
  }

  async refreshImport(tx: Tx, head: ImportRow): Promise<void> {
    const lines = await tx.accSettlementLine.findMany({
      where: { aslImportId: head.asiId, aslAccYear: head.asiAccYear },
    });
    const live = lines.filter(
      (l) => (l.aslMatchStatus as SettlementMatchStatus) !== SettlementMatchStatus.IGNORED,
    );
    const totals = signedTotals(
      live.map((l) => ({
        kind: l.aslKind as SettlementLineKind,
        gross: new Prisma.Decimal(l.aslGrossAmount),
        fee: new Prisma.Decimal(l.aslFeeAmount),
        tax: new Prisma.Decimal(l.aslTaxAmount),
      })),
    );
    const waiting = live.some(
      (l) =>
        isCustomerKind(l.aslKind as SettlementLineKind) &&
        ((l.aslMatchStatus as SettlementMatchStatus) === SettlementMatchStatus.UNMATCHED ||
          (l.aslMatchStatus as SettlementMatchStatus) === SettlementMatchStatus.SUGGESTED),
    );
    const status =
      (head.asiStatus as SettlementImportStatus) === SettlementImportStatus.POSTED
        ? SettlementImportStatus.POSTED
        : waiting
          ? SettlementImportStatus.IMPORTED
          : SettlementImportStatus.MATCHED;
    await tx.accSettlementImport.update({
      where: { asiId_asiAccYear: { asiId: head.asiId, asiAccYear: head.asiAccYear } },
      data: {
        asiStatus: status,
        ...((head.asiStatus as SettlementImportStatus) === SettlementImportStatus.POSTED
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

  // ═════════════════════════════════════════════════════════════════════════
  //  Internals
  // ═════════════════════════════════════════════════════════════════════════

  private async runMatch(
    tx: Tx,
    key: { asiId: string; accYear: string },
    caller: SettlementCaller,
    settings: TenderSettings,
  ): Promise<void> {
    const head = await tx.accSettlementImport.findUniqueOrThrow({
      where: { asiId_asiAccYear: { asiId: key.asiId, asiAccYear: key.accYear } },
    });
    const all = await tx.accSettlementLine.findMany({
      where: { aslImportId: key.asiId, aslAccYear: key.accYear },
      orderBy: { aslRowNo: 'asc' },
    });
    const judged = all.filter(
      (l) =>
        isCustomerKind(l.aslKind as SettlementLineKind) &&
        ((l.aslMatchStatus as SettlementMatchStatus) === SettlementMatchStatus.UNMATCHED ||
          (l.aslMatchStatus as SettlementMatchStatus) === SettlementMatchStatus.SUGGESTED),
    );
    if (judged.length > 0) {
      const payout = iso(head.asiPayoutDate);
      const days = [
        payout,
        ...judged.map((l) => (l.aslTxnOn ? istDate(l.aslTxnOn) : payout)),
      ].sort();
      const from = shiftDays(days[0], -CANDIDATE_DAYS_BACK);
      const to = shiftDays(days[days.length - 1], 1);
      const years = [...new Set([accYearOfDate(from), accYearOfDate(to)])];
      const tenders = [
        ...new Set(judged.map((l) => l.aslTenderId).filter((t): t is string => !!t)),
      ];
      const found = await tx.$queryRaw<
        {
          td_id: string;
          td_acc_year: string;
          td_tender_id: string;
          dr_cr: string;
          td_settle_status: string;
          td_ref_no: string | null;
          td_auth_code: string | null;
          td_card_last4: string | null;
          td_total_amt: Prisma.Decimal;
          td_doc_date: Date;
          td_created_on: Date;
        }[]
      >`
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
      const candidates: MatchCandidate[] = found.map((r) => ({
        tdId: r.td_id,
        tdAccYear: r.td_acc_year,
        tenderId: r.td_tender_id,
        drCr: r.dr_cr as 'DR' | 'CR',
        settleStatus: r.td_settle_status,
        refNo: r.td_ref_no,
        authCode: r.td_auth_code,
        cardLast4: r.td_card_last4,
        amount: new Prisma.Decimal(r.td_total_amt),
        docDate: iso(r.td_doc_date),
        createdOn: r.td_created_on,
      }));
      const taken = await tx.$queryRaw<{ asl_kind: string; td_id: string }[]>`
        SELECT l.asl_kind, l.asl_td_id::text AS td_id
          FROM accounts.acc_settlement_line l
          JOIN accounts.acc_settlement_import i
            ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
         WHERE l.asl_td_id = ANY(${candidates.map((c) => c.tdId)}::uuid[])
           AND i.asi_is_deleted = false AND i.asi_status <> 'VOIDED'
           AND (l.asl_match_status IN ('MATCHED','SUGGESTED')
                OR (l.asl_match_status = 'RESOLVED' AND l.asl_resolution = 'LINKED'))
           AND l.asl_id <> ALL(${judged.map((l) => l.aslId)}::uuid[])`;
      const verdicts = matchLines(
        judged.map((l) => ({
          aslId: l.aslId,
          kind: l.aslKind as SettlementLineKind,
          tenderId: l.aslTenderId,
          refNo: l.aslRefNo,
          authCode: l.aslAuthCode,
          cardLast4: l.aslCardLast4,
          gross: new Prisma.Decimal(l.aslGrossAmount),
          txnOn: l.aslTxnOn,
        })),
        candidates,
        {
          tolerance: settings.matchAmountTolerance,
          windowMinutes: settings.matchWindowMinutes,
          taken: new Set(taken.map((t) => `${t.asl_kind}|${t.td_id}`)),
        },
      );
      const now = new Date();
      for (const v of verdicts) {
        await guardMatched(() =>
          tx.accSettlementLine.update({
            where: { aslId_aslAccYear: { aslId: v.aslId, aslAccYear: key.accYear } },
            data:
              v.status === SettlementMatchStatus.UNMATCHED
                ? this.unmatchedData()
                : {
                    aslMatchStatus: v.status,
                    aslMatchRule: v.rule,
                    aslTdId: v.tdId,
                    aslTdAccYear: v.tdAccYear,
                    aslAmountDiff: v.diff,
                    aslMatchedBy: v.status === SettlementMatchStatus.MATCHED ? caller.userId : null,
                    aslMatchedOn: v.status === SettlementMatchStatus.MATCHED ? now : null,
                    aslModifiedOn: now,
                  },
          }),
        );
      }
    }
    await this.refreshImport(tx, head);
  }

  /** Each line's tender: its terminal id, its VPA, else the file's own tender. */
  private async lineTenders(
    tx: Tx,
    dto: ImportSettlementDto,
    tender: TenderRow,
    lines: ParsedStatementLine[],
  ): Promise<Map<number, string>> {
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
    const byTerminal = new Map(
      all.filter((t) => t.tndTerminalId).map((t) => [t.tndTerminalId!.trim().toUpperCase(), t]),
    );
    const byVpa = new Map(
      all.filter((t) => t.tndUpiVpa).map((t) => [t.tndUpiVpa!.trim().toLowerCase(), t]),
    );
    const out = new Map<number, string>();
    const unknown: string[] = [];
    const elsewhere: string[] = [];
    // A shop whose one tender carries no terminal id has not split its terminals
    // yet (§4.1 set-up rule): every line is that tender's.
    const unsplit = !tender.tndTerminalId && !tender.tndUpiVpa;
    for (const line of lines) {
      const hit =
        (line.terminalId ? byTerminal.get(line.terminalId.trim().toUpperCase()) : undefined) ??
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
      throwSettlement(
        SettlementErrorCode.TERMINAL_UNKNOWN,
        `${unknown.length} line(s) name a terminal / VPA no tender of this company carries (${unknown.slice(0, 5).join('; ')})`,
        'file',
      );
    }
    if (elsewhere.length > 0) {
      throwSettlement(
        SettlementErrorCode.OTHER_STORE,
        `${elsewhere.length} line(s) are another store's terminal (${elsewhere.slice(0, 5).join('; ')}): import each store's part at that store`,
        'file',
      );
    }
    return out;
  }

  private async loadTender(
    client: Client,
    companyId: string,
    branchId: string | null,
    tenderId: string,
  ): Promise<TenderRow> {
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
      throwSettlement(
        SettlementErrorCode.NOT_FOUND,
        `No tender ${tenderId} in this company`,
        'tenderId',
      );
    }
    if (tender.tndTypeId === CASH_TENDER_TYPE_ID) {
      throwSettlement(
        SettlementErrorCode.STATE,
        'Cash has no provider statement: it is counted at the till',
        'tenderId',
      );
    }
    if (branchId && tender.tndBranchId && tender.tndBranchId !== branchId) {
      throwSettlement(
        SettlementErrorCode.OTHER_STORE,
        `${tender.tndName} belongs to another store: import its file there`,
        'tenderId',
      );
    }
    return tender;
  }

  private requireFormat(tender: TenderRow): StatementFormat {
    if (!tender.tndStatementFormat) {
      throwSettlement(
        SettlementErrorCode.FORMAT_MISSING,
        `${tender.tndName} has no statement format: set its column map first (POST /tender-settlement/format)`,
        'tenderId',
      );
    }
    const checked = validateStatementFormat(tender.tndStatementFormat);
    if (!checked.format) {
      throwSettlementDetails(
        SettlementErrorCode.FORMAT_INVALID,
        `${tender.tndName}'s statement format cannot be used`,
        checked.problems.map((message) => ({ field: 'format', message })),
      );
    }
    return checked.format;
  }

  private formatPayload(
    tender: TenderRow,
    format: StatementFormat | null,
  ): SettlementFormatPayload {
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

  private fileText(file: UploadedStatement | undefined): string {
    if (!file?.buffer?.length) {
      throwSettlement(
        SettlementErrorCode.FILE_INVALID,
        'Attach the statement CSV as the "file" part of the form',
        'file',
      );
    }
    if (file.buffer.length > IMPORT_MAX_BYTES) {
      throwSettlement(
        SettlementErrorCode.FILE_INVALID,
        `The file is over ${IMPORT_MAX_BYTES / 1024 / 1024} MB: split it`,
        'file',
      );
    }
    return file.buffer.toString('utf8');
  }

  private async assertSettlementPartition(tx: Tx, accYear: string): Promise<void> {
    const name = `acc_settlement_line_${accYear.replace('-', '_')}`;
    const [row] = await tx.$queryRaw<{ ok: boolean }[]>`
      SELECT to_regclass(${`accounts.${name}`}) IS NOT NULL AS ok`;
    if (!row?.ok) {
      throwSettlement(
        SettlementErrorCode.STATE,
        `The year ${accYear} is not set up for settlements: run ensure_acc_year_partitions('${accYear}')`,
        'payoutDate',
      );
    }
  }

  private async lockImport(tx: Tx, key: SettlementKeyDto): Promise<ImportRow> {
    await tx.$queryRaw`
      SELECT asi_id FROM accounts.acc_settlement_import
       WHERE asi_id = ${key.asiId}::uuid AND asi_acc_year = ${key.accYear}::char(9) FOR UPDATE`;
    return this.loadImport(tx, key);
  }

  private assertOpen(head: ImportRow): void {
    if (
      (head.asiStatus as SettlementImportStatus) !== SettlementImportStatus.IMPORTED &&
      (head.asiStatus as SettlementImportStatus) !== SettlementImportStatus.MATCHED
    ) {
      throwSettlement(
        SettlementErrorCode.STATE,
        `This payout is ${head.asiStatus}: lines are matched only before it is posted`,
        'asiId',
      );
    }
  }

  private unmatchedData(): Prisma.AccSettlementLineUncheckedUpdateInput {
    return {
      aslMatchStatus: SettlementMatchStatus.UNMATCHED,
      aslMatchRule: null,
      aslTdId: null,
      aslTdAccYear: null,
      aslAmountDiff: ZERO,
      aslMatchedBy: null,
      aslMatchedOn: null,
      aslModifiedOn: new Date(),
    };
  }

  private keyOf(head: ImportRow): SettlementKeyDto {
    return {
      companyId: head.asiCompanyId,
      branchId: head.asiBranchId,
      accYear: head.asiAccYear,
      asiId: head.asiId,
    };
  }

  private async tenderRowPayloads(
    client: Client,
    keys: { tdId: string; tdAccYear: string }[],
  ): Promise<Map<string, SettlementTenderRowPayload>> {
    if (keys.length === 0) return new Map();
    const rows = await client.$queryRaw<
      {
        td_id: string;
        td_acc_year: string;
        td_src_doc_type: string;
        td_src_doc_id: string;
        refno: string | null;
        td_doc_date: Date;
        td_total_amt: Prisma.Decimal;
        td_ref_no: string | null;
        td_auth_code: string | null;
        td_card_last4: string | null;
        td_settle_status: string;
        td_session_id: string | null;
        td_created_on: Date;
      }[]
    >`
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
    return new Map(
      rows.map((r) => [
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
      ]),
    );
  }

  private importPayload(
    head: ImportRow,
    lines: LineRow[],
    extras: { bank: string | null; refno: string | null } | undefined,
  ): SettlementImportPayload {
    const counts = Object.fromEntries(
      Object.values(SettlementMatchStatus).map((s) => [s, 0]),
    ) as Record<SettlementMatchStatus, number>;
    for (const l of lines) {
      if (isCustomerKind(l.aslKind as SettlementLineKind)) {
        counts[l.aslMatchStatus as SettlementMatchStatus] += 1;
      }
    }
    return {
      asiId: head.asiId,
      accYear: head.asiAccYear,
      companyId: head.asiCompanyId,
      branchId: head.asiBranchId,
      source: head.asiSource as SettlementSource,
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
      status: head.asiStatus as SettlementImportStatus,
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

  private linePayload(l: LineRow, row: SettlementTenderRowPayload | null): SettlementLinePayload {
    return {
      aslId: l.aslId,
      rowNo: l.aslRowNo,
      kind: l.aslKind as SettlementLineKind,
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
      matchStatus: l.aslMatchStatus as SettlementMatchStatus,
      matchRule: (l.aslMatchRule as SettlementMatchRule | null) ?? null,
      amountDiff: num(l.aslAmountDiff),
      tenderRow: row,
      resolution: (l.aslResolution as SettlementLinePayload['resolution']) ?? null,
      reasonId: l.aslReasonId,
      resolutionVoucherId: l.aslResolutionVoucherId,
      notes: l.aslNotes,
    };
  }
}

export interface SettlementRow {
  tdId: string;
  tdAccYear: string;
  companyId: string;
  branchId: string;
  tenderId: string;
  tenderTypeId: number;
  drCr: 'DR' | 'CR';
  settleStatus: string;
  amount: Prisma.Decimal;
  settleAmount: Prisma.Decimal | null;
  /** The ledger the row's own leg hit: its clearing ledger, else its tender ledger. */
  ledgerId: string;
  sessionId: string | null;
  srcDocType: string;
  srcDocId: string;
  settleVoucherId: string | null;
  isVoided: boolean;
  isDeleted: boolean;
}

type TenderRow = {
  tndId: string;
  tndName: string;
  tndTypeId: number;
  tndBranchId: string | null;
  tndTerminalId: string | null;
  tndUpiVpa: string | null;
  tndSettlementLedgerId: string | null;
  tndSettlementDays: number;
  tndStatementFormat: Prisma.JsonValue;
};

/**
 * A payout's totals as the provider states them: gross = sales + adjustments −
 * refunds − chargebacks; fee and tax summed; net = gross − fee − tax
 * (ck_asi_net).
 */
export function signedTotals(
  lines: readonly {
    kind: SettlementLineKind;
    gross: Prisma.Decimal;
    fee: Prisma.Decimal;
    tax: Prisma.Decimal;
  }[],
): { gross: Prisma.Decimal; fee: Prisma.Decimal; tax: Prisma.Decimal; net: Prisma.Decimal } {
  let gross = ZERO;
  let fee = ZERO;
  let tax = ZERO;
  for (const l of lines) {
    const out = l.kind === SettlementLineKind.REFUND || l.kind === SettlementLineKind.CHARGEBACK;
    gross = out ? gross.minus(l.gross) : gross.plus(l.gross);
    fee = fee.plus(l.fee);
    tax = tax.plus(l.tax);
  }
  return { gross, fee, tax, net: gross.minus(fee).minus(tax) };
}

/** Dr and Cr per ledger, netted to one leg each. */
export class LegBook {
  private readonly byLedger = new Map<string, { net: Prisma.Decimal; role: string | null }>();

  add(ledgerId: string, side: 'DR' | 'CR', amount: Prisma.Decimal, role: string | null): void {
    if (amount.isZero()) return;
    const entry = this.byLedger.get(ledgerId) ?? { net: ZERO, role };
    entry.net = side === 'DR' ? entry.net.plus(amount) : entry.net.minus(amount);
    entry.role = entry.role ?? role;
    this.byLedger.set(ledgerId, entry);
  }

  legs(): { ledgerId: string; drCr: 'DR' | 'CR'; amount: Prisma.Decimal; role: string | null }[] {
    const out: {
      ledgerId: string;
      drCr: 'DR' | 'CR';
      amount: Prisma.Decimal;
      role: string | null;
    }[] = [];
    for (const [ledgerId, e] of this.byLedger) {
      if (e.net.isZero()) continue;
      out.push({
        ledgerId,
        drCr: e.net.isNegative() ? 'CR' : 'DR',
        amount: e.net.abs(),
        role: e.role,
      });
    }
    // Debits first, the way a journal reads.
    return out.sort((a, b) => (a.drCr === b.drCr ? 0 : a.drCr === 'DR' ? -1 : 1));
  }
}

/**
 * ux_asl_td_matched (one SALE line settles a row, within a statement year) is
 * the database's last word on a race the service checks first: answer it as
 * the service would, 409 SETTLEMENT_TD_ALREADY_MATCHED, not a 500.
 */
async function guardMatched<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throwSettlement(
        SettlementErrorCode.TD_ALREADY_MATCHED,
        'That tender row is already settled by another statement line',
        'tdId',
      );
    }
    throw error;
  }
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}
