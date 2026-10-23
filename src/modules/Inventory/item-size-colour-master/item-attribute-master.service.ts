import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  throwInventoryBadRequest,
  throwInventoryConflict,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { assertDeleteState, assertNoLiveReferences } from '../utils/master-tree.helper';
import type {
  ItemAttributeErrorDetail,
  ItemAttributeMasterConfig,
  ItemAttributePayload,
} from './types/item-attribute-master.types';

type Row = Record<string, unknown>;

/**
 * Textile auto batch, addendum 2 E1 — the size and the colour master, one
 * service: the two tables differ only by their prefix and the size set.
 *
 * - Company NULL = shared. A name is unique ignoring case among the live rows
 *   of the company and the shared ones (a shared row against the shared ones),
 *   checked under an advisory lock on the folded name; ux_*_name holds the
 *   exact scope in the database.
 * - A taken name is a 409 whose error carries `existingId`, so the quick-add
 *   path (a save with only a name) simply uses the row that has it.
 * - DELETE deletes and RESTORE restores (notes 70 C1); a delete is refused
 *   while a live batch detail names the row — deactivate it instead.
 */
export abstract class ItemAttributeMasterService {
  protected constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    private readonly config: ItemAttributeMasterConfig,
  ) {}

  async save(dto: object): Promise<ItemAttributePayload> {
    const body = dto as Row;
    const id = body[this.name('id')] as string | null | undefined;
    return id ? this.update(id, body) : this.create(body);
  }

  async getById(id: string): Promise<ItemAttributePayload> {
    const [row] = await this.prisma.$queryRaw<Row[]>`
      SELECT * FROM ${this.table()}
       WHERE ${this.col('id')} = ${id}::uuid AND ${this.col('is_deleted')} = false`;
    if (!row) this.throwNotFound(id);
    return this.toPayload(row);
  }

  /** `{ isz_id | icl_id, deleted: true }`. */
  async softDelete(id: string): Promise<ItemAttributePayload> {
    return this.setDeleted(id, true);
  }

  async restore(id: string): Promise<ItemAttributePayload> {
    return this.setDeleted(id, false);
  }

  private async create(body: Row): Promise<ItemAttributePayload> {
    const companyId = (body[this.name('company_id')] as string | null | undefined) ?? null;
    const name = body[this.name('name')] as string;
    const actor = this.actor();
    const fields = this.writableFields(body, 'create');
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (companyId) await this.assertCompany(tx, companyId);
        await this.assertNameFree(tx, companyId, name, null);
        const [created] = await tx.$queryRaw<Row[]>`
          INSERT INTO ${this.table()}
                 (${Prisma.join(
                   fields.map(([column]) => this.col(column)),
                   ', ',
                 )},
                  ${this.col('company_id')}, ${this.col('created_by')})
          VALUES (${Prisma.join(
            fields.map(([, value]) => Prisma.sql`${value}`),
            ', ',
          )},
                  ${companyId}::uuid, ${actor})
          RETURNING *`;
        const payload = this.toPayload(created);
        await this.audit(tx, 'New', payload, null, actor, `${this.titleLabel()} created`);
        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async update(id: string, body: Row): Promise<ItemAttributePayload> {
    const name = body[this.name('name')] as string;
    const actor = this.actor();
    const fields = this.writableFields(body, 'update');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const [existing] = await tx.$queryRaw<Row[]>`
          SELECT * FROM ${this.table()}
           WHERE ${this.col('id')} = ${id}::uuid AND ${this.col('is_deleted')} = false
           FOR UPDATE`;
        if (!existing) this.throwNotFound(id);
        if (name.toUpperCase() !== String(existing[this.name('name')]).toUpperCase()) {
          await this.assertNameFree(
            tx,
            existing[this.name('company_id')] as string | null,
            name,
            id,
          );
        }
        const [updated] = await tx.$queryRaw<Row[]>`
          UPDATE ${this.table()}
             SET ${Prisma.join(
               fields.map(([column, value]) => Prisma.sql`${this.col(column)} = ${value}`),
               ', ',
             )},
                 ${this.col('modified_on')} = now(),
                 ${this.col('modified_by')} = ${actor}
           WHERE ${this.col('id')} = ${id}::uuid
          RETURNING *`;
        const payload = this.toPayload(updated);
        await this.audit(
          tx,
          'update',
          payload,
          this.toPayload(existing),
          actor,
          `${this.titleLabel()} updated`,
        );
        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async setDeleted(id: string, wantDeleted: boolean): Promise<ItemAttributePayload> {
    const actor = this.actor();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const [existing] = await tx.$queryRaw<Row[]>`
          SELECT * FROM ${this.table()} WHERE ${this.col('id')} = ${id}::uuid FOR UPDATE`;
        if (!existing) this.throwNotFound(id);
        const what = {
          label: this.config.label,
          idField: this.name('id'),
          restoreRoute: this.config.restoreRoute,
          alreadyDeletedCode: this.config.codes.ALREADY_DELETED,
          notDeletedCode: this.config.codes.NOT_DELETED,
          inUseCode: this.config.codes.IN_USE,
        };
        assertDeleteState(existing[this.name('is_deleted')] as boolean, wantDeleted, what);
        if (wantDeleted) {
          await assertNoLiveReferences(
            tx,
            [
              {
                table: 'stock.stock_batch_detail',
                column: this.config.batchDetailColumn,
                live: 'sbd_is_deleted = false',
                label: 'batches',
              },
            ],
            id,
            what,
          );
        } else {
          await this.assertNameFree(
            tx,
            existing[this.name('company_id')] as string | null,
            existing[this.name('name')] as string,
            id,
          );
        }
        const [changed] = await tx.$queryRaw<Row[]>`
          UPDATE ${this.table()}
             SET ${this.col('is_deleted')} = ${wantDeleted},
                 ${this.col('modified_on')} = now(),
                 ${this.col('modified_by')} = ${actor}
           WHERE ${this.col('id')} = ${id}::uuid
          RETURNING *`;
        await this.audit(
          tx,
          wantDeleted ? 'cancel' : 'update',
          this.toPayload(changed),
          this.toPayload(existing),
          actor,
          `${this.titleLabel()} ${wantDeleted ? 'soft deleted' : 'restored'}`,
        );
        return { [this.name('id')]: id, deleted: wantDeleted };
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  /**
   * The columns a save writes, with their values. On an update a field the
   * body leaves out keeps its value (every DTO field is an own property, so
   * `undefined` is the test, never hasOwnProperty); null clears a nullable one
   * and is ignored on the NOT NULL sort / active flag.
   */
  private writableFields(body: Row, mode: 'create' | 'update'): [string, unknown][] {
    const nullable = ['code', ...(this.config.hasSizeSet ? ['size_set'] : [])];
    const fields: [string, unknown][] = [['name', body[this.name('name')]]];
    for (const column of nullable) {
      const value = body[this.name(column)];
      if (value !== undefined) fields.push([column, value]);
      else if (mode === 'create') fields.push([column, null]);
    }
    for (const column of ['sort', 'is_active']) {
      const value = body[this.name(column)];
      if (value !== undefined && value !== null) fields.push([column, value]);
    }
    return fields;
  }

  private async assertCompany(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
    const [company] = await tx.$queryRaw<{ comp_id: string }[]>`
      SELECT comp_id FROM public.companys WHERE comp_id = ${companyId}::uuid AND comp_is_deleted = false`;
    if (!company) {
      throwInventoryBadRequest<ItemAttributeErrorDetail>('Validation error', [
        {
          field: this.name('company_id'),
          code: this.config.codes.COMPANY_NOT_FOUND,
          message: `No live company has the id ${companyId}.`,
        },
      ]);
    }
  }

  /**
   * A company's row clashes with a live row of that company or a shared one; a
   * shared row with a shared one. Locked on the folded name, so two saves of
   * "XL" and "xl" cannot both pass.
   */
  private async assertNameFree(
    tx: Prisma.TransactionClient,
    companyId: string | null,
    name: string,
    id: string | null,
  ): Promise<void> {
    const folded = name.trim().toUpperCase();
    await tx.$queryRaw`
      SELECT count(pg_advisory_xact_lock(hashtext(${`inventory.${this.config.table}.name`}), hashtext(${folded})))::int AS locked`;
    const [clash] = await tx.$queryRaw<{ id: string; name: string }[]>`
      SELECT ${this.col('id')}::text AS id, ${this.col('name')} AS name
        FROM ${this.table()}
       WHERE upper(${this.col('name')}) = ${folded}
         AND ${this.col('is_deleted')} = false
         AND (${this.col('company_id')} IS NULL OR ${this.col('company_id')} = ${companyId}::uuid)
         ${id ? Prisma.sql`AND ${this.col('id')} <> ${id}::uuid` : Prisma.empty}
       ORDER BY (${this.col('company_id')} IS NULL)
       LIMIT 1`;
    if (clash) {
      throwInventoryConflict<ItemAttributeErrorDetail>(`${this.titleLabel()} name already exists`, [
        {
          field: this.name('name'),
          code: this.config.codes.NAME_TAKEN,
          message: `${this.titleLabel()} "${clash.name}" already exists.`,
          existingId: clash.id,
        },
      ]);
    }
  }

  private async audit(
    tx: Prisma.TransactionClient,
    action: 'New' | 'update' | 'cancel',
    payload: ItemAttributePayload,
    original: ItemAttributePayload | null,
    actor: string,
    notes: string,
  ): Promise<void> {
    await this.auditLogService.logEntityChange(
      {
        action,
        tableName: this.config.table,
        screenName: this.config.auditScreenName,
        screenType: 'master',
        pk: String(payload[this.name('id')]),
        displayName: String(payload[this.name('name')]),
        originalRecord: original,
        modifiedRecord: payload,
        userId: actor,
        notes,
      },
      tx,
    );
  }

  private toPayload(row: Row): ItemAttributePayload {
    const payload: ItemAttributePayload = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === this.name('sync_date')) continue;
      payload[key] =
        value instanceof Date ? value.toISOString() : (value as string | number | boolean | null);
    }
    return payload;
  }

  private throwNotFound(id: string): never {
    throwInventoryNotFound<ItemAttributeErrorDetail>(
      `${this.titleLabel()} not found`,
      this.name('id'),
      `No ${this.config.label} found with id ${id}`,
      this.config.codes.NOT_FOUND,
    );
  }

  /** A unique violation that slipped past the check (a race): the same 409, without the id. */
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemAttributeErrorDetail>(
      error,
      `${this.titleLabel()} name already exists`,
      [
        {
          field: this.name('name'),
          code: this.config.codes.NAME_TAKEN,
          message: `Another live ${this.config.label} already has this name.`,
        },
      ],
    );
  }

  private actor(): string {
    return this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
  }

  private titleLabel(): string {
    return this.config.label.charAt(0).toUpperCase() + this.config.label.slice(1);
  }

  private name(column: string): string {
    return `${this.config.prefix}_${column}`;
  }

  private col(column: string): Prisma.Sql {
    return Prisma.raw(this.name(column));
  }

  private table(): Prisma.Sql {
    return Prisma.raw(`inventory.${this.config.table}`);
  }
}
