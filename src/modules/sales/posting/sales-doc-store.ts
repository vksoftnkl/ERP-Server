import { Prisma } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { allocateVoucherNumber } from 'src/common/Sequence/voucher-sequence.helper';
import {
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
  appendTxnStatusLog,
} from 'src/common/txn-status-log/txn-status-log.helper';
import {
  applyPresentFields,
  throwSalesBadRequest,
  throwSalesNotFound,
} from 'src/common/utils/module-service.utils';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import type { ChargeDocType } from '../../master/charge-master/types/charge-enum';
import type { SaveChargeDetailDto } from '../../master/charge-detail/dto/save-charge-detail.dto';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import type { SaveTenderDetailDto } from '../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import {
  TenderDrCr,
  TenderSrcDocType,
  TenderSrcModule,
} from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { throwSalesLocked } from './sales.errors';
import { SALES_ERROR_CODES } from './types/posting.types';
import {
  TransportBandService,
  type TransportBandInput,
  type TransportDocType,
} from './transport-band.service';

/**
 * The persistence every NEW sales document shares — a delivery challan, a DC
 * return, a sale return. One header table, one item table, the same DRAFT →
 * POSTED → CANCELLED life, the same house rules (`/create` is a draft upsert,
 * a POSTED id is refused, a delete is DRAFT-only, the number is drawn from the
 * document's own voucher type on create).
 *
 * The three tables differ only in their prefixes, so the store is driven by a
 * `DocSpec` and reads Prisma through the delegate NAMES. That costs static
 * typing on the row objects (they are `DocRow`, a string-keyed record) and buys
 * one implementation instead of three that drift.
 */
export type DocRow = Record<string, unknown> & { [k: string]: unknown };

interface DelegateLike {
  findFirst(args: unknown): Promise<DocRow | null>;
  findMany(args: unknown): Promise<DocRow[]>;
  create(args: unknown): Promise<DocRow>;
  update(args: unknown): Promise<DocRow>;
  updateMany(args: unknown): Promise<{ count: number }>;
  count(args: unknown): Promise<number>;
}

export interface DocSpec {
  kind: 'DELIVERY_CHALLAN' | 'DC_RETURN' | 'SALE_RETURN';
  headerDelegate: string;
  itemDelegate: string;
  /** Column prefixes, e.g. `sdc` / `sdi`. */
  p: string;
  ip: string;
  /** The item's FK to the header, camelCase, e.g. `sdiDcId`. */
  itemFk: string;
  /** Header field names (camelCase) that vary per document. */
  refnoField: string;
  slnoField: string;
  dateField: string;
  datetimeField: string;
  custField: string;
  custNameField: string | null;
  revisionField: string | null;
  voucherTypeId: number;
  menuId: number;
  statusDocType: TxnStatusDocType;
  chargeDocType: ChargeDocType | null;
  tenderDocType: TenderSrcDocType | null;
  tenderDrCr: TenderDrCr;
  transportDocType: TransportDocType;
  transportDirection: 'OUTWARD' | 'INWARD';
  tableName: string;
  itemTableName: string;
  screenName: string;
  optionalFields: readonly string[];
  dateFields: readonly string[];
  serverOwned: readonly string[];
  itemOptionalFields: readonly string[];
  itemDateFields: readonly string[];
  itemRequired: readonly string[];
  /**
   * Header fields the TABLE demands on create beyond the keys the store fills
   * itself — `sdc_counter_id` and its two siblings are NOT NULL with no
   * default, while the DTOs (and `sale_bill.sb_counter_id`) treat the counter
   * as optional. Refused as a 400 naming the field, not a Prisma 500.
   */
  headerRequired: readonly string[];
  /** Defaults a NEW line takes from its header (`sri_price_level` is NOT NULL). */
  itemDefaults?: (header: DocRow) => DocRow;
  /** The composite unique input name Prisma generated, e.g. `sdcId_sdcAccYear`. */
  headerWhereUnique: string;
  itemWhereUnique: string;
}

export interface DocKeys {
  id: string;
  companyId: string;
  branchId: string;
  accYear: string;
}

export class SalesDocStore {
  constructor(
    readonly spec: DocSpec,
    private readonly audit: AuditLogService,
    private readonly charges: ChargeDetailService,
    private readonly tenders: TenderDetailService,
    private readonly transportBand: TransportBandService,
  ) {}

  // ── naming helpers ───────────────────────────────────────────────────────
  f(name: string): string {
    return this.spec.p + name;
  }
  fi(name: string): string {
    return this.spec.ip + name;
  }
  private header(tx: Prisma.TransactionClient): DelegateLike {
    return (tx as unknown as Record<string, DelegateLike>)[this.spec.headerDelegate];
  }
  private items(tx: Prisma.TransactionClient): DelegateLike {
    return (tx as unknown as Record<string, DelegateLike>)[this.spec.itemDelegate];
  }
  private whereHeader(id: string, accYear: string): Record<string, unknown> {
    return { [this.spec.headerWhereUnique]: { [this.f('Id')]: id, [this.f('AccYear')]: accYear } };
  }
  private whereItem(id: string, accYear: string): Record<string, unknown> {
    return { [this.spec.itemWhereUnique]: { [this.fi('Id')]: id, [this.fi('AccYear')]: accYear } };
  }
  keysOf(row: DocRow): DocKeys {
    return {
      id: row[this.f('Id')] as string,
      companyId: row[this.f('CompanyId')] as string,
      branchId: row[this.f('BranchId')] as string,
      accYear: row[this.f('AccYear')] as string,
    };
  }
  status(row: DocRow): string {
    return row[this.f('Status')] as string;
  }
  refno(row: DocRow): string | null {
    return (row[this.spec.refnoField] as string | null) ?? null;
  }

  // ── reads ────────────────────────────────────────────────────────────────
  async find(c: Prisma.TransactionClient, keys: DocKeys): Promise<DocRow | null> {
    return this.header(c).findFirst({
      where: {
        [this.f('Id')]: keys.id,
        [this.f('CompanyId')]: keys.companyId,
        [this.f('BranchId')]: keys.branchId,
        [this.f('AccYear')]: keys.accYear,
        [this.f('IsDeleted')]: false,
      },
    });
  }

  async findOrThrow(c: Prisma.TransactionClient, keys: DocKeys): Promise<DocRow> {
    const row = await this.find(c, keys);
    if (!row) {
      throwSalesNotFound(
        `${this.spec.screenName} not found`,
        this.f('Id'),
        `No active ${this.spec.screenName.toLowerCase()} found with id ${keys.id}`,
      );
    }
    return row;
  }

  async lock(tx: Prisma.TransactionClient, keys: DocKeys): Promise<DocRow> {
    const table = Prisma.raw(`sales.${this.spec.tableName}`);
    const p = this.spec.p;
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT ${Prisma.raw(`${p}_id`)} AS id FROM ${table}
       WHERE ${Prisma.raw(`${p}_id`)} = ${keys.id}::uuid AND ${Prisma.raw(`${p}_acc_year`)} = ${keys.accYear}::char(9)
         AND ${Prisma.raw(`${p}_company_id`)} = ${keys.companyId}::uuid AND ${Prisma.raw(`${p}_branch_id`)} = ${keys.branchId}::uuid
         AND ${Prisma.raw(`${p}_is_deleted`)} = false
       FOR UPDATE`;
    if (rows.length === 0) {
      throwSalesNotFound(
        `${this.spec.screenName} not found`,
        this.f('Id'),
        `No active ${this.spec.screenName.toLowerCase()} found with id ${keys.id}`,
      );
    }
    return (await this.find(tx, keys))!;
  }

  async loadItems(c: Prisma.TransactionClient, row: DocRow): Promise<DocRow[]> {
    return this.items(c).findMany({
      where: {
        [this.spec.itemFk]: row[this.f('Id')],
        [this.fi('AccYear')]: row[this.f('AccYear')],
        [this.fi('IsDeleted')]: false,
      },
      orderBy: { [this.fi('LineNo')]: 'asc' },
    });
  }

  async loadCharges(row: DocRow) {
    if (!this.spec.chargeDocType) {
      return [];
    }
    return this.charges.getByDocument(this.spec.chargeDocType, row[this.f('Id')] as string);
  }

  async loadTenders(row: DocRow) {
    if (!this.spec.tenderDocType) {
      return [];
    }
    return this.tenders.getByDocument(
      TenderSrcModule.SALES,
      this.spec.tenderDocType,
      row[this.f('Id')] as string,
    );
  }

  async loadTransport(c: Prisma.TransactionClient, row: DocRow) {
    return this.transportBand.read(
      {
        docType: this.spec.transportDocType,
        docId: row[this.f('Id')] as string,
        accYear: row[this.f('AccYear')] as string,
      },
      c,
    );
  }

  // ── the draft upsert ─────────────────────────────────────────────────────
  /**
   * `/create`. `dto` is the generated Save*Dto (a string-keyed record here).
   * The id is the client's uuidv7 when it sends one and the row does not yet
   * exist; a POSTED id is refused; a CANCELLED one too.
   */
  async saveDraft(
    tx: Prisma.TransactionClient,
    dto: DocRow,
    actor: string,
    now: Date,
    hooks: {
      beforeWrite?: (data: DocRow, existing: DocRow | null) => Promise<void> | void;
      afterWrite?: (row: DocRow, items: DocRow[]) => Promise<void> | void;
    } = {},
  ): Promise<DocRow> {
    for (const k of this.spec.serverOwned) {
      delete dto[k];
    }
    const id = dto[this.f('Id')] as string | undefined;
    const accYear = dto[this.f('AccYear')] as string;
    const existing = id
      ? await this.header(tx).findFirst({
          where: { [this.f('Id')]: id, [this.f('IsDeleted')]: false },
        })
      : null;
    if (existing) {
      const st = this.status(existing);
      if (st === 'POSTED') {
        throwSalesLocked(
          `This ${this.spec.screenName.toLowerCase()} is POSTED — use /amend`,
          SALES_ERROR_CODES.DOC_POSTED,
          this.f('Id'),
        );
      }
      if (st === 'CANCELLED') {
        throwSalesLocked(
          `This ${this.spec.screenName.toLowerCase()} is CANCELLED`,
          SALES_ERROR_CODES.DOC_CANCELLED,
          this.f('Id'),
        );
      }
    }
    const data: DocRow = {};
    applyPresentFields(
      data,
      dto,
      this.spec.optionalFields,
      this.dateTransforms(this.spec.dateFields),
    );
    let row: DocRow;
    if (!existing) {
      for (const k of this.spec.headerRequired) {
        if (dto[k] === undefined || dto[k] === null || dto[k] === '') {
          throwSalesBadRequest(`${k} is required`, [
            {
              field: k,
              message: `${k} must be provided when creating a ${this.spec.screenName.toLowerCase()}`,
            },
          ]);
        }
        data[k] = dto[k];
      }
      const docDate = (dto[this.spec.dateField] as string | undefined)
        ? new Date(dto[this.spec.dateField] as string)
        : now;
      const number = await allocateVoucherNumber(tx, {
        vchrTypeId: this.spec.voucherTypeId,
        companyId: dto[this.f('CompanyId')] as string,
        branchId: dto[this.f('BranchId')] as string,
        accYear,
        documentDate: docDate,
      });
      Object.assign(data, {
        ...(id ? { [this.f('Id')]: id } : {}),
        [this.f('CompanyId')]: dto[this.f('CompanyId')],
        [this.f('BranchId')]: dto[this.f('BranchId')],
        [this.f('AccYear')]: accYear,
        [this.f('DeviceType')]: dto[this.f('DeviceType')],
        [this.f('DeviceId')]: dto[this.f('DeviceId')],
        [this.f('UserId')]: dto[this.f('UserId')],
        [this.spec.custField]: dto[this.spec.custField],
        ...(this.spec.custNameField
          ? { [this.spec.custNameField]: dto[this.spec.custNameField] }
          : {}),
        [this.spec.slnoField]: number.lastNo,
        [this.spec.refnoField]: number.refno,
        [this.spec.dateField]: docDate,
        [this.f('Status')]: 'DRAFT',
        ...(this.spec.revisionField ? { [this.spec.revisionField]: 1 } : {}),
        [this.f('CreatedOn')]: now,
        [this.f('CreatedBy')]: actor,
      });
      if (hooks.beforeWrite) {
        await hooks.beforeWrite(data, null);
      }
      row = await this.header(tx).create({ data });
    } else {
      // The keys never move on an update.
      for (const k of [
        this.f('Id'),
        this.f('CompanyId'),
        this.f('BranchId'),
        this.f('AccYear'),
        this.spec.slnoField,
        this.spec.refnoField,
      ]) {
        delete data[k];
      }
      Object.assign(data, { [this.f('ModifiedOn')]: now, [this.f('ModifiedBy')]: actor });
      if (hooks.beforeWrite) {
        await hooks.beforeWrite(data, existing);
      }
      row = await this.header(tx).update({
        where: this.whereHeader(
          existing[this.f('Id')] as string,
          existing[this.f('AccYear')] as string,
        ),
        data,
      });
    }
    const items = await this.syncItems(tx, row, dto.items as DocRow[] | undefined, actor, now);
    if (this.spec.chargeDocType) {
      await this.charges.syncDocumentCharges(
        tx,
        {
          cdDocType: this.spec.chargeDocType,
          cdDocId: row[this.f('Id')] as string,
          cdCompId: row[this.f('CompanyId')] as string,
          cdBranchId: row[this.f('BranchId')] as string,
          cdAccYear: row[this.f('AccYear')] as string,
          cdVoucherNo: (row[this.spec.slnoField] as bigint | null) ?? null,
        },
        dto.charges as SaveChargeDetailDto[] | undefined,
        actor,
        {
          tableName: 'txn_charge_detail',
          screenName: this.spec.screenName,
          entityName: `${this.spec.screenName} charge`,
        },
      );
    }
    if (this.spec.tenderDocType && dto.tenders !== undefined) {
      await this.tenders.syncDocumentTenders(
        tx,
        {
          tdSrcModule: TenderSrcModule.SALES,
          tdSrcDocType: this.spec.tenderDocType,
          tdSrcDocId: row[this.f('Id')] as string,
          tdCompanyId: row[this.f('CompanyId')] as string,
          tdBranchId: row[this.f('BranchId')] as string,
          tdTenantId: (row[this.f('TenantId')] as string | null) ?? null,
          tdAccYear: row[this.f('AccYear')] as string,
          tdDocDate: row[this.spec.dateField] as Date,
          tdPartyLedgerId: (row[this.spec.custField] as string | null) ?? null,
          tdUserId: row[this.f('UserId')] as string,
          tdSessionId: (row[this.f('SessionId')] as string | null) ?? null,
          tdDeviceId: (row[this.f('DeviceId')] as string | null) ?? null,
          tdDrCr: this.spec.tenderDrCr,
        },
        dto.tenders as SaveTenderDetailDto[] | undefined,
        actor,
        {
          tableName: 'acc_tender_detail',
          screenName: this.spec.screenName,
          entityName: `${this.spec.screenName} tender`,
        },
      );
    }
    const transport = dto.transport as TransportBandInput | null | undefined;
    if (transport && TransportBandService.hasContent(transport)) {
      await this.transportBand.write(
        tx,
        {
          docType: this.spec.transportDocType,
          docId: row[this.f('Id')] as string,
          accYear: row[this.f('AccYear')] as string,
          companyId: row[this.f('CompanyId')] as string,
          branchId: row[this.f('BranchId')] as string,
          tenantId: (row[this.f('TenantId')] as string | null) ?? null,
          docRefno: this.refno(row),
        },
        { ...transport, direction: transport.direction ?? this.spec.transportDirection },
        actor,
        { gdrId: null, now },
      );
    }
    if (hooks.afterWrite) {
      await hooks.afterWrite(row, items);
    }
    await this.trail(
      tx,
      row,
      existing ? TxnStatusEvent.STATUS_CHANGED : TxnStatusEvent.CREATED,
      existing ? 'DRAFT' : null,
      'DRAFT',
      actor,
      now,
      null,
      !existing,
    );
    await this.audit.logEntityChange(
      {
        action: existing ? 'update' : 'New',
        tableName: this.spec.tableName,
        screenName: this.spec.screenName,
        screenType: 'transaction',
        pk: row[this.f('Id')] as string,
        displayName: this.refno(row) ?? (row[this.f('Id')] as string),
        originalRecord: existing ? this.plain(existing) : null,
        modifiedRecord: this.plain(row),
        userId: actor,
        notes: existing ? `${this.spec.screenName} updated` : `${this.spec.screenName} created`,
      },
      tx,
    );
    return row;
  }

  private async syncItems(
    tx: Prisma.TransactionClient,
    row: DocRow,
    input: DocRow[] | undefined,
    actor: string,
    now: Date,
  ): Promise<DocRow[]> {
    const existing = await this.loadItems(tx, row);
    if (input === undefined) {
      return existing;
    }
    const byId = new Map(existing.map((i) => [i[this.fi('Id')] as string, i]));
    const keep = new Set<string>();
    const seen = new Set<number>();
    const resolved = input.map((it, idx) => ({
      it,
      lineNo: (it[this.fi('LineNo')] as number | undefined) ?? idx + 1,
    }));
    for (const { it, lineNo } of resolved) {
      if (seen.has(lineNo)) {
        throwSalesBadRequest('Duplicate line number', [
          { field: this.fi('LineNo'), message: `Line ${lineNo} appears twice` },
        ]);
      }
      seen.add(lineNo);
      const id = it[this.fi('Id')] as string | undefined;
      if (id) {
        if (!byId.has(id)) {
          throwSalesNotFound(
            'Line not found',
            this.fi('Id'),
            `No active line ${id} on this document`,
          );
        }
        keep.add(id);
      }
    }
    for (const old of existing) {
      const id = old[this.fi('Id')] as string;
      if (!keep.has(id)) {
        await this.items(tx).update({
          where: this.whereItem(id, old[this.fi('AccYear')] as string),
          data: {
            [this.fi('IsDeleted')]: true,
            [this.fi('ModifiedOn')]: now,
            [this.fi('ModifiedBy')]: actor,
          },
        });
      }
    }
    // Park surviving lines above every requested number before renumbering.
    if (
      keep.size > 0 &&
      resolved.some(
        ({ it, lineNo }) =>
          it[this.fi('Id')] &&
          byId.get(it[this.fi('Id')] as string)?.[this.fi('LineNo')] !== lineNo,
      )
    ) {
      await this.items(tx).updateMany({
        where: { [this.fi('Id')]: { in: [...keep] } },
        data: { [this.fi('LineNo')]: { increment: Math.max(...seen) + 1 } },
      });
    }
    const out: DocRow[] = [];
    for (const { it, lineNo } of resolved) {
      const id = it[this.fi('Id')] as string | undefined;
      const data: DocRow = {};
      applyPresentFields(
        data,
        it,
        this.spec.itemOptionalFields,
        this.dateTransforms(this.spec.itemDateFields),
      );
      if (id) {
        Object.assign(data, {
          [this.fi('LineNo')]: lineNo,
          [this.fi('ModifiedOn')]: now,
          [this.fi('ModifiedBy')]: actor,
        });
        for (const r of this.spec.itemRequired) {
          if (it[r] !== undefined) {
            data[r] = it[r];
          }
        }
        out.push(
          await this.items(tx).update({
            where: this.whereItem(id, byId.get(id)![this.fi('AccYear')] as string),
            data,
          }),
        );
        continue;
      }
      for (const r of this.spec.itemRequired) {
        if (!it[r]) {
          throwSalesBadRequest(`${r} is required for a new line`, [
            { field: r, message: `${r} must be provided when creating a line` },
          ]);
        }
        data[r] = it[r];
      }
      if (this.spec.itemDefaults) {
        for (const [k, v] of Object.entries(this.spec.itemDefaults(row))) {
          if (data[k] === undefined || data[k] === null) {
            data[k] = v;
          }
        }
      }
      Object.assign(data, {
        [this.spec.itemFk]: row[this.f('Id')],
        [this.fi('CompanyId')]: row[this.f('CompanyId')],
        [this.fi('BranchId')]: row[this.f('BranchId')],
        [this.fi('TenantId')]: row[this.f('TenantId')] ?? null,
        [this.fi('AccYear')]: row[this.f('AccYear')],
        [this.fi('LineNo')]: lineNo,
        [this.fi('CreatedOn')]: now,
        [this.fi('CreatedBy')]: actor,
      });
      out.push(await this.items(tx).create({ data }));
    }
    return out.sort((a, b) => (a[this.fi('LineNo')] as number) - (b[this.fi('LineNo')] as number));
  }

  // ── DRAFT delete ─────────────────────────────────────────────────────────
  async deleteDraft(
    tx: Prisma.TransactionClient,
    keys: DocKeys,
    actor: string,
    now: Date,
  ): Promise<DocRow> {
    const row = await this.lock(tx, keys);
    const st = this.status(row);
    if (st !== 'DRAFT') {
      throwSalesLocked(
        st === 'POSTED'
          ? `This ${this.spec.screenName.toLowerCase()} is POSTED — use /cancel`
          : `This ${this.spec.screenName.toLowerCase()} is CANCELLED`,
        st === 'POSTED' ? SALES_ERROR_CODES.DOC_POSTED : SALES_ERROR_CODES.DOC_CANCELLED,
        this.f('Id'),
      );
    }
    await this.items(tx).updateMany({
      where: {
        [this.spec.itemFk]: keys.id,
        [this.fi('AccYear')]: keys.accYear,
        [this.fi('IsDeleted')]: false,
      },
      data: {
        [this.fi('IsDeleted')]: true,
        [this.fi('ModifiedOn')]: now,
        [this.fi('ModifiedBy')]: actor,
      },
    });
    if (this.spec.chargeDocType) {
      await this.charges.syncDocumentCharges(
        tx,
        {
          cdDocType: this.spec.chargeDocType,
          cdDocId: keys.id,
          cdCompId: keys.companyId,
          cdBranchId: keys.branchId,
          cdAccYear: keys.accYear,
          cdVoucherNo: null,
        },
        [],
        actor,
        {
          tableName: 'txn_charge_detail',
          screenName: this.spec.screenName,
          entityName: `${this.spec.screenName} charge`,
        },
      );
    }
    await this.transportBand.remove(
      tx,
      { docType: this.spec.transportDocType, docId: keys.id, accYear: keys.accYear },
      actor,
    );
    const deleted = await this.header(tx).update({
      where: this.whereHeader(keys.id, keys.accYear),
      data: {
        [this.f('IsDeleted')]: true,
        [this.f('ModifiedOn')]: now,
        [this.f('ModifiedBy')]: actor,
      },
    });
    await this.trail(tx, row, TxnStatusEvent.DELETED, st, st, actor, now, null, false);
    await this.audit.logEntityChange(
      {
        action: 'cancel',
        tableName: this.spec.tableName,
        screenName: this.spec.screenName,
        screenType: 'transaction',
        pk: keys.id,
        displayName: this.refno(row) ?? keys.id,
        originalRecord: this.plain(row),
        modifiedRecord: null,
        userId: actor,
        notes: `Draft ${this.spec.screenName.toLowerCase()} deleted`,
      },
      tx,
    );
    return deleted;
  }

  // ── status writes ────────────────────────────────────────────────────────
  async setStatus(
    tx: Prisma.TransactionClient,
    row: DocRow,
    status: string,
    extra: DocRow,
    actor: string,
    now: Date,
  ): Promise<DocRow> {
    return this.header(tx).update({
      where: this.whereHeader(row[this.f('Id')] as string, row[this.f('AccYear')] as string),
      data: {
        [this.f('Status')]: status,
        ...extra,
        [this.f('ModifiedOn')]: now,
        [this.f('ModifiedBy')]: actor,
      },
    });
  }

  async updateItem(tx: Prisma.TransactionClient, item: DocRow, data: DocRow): Promise<DocRow> {
    return this.items(tx).update({
      where: this.whereItem(item[this.fi('Id')] as string, item[this.fi('AccYear')] as string),
      data,
    });
  }

  async trail(
    tx: Prisma.TransactionClient,
    row: DocRow,
    event: TxnStatusEvent | string,
    from: string | null,
    to: string,
    actor: string,
    now: Date,
    remarks: string | null,
    write = true,
  ): Promise<void> {
    if (!write) {
      return;
    }
    await appendTxnStatusLog(tx, {
      companyId: row[this.f('CompanyId')] as string,
      branchId: row[this.f('BranchId')] as string,
      tenantId: (row[this.f('TenantId')] as string | null) ?? null,
      accYear: row[this.f('AccYear')] as string,
      srcModule: TxnStatusSrcModule.SALES,
      srcDocType: this.spec.statusDocType,
      srcDocId: row[this.f('Id')] as string,
      srcDocRefno: this.refno(row),
      event: event as TxnStatusEvent,
      fromStatus: from,
      toStatus: to,
      changedOn: now,
      changedBy: actor,
      remarks,
      deviceId: (row[this.f('DeviceId')] as string | null) ?? null,
      sessionId: (row[this.f('SessionId')] as string | null) ?? null,
    });
  }

  async auditChange(
    tx: Prisma.TransactionClient,
    row: DocRow,
    action: 'update' | 'cancel' | 'approve',
    before: unknown,
    after: unknown,
    actor: string,
    notes: string,
  ): Promise<void> {
    await this.audit.logEntityChange(
      {
        action,
        tableName: this.spec.tableName,
        screenName: this.spec.screenName,
        screenType: 'transaction',
        pk: row[this.f('Id')] as string,
        displayName: this.refno(row) ?? (row[this.f('Id')] as string),
        originalRecord: before as Record<string, unknown> | null,
        modifiedRecord: after as Record<string, unknown> | null,
        userId: actor,
        notes,
      },
      tx,
    );
  }

  /** Dates → ISO, bigint → string, Decimal → number: a row the wire can carry. */
  plain(row: DocRow): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) {
        out[k] = v.toISOString();
      } else if (typeof v === 'bigint') {
        out[k] = v.toString();
      } else if (v instanceof Prisma.Decimal) {
        out[k] = Number(v.toString());
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private dateTransforms(fields: readonly string[]): Record<string, (v: unknown) => unknown> {
    const t: Record<string, (v: unknown) => unknown> = {};
    for (const f of fields) {
      t[f] = (v: unknown) =>
        v === null || v === undefined ? v : v instanceof Date ? v : new Date(v as string | number);
    }
    return t;
  }
}
