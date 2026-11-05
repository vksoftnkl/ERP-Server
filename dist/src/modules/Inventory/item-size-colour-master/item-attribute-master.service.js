"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemAttributeMasterService = void 0;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const master_tree_helper_1 = require("../utils/master-tree.helper");
class ItemAttributeMasterService {
    prisma;
    auditLogService;
    requestContextService;
    config;
    constructor(prisma, auditLogService, requestContextService, config) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.config = config;
    }
    async save(dto) {
        const body = dto;
        const id = body[this.name('id')];
        return id ? this.update(id, body) : this.create(body);
    }
    async getById(id) {
        const [row] = await this.prisma.$queryRaw `
      SELECT * FROM ${this.table()}
       WHERE ${this.col('id')} = ${id}::uuid AND ${this.col('is_deleted')} = false`;
        if (!row)
            this.throwNotFound(id);
        return this.toPayload(row);
    }
    async softDelete(id) {
        return this.setDeleted(id, true);
    }
    async restore(id) {
        return this.setDeleted(id, false);
    }
    async create(body) {
        const companyId = body[this.name('company_id')] ?? null;
        const name = body[this.name('name')];
        const actor = this.actor();
        const fields = this.writableFields(body, 'create');
        try {
            return await this.prisma.$transaction(async (tx) => {
                if (companyId)
                    await this.assertCompany(tx, companyId);
                await this.assertNameFree(tx, companyId, name, null);
                const [created] = await tx.$queryRaw `
          INSERT INTO ${this.table()}
                 (${client_1.Prisma.join(fields.map(([column]) => this.col(column)), ', ')},
                  ${this.col('company_id')}, ${this.col('created_by')})
          VALUES (${client_1.Prisma.join(fields.map(([, value]) => client_1.Prisma.sql `${value}`), ', ')},
                  ${companyId}::uuid, ${actor})
          RETURNING *`;
                const payload = this.toPayload(created);
                await this.audit(tx, 'New', payload, null, actor, `${this.titleLabel()} created`);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async update(id, body) {
        const name = body[this.name('name')];
        const actor = this.actor();
        const fields = this.writableFields(body, 'update');
        try {
            return await this.prisma.$transaction(async (tx) => {
                const [existing] = await tx.$queryRaw `
          SELECT * FROM ${this.table()}
           WHERE ${this.col('id')} = ${id}::uuid AND ${this.col('is_deleted')} = false
           FOR UPDATE`;
                if (!existing)
                    this.throwNotFound(id);
                if (name.toUpperCase() !== String(existing[this.name('name')]).toUpperCase()) {
                    await this.assertNameFree(tx, existing[this.name('company_id')], name, id);
                }
                const [updated] = await tx.$queryRaw `
          UPDATE ${this.table()}
             SET ${client_1.Prisma.join(fields.map(([column, value]) => client_1.Prisma.sql `${this.col(column)} = ${value}`), ', ')},
                 ${this.col('modified_on')} = now(),
                 ${this.col('modified_by')} = ${actor}
           WHERE ${this.col('id')} = ${id}::uuid
          RETURNING *`;
                const payload = this.toPayload(updated);
                await this.audit(tx, 'update', payload, this.toPayload(existing), actor, `${this.titleLabel()} updated`);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async setDeleted(id, wantDeleted) {
        const actor = this.actor();
        try {
            return await this.prisma.$transaction(async (tx) => {
                const [existing] = await tx.$queryRaw `
          SELECT * FROM ${this.table()} WHERE ${this.col('id')} = ${id}::uuid FOR UPDATE`;
                if (!existing)
                    this.throwNotFound(id);
                const what = {
                    label: this.config.label,
                    idField: this.name('id'),
                    restoreRoute: this.config.restoreRoute,
                    alreadyDeletedCode: this.config.codes.ALREADY_DELETED,
                    notDeletedCode: this.config.codes.NOT_DELETED,
                    inUseCode: this.config.codes.IN_USE,
                };
                (0, master_tree_helper_1.assertDeleteState)(existing[this.name('is_deleted')], wantDeleted, what);
                if (wantDeleted) {
                    await (0, master_tree_helper_1.assertNoLiveReferences)(tx, [
                        {
                            table: 'stock.stock_batch_detail',
                            column: this.config.batchDetailColumn,
                            live: 'sbd_is_deleted = false',
                            label: 'batches',
                        },
                    ], id, what);
                }
                else {
                    await this.assertNameFree(tx, existing[this.name('company_id')], existing[this.name('name')], id);
                }
                const [changed] = await tx.$queryRaw `
          UPDATE ${this.table()}
             SET ${this.col('is_deleted')} = ${wantDeleted},
                 ${this.col('modified_on')} = now(),
                 ${this.col('modified_by')} = ${actor}
           WHERE ${this.col('id')} = ${id}::uuid
          RETURNING *`;
                await this.audit(tx, wantDeleted ? 'cancel' : 'update', this.toPayload(changed), this.toPayload(existing), actor, `${this.titleLabel()} ${wantDeleted ? 'soft deleted' : 'restored'}`);
                return { [this.name('id')]: id, deleted: wantDeleted };
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    writableFields(body, mode) {
        const nullable = ['code', ...(this.config.hasSizeSet ? ['size_set'] : [])];
        const fields = [['name', body[this.name('name')]]];
        for (const column of nullable) {
            const value = body[this.name(column)];
            if (value !== undefined)
                fields.push([column, value]);
            else if (mode === 'create')
                fields.push([column, null]);
        }
        for (const column of ['sort', 'is_active']) {
            const value = body[this.name(column)];
            if (value !== undefined && value !== null)
                fields.push([column, value]);
        }
        return fields;
    }
    async assertCompany(tx, companyId) {
        const [company] = await tx.$queryRaw `
      SELECT comp_id FROM public.companys WHERE comp_id = ${companyId}::uuid AND comp_is_deleted = false`;
        if (!company) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation error', [
                {
                    field: this.name('company_id'),
                    code: this.config.codes.COMPANY_NOT_FOUND,
                    message: `No live company has the id ${companyId}.`,
                },
            ]);
        }
    }
    async assertNameFree(tx, companyId, name, id) {
        const folded = name.trim().toUpperCase();
        await tx.$queryRaw `
      SELECT count(pg_advisory_xact_lock(hashtext(${`inventory.${this.config.table}.name`}), hashtext(${folded})))::int AS locked`;
        const [clash] = await tx.$queryRaw `
      SELECT ${this.col('id')}::text AS id, ${this.col('name')} AS name
        FROM ${this.table()}
       WHERE upper(${this.col('name')}) = ${folded}
         AND ${this.col('is_deleted')} = false
         AND (${this.col('company_id')} IS NULL OR ${this.col('company_id')} = ${companyId}::uuid)
         ${id ? client_1.Prisma.sql `AND ${this.col('id')} <> ${id}::uuid` : client_1.Prisma.empty}
       ORDER BY (${this.col('company_id')} IS NULL)
       LIMIT 1`;
        if (clash) {
            (0, module_service_utils_1.throwInventoryConflict)(`${this.titleLabel()} name already exists`, [
                {
                    field: this.name('name'),
                    code: this.config.codes.NAME_TAKEN,
                    message: `${this.titleLabel()} "${clash.name}" already exists.`,
                    existingId: clash.id,
                },
            ]);
        }
    }
    async audit(tx, action, payload, original, actor, notes) {
        await this.auditLogService.logEntityChange({
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
        }, tx);
    }
    toPayload(row) {
        const payload = {};
        for (const [key, value] of Object.entries(row)) {
            if (key === this.name('sync_date'))
                continue;
            payload[key] =
                value instanceof Date ? value.toISOString() : value;
        }
        return payload;
    }
    throwNotFound(id) {
        (0, module_service_utils_1.throwInventoryNotFound)(`${this.titleLabel()} not found`, this.name('id'), `No ${this.config.label} found with id ${id}`, this.config.codes.NOT_FOUND);
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, `${this.titleLabel()} name already exists`, [
            {
                field: this.name('name'),
                code: this.config.codes.NAME_TAKEN,
                message: `Another live ${this.config.label} already has this name.`,
            },
        ]);
    }
    actor() {
        return this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
    }
    titleLabel() {
        return this.config.label.charAt(0).toUpperCase() + this.config.label.slice(1);
    }
    name(column) {
        return `${this.config.prefix}_${column}`;
    }
    col(column) {
        return client_1.Prisma.raw(this.name(column));
    }
    table() {
        return client_1.Prisma.raw(`inventory.${this.config.table}`);
    }
}
exports.ItemAttributeMasterService = ItemAttributeMasterService;
//# sourceMappingURL=item-attribute-master.service.js.map