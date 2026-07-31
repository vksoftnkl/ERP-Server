import { Injectable } from '@nestjs/common';
import { Prisma, SaleChargeDetail } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { GetChargeDetailQueryDto } from './dto/get-charge-detail-query.dto';
import { SaveChargeDetailDto } from './dto/save-charge-detail.dto';
import {
  CHARGE_DETAIL_VALUE_GUARDS,
  ChargeApplyOn,
  ChargeCostAlloc,
  ChargeDetailDeleteResult,
  ChargeDetailErrorDetail,
  ChargeDetailGuardedValues,
  ChargeDetailPayload,
  ChargeDocType,
  ChargeDocumentAudit,
  ChargeDocumentScope,
  ChargeMethod,
  ChargeRole,
  ChargeType,
} from './types/charge-detail-api.types';
import {
  DEFAULT_ACTOR,
  MasterWriteClient,
  applyPresentFields,
  isForeignKeyConstraintError,
  normalizeRequiredText,
  resolveActor,
  toNullableNumber,
  throwMasterBadRequest,
  throwMasterConflict,
  throwMasterNotFound,
} from 'src/common/utils/module-service.utils';
const CHARGE_DETAIL_TABLE_NAME = 'sale charge detail';
const CHARGE_DETAIL_AUDIT_SCREEN_NAME = 'Charge Detail';
// How this module labels the audit rows it writes on its own endpoints. A
// document reconciling its charges through syncDocumentCharges passes its own
// labels instead, so a charge edited as part of a bill save stays on the bill's
// screen in the trail.
const CHARGE_DETAIL_AUDIT: ChargeDocumentAudit = {
  tableName: CHARGE_DETAIL_TABLE_NAME,
  screenName: CHARGE_DETAIL_AUDIT_SCREEN_NAME,
  entityName: 'Charge line',
};
// Snapshot / amount columns copied verbatim from the DTO (already normalized by
// its decorators) onto the create/update payload; only keys present on the
// request are applied, so a partial update stays partial. The document scope
// (cdDocType / cdDocId / cdCompId / cdBranchId / cdAccYear / cdSlno), the two
// references (cdChgId / cdLedgerCode) and cdVoucherNo are set explicitly, so
// they are intentionally excluded here.
const CHARGE_DETAIL_OPTIONAL_FIELDS = [
  'cdChgName',
  'cdRole',
  'cdMethod',
  'cdType',
  'cdApplyOn',
  'cdLandingCost',
  'cdCostAlloc',
  'cdBeforeTax',
  'cdTaxApl',
  'cdSepPost',
  'cdUnit',
  'cdQtyVal',
  'cdWeight',
  'cdRate',
  'cdAmount',
  'cdTaxCode',
  'cdHsn',
  'cdTaxPerc',
  'cdTaxAmt',
  'cdSgstPerc',
  'cdSgstAmt',
  'cdCgstPerc',
  'cdCgstAmt',
  'cdIgstPerc',
  'cdIgstAmt',
  'cdCessPerc',
  'cdCessAmt',
  'cdNetAmt',
  'cdRemarks',
  'cdIsActive',
];
type ChargeDetailWriteClient = MasterWriteClient;
type ChargeDetailRecord = SaleChargeDetail & { ledger?: { ledName: string } | null };
/**
 * Standalone CRUD over `public.sale_charge_detail` — the per-document applied
 * charges (freight, loading, packing, cash discount, …).
 *
 * The table is polymorphic: a row belongs to whichever document the
 * (cdDocType, cdDocId) pair names, and every cd_* column except the amounts is a
 * SNAPSHOT of the charge master taken at save time, so this service stores what
 * the client sends rather than re-reading the master.
 *
 * A document that owns its charge lines as part of one save (a bill, for
 * instance) reconciles them through `syncDocumentCharges`, which takes the
 * caller's transaction so the header, its lines and its charges stay
 * all-or-nothing — the same writers, guards and audit trail as the endpoints
 * here, with the parent's scope filling in what the payload leaves out.
 */
@Injectable()
export class ChargeDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveChargeDetailDto: SaveChargeDetailDto): Promise<ChargeDetailPayload> {
    if (saveChargeDetailDto.cdId) {
      return this.updateChargeDetail(saveChargeDetailDto);
    }
    return this.createChargeDetail(saveChargeDetailDto);
  }
  // Single endpoint, two lookups: by id it answers with one charge line, by
  // (cdDocType, cdDocId) with every charge line on that document.
  async get(
    getChargeDetailQueryDto: GetChargeDetailQueryDto,
  ): Promise<ChargeDetailPayload | ChargeDetailPayload[]> {
    const { cdId, cdDocType, cdDocId, isActive } = getChargeDetailQueryDto;
    if (cdId && (cdDocType || cdDocId)) {
      throwMasterBadRequest<ChargeDetailErrorDetail>('Ambiguous charge line lookup', [
        { field: 'cdId', message: 'Send either cdId or the cdDocType + cdDocId pair, not both' },
      ]);
    }
    if (cdId) {
      return this.getById(cdId);
    }
    if (cdDocType && cdDocId) {
      return this.getByDocument(cdDocType, cdDocId, isActive);
    }
    throwMasterBadRequest<ChargeDetailErrorDetail>('Missing charge line lookup', [
      {
        field: 'cdId',
        message: 'Either cdId, or both cdDocType and cdDocId, is required',
      },
    ]);
  }
  async getById(cdId: string): Promise<ChargeDetailPayload> {
    const record = await this.prisma.saleChargeDetail.findFirst({
      where: { cdId, cdIsDeleted: false },
      include: { ledger: { select: { ledName: true } } },
    });
    if (!record) {
      this.throwNotFound(cdId);
    }
    return this.toPayload(record);
  }
  // The charge lines of one document, in the order the entry screen shows them
  // (cdSlno, unnumbered rows last). Soft-deleted rows are always excluded;
  // inactive ones only when the caller asks for active rows.
  async getByDocument(
    cdDocType: ChargeDocType,
    cdDocId: string,
    isActive?: boolean,
  ): Promise<ChargeDetailPayload[]> {
    const records = await this.prisma.saleChargeDetail.findMany({
      where: {
        cdDocType,
        cdDocId,
        cdIsDeleted: false,
        ...(isActive === undefined ? {} : { cdIsActive: isActive }),
      },
      include: { ledger: { select: { ledName: true } } },
      orderBy: [{ cdSlno: { sort: 'asc', nulls: 'last' } }, { cdCreatedOn: 'asc' }],
    });
    return records.map((record) => this.toPayload(record));
  }
  async softDelete(cdId: string): Promise<ChargeDetailDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.saleChargeDetail.findFirst({
        where: { cdId, cdIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound(cdId);
      }
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const modifiedOn = new Date();
      const result = await tx.saleChargeDetail.updateMany({
        where: { cdId, cdIsDeleted: false },
        data: {
          cdIsDeleted: true,
          cdIsActive: false,
          cdModifiedOn: modifiedOn,
          cdModifiedBy: actor,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(cdId);
      }
      const modifiedRecord = this.toPayload({
        ...existing,
        cdIsDeleted: true,
        cdIsActive: false,
        cdModifiedOn: modifiedOn,
        cdModifiedBy: actor,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: CHARGE_DETAIL_TABLE_NAME,
          screenName: CHARGE_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: cdId,
          displayName: this.displayName(existing),
          originalRecord: this.toPayload(existing),
          modifiedRecord,
          userId: actor,
          notes: 'Charge line soft deleted',
        },
        tx,
      );
      return { cdId, deleted: true };
    });
  }
  // ---------------------------------------------------------------------
  // Document-owned charge lines
  //
  // The three methods below are what an owning module (a bill, a quotation)
  // calls instead of reimplementing sale_charge_detail. They take the caller's
  // transaction, so the parent header, its lines and its charges commit or roll
  // back together, and they go through the same writers and guards as this
  // module's own endpoints.
  // ---------------------------------------------------------------------
  // Reconciles one document's charge lines against the payload array:
  //   - a line carrying cdId updates that existing line
  //   - a line without cdId is created under the parent's scope
  //   - an existing line absent from the array is soft deleted
  // Passing `undefined` (property omitted on the parent payload) leaves the
  // stored lines untouched and just reads them back.
  async syncDocumentCharges(
    tx: ChargeDetailWriteClient,
    scope: ChargeDocumentScope,
    inputCharges: SaveChargeDetailDto[] | undefined,
    actorId: string,
    audit: ChargeDocumentAudit = CHARGE_DETAIL_AUDIT,
  ): Promise<ChargeDetailPayload[]> {
    const existing = await this.findDocumentCharges(tx, scope.cdDocType, scope.cdDocId);
    if (inputCharges === undefined) {
      return existing.map((record) => this.toPayload(record));
    }
    const existingMap = new Map(existing.map((charge) => [charge.cdId, charge]));
    const keptIds = new Set<string>();
    const seenSlnos = new Set<number>();
    const now = new Date();
    const persisted: ChargeDetailPayload[] = [];
    for (const [index, inputCharge] of inputCharges.entries()) {
      // cd_slno carries no DB uniqueness, so a duplicate within one payload is
      // rejected here; an omitted number takes the line's position in the array.
      const slno = inputCharge.cdSlno ?? index + 1;
      if (seenSlnos.has(slno)) {
        throwMasterConflict<ChargeDetailErrorDetail>('Duplicate charge line number', [
          {
            field: 'cdSlno',
            message: `A charge line with number ${slno} already exists on this document`,
          },
        ]);
      }
      seenSlnos.add(slno);
      const existingCharge = inputCharge.cdId ? existingMap.get(inputCharge.cdId) : undefined;
      if (inputCharge.cdId && !existingCharge) {
        this.throwNotFound(inputCharge.cdId);
      }
      this.ensureDocumentMatchesScope(inputCharge, scope);
      this.ensureValuesAreAllowed(inputCharge, existingCharge, scope.cdDocType);
      if (existingCharge) {
        persisted.push(
          await this.updateChargeLine(tx, existingCharge, inputCharge, slno, actorId, now, audit),
        );
        keptIds.add(existingCharge.cdId);
        continue;
      }
      const created = await this.insertChargeLine(
        tx,
        scope,
        inputCharge,
        slno,
        actorId,
        now,
        audit,
      );
      keptIds.add(created.cdId);
      persisted.push(created);
    }
    for (const removed of existing.filter((charge) => !keptIds.has(charge.cdId))) {
      await this.softDeleteChargeLine(tx, removed, actorId, now, audit);
    }
    return persisted.sort((left, right) => (left.cdSlno ?? 0) - (right.cdSlno ?? 0));
  }
  // The stored charge lines of one document, in reconciliation order. Takes the
  // caller's client so an owning module can read them inside its own
  // transaction; getByDocument is the same read for a plain HTTP GET.
  findDocumentCharges(
    client: ChargeDetailWriteClient,
    cdDocType: ChargeDocType,
    cdDocId: string,
  ): Promise<ChargeDetailRecord[]> {
    return client.saleChargeDetail.findMany({
      where: { cdDocType, cdDocId, cdIsDeleted: false },
      include: { ledger: { select: { ledName: true } } },
      orderBy: { cdSlno: 'asc' },
    });
  }
  // Retires every charge line of a document in one statement — what an owning
  // module calls when its header is soft deleted, since an active charge must
  // never outlive the document it was charged on.
  async softDeleteDocumentCharges(
    tx: ChargeDetailWriteClient,
    cdDocType: ChargeDocType,
    cdDocId: string,
    actorId: string,
    modifiedOn: Date = new Date(),
  ): Promise<void> {
    await tx.saleChargeDetail.updateMany({
      where: { cdDocType, cdDocId, cdIsDeleted: false },
      data: {
        cdIsDeleted: true,
        cdIsActive: false,
        cdModifiedOn: modifiedOn,
        cdModifiedBy: actorId,
      },
    });
  }
  private async createChargeDetail(
    saveChargeDetailDto: SaveChargeDetailDto,
  ): Promise<ChargeDetailPayload> {
    const now = new Date();
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const docType = this.requireField(saveChargeDetailDto.cdDocType, 'cdDocType');
    const docId = this.requireField(saveChargeDetailDto.cdDocId, 'cdDocId');
    this.requireField(saveChargeDetailDto.cdChgId, 'cdChgId');
    this.requireField(saveChargeDetailDto.cdLedgerCode, 'cdLedgerCode');
    // Standalone create: the request carries the scope an owning module would
    // otherwise inherit from its header, so it is assembled from the payload
    // and every part of it is required.
    const scope: ChargeDocumentScope = {
      cdDocType: docType,
      cdDocId: docId,
      cdCompId: this.requireField(saveChargeDetailDto.cdCompId, 'cdCompId'),
      cdBranchId: this.requireField(saveChargeDetailDto.cdBranchId, 'cdBranchId'),
      cdAccYear: normalizeRequiredText<ChargeDetailErrorDetail>(
        this.requireField(saveChargeDetailDto.cdAccYear, 'cdAccYear'),
        'cdAccYear',
      ),
      cdVoucherNo: null,
    };
    this.ensureValuesAreAllowed(saveChargeDetailDto, undefined, docType);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const slno = await this.resolveSlno(tx, docType, docId, saveChargeDetailDto.cdSlno ?? null);
        return this.insertChargeLine(
          tx,
          scope,
          saveChargeDetailDto,
          slno,
          actor,
          now,
          CHARGE_DETAIL_AUDIT,
        );
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async updateChargeDetail(
    saveChargeDetailDto: SaveChargeDetailDto,
  ): Promise<ChargeDetailPayload> {
    const cdId = saveChargeDetailDto.cdId!;
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saleChargeDetail.findFirst({
          where: { cdId, cdIsDeleted: false },
        });
        if (!existing) {
          this.throwNotFound(cdId);
        }
        this.ensureDocumentIsUnchanged(saveChargeDetailDto, existing);
        this.ensureValuesAreAllowed(
          saveChargeDetailDto,
          existing,
          existing.cdDocType as ChargeDocType,
        );
        const slno =
          saveChargeDetailDto.cdSlno === undefined
            ? existing.cdSlno
            : await this.resolveSlno(
                tx,
                existing.cdDocType,
                existing.cdDocId,
                saveChargeDetailDto.cdSlno,
                cdId,
              );
        return this.updateChargeLine(
          tx,
          existing,
          saveChargeDetailDto,
          slno,
          actor,
          new Date(),
          CHARGE_DETAIL_AUDIT,
        );
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  // Inserts one charge line under `scope`. Anything the payload sends for the
  // scope wins over the parent's value; cdChgId / cdLedgerCode are the two
  // references a new line cannot be created without.
  private async insertChargeLine(
    tx: ChargeDetailWriteClient,
    scope: ChargeDocumentScope,
    saveChargeDetailDto: SaveChargeDetailDto,
    slno: number,
    actorId: string,
    now: Date,
    audit: ChargeDocumentAudit,
  ): Promise<ChargeDetailPayload> {
    const chgId = this.requireField(saveChargeDetailDto.cdChgId, 'cdChgId');
    const ledgerCode = this.requireField(saveChargeDetailDto.cdLedgerCode, 'cdLedgerCode');
    const ledgerName = await this.ensureLedgerExists(tx, ledgerCode);
    await this.ensureChargeExists(tx, chgId);
    const data: Prisma.SaleChargeDetailUncheckedCreateInput = {
      cdDocType: scope.cdDocType,
      cdDocId: scope.cdDocId,
      cdSlno: slno,
      cdCompId: saveChargeDetailDto.cdCompId ?? scope.cdCompId,
      cdBranchId: saveChargeDetailDto.cdBranchId ?? scope.cdBranchId,
      cdAccYear:
        saveChargeDetailDto.cdAccYear === undefined
          ? scope.cdAccYear
          : normalizeRequiredText<ChargeDetailErrorDetail>(
              saveChargeDetailDto.cdAccYear,
              'cdAccYear',
            ),
      cdVoucherNo:
        saveChargeDetailDto.cdVoucherNo === undefined
          ? scope.cdVoucherNo
          : this.toVoucherNo(saveChargeDetailDto.cdVoucherNo),
      cdChgId: chgId,
      cdLedgerCode: ledgerCode,
      cdCreatedOn: now,
      cdCreatedBy: resolveActor(saveChargeDetailDto.cdCreatedBy, actorId),
    };
    applyPresentFields(data, saveChargeDetailDto, CHARGE_DETAIL_OPTIONAL_FIELDS);
    const created = await tx.saleChargeDetail.create({ data });
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: audit.tableName,
        screenName: audit.screenName,
        screenType: 'transaction',
        pk: created.cdId,
        displayName: this.displayName(created),
        originalRecord: null,
        // Audit tracks stored columns only; cdLedgerName is read from the
        // ledger, so it is left out of both snapshots to avoid a spurious
        // "changed" diff.
        modifiedRecord: this.toPayload(created),
        userId: created.cdCreatedBy ?? actorId,
        notes: `${audit.entityName} created`,
      },
      tx,
    );
    return this.toPayload(created, ledgerName);
  }
  // Updates one stored charge line from a partial payload: only the keys the
  // request actually carries are written, the rest of the row stands.
  private async updateChargeLine(
    tx: ChargeDetailWriteClient,
    existing: SaleChargeDetail,
    saveChargeDetailDto: SaveChargeDetailDto,
    slno: number | null,
    actorId: string,
    now: Date,
    audit: ChargeDocumentAudit,
  ): Promise<ChargeDetailPayload> {
    const nextLedgerCode = saveChargeDetailDto.cdLedgerCode ?? existing.cdLedgerCode;
    const nextChgId = saveChargeDetailDto.cdChgId ?? existing.cdChgId;
    const ledgerName = await this.ensureLedgerExists(tx, nextLedgerCode);
    if (nextChgId !== existing.cdChgId) {
      await this.ensureChargeExists(tx, nextChgId);
    }
    const data: Prisma.SaleChargeDetailUncheckedUpdateInput = {
      cdSlno: slno,
      cdChgId: nextChgId,
      cdLedgerCode: nextLedgerCode,
      cdModifiedOn: now,
      cdModifiedBy: resolveActor(saveChargeDetailDto.cdModifiedBy, actorId),
    };
    applyPresentFields(data, saveChargeDetailDto, CHARGE_DETAIL_OPTIONAL_FIELDS);
    if (saveChargeDetailDto.cdCompId !== undefined) {
      data.cdCompId = saveChargeDetailDto.cdCompId;
    }
    if (saveChargeDetailDto.cdBranchId !== undefined) {
      data.cdBranchId = saveChargeDetailDto.cdBranchId;
    }
    if (saveChargeDetailDto.cdAccYear !== undefined) {
      data.cdAccYear = normalizeRequiredText<ChargeDetailErrorDetail>(
        saveChargeDetailDto.cdAccYear,
        'cdAccYear',
      );
    }
    if (saveChargeDetailDto.cdVoucherNo !== undefined) {
      data.cdVoucherNo = this.toVoucherNo(saveChargeDetailDto.cdVoucherNo);
    }
    const updated = await tx.saleChargeDetail.update({ where: { cdId: existing.cdId }, data });
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: audit.tableName,
        screenName: audit.screenName,
        screenType: 'transaction',
        pk: existing.cdId,
        displayName: this.displayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload(updated),
        userId: resolveActor(saveChargeDetailDto.cdModifiedBy, actorId),
        notes: `${audit.entityName} updated`,
      },
      tx,
    );
    return this.toPayload(updated, ledgerName);
  }
  // Retires a single line the reconciliation dropped. Flags it inactive as well
  // as deleted, the way this module's own softDelete does.
  private async softDeleteChargeLine(
    tx: ChargeDetailWriteClient,
    existing: SaleChargeDetail,
    actorId: string,
    now: Date,
    audit: ChargeDocumentAudit,
  ): Promise<void> {
    const deleted = await tx.saleChargeDetail.update({
      where: { cdId: existing.cdId },
      data: {
        cdIsDeleted: true,
        cdIsActive: false,
        cdModifiedOn: now,
        cdModifiedBy: actorId,
      },
    });
    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: audit.tableName,
        screenName: audit.screenName,
        screenType: 'transaction',
        pk: existing.cdId,
        displayName: this.displayName(existing),
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload(deleted),
        userId: actorId,
        notes: `${audit.entityName} soft deleted`,
      },
      tx,
    );
  }
  // A charge line belongs to the document it was saved against: re-pointing it
  // at another document would silently move money between vouchers, so an
  // update may resend the pair but never change it.
  private ensureDocumentIsUnchanged(
    saveChargeDetailDto: SaveChargeDetailDto,
    existing: SaleChargeDetail,
  ): void {
    const details: ChargeDetailErrorDetail[] = [];
    // cd_doc_type is varchar in Postgres, so the stored value arrives as a plain
    // string; assert it to compare against the DTO's enum.
    const storedDocType = existing.cdDocType as ChargeDocType;
    if (saveChargeDetailDto.cdDocType && saveChargeDetailDto.cdDocType !== storedDocType) {
      details.push({
        field: 'cdDocType',
        message: `cdDocType cannot be changed (stored value is ${existing.cdDocType})`,
      });
    }
    if (saveChargeDetailDto.cdDocId && saveChargeDetailDto.cdDocId !== existing.cdDocId) {
      details.push({
        field: 'cdDocId',
        message: 'cdDocId cannot be changed; delete the line and create it on the other document',
      });
    }
    if (details.length > 0) {
      throwMasterBadRequest<ChargeDetailErrorDetail>('Charge line document is immutable', details);
    }
  }
  // Same rule seen from the owning document's side: a charge reconciled as part
  // of a bill / quotation save belongs to that document, so the pair may be
  // echoed on the line but never point somewhere else.
  private ensureDocumentMatchesScope(
    saveChargeDetailDto: SaveChargeDetailDto,
    scope: ChargeDocumentScope,
  ): void {
    const details: ChargeDetailErrorDetail[] = [];
    if (saveChargeDetailDto.cdDocType && saveChargeDetailDto.cdDocType !== scope.cdDocType) {
      details.push({
        field: 'cdDocType',
        message: `cdDocType must be ${scope.cdDocType} on this document`,
      });
    }
    if (saveChargeDetailDto.cdDocId && saveChargeDetailDto.cdDocId !== scope.cdDocId) {
      details.push({
        field: 'cdDocId',
        message: 'cdDocId must be the parent document; a charge line cannot be moved off it',
      });
    }
    if (details.length > 0) {
      throwMasterBadRequest<ChargeDetailErrorDetail>('Charge line document is immutable', details);
    }
  }
  // cd_ledger_code has a DB foreign key to acc_ledger_master (migration
  // 20260728150000_sale_charge_detail_relations), but that only guarantees the
  // row exists — not that it is active. Verify it is not soft-deleted to reject
  // orphan mappings early, and return the name so the payload can echo it.
  private async ensureLedgerExists(
    tx: ChargeDetailWriteClient,
    ledgerCode: string,
  ): Promise<string> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: { ledId: ledgerCode, ledIsDeleted: false },
      select: { ledName: true },
    });
    if (!ledger) {
      throwMasterBadRequest<ChargeDetailErrorDetail>('Ledger does not exist', [
        { field: 'cdLedgerCode', message: `No active ledger found with id ${ledgerCode}` },
      ]);
    }
    return ledger.ledName;
  }
  private async ensureChargeExists(tx: ChargeDetailWriteClient, chgId: string): Promise<void> {
    const charge = await tx.chargeMaster.findFirst({
      where: { chgId, chgIsDeleted: false },
      select: { chgId: true },
    });
    if (!charge) {
      throwMasterBadRequest<ChargeDetailErrorDetail>('Charge does not exist', [
        { field: 'cdChgId', message: `No active charge found with id ${chgId}` },
      ]);
    }
  }
  // cd_slno is the line order within one document. It carries no DB uniqueness
  // (the table's only index is on the discriminator pair), so a duplicate is
  // rejected here; an omitted value gets the next free number.
  private async resolveSlno(
    tx: ChargeDetailWriteClient,
    docType: string,
    docId: string,
    requested: number | null,
    excludeId?: string,
  ): Promise<number> {
    if (requested === null) {
      const highest = await tx.saleChargeDetail.aggregate({
        where: { cdDocType: docType, cdDocId: docId, cdIsDeleted: false },
        _max: { cdSlno: true },
      });
      return (highest._max.cdSlno ?? 0) + 1;
    }
    const clash = await tx.saleChargeDetail.findFirst({
      where: {
        cdDocType: docType,
        cdDocId: docId,
        cdSlno: requested,
        cdIsDeleted: false,
        ...(excludeId ? { cdId: { not: excludeId } } : {}),
      },
      select: { cdId: true },
    });
    if (clash) {
      throwMasterConflict<ChargeDetailErrorDetail>('Duplicate charge line number', [
        {
          field: 'cdSlno',
          message: `A charge line with number ${requested} already exists on this document`,
        },
      ]);
    }
    return requested;
  }
  // Mirrors the DB CHECK constraints on sale_charge_detail (ck_cd_doc_type /
  // ck_cd_type / ck_cd_method / ck_cd_apply_on / ck_cd_cost_alloc, migration
  // 20260728140000, plus ck_cd_tax_apl from 20260728130000) so a bad value comes
  // back as a 400 naming the field instead of a raw Postgres 23514. On update the
  // stored row supplies the values the payload did not send, since a constraint
  // judges the merged row.
  private ensureValuesAreAllowed(
    saveChargeDetailDto: SaveChargeDetailDto,
    existing: SaleChargeDetail | undefined,
    docType: ChargeDocType,
  ): void {
    const values: ChargeDetailGuardedValues = {
      cdDocType: docType,
      cdRole: saveChargeDetailDto.cdRole,
      cdMethod: saveChargeDetailDto.cdMethod,
      cdType: saveChargeDetailDto.cdType,
      cdApplyOn: saveChargeDetailDto.cdApplyOn,
      cdCostAlloc: saveChargeDetailDto.cdCostAlloc,
    };
    const details: ChargeDetailErrorDetail[] = [];
    for (const guard of CHARGE_DETAIL_VALUE_GUARDS) {
      const value = values[guard.field];
      if (value === undefined) {
        continue;
      }
      if (value === null) {
        if (!guard.nullable) {
          details.push({ field: guard.field, message: `${guard.field} is required` });
        }
        continue;
      }
      if (!(guard.allowed as readonly string[]).includes(value)) {
        details.push({
          field: guard.field,
          message: `${guard.field} must be one of: ${guard.allowed.join(', ')}`,
        });
      }
    }
    const taxApl = saveChargeDetailDto.cdTaxApl ?? existing?.cdTaxApl ?? false;
    const beforeTax = saveChargeDetailDto.cdBeforeTax ?? existing?.cdBeforeTax ?? false;
    if (taxApl && beforeTax) {
      details.push({
        field: 'cdTaxApl',
        message:
          'cdTaxApl and cdBeforeTax are mutually exclusive: a charge is either taxed at the item rate or carries its own GST',
      });
    }
    if (details.length > 0) {
      throwMasterBadRequest<ChargeDetailErrorDetail>('Invalid charge line value', details);
    }
  }
  // Generic in the value so an enum-typed DTO field survives the check as its
  // enum rather than widening to string.
  private requireField<T extends string>(value: T | undefined, field: string): T {
    if (!value) {
      throwMasterBadRequest<ChargeDetailErrorDetail>(`${field} is required`, [
        { field, message: `${field} must be provided when creating a charge line` },
      ]);
    }
    return value;
  }
  // cd_voucher_no is a bigint column but JSON carries it as a number/string.
  private toVoucherNo(value: string | number | null): bigint | null {
    if (value === null || value === '') {
      return null;
    }
    return BigInt(value);
  }
  private handleWriteError(error: unknown): void {
    if (isForeignKeyConstraintError(error)) {
      throwMasterBadRequest<ChargeDetailErrorDetail>('Invalid relation reference', [
        {
          field: 'request',
          message:
            'One of the referenced charge / ledger / company / branch records does not exist',
        },
      ]);
    }
  }
  private throwNotFound(cdId: string): never {
    throwMasterNotFound<ChargeDetailErrorDetail>(
      'Charge line not found',
      'cdId',
      `No active charge line found with id ${cdId}`,
    );
  }
  private displayName(record: SaleChargeDetail): string {
    return record.cdChgName || `Charge ${record.cdSlno ?? ''}`.trim();
  }
  // The cd_* enum columns are varchar in Postgres, so Prisma reads them back as
  // plain strings and they are asserted to their enum here. Every write path
  // (this module's DTO + ensureValuesAreAllowed, the owning modules' own guards)
  // and the ck_cd_* CHECK constraints keep the stored values inside the sets, so
  // the assertion cannot invent a member that isn't there.
  //
  // Public so an owning module can shape a charge row it read itself into the
  // one payload every module answers with.
  toPayload(record: ChargeDetailRecord, ledgerName: string | null = null): ChargeDetailPayload {
    return {
      cdId: record.cdId,
      cdDocType: record.cdDocType as ChargeDocType,
      cdDocId: record.cdDocId,
      cdSlno: record.cdSlno,
      cdCompId: record.cdCompId,
      cdBranchId: record.cdBranchId,
      cdAccYear: record.cdAccYear,
      cdVoucherNo: record.cdVoucherNo?.toString() ?? null,
      cdChgId: record.cdChgId,
      cdChgName: record.cdChgName,
      cdRole: record.cdRole as ChargeRole | null,
      cdMethod: record.cdMethod as ChargeMethod | null,
      cdType: record.cdType as ChargeType,
      cdApplyOn: record.cdApplyOn as ChargeApplyOn | null,
      cdLedgerCode: record.cdLedgerCode,
      cdLedgerName: record.ledger?.ledName ?? ledgerName,
      cdLandingCost: record.cdLandingCost,
      cdCostAlloc: record.cdCostAlloc as ChargeCostAlloc | null,
      cdBeforeTax: record.cdBeforeTax,
      cdTaxApl: record.cdTaxApl,
      cdSepPost: record.cdSepPost,
      cdUnit: record.cdUnit,
      cdQtyVal: toNullableNumber(record.cdQtyVal),
      cdWeight: toNullableNumber(record.cdWeight),
      cdRate: toNullableNumber(record.cdRate),
      cdAmount: toNullableNumber(record.cdAmount),
      cdTaxCode: record.cdTaxCode,
      cdHsn: record.cdHsn,
      cdTaxPerc: toNullableNumber(record.cdTaxPerc),
      cdTaxAmt: toNullableNumber(record.cdTaxAmt),
      cdSgstPerc: toNullableNumber(record.cdSgstPerc),
      cdSgstAmt: toNullableNumber(record.cdSgstAmt),
      cdCgstPerc: toNullableNumber(record.cdCgstPerc),
      cdCgstAmt: toNullableNumber(record.cdCgstAmt),
      cdIgstPerc: toNullableNumber(record.cdIgstPerc),
      cdIgstAmt: toNullableNumber(record.cdIgstAmt),
      cdCessPerc: toNullableNumber(record.cdCessPerc),
      cdCessAmt: toNullableNumber(record.cdCessAmt),
      cdNetAmt: toNullableNumber(record.cdNetAmt),
      cdRemarks: record.cdRemarks,
      cdIsActive: record.cdIsActive,
      cdIsDeleted: record.cdIsDeleted,
      cdSyncDate: record.cdSyncDate ? record.cdSyncDate.toISOString() : null,
      cdCreatedOn: record.cdCreatedOn.toISOString(),
      cdCreatedBy: record.cdCreatedBy,
      cdModifiedOn: record.cdModifiedOn ? record.cdModifiedOn.toISOString() : null,
      cdModifiedBy: record.cdModifiedBy,
    };
  }
}
