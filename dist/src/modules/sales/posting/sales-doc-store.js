"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesDocStore = void 0;
const client_1 = require("@prisma/client");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const tender_detail_api_types_1 = require("../../accountsModule/tenderDetail/types/tender-detail-api.types");
const sales_errors_1 = require("./sales.errors");
const posting_types_1 = require("./types/posting.types");
const transport_band_service_1 = require("./transport-band.service");
class SalesDocStore {
    spec;
    audit;
    charges;
    tenders;
    transportBand;
    constructor(spec, audit, charges, tenders, transportBand) {
        this.spec = spec;
        this.audit = audit;
        this.charges = charges;
        this.tenders = tenders;
        this.transportBand = transportBand;
    }
    f(name) {
        return this.spec.p + name;
    }
    fi(name) {
        return this.spec.ip + name;
    }
    header(tx) {
        return tx[this.spec.headerDelegate];
    }
    items(tx) {
        return tx[this.spec.itemDelegate];
    }
    whereHeader(id, accYear) {
        return { [this.spec.headerWhereUnique]: { [this.f('Id')]: id, [this.f('AccYear')]: accYear } };
    }
    whereItem(id, accYear) {
        return { [this.spec.itemWhereUnique]: { [this.fi('Id')]: id, [this.fi('AccYear')]: accYear } };
    }
    keysOf(row) {
        return {
            id: row[this.f('Id')],
            companyId: row[this.f('CompanyId')],
            branchId: row[this.f('BranchId')],
            accYear: row[this.f('AccYear')],
        };
    }
    status(row) {
        return row[this.f('Status')];
    }
    refno(row) {
        return row[this.spec.refnoField] ?? null;
    }
    async find(c, keys) {
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
    async findOrThrow(c, keys) {
        const row = await this.find(c, keys);
        if (!row) {
            (0, module_service_utils_1.throwSalesNotFound)(`${this.spec.screenName} not found`, this.f('Id'), `No active ${this.spec.screenName.toLowerCase()} found with id ${keys.id}`);
        }
        return row;
    }
    async lock(tx, keys) {
        const table = client_1.Prisma.raw(`sales.${this.spec.tableName}`);
        const p = this.spec.p;
        const rows = await tx.$queryRaw `
      SELECT ${client_1.Prisma.raw(`${p}_id`)} AS id FROM ${table}
       WHERE ${client_1.Prisma.raw(`${p}_id`)} = ${keys.id}::uuid AND ${client_1.Prisma.raw(`${p}_acc_year`)} = ${keys.accYear}::char(9)
         AND ${client_1.Prisma.raw(`${p}_company_id`)} = ${keys.companyId}::uuid AND ${client_1.Prisma.raw(`${p}_branch_id`)} = ${keys.branchId}::uuid
         AND ${client_1.Prisma.raw(`${p}_is_deleted`)} = false
       FOR UPDATE`;
        if (rows.length === 0) {
            (0, module_service_utils_1.throwSalesNotFound)(`${this.spec.screenName} not found`, this.f('Id'), `No active ${this.spec.screenName.toLowerCase()} found with id ${keys.id}`);
        }
        return (await this.find(tx, keys));
    }
    async loadItems(c, row) {
        return this.items(c).findMany({
            where: {
                [this.spec.itemFk]: row[this.f('Id')],
                [this.fi('AccYear')]: row[this.f('AccYear')],
                [this.fi('IsDeleted')]: false,
            },
            orderBy: { [this.fi('LineNo')]: 'asc' },
        });
    }
    async loadCharges(row) {
        if (!this.spec.chargeDocType) {
            return [];
        }
        return this.charges.getByDocument(this.spec.chargeDocType, row[this.f('Id')]);
    }
    async loadTenders(row) {
        if (!this.spec.tenderDocType) {
            return [];
        }
        return this.tenders.getByDocument(tender_detail_api_types_1.TenderSrcModule.SALES, this.spec.tenderDocType, row[this.f('Id')]);
    }
    async loadTransport(c, row) {
        return this.transportBand.read({
            docType: this.spec.transportDocType,
            docId: row[this.f('Id')],
            accYear: row[this.f('AccYear')],
        }, c);
    }
    async saveDraft(tx, dto, actor, now, hooks = {}) {
        for (const k of this.spec.serverOwned) {
            delete dto[k];
        }
        const id = dto[this.f('Id')];
        const accYear = dto[this.f('AccYear')];
        const existing = id
            ? await this.header(tx).findFirst({
                where: { [this.f('Id')]: id, [this.f('IsDeleted')]: false },
            })
            : null;
        if (existing) {
            const st = this.status(existing);
            if (st === 'POSTED') {
                (0, sales_errors_1.throwSalesLocked)(`This ${this.spec.screenName.toLowerCase()} is POSTED — use /amend`, posting_types_1.SALES_ERROR_CODES.DOC_POSTED, this.f('Id'));
            }
            if (st === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)(`This ${this.spec.screenName.toLowerCase()} is CANCELLED`, posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, this.f('Id'));
            }
        }
        const data = {};
        (0, module_service_utils_1.applyPresentFields)(data, dto, this.spec.optionalFields, this.dateTransforms(this.spec.dateFields));
        let row;
        if (!existing) {
            for (const k of this.spec.headerRequired) {
                if (dto[k] === undefined || dto[k] === null || dto[k] === '') {
                    (0, module_service_utils_1.throwSalesBadRequest)(`${k} is required`, [
                        {
                            field: k,
                            message: `${k} must be provided when creating a ${this.spec.screenName.toLowerCase()}`,
                        },
                    ]);
                }
                data[k] = dto[k];
            }
            const docDate = dto[this.spec.dateField]
                ? new Date(dto[this.spec.dateField])
                : now;
            const number = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
                vchrTypeId: this.spec.voucherTypeId,
                companyId: dto[this.f('CompanyId')],
                branchId: dto[this.f('BranchId')],
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
        }
        else {
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
                where: this.whereHeader(existing[this.f('Id')], existing[this.f('AccYear')]),
                data,
            });
        }
        const items = await this.syncItems(tx, row, dto.items, actor, now);
        if (this.spec.chargeDocType) {
            await this.charges.syncDocumentCharges(tx, {
                cdDocType: this.spec.chargeDocType,
                cdDocId: row[this.f('Id')],
                cdCompId: row[this.f('CompanyId')],
                cdBranchId: row[this.f('BranchId')],
                cdAccYear: row[this.f('AccYear')],
                cdVoucherNo: row[this.spec.slnoField] ?? null,
            }, dto.charges, actor, {
                tableName: 'txn_charge_detail',
                screenName: this.spec.screenName,
                entityName: `${this.spec.screenName} charge`,
            });
        }
        if (this.spec.tenderDocType && dto.tenders !== undefined) {
            await this.tenders.syncDocumentTenders(tx, {
                tdSrcModule: tender_detail_api_types_1.TenderSrcModule.SALES,
                tdSrcDocType: this.spec.tenderDocType,
                tdSrcDocId: row[this.f('Id')],
                tdCompanyId: row[this.f('CompanyId')],
                tdBranchId: row[this.f('BranchId')],
                tdTenantId: row[this.f('TenantId')] ?? null,
                tdAccYear: row[this.f('AccYear')],
                tdDocDate: row[this.spec.dateField],
                tdPartyLedgerId: row[this.spec.custField] ?? null,
                tdUserId: row[this.f('UserId')],
                tdSessionId: row[this.f('SessionId')] ?? null,
                tdDeviceId: row[this.f('DeviceId')] ?? null,
                tdDrCr: this.spec.tenderDrCr,
            }, dto.tenders, actor, {
                tableName: 'acc_tender_detail',
                screenName: this.spec.screenName,
                entityName: `${this.spec.screenName} tender`,
            });
        }
        const transport = dto.transport;
        if (transport && transport_band_service_1.TransportBandService.hasContent(transport)) {
            await this.transportBand.write(tx, {
                docType: this.spec.transportDocType,
                docId: row[this.f('Id')],
                accYear: row[this.f('AccYear')],
                companyId: row[this.f('CompanyId')],
                branchId: row[this.f('BranchId')],
                tenantId: row[this.f('TenantId')] ?? null,
                docRefno: this.refno(row),
            }, { ...transport, direction: transport.direction ?? this.spec.transportDirection }, actor, { gdrId: null, now });
        }
        if (hooks.afterWrite) {
            await hooks.afterWrite(row, items);
        }
        await this.trail(tx, row, existing ? txn_status_log_helper_1.TxnStatusEvent.STATUS_CHANGED : txn_status_log_helper_1.TxnStatusEvent.CREATED, existing ? 'DRAFT' : null, 'DRAFT', actor, now, null, !existing);
        await this.audit.logEntityChange({
            action: existing ? 'update' : 'New',
            tableName: this.spec.tableName,
            screenName: this.spec.screenName,
            screenType: 'transaction',
            pk: row[this.f('Id')],
            displayName: this.refno(row) ?? row[this.f('Id')],
            originalRecord: existing ? this.plain(existing) : null,
            modifiedRecord: this.plain(row),
            userId: actor,
            notes: existing ? `${this.spec.screenName} updated` : `${this.spec.screenName} created`,
        }, tx);
        return row;
    }
    async syncItems(tx, row, input, actor, now) {
        const existing = await this.loadItems(tx, row);
        if (input === undefined) {
            return existing;
        }
        const byId = new Map(existing.map((i) => [i[this.fi('Id')], i]));
        const keep = new Set();
        const seen = new Set();
        const resolved = input.map((it, idx) => ({
            it,
            lineNo: it[this.fi('LineNo')] ?? idx + 1,
        }));
        for (const { it, lineNo } of resolved) {
            if (seen.has(lineNo)) {
                (0, module_service_utils_1.throwSalesBadRequest)('Duplicate line number', [
                    { field: this.fi('LineNo'), message: `Line ${lineNo} appears twice` },
                ]);
            }
            seen.add(lineNo);
            const id = it[this.fi('Id')];
            if (id) {
                if (!byId.has(id)) {
                    (0, module_service_utils_1.throwSalesNotFound)('Line not found', this.fi('Id'), `No active line ${id} on this document`);
                }
                keep.add(id);
            }
        }
        for (const old of existing) {
            const id = old[this.fi('Id')];
            if (!keep.has(id)) {
                await this.items(tx).update({
                    where: this.whereItem(id, old[this.fi('AccYear')]),
                    data: {
                        [this.fi('IsDeleted')]: true,
                        [this.fi('ModifiedOn')]: now,
                        [this.fi('ModifiedBy')]: actor,
                    },
                });
            }
        }
        if (keep.size > 0 &&
            resolved.some(({ it, lineNo }) => it[this.fi('Id')] &&
                byId.get(it[this.fi('Id')])?.[this.fi('LineNo')] !== lineNo)) {
            await this.items(tx).updateMany({
                where: { [this.fi('Id')]: { in: [...keep] } },
                data: { [this.fi('LineNo')]: { increment: Math.max(...seen) + 1 } },
            });
        }
        const out = [];
        for (const { it, lineNo } of resolved) {
            const id = it[this.fi('Id')];
            const data = {};
            (0, module_service_utils_1.applyPresentFields)(data, it, this.spec.itemOptionalFields, this.dateTransforms(this.spec.itemDateFields));
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
                out.push(await this.items(tx).update({
                    where: this.whereItem(id, byId.get(id)[this.fi('AccYear')]),
                    data,
                }));
                continue;
            }
            for (const r of this.spec.itemRequired) {
                if (!it[r]) {
                    (0, module_service_utils_1.throwSalesBadRequest)(`${r} is required for a new line`, [
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
        return out.sort((a, b) => a[this.fi('LineNo')] - b[this.fi('LineNo')]);
    }
    async deleteDraft(tx, keys, actor, now) {
        const row = await this.lock(tx, keys);
        const st = this.status(row);
        if (st !== 'DRAFT') {
            (0, sales_errors_1.throwSalesLocked)(st === 'POSTED'
                ? `This ${this.spec.screenName.toLowerCase()} is POSTED — use /cancel`
                : `This ${this.spec.screenName.toLowerCase()} is CANCELLED`, st === 'POSTED' ? posting_types_1.SALES_ERROR_CODES.DOC_POSTED : posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, this.f('Id'));
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
            await this.charges.syncDocumentCharges(tx, {
                cdDocType: this.spec.chargeDocType,
                cdDocId: keys.id,
                cdCompId: keys.companyId,
                cdBranchId: keys.branchId,
                cdAccYear: keys.accYear,
                cdVoucherNo: null,
            }, [], actor, {
                tableName: 'txn_charge_detail',
                screenName: this.spec.screenName,
                entityName: `${this.spec.screenName} charge`,
            });
        }
        await this.transportBand.remove(tx, { docType: this.spec.transportDocType, docId: keys.id, accYear: keys.accYear }, actor);
        const deleted = await this.header(tx).update({
            where: this.whereHeader(keys.id, keys.accYear),
            data: {
                [this.f('IsDeleted')]: true,
                [this.f('ModifiedOn')]: now,
                [this.f('ModifiedBy')]: actor,
            },
        });
        await this.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.DELETED, st, st, actor, now, null, false);
        await this.audit.logEntityChange({
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
        }, tx);
        return deleted;
    }
    async setStatus(tx, row, status, extra, actor, now) {
        return this.header(tx).update({
            where: this.whereHeader(row[this.f('Id')], row[this.f('AccYear')]),
            data: {
                [this.f('Status')]: status,
                ...extra,
                [this.f('ModifiedOn')]: now,
                [this.f('ModifiedBy')]: actor,
            },
        });
    }
    async updateItem(tx, item, data) {
        return this.items(tx).update({
            where: this.whereItem(item[this.fi('Id')], item[this.fi('AccYear')]),
            data,
        });
    }
    async trail(tx, row, event, from, to, actor, now, remarks, write = true) {
        if (!write) {
            return;
        }
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: row[this.f('CompanyId')],
            branchId: row[this.f('BranchId')],
            tenantId: row[this.f('TenantId')] ?? null,
            accYear: row[this.f('AccYear')],
            srcModule: txn_status_log_helper_1.TxnStatusSrcModule.SALES,
            srcDocType: this.spec.statusDocType,
            srcDocId: row[this.f('Id')],
            srcDocRefno: this.refno(row),
            event: event,
            fromStatus: from,
            toStatus: to,
            changedOn: now,
            changedBy: actor,
            remarks,
            deviceId: row[this.f('DeviceId')] ?? null,
            sessionId: row[this.f('SessionId')] ?? null,
        });
    }
    async auditChange(tx, row, action, before, after, actor, notes) {
        await this.audit.logEntityChange({
            action,
            tableName: this.spec.tableName,
            screenName: this.spec.screenName,
            screenType: 'transaction',
            pk: row[this.f('Id')],
            displayName: this.refno(row) ?? row[this.f('Id')],
            originalRecord: before,
            modifiedRecord: after,
            userId: actor,
            notes,
        }, tx);
    }
    plain(row) {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
            if (v instanceof Date) {
                out[k] = v.toISOString();
            }
            else if (typeof v === 'bigint') {
                out[k] = v.toString();
            }
            else if (v instanceof client_1.Prisma.Decimal) {
                out[k] = Number(v.toString());
            }
            else {
                out[k] = v;
            }
        }
        return out;
    }
    dateTransforms(fields) {
        const t = {};
        for (const f of fields) {
            t[f] = (v) => v === null || v === undefined ? v : v instanceof Date ? v : new Date(v);
        }
        return t;
    }
}
exports.SalesDocStore = SalesDocStore;
//# sourceMappingURL=sales-doc-store.js.map