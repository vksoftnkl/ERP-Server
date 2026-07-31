import { Injectable } from '@nestjs/common';
import { AccTenderDetail, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { GetTenderDetailQueryDto } from './dto/get-tender-detail-query.dto';
import { SaveTenderDetailDto } from './dto/save-tender-detail.dto';
import {
  TENDER_DETAIL_VALUE_GUARDS,
  TenderDetailDeleteResult,
  TenderDetailErrorDetail,
  TenderDetailGuardedValues,
  TenderDetailPayload,
  TenderDocumentAudit,
  TenderDocumentScope,
  TenderDrCr,
  TenderSettleStatus,
  TenderSrcDocType,
  TenderSrcModule,
} from './types/tender-detail-api.types';
import {
  AccountsWriteClient,
  DEFAULT_ACTOR,
  PresentFieldTransform,
  applyPresentFields,
  isForeignKeyConstraintError,
  normalizeRequiredText,
  resolveActor,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  toNumber,
  toNullableNumber,
} from 'src/common/utils/module-service.utils';
const TENDER_DETAIL_TABLE_NAME = 'account tender detail';
const TENDER_DETAIL_AUDIT_SCREEN_NAME = 'Tender Detail';
// How this module labels the audit rows it writes on its own endpoints. A
// document reconciling its tenders through syncDocumentTenders passes its own
// labels instead, so a tender captured with a bill stays on the bill's screen.
const TENDER_DETAIL_AUDIT: TenderDocumentAudit = {
  tableName: TENDER_DETAIL_TABLE_NAME,
  screenName: TENDER_DETAIL_AUDIT_SCREEN_NAME,
  entityName: 'Tender line',
};
// Amount / instrument / settlement columns copied verbatim from the DTO
// (already normalized by its decorators) onto the create/update payload; only
// keys present on the request are applied, so a partial update stays partial.
// The document scope, the tender snapshot (tdTenderId / tdTenderTypeId /
// tdTenderLedgerId / tdDrCr) and tdTotalAmt — which is derived — are set
// explicitly, so they are intentionally excluded here.
const TENDER_DETAIL_OPTIONAL_FIELDS = [
  'tdVoucherId',
  'tdAmount',
  'tdSurchargePerc',
  'tdSurchargeAmt',
  'tdReceivedAmt',
  'tdChangeAmt',
  'tdUnitsUsed',
  'tdConversionRate',
  'tdRefNo',
  'tdAuthCode',
  'tdCardLast4',
  'tdBankName',
  'tdPayerVpa',
  'tdInstrumentDate',
  'tdIsPdc',
  'tdSettleStatus',
  'tdSettleLedgerId',
  'tdExpectedSettleOn',
  'tdSettledOn',
  'tdSettleAmount',
  'tdMdrAmt',
  'tdSettleRefNo',
  'tdSettleVoucherId',
  'tdSessionId',
  'tdDeviceId',
  'tdNotes',
];
// NOT NULL columns carrying a DB default: an explicit null is dropped rather
// than written, so the default (or the stored value on update) survives instead
// of the insert failing on a 23502.
const TENDER_DETAIL_DEFAULTED_FIELDS = [
  'tdAmount',
  'tdSurchargePerc',
  'tdSurchargeAmt',
  'tdReceivedAmt',
  'tdChangeAmt',
  'tdUnitsUsed',
  'tdConversionRate',
  'tdIsPdc',
  'tdSettleStatus',
  'tdMdrAmt',
];
// Date-only columns reachable from the payload. JSON carries them as strings,
// Prisma wants Date objects, so each is converted on the way in.
const TENDER_DETAIL_DATE_FIELDS = ['tdInstrumentDate', 'tdExpectedSettleOn', 'tdSettledOn'];
function dropNullish(value: unknown): unknown {
  return value === null ? undefined : value;
}
const CARD_LAST4_PATTERN = /^[0-9]{4}$/;
function toDateOrNull(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    throwAccountsBadRequest<TenderDetailErrorDetail>('Validation failed', [
      { field, message: `${field} must be a valid ISO date` },
    ]);
  }
  return parsed;
}
const TENDER_DETAIL_FIELD_TRANSFORMS: Partial<Record<string, PresentFieldTransform>> = {
  ...Object.fromEntries(TENDER_DETAIL_DEFAULTED_FIELDS.map((field) => [field, dropNullish])),
  ...Object.fromEntries(
    TENDER_DETAIL_DATE_FIELDS.map((field) => [
      field,
      (value: unknown) => toDateOrNull(value, field),
    ]),
  ),
};
type TenderDetailWriteClient = AccountsWriteClient;
type TenderDetailRecord = AccTenderDetail & {
  tender?: { tndName: string } | null;
  ledger?: { ledName: string } | null;
};
// The tender master values a line snapshots when it does not carry its own.
interface TenderMasterSnapshot {
  tndName: string;
  tndTypeId: number;
  tndLedgerId: string;
}
/**
 * CRUD over `accounts.acc_tender_detail` — the money tendered against a
 * document (cash, card, UPI, loyalty points, …), captured while the document is
 * still a draft and carried through to posting.
 *
 * The table is polymorphic: a row belongs to whichever document the
 * (tdSrcModule, tdSrcDocType, tdSrcDocId) triple names, and every td_* column
 * except the amounts is a SNAPSHOT of the tender master taken at tender time,
 * so this service stores what the client sends rather than re-reading the
 * master — the two identity snapshots (tdTenderTypeId / tdTenderLedgerId) being
 * filled from it only when the payload leaves them out.
 *
 * A document that owns its tender lines as part of one save (a bill) reconciles
 * them through `syncDocumentTenders`, which takes the caller's transaction so
 * the header, its lines and its tenders stay all-or-nothing — the same writers,
 * guards and audit trail as the endpoints here.
 *
 * `acc_tender_detail` is LIST-partitioned by `td_acc_year` with a composite
 * `(tdId, tdAccYear)` primary key, so every single-row `.update()` addresses the
 * `tdId_tdAccYear` compound key, exactly as `sale_bill` does.
 */
@Injectable()
export class TenderDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveTenderDetailDto: SaveTenderDetailDto): Promise<TenderDetailPayload> {
    if (saveTenderDetailDto.tdId) {
      return this.updateTenderDetail(saveTenderDetailDto);
    }
    return this.createTenderDetail(saveTenderDetailDto);
  }
  // Single endpoint, two lookups: by id it answers with one tender line, by the
  // document triple with every tender line on that document.
  async get(
    getTenderDetailQueryDto: GetTenderDetailQueryDto,
  ): Promise<TenderDetailPayload | TenderDetailPayload[]> {
    const { tdId, tdSrcModule, tdSrcDocType, tdSrcDocId } = getTenderDetailQueryDto;
    if (tdId && (tdSrcModule || tdSrcDocType || tdSrcDocId)) {
      throwAccountsBadRequest<TenderDetailErrorDetail>('Ambiguous tender line lookup', [
        {
          field: 'tdId',
          message:
            'Send either tdId or the tdSrcModule + tdSrcDocType + tdSrcDocId triple, not both',
        },
      ]);
    }
    if (tdId) {
      return this.getById(tdId);
    }
    if (tdSrcModule && tdSrcDocType && tdSrcDocId) {
      return this.getByDocument(tdSrcModule, tdSrcDocType, tdSrcDocId);
    }
    throwAccountsBadRequest<TenderDetailErrorDetail>('Missing tender line lookup', [
      {
        field: 'tdId',
        message: 'Either tdId, or all of tdSrcModule, tdSrcDocType and tdSrcDocId, is required',
      },
    ]);
  }
  async getById(tdId: string): Promise<TenderDetailPayload> {
    const record = await this.prisma.accTenderDetail.findFirst({
      where: { tdId, tdIsDeleted: false },
      include: this.displayJoins(),
    });
    if (!record) {
      this.throwNotFound(tdId);
    }
    return this.toPayload(record);
  }
  // The tender lines of one document, in the order the tender screen shows them.
  async getByDocument(
    tdSrcModule: TenderSrcModule,
    tdSrcDocType: TenderSrcDocType,
    tdSrcDocId: string,
  ): Promise<TenderDetailPayload[]> {
    const records = await this.findDocumentTenders(
      this.prisma,
      tdSrcModule,
      tdSrcDocType,
      tdSrcDocId,
    );
    return records.map((record) => this.toPayload(record));
  }
  async softDelete(tdId: string): Promise<TenderDetailDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accTenderDetail.findFirst({
        where: { tdId, tdIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound(tdId);
      }
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const modifiedOn = new Date();
      await this.softDeleteTenderLine(tx, existing, actor, modifiedOn, TENDER_DETAIL_AUDIT);
      return { tdId, deleted: true };
    });
  }
  // ---------------------------------------------------------------------
  // Document-owned tender lines
  //
  // What an owning module (a bill) calls instead of writing acc_tender_detail
  // itself. All three take the caller's transaction, so the parent header, its
  // lines and its tenders commit or roll back together.
  // ---------------------------------------------------------------------
  // Reconciles one document's tender lines against the payload array:
  //   - a line carrying tdId updates that existing line
  //   - a line without tdId is created under the parent's scope
  //   - an existing line absent from the array is soft deleted
  // Passing `undefined` (property omitted on the parent payload) leaves the
  // stored lines untouched and just reads them back.
  async syncDocumentTenders(
    tx: TenderDetailWriteClient,
    scope: TenderDocumentScope,
    inputTenders: SaveTenderDetailDto[] | undefined,
    actorId: string,
    audit: TenderDocumentAudit = TENDER_DETAIL_AUDIT,
  ): Promise<TenderDetailPayload[]> {
    const existing = await this.findDocumentTenders(
      tx,
      scope.tdSrcModule,
      scope.tdSrcDocType,
      scope.tdSrcDocId,
    );
    if (inputTenders === undefined) {
      return existing.map((record) => this.toPayload(record));
    }
    const existingMap = new Map(existing.map((tender) => [tender.tdId, tender]));
    const keptIds = new Set<string>();
    const seenRowNos = new Set<number>();
    const now = new Date();
    const persisted: TenderDetailPayload[] = [];
    for (const [index, inputTender] of inputTenders.entries()) {
      // td_row_no carries no DB uniqueness (the table's only index is its PK),
      // so a duplicate within one payload is rejected here; an omitted number
      // takes the line's position in the array.
      const rowNo = inputTender.tdRowNo ?? index + 1;
      if (seenRowNos.has(rowNo)) {
        throwAccountsConflict<TenderDetailErrorDetail>('Duplicate tender line number', [
          {
            field: 'tdRowNo',
            message: `A tender line with number ${rowNo} already exists on this document`,
          },
        ]);
      }
      seenRowNos.add(rowNo);
      const existingTender = inputTender.tdId ? existingMap.get(inputTender.tdId) : undefined;
      if (inputTender.tdId && !existingTender) {
        this.throwNotFound(inputTender.tdId);
      }
      this.ensureDocumentMatchesScope(inputTender, scope);
      if (existingTender) {
        persisted.push(
          await this.updateTenderLine(tx, existingTender, inputTender, rowNo, actorId, now, audit),
        );
        keptIds.add(existingTender.tdId);
        continue;
      }
      const created = await this.insertTenderLine(
        tx,
        scope,
        inputTender,
        rowNo,
        actorId,
        now,
        audit,
      );
      keptIds.add(created.tdId);
      persisted.push(created);
    }
    for (const removed of existing.filter((tender) => !keptIds.has(tender.tdId))) {
      await this.softDeleteTenderLine(tx, removed, actorId, now, audit);
    }
    return persisted.sort((left, right) => left.tdRowNo - right.tdRowNo);
  }
  // The stored tender lines of one document, in row order. Takes the caller's
  // client so an owning module can read them inside its own transaction.
  findDocumentTenders(
    client: TenderDetailWriteClient,
    tdSrcModule: TenderSrcModule,
    tdSrcDocType: TenderSrcDocType,
    tdSrcDocId: string,
  ): Promise<TenderDetailRecord[]> {
    return client.accTenderDetail.findMany({
      where: { tdSrcModule, tdSrcDocType, tdSrcDocId, tdIsDeleted: false },
      include: this.displayJoins(),
      orderBy: { tdRowNo: 'asc' },
    });
  }
  // Retires every tender line of a document in one statement — what an owning
  // module calls when its header is soft deleted, since tendered money must
  // never stay active under a logically deleted document.
  async softDeleteDocumentTenders(
    tx: TenderDetailWriteClient,
    tdSrcModule: TenderSrcModule,
    tdSrcDocType: TenderSrcDocType,
    tdSrcDocId: string,
    actorId: string,
    modifiedOn: Date = new Date(),
  ): Promise<void> {
    await tx.accTenderDetail.updateMany({
      where: { tdSrcModule, tdSrcDocType, tdSrcDocId, tdIsDeleted: false },
      data: {
        tdIsDeleted: true,
        tdModifiedOn: modifiedOn,
        tdModifiedBy: actorId,
      },
    });
  }
  private async createTenderDetail(
    saveTenderDetailDto: SaveTenderDetailDto,
  ): Promise<TenderDetailPayload> {
    const now = new Date();
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    // Standalone create: the request carries the scope an owning module would
    // otherwise inherit from its header, so it is assembled from the payload and
    // every part of it is required.
    const scope: TenderDocumentScope = {
      tdSrcModule: this.requireField(saveTenderDetailDto.tdSrcModule, 'tdSrcModule'),
      tdSrcDocType: this.requireField(saveTenderDetailDto.tdSrcDocType, 'tdSrcDocType'),
      tdSrcDocId: this.requireField(saveTenderDetailDto.tdSrcDocId, 'tdSrcDocId'),
      tdCompanyId: this.requireField(saveTenderDetailDto.tdCompanyId, 'tdCompanyId'),
      tdBranchId: this.requireField(saveTenderDetailDto.tdBranchId, 'tdBranchId'),
      tdTenantId: saveTenderDetailDto.tdTenantId ?? null,
      tdAccYear: normalizeRequiredText<TenderDetailErrorDetail>(
        this.requireField(saveTenderDetailDto.tdAccYear, 'tdAccYear'),
        'tdAccYear',
      ),
      tdDocDate: toDateOrNull(
        this.requireField(saveTenderDetailDto.tdDocDate, 'tdDocDate'),
        'tdDocDate',
      ) as Date,
      tdPartyLedgerId: this.requireField(saveTenderDetailDto.tdPartyLedgerId, 'tdPartyLedgerId'),
      tdUserId: this.requireField(saveTenderDetailDto.tdUserId, 'tdUserId'),
      tdSessionId: saveTenderDetailDto.tdSessionId ?? null,
      tdDeviceId: saveTenderDetailDto.tdDeviceId ?? null,
      tdDrCr: this.requireField(saveTenderDetailDto.tdDrCr, 'tdDrCr'),
    };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rowNo = await this.resolveRowNo(tx, scope, saveTenderDetailDto.tdRowNo ?? null);
        return this.insertTenderLine(
          tx,
          scope,
          saveTenderDetailDto,
          rowNo,
          actor,
          now,
          TENDER_DETAIL_AUDIT,
        );
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async updateTenderDetail(
    saveTenderDetailDto: SaveTenderDetailDto,
  ): Promise<TenderDetailPayload> {
    const tdId = saveTenderDetailDto.tdId!;
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accTenderDetail.findFirst({
          where: { tdId, tdIsDeleted: false },
        });
        if (!existing) {
          this.throwNotFound(tdId);
        }
        this.ensureDocumentIsUnchanged(saveTenderDetailDto, existing);
        const rowNo =
          saveTenderDetailDto.tdRowNo === undefined
            ? existing.tdRowNo
            : await this.resolveRowNo(
                tx,
                {
                  tdSrcModule: existing.tdSrcModule as TenderSrcModule,
                  tdSrcDocType: existing.tdSrcDocType as TenderSrcDocType,
                  tdSrcDocId: existing.tdSrcDocId,
                } as TenderDocumentScope,
                saveTenderDetailDto.tdRowNo,
                tdId,
              );
        return this.updateTenderLine(
          tx,
          existing,
          saveTenderDetailDto,
          rowNo,
          actor,
          new Date(),
          TENDER_DETAIL_AUDIT,
        );
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  // Inserts one tender line under `scope`. Anything the payload sends for the
  // scope wins over the parent's value; tdTenderId is the one reference a new
  // line cannot be created without, and the tender master fills the two
  // identity snapshots the payload leaves out.
  private async insertTenderLine(
    tx: TenderDetailWriteClient,
    scope: TenderDocumentScope,
    saveTenderDetailDto: SaveTenderDetailDto,
    rowNo: number,
    actorId: string,
    now: Date,
    audit: TenderDocumentAudit,
  ): Promise<TenderDetailPayload> {
    const tenderId = this.requireField(saveTenderDetailDto.tdTenderId, 'tdTenderId');
    const tender = await this.ensureTenderExists(tx, tenderId);
    const tenderTypeId =
      saveTenderDetailDto.tdTenderTypeId === undefined
        ? tender.tndTypeId
        : this.toTenderTypeId(saveTenderDetailDto.tdTenderTypeId);
    if (tenderTypeId !== tender.tndTypeId) {
      await this.ensureTenderTypeExists(tx, tenderTypeId);
    }
    const tenderLedgerId = saveTenderDetailDto.tdTenderLedgerId ?? tender.tndLedgerId;
    const ledgerName = await this.ensureLedgerExists(tx, tenderLedgerId, 'tdTenderLedgerId');
    const partyLedgerId = saveTenderDetailDto.tdPartyLedgerId ?? scope.tdPartyLedgerId;
    await this.ensureLedgerExists(tx, partyLedgerId, 'tdPartyLedgerId');
    if (saveTenderDetailDto.tdSettleLedgerId) {
      await this.ensureLedgerExists(tx, saveTenderDetailDto.tdSettleLedgerId, 'tdSettleLedgerId');
    }
    const data: Prisma.AccTenderDetailUncheckedCreateInput = {
      tdSrcModule: scope.tdSrcModule,
      tdSrcDocType: scope.tdSrcDocType,
      tdSrcDocId: scope.tdSrcDocId,
      tdRowNo: rowNo,
      tdCompanyId: saveTenderDetailDto.tdCompanyId ?? scope.tdCompanyId,
      tdBranchId: saveTenderDetailDto.tdBranchId ?? scope.tdBranchId,
      tdTenantId:
        saveTenderDetailDto.tdTenantId === undefined
          ? scope.tdTenantId
          : saveTenderDetailDto.tdTenantId,
      tdAccYear:
        saveTenderDetailDto.tdAccYear === undefined
          ? scope.tdAccYear
          : normalizeRequiredText<TenderDetailErrorDetail>(
              saveTenderDetailDto.tdAccYear,
              'tdAccYear',
            ),
      tdDocDate:
        saveTenderDetailDto.tdDocDate === undefined
          ? scope.tdDocDate
          : (toDateOrNull(saveTenderDetailDto.tdDocDate, 'tdDocDate') as Date),
      tdPartyLedgerId: partyLedgerId,
      tdTenderId: tenderId,
      tdTenderTypeId: tenderTypeId,
      tdTenderLedgerId: tenderLedgerId,
      tdDrCr: saveTenderDetailDto.tdDrCr ?? scope.tdDrCr,
      tdUserId: saveTenderDetailDto.tdUserId ?? scope.tdUserId,
      tdSessionId:
        saveTenderDetailDto.tdSessionId === undefined
          ? scope.tdSessionId
          : saveTenderDetailDto.tdSessionId,
      tdDeviceId:
        saveTenderDetailDto.tdDeviceId === undefined
          ? scope.tdDeviceId
          : saveTenderDetailDto.tdDeviceId,
      tdCreatedOn: now,
      tdCreatedBy: resolveActor(saveTenderDetailDto.tdCreatedBy, actorId),
    };
    applyPresentFields(
      data,
      saveTenderDetailDto,
      TENDER_DETAIL_OPTIONAL_FIELDS,
      TENDER_DETAIL_FIELD_TRANSFORMS,
    );
    data.tdTotalAmt = this.resolveTotalAmt(saveTenderDetailDto, undefined);
    this.ensureValuesAreAllowed(saveTenderDetailDto, undefined, data);
    const created = await tx.accTenderDetail.create({ data });
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: audit.tableName,
        screenName: audit.screenName,
        screenType: 'transaction',
        pk: created.tdId,
        displayName: this.displayName(created, tender.tndName),
        originalRecord: null,
        // Audit tracks stored columns only; the two display names are read from
        // the masters, so they are left out of both snapshots to avoid a
        // spurious "changed" diff.
        modifiedRecord: this.toPayload(created),
        userId: created.tdCreatedBy,
        notes: `${audit.entityName} created`,
      },
      tx,
    );
    return this.toPayload(created, tender.tndName, ledgerName);
  }
  // Updates one stored tender line from a partial payload: only the keys the
  // request actually carries are written, the rest of the row stands.
  private async updateTenderLine(
    tx: TenderDetailWriteClient,
    existing: AccTenderDetail,
    saveTenderDetailDto: SaveTenderDetailDto,
    rowNo: number,
    actorId: string,
    now: Date,
    audit: TenderDocumentAudit,
  ): Promise<TenderDetailPayload> {
    const tenderId = saveTenderDetailDto.tdTenderId ?? existing.tdTenderId;
    const tender = await this.ensureTenderExists(tx, tenderId);
    // Re-picking the tender re-snapshots its type and ledger unless the payload
    // names its own; keeping the tender keeps whatever is stored.
    const tenderChanged = tenderId !== existing.tdTenderId;
    const tenderTypeId =
      saveTenderDetailDto.tdTenderTypeId === undefined
        ? tenderChanged
          ? tender.tndTypeId
          : existing.tdTenderTypeId
        : this.toTenderTypeId(saveTenderDetailDto.tdTenderTypeId);
    if (tenderTypeId !== tender.tndTypeId && tenderTypeId !== existing.tdTenderTypeId) {
      await this.ensureTenderTypeExists(tx, tenderTypeId);
    }
    const tenderLedgerId =
      saveTenderDetailDto.tdTenderLedgerId ??
      (tenderChanged ? tender.tndLedgerId : existing.tdTenderLedgerId);
    const ledgerName = await this.ensureLedgerExists(tx, tenderLedgerId, 'tdTenderLedgerId');
    if (
      saveTenderDetailDto.tdPartyLedgerId &&
      saveTenderDetailDto.tdPartyLedgerId !== existing.tdPartyLedgerId
    ) {
      await this.ensureLedgerExists(tx, saveTenderDetailDto.tdPartyLedgerId, 'tdPartyLedgerId');
    }
    if (
      saveTenderDetailDto.tdSettleLedgerId &&
      saveTenderDetailDto.tdSettleLedgerId !== existing.tdSettleLedgerId
    ) {
      await this.ensureLedgerExists(tx, saveTenderDetailDto.tdSettleLedgerId, 'tdSettleLedgerId');
    }
    const data: Prisma.AccTenderDetailUncheckedUpdateInput = {
      tdRowNo: rowNo,
      tdTenderId: tenderId,
      tdTenderTypeId: tenderTypeId,
      tdTenderLedgerId: tenderLedgerId,
      tdDrCr: saveTenderDetailDto.tdDrCr ?? existing.tdDrCr,
      tdModifiedOn: now,
      tdModifiedBy: resolveActor(saveTenderDetailDto.tdModifiedBy, actorId),
    };
    applyPresentFields(
      data,
      saveTenderDetailDto,
      TENDER_DETAIL_OPTIONAL_FIELDS,
      TENDER_DETAIL_FIELD_TRANSFORMS,
    );
    if (saveTenderDetailDto.tdCompanyId !== undefined) {
      data.tdCompanyId = saveTenderDetailDto.tdCompanyId;
    }
    if (saveTenderDetailDto.tdBranchId !== undefined) {
      data.tdBranchId = saveTenderDetailDto.tdBranchId;
    }
    if (saveTenderDetailDto.tdTenantId !== undefined) {
      data.tdTenantId = saveTenderDetailDto.tdTenantId;
    }
    if (saveTenderDetailDto.tdDocDate !== undefined) {
      data.tdDocDate = toDateOrNull(saveTenderDetailDto.tdDocDate, 'tdDocDate') as Date;
    }
    if (saveTenderDetailDto.tdPartyLedgerId !== undefined) {
      data.tdPartyLedgerId = saveTenderDetailDto.tdPartyLedgerId;
    }
    if (saveTenderDetailDto.tdUserId !== undefined) {
      data.tdUserId = saveTenderDetailDto.tdUserId;
    }
    data.tdTotalAmt = this.resolveTotalAmt(saveTenderDetailDto, existing);
    this.ensureValuesAreAllowed(saveTenderDetailDto, existing, data);
    const updated = await tx.accTenderDetail.update({
      where: { tdId_tdAccYear: { tdId: existing.tdId, tdAccYear: existing.tdAccYear } },
      data,
    });
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: audit.tableName,
        screenName: audit.screenName,
        screenType: 'transaction',
        pk: existing.tdId,
        displayName: this.displayName(updated, tender.tndName),
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload(updated),
        userId: resolveActor(saveTenderDetailDto.tdModifiedBy, actorId),
        notes: `${audit.entityName} updated`,
      },
      tx,
    );
    return this.toPayload(updated, tender.tndName, ledgerName);
  }
  // Retires a single line — the one the reconciliation dropped, or the one the
  // delete endpoint named. acc_tender_detail has no is_active column, so a soft
  // delete is the only retirement there is.
  private async softDeleteTenderLine(
    tx: TenderDetailWriteClient,
    existing: AccTenderDetail,
    actorId: string,
    now: Date,
    audit: TenderDocumentAudit,
  ): Promise<void> {
    const deleted = await tx.accTenderDetail.update({
      where: { tdId_tdAccYear: { tdId: existing.tdId, tdAccYear: existing.tdAccYear } },
      data: {
        tdIsDeleted: true,
        tdModifiedOn: now,
        tdModifiedBy: actorId,
      },
    });
    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: audit.tableName,
        screenName: audit.screenName,
        screenType: 'transaction',
        pk: existing.tdId,
        displayName: this.displayName(existing),
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload(deleted),
        userId: actorId,
        notes: `${audit.entityName} soft deleted`,
      },
      tx,
    );
  }
  // A tender line belongs to the document it was tendered against: re-pointing
  // it at another one would silently move money between documents, so an update
  // may resend the triple but never change it.
  private ensureDocumentIsUnchanged(
    saveTenderDetailDto: SaveTenderDetailDto,
    existing: AccTenderDetail,
  ): void {
    const details: TenderDetailErrorDetail[] = [];
    if (
      saveTenderDetailDto.tdSrcModule &&
      saveTenderDetailDto.tdSrcModule !== (existing.tdSrcModule as TenderSrcModule)
    ) {
      details.push({
        field: 'tdSrcModule',
        message: `tdSrcModule cannot be changed (stored value is ${existing.tdSrcModule})`,
      });
    }
    if (
      saveTenderDetailDto.tdSrcDocType &&
      saveTenderDetailDto.tdSrcDocType !== (existing.tdSrcDocType as TenderSrcDocType)
    ) {
      details.push({
        field: 'tdSrcDocType',
        message: `tdSrcDocType cannot be changed (stored value is ${existing.tdSrcDocType})`,
      });
    }
    if (saveTenderDetailDto.tdSrcDocId && saveTenderDetailDto.tdSrcDocId !== existing.tdSrcDocId) {
      details.push({
        field: 'tdSrcDocId',
        message:
          'tdSrcDocId cannot be changed; delete the line and create it on the other document',
      });
    }
    if (details.length > 0) {
      throwAccountsBadRequest<TenderDetailErrorDetail>(
        'Tender line document is immutable',
        details,
      );
    }
  }
  // Same rule seen from the owning document's side: a tender reconciled as part
  // of a bill save belongs to that bill, so the triple may be echoed on the line
  // but never point somewhere else.
  private ensureDocumentMatchesScope(
    saveTenderDetailDto: SaveTenderDetailDto,
    scope: TenderDocumentScope,
  ): void {
    const details: TenderDetailErrorDetail[] = [];
    if (saveTenderDetailDto.tdSrcModule && saveTenderDetailDto.tdSrcModule !== scope.tdSrcModule) {
      details.push({
        field: 'tdSrcModule',
        message: `tdSrcModule must be ${scope.tdSrcModule} on this document`,
      });
    }
    if (
      saveTenderDetailDto.tdSrcDocType &&
      saveTenderDetailDto.tdSrcDocType !== scope.tdSrcDocType
    ) {
      details.push({
        field: 'tdSrcDocType',
        message: `tdSrcDocType must be ${scope.tdSrcDocType} on this document`,
      });
    }
    if (saveTenderDetailDto.tdSrcDocId && saveTenderDetailDto.tdSrcDocId !== scope.tdSrcDocId) {
      details.push({
        field: 'tdSrcDocId',
        message: 'tdSrcDocId must be the parent document; a tender line cannot be moved off it',
      });
    }
    if (details.length > 0) {
      throwAccountsBadRequest<TenderDetailErrorDetail>(
        'Tender line document is immutable',
        details,
      );
    }
  }
  // td_tender_id has a DB foreign key to acc_tender_master, but that only
  // guarantees the row exists — not that it is usable. Verify it is neither
  // soft-deleted nor inactive, and hand back the snapshot values a line inherits.
  private async ensureTenderExists(
    tx: TenderDetailWriteClient,
    tenderId: string,
  ): Promise<TenderMasterSnapshot> {
    const tender = await tx.accTenderMaster.findFirst({
      where: { tndId: tenderId, tndIsDeleted: false, tndIsActive: true },
      select: { tndName: true, tndTypeId: true, tndLedgerId: true },
    });
    if (!tender) {
      throwAccountsBadRequest<TenderDetailErrorDetail>('Tender does not exist', [
        { field: 'tdTenderId', message: `No active tender found with id ${tenderId}` },
      ]);
    }
    return tender;
  }
  private async ensureTenderTypeExists(
    tx: TenderDetailWriteClient,
    tenderTypeId: number,
  ): Promise<void> {
    const tenderType = await tx.accTenderType.findFirst({
      where: { ttmTypeId: tenderTypeId, ttmIsDeleted: false },
      select: { ttmTypeId: true },
    });
    if (!tenderType) {
      throwAccountsBadRequest<TenderDetailErrorDetail>('Tender type does not exist', [
        {
          field: 'tdTenderTypeId',
          message: `No active tender type found with id ${tenderTypeId.toString()}`,
        },
      ]);
    }
  }
  // Shared by the posting, party and settlement ledgers — the error is reported
  // against whichever field carried the id, and the name is returned so the
  // payload can echo the posting ledger's.
  private async ensureLedgerExists(
    tx: TenderDetailWriteClient,
    ledgerId: string,
    field: string,
  ): Promise<string> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: { ledId: ledgerId, ledIsDeleted: false },
      select: { ledName: true },
    });
    if (!ledger) {
      throwAccountsBadRequest<TenderDetailErrorDetail>('Ledger does not exist', [
        { field, message: `No active account ledger found with id ${ledgerId}` },
      ]);
    }
    return ledger.ledName;
  }
  // td_row_no is the line order within one document. It carries no DB
  // uniqueness, so a duplicate is rejected here; an omitted value gets the next
  // free number.
  private async resolveRowNo(
    tx: TenderDetailWriteClient,
    scope: Pick<TenderDocumentScope, 'tdSrcModule' | 'tdSrcDocType' | 'tdSrcDocId'>,
    requested: number | null,
    excludeId?: string,
  ): Promise<number> {
    const document = {
      tdSrcModule: scope.tdSrcModule,
      tdSrcDocType: scope.tdSrcDocType,
      tdSrcDocId: scope.tdSrcDocId,
      tdIsDeleted: false,
    };
    if (requested === null) {
      const highest = await tx.accTenderDetail.aggregate({
        where: document,
        _max: { tdRowNo: true },
      });
      return (highest._max.tdRowNo ?? 0) + 1;
    }
    const clash = await tx.accTenderDetail.findFirst({
      where: {
        ...document,
        tdRowNo: requested,
        ...(excludeId ? { tdId: { not: excludeId } } : {}),
      },
      select: { tdId: true },
    });
    if (clash) {
      throwAccountsConflict<TenderDetailErrorDetail>('Duplicate tender line number', [
        {
          field: 'tdRowNo',
          message: `A tender line with number ${requested} already exists on this document`,
        },
      ]);
    }
    return requested;
  }
  // td_total_amt is derived: ck_td_total_amt requires it to equal
  // round(td_amount + td_surcharge_amt, 2), so it is computed from the merged
  // row rather than trusted, and a value the client did send is checked against
  // that same sum.
  private resolveTotalAmt(
    saveTenderDetailDto: SaveTenderDetailDto,
    existing: AccTenderDetail | undefined,
  ): Prisma.Decimal {
    const amount = this.mergedDecimal(saveTenderDetailDto.tdAmount, existing?.tdAmount);
    const surcharge = this.mergedDecimal(
      saveTenderDetailDto.tdSurchargeAmt,
      existing?.tdSurchargeAmt,
    );
    const computed = amount.plus(surcharge).toDecimalPlaces(2);
    if (saveTenderDetailDto.tdTotalAmt === undefined) {
      return computed;
    }
    const requested = this.toDecimal(saveTenderDetailDto.tdTotalAmt, 'tdTotalAmt');
    if (!requested.equals(computed)) {
      throwAccountsBadRequest<TenderDetailErrorDetail>('Invalid tender line value', [
        {
          field: 'tdTotalAmt',
          message: `tdTotalAmt must equal tdAmount + tdSurchargeAmt (${computed.toString()})`,
        },
      ]);
    }
    return requested;
  }
  // Mirrors the DB CHECK constraints on acc_tender_detail (ck_td_src_module /
  // ck_td_src_doc_type / ck_td_dr_cr / ck_td_settle_status / ck_td_amounts /
  // ck_td_cash_change / ck_td_units / ck_td_settle_amount / ck_td_mdr /
  // ck_td_settled_on / ck_td_pdc / ck_td_card_last4, migration 20260731090000)
  // so a bad value comes back as a 400 naming the field instead of a raw
  // Postgres 23514. Judged on the MERGED row — `data` already carries the
  // payload's values resolved against the parent scope, and the stored row
  // supplies whatever neither of them set, since a constraint judges the row
  // that will actually be written.
  private ensureValuesAreAllowed(
    saveTenderDetailDto: SaveTenderDetailDto,
    existing: AccTenderDetail | undefined,
    data: Prisma.AccTenderDetailUncheckedCreateInput | Prisma.AccTenderDetailUncheckedUpdateInput,
  ): void {
    const details: TenderDetailErrorDetail[] = [];
    const values: TenderDetailGuardedValues = {
      tdSrcModule: (data.tdSrcModule as string | undefined) ?? existing?.tdSrcModule,
      tdSrcDocType: (data.tdSrcDocType as string | undefined) ?? existing?.tdSrcDocType,
      tdDrCr: (data.tdDrCr as string | undefined) ?? existing?.tdDrCr,
      tdSettleStatus:
        (data.tdSettleStatus as string | undefined) ?? existing?.tdSettleStatus ?? undefined,
    };
    for (const guard of TENDER_DETAIL_VALUE_GUARDS) {
      const value = values[guard.field];
      if (value === undefined) {
        continue;
      }
      if (value === null) {
        details.push({ field: guard.field, message: `${guard.field} is required` });
        continue;
      }
      if (!(guard.allowed as readonly string[]).includes(value)) {
        details.push({
          field: guard.field,
          message: `${guard.field} must be one of: ${guard.allowed.join(', ')}`,
        });
      }
    }
    const received = this.mergedDecimal(saveTenderDetailDto.tdReceivedAmt, existing?.tdReceivedAmt);
    const change = this.mergedDecimal(saveTenderDetailDto.tdChangeAmt, existing?.tdChangeAmt);
    // ck_td_cash_change: change is only meaningful against cash actually taken —
    // a zero received amount is the "no drawer movement" case and is allowed.
    if (!received.isZero() && received.lessThan(change)) {
      details.push({
        field: 'tdChangeAmt',
        message: 'tdChangeAmt cannot exceed tdReceivedAmt',
      });
    }
    const conversionRate = this.mergedDecimal(
      saveTenderDetailDto.tdConversionRate,
      existing?.tdConversionRate,
      1,
    );
    if (conversionRate.lessThanOrEqualTo(0)) {
      details.push({
        field: 'tdConversionRate',
        message: 'tdConversionRate must be greater than 0',
      });
    }
    // td_settle_status is varchar, so the merged value is a plain string —
    // compared against the enum's own value rather than the member.
    const settleStatus: string = values.tdSettleStatus ?? TenderSettleStatus.NA;
    const settledOn =
      saveTenderDetailDto.tdSettledOn === undefined
        ? (existing?.tdSettledOn ?? null)
        : saveTenderDetailDto.tdSettledOn;
    if (settleStatus === String(TenderSettleStatus.SETTLED) && !settledOn) {
      details.push({
        field: 'tdSettledOn',
        message: 'tdSettledOn is required when tdSettleStatus is SETTLED',
      });
    }
    const isPdc = saveTenderDetailDto.tdIsPdc ?? existing?.tdIsPdc ?? false;
    const instrumentDate =
      saveTenderDetailDto.tdInstrumentDate === undefined
        ? (existing?.tdInstrumentDate ?? null)
        : saveTenderDetailDto.tdInstrumentDate;
    if (isPdc && !instrumentDate) {
      details.push({
        field: 'tdInstrumentDate',
        message: 'tdInstrumentDate is required when tdIsPdc is true',
      });
    }
    const cardLast4 =
      saveTenderDetailDto.tdCardLast4 === undefined
        ? (existing?.tdCardLast4 ?? null)
        : saveTenderDetailDto.tdCardLast4;
    if (cardLast4 && !CARD_LAST4_PATTERN.test(cardLast4)) {
      details.push({
        field: 'tdCardLast4',
        message: 'tdCardLast4 must be exactly 4 digits',
      });
    }
    if (details.length > 0) {
      throwAccountsBadRequest<TenderDetailErrorDetail>('Invalid tender line value', details);
    }
  }
  // The value a column will hold once the write lands: the payload's when it
  // sent one, the stored row's otherwise, and the column default for a new line.
  private mergedDecimal(
    sent: string | number | null | undefined,
    stored: Prisma.Decimal | null | undefined,
    columnDefault = 0,
  ): Prisma.Decimal {
    if (sent !== undefined && sent !== null) {
      return this.toDecimal(sent, 'amount');
    }
    if (stored !== undefined && stored !== null) {
      return new Prisma.Decimal(stored);
    }
    return new Prisma.Decimal(columnDefault);
  }
  private toDecimal(value: string | number, field: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(value);
    } catch {
      return throwAccountsBadRequest<TenderDetailErrorDetail>('Validation failed', [
        { field, message: `${field} must be a valid number` },
      ]);
    }
  }
  // acc_tender_types.ttm_type_id is an integer; the API carries it as a string,
  // the way the tender master module carries tndTypeId.
  private toTenderTypeId(value: string | number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed)) {
      return throwAccountsBadRequest<TenderDetailErrorDetail>('Validation failed', [
        { field: 'tdTenderTypeId', message: 'tdTenderTypeId must be an integer' },
      ]);
    }
    return parsed;
  }
  // Generic in the value so an enum-typed DTO field survives the check as its
  // enum rather than widening to string.
  private requireField<T extends string>(value: T | undefined, field: string): T {
    if (!value) {
      throwAccountsBadRequest<TenderDetailErrorDetail>(`${field} is required`, [
        { field, message: `${field} must be provided when creating a tender line` },
      ]);
    }
    return value;
  }
  private displayJoins() {
    return {
      tender: { select: { tndName: true } },
      ledger: { select: { ledName: true } },
    };
  }
  private handleWriteError(error: unknown): void {
    if (isForeignKeyConstraintError(error)) {
      throwAccountsBadRequest<TenderDetailErrorDetail>('Invalid relation reference', [
        {
          field: 'request',
          message:
            'One of the referenced tender / ledger / company / branch / user records does not exist',
        },
      ]);
    }
  }
  private throwNotFound(tdId: string): never {
    throwAccountsNotFound<TenderDetailErrorDetail>(
      'Tender line not found',
      'tdId',
      `No active tender line found with id ${tdId}`,
    );
  }
  private displayName(record: AccTenderDetail, tenderName?: string): string {
    return tenderName || `Tender ${record.tdRowNo}`;
  }
  // td_doc_date / td_instrument_date / td_expected_settle_on / td_settled_on are
  // DATE columns — emitting the full ISO timestamp would hand clients a UTC
  // midnight they have to strip again.
  private toOutputDateOnly(value: Date | null): string | null {
    return value === null ? null : value.toISOString().slice(0, 10);
  }
  // The td_* enum columns are varchar in Postgres, so Prisma reads them back as
  // plain strings and they are asserted to their enum here. Every write path
  // (this module's DTO + ensureValuesAreAllowed) and the ck_td_* CHECK
  // constraints keep the stored values inside the sets, so the assertion cannot
  // invent a member that isn't there.
  //
  // Public so an owning module can shape a tender row it read itself into the
  // one payload every module answers with.
  toPayload(
    record: TenderDetailRecord,
    tenderName: string | null = null,
    tenderLedgerName: string | null = null,
  ): TenderDetailPayload {
    return {
      tdId: record.tdId,
      tdCompanyId: record.tdCompanyId,
      tdBranchId: record.tdBranchId,
      tdTenantId: record.tdTenantId,
      tdAccYear: record.tdAccYear,
      tdSrcModule: record.tdSrcModule as TenderSrcModule,
      tdSrcDocType: record.tdSrcDocType as TenderSrcDocType,
      tdSrcDocId: record.tdSrcDocId,
      tdRowNo: record.tdRowNo,
      tdDocDate: this.toOutputDateOnly(record.tdDocDate) as string,
      tdPartyLedgerId: record.tdPartyLedgerId,
      tdVoucherId: record.tdVoucherId,
      tdTenderId: record.tdTenderId,
      tdTenderName: record.tender?.tndName ?? tenderName,
      tdTenderTypeId: record.tdTenderTypeId.toString(),
      tdTenderLedgerId: record.tdTenderLedgerId,
      tdTenderLedgerName: record.ledger?.ledName ?? tenderLedgerName,
      tdDrCr: record.tdDrCr as TenderDrCr,
      tdAmount: toNumber(record.tdAmount),
      tdSurchargePerc: toNumber(record.tdSurchargePerc),
      tdSurchargeAmt: toNumber(record.tdSurchargeAmt),
      tdTotalAmt: toNumber(record.tdTotalAmt),
      tdReceivedAmt: toNumber(record.tdReceivedAmt),
      tdChangeAmt: toNumber(record.tdChangeAmt),
      tdUnitsUsed: toNumber(record.tdUnitsUsed),
      tdConversionRate: toNumber(record.tdConversionRate),
      tdRefNo: record.tdRefNo,
      tdAuthCode: record.tdAuthCode,
      tdCardLast4: record.tdCardLast4,
      tdBankName: record.tdBankName,
      tdPayerVpa: record.tdPayerVpa,
      tdInstrumentDate: this.toOutputDateOnly(record.tdInstrumentDate),
      tdIsPdc: record.tdIsPdc,
      tdSettleStatus: record.tdSettleStatus as TenderSettleStatus,
      tdSettleLedgerId: record.tdSettleLedgerId,
      tdExpectedSettleOn: this.toOutputDateOnly(record.tdExpectedSettleOn),
      tdSettledOn: this.toOutputDateOnly(record.tdSettledOn),
      tdSettleAmount: toNullableNumber(record.tdSettleAmount),
      tdMdrAmt: toNumber(record.tdMdrAmt),
      tdSettleRefNo: record.tdSettleRefNo,
      tdSettleVoucherId: record.tdSettleVoucherId,
      tdSessionId: record.tdSessionId,
      tdDeviceId: record.tdDeviceId,
      tdUserId: record.tdUserId,
      tdNotes: record.tdNotes,
      tdIsDeleted: record.tdIsDeleted,
      tdSyncDate: record.tdSyncDate ? record.tdSyncDate.toISOString() : null,
      tdCreatedOn: record.tdCreatedOn.toISOString(),
      tdCreatedBy: record.tdCreatedBy,
      tdModifiedOn: record.tdModifiedOn ? record.tdModifiedOn.toISOString() : null,
      tdModifiedBy: record.tdModifiedBy,
    };
  }
}
