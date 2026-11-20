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
exports.AuditLogService = exports.maskAuditValue = exports.deviceDisplayName = void 0;
exports.extractSelectList = extractSelectList;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_net_1 = require("node:net");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_screen_sql_constants_1 = require("./audit-screen-sql.constants");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const audit_log_error_codes_1 = require("./types/audit-log-error-codes");
const audit_text_digest_1 = require("./audit-text-digest");
const audit_item_history_1 = require("./audit-item-history");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_ID_PATTERN = /^\d+$/;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const DISPLAY_FIELD_PATTERN = /\b(name|title)\b/i;
const AUDIT_LOG_SELECT = {
    logId: true,
    logDate: true,
    logAction: true,
    logScreenId: true,
    logTableName: true,
    logPk: true,
    logDisplayName: true,
    logOriginalRecord: true,
    logModifiedRecord: true,
    logChangedFields: true,
    logNotes: true,
    logUserId: true,
    logBranchId: true,
    logEntityId: true,
    logRevNo: true,
    logDeviceName: true,
    auditScreen: { select: { screenName: true, screenType: true } },
};
const normalizeAuditFieldLookupToken = (value) => value
    .replace(/["'`]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
const createAuditReferenceTypeMap = (entries) => new Map(entries.map(([label, lookupType]) => [normalizeAuditFieldLookupToken(label), lookupType]));
const GLOBAL_AUDIT_FIELD_REFERENCE_TYPES = createAuditReferenceTypeMap([
    ['Approved By', 'user'],
    ['Area ID', 'area'],
    ['Base Unit ID', 'unit'],
    ['Branch ID', 'branch'],
    ['City ID', 'city'],
    ['Company ID', 'company'],
    ['Company IDs', 'company'],
    ['Created By', 'user'],
    ['Customer Group ID', 'customerGroup'],
    ['Customer ID', 'customer'],
    ['Default Tax ID', 'itemTax'],
    ['Default UOM ID', 'unit'],
    ['Department ID', 'employeeDepartment'],
    ['Designation ID', 'employeeDesignation'],
    ['Device ID', 'device'],
    ['Employee ID', 'employee'],
    ['Item ID', 'item'],
    ['Ledger ID', 'ledger'],
    ['Locked By', 'user'],
    ['Modified By', 'user'],
    ['State ID', 'state'],
    ['Supplier Group ID', 'supplierGroup'],
    ['Tax ID', 'itemTax'],
    ['Tender Type ID', 'tenderType'],
    ['Unit ID', 'unit'],
    ['Unit Rate ID', 'unitRate'],
    ['User ID', 'user'],
]);
const USER_STAMP_KEY_PATTERN = /(^|_)(created_by|modified_by|updated_by|approved_by|locked_by|deleted_by|cancelled_by)$/;
const SCREEN_AUDIT_FIELD_REFERENCE_TYPES = new Map([
    [
        'Account Group Master',
        createAuditReferenceTypeMap([
            ['Child IDs', 'accountGroup'],
            ['Group ID', 'accountGroup'],
            ['Parent Group ID', 'accountGroup'],
        ]),
    ],
    ['Account Ledger Master', createAuditReferenceTypeMap([['Group ID', 'accountGroup']])],
    [
        'Category Master',
        createAuditReferenceTypeMap([
            ['Parent Category ID', 'category'],
            ['Path IDs Cache', 'category'],
        ]),
    ],
    [
        'Godown Location Master',
        createAuditReferenceTypeMap([
            ['Godown ID', 'godownGroup'],
            ['Parent Location ID', 'godownLocation'],
            ['Path IDs Cache', 'godownLocation'],
        ]),
    ],
    [
        'Item Brand Master',
        createAuditReferenceTypeMap([
            ['Parent Brand ID', 'itemBrand'],
            ['Path IDs', 'itemBrand'],
        ]),
    ],
    [
        'Item EAN Code Master',
        createAuditReferenceTypeMap([
            ['Godown ID', 'godownLocation'],
            ['Unit ID', 'unitConversion'],
        ]),
    ],
    [
        'Item Group Master',
        createAuditReferenceTypeMap([
            ['Parent Group ID', 'itemGroup'],
            ['Path IDs Cache', 'itemGroup'],
        ]),
    ],
    [
        'Item Price Master',
        createAuditReferenceTypeMap([
            ['Godown ID', 'godownLocation'],
            ['Unit ID', 'unitConversion'],
        ]),
    ],
    [
        'Item Reorder Master',
        createAuditReferenceTypeMap([
            ['Godown ID', 'godownLocation'],
            ['Unit ID', 'unitConversion'],
        ]),
    ],
    [
        'Item Section Master',
        createAuditReferenceTypeMap([
            ['Parent Section ID', 'itemSection'],
            ['Path IDs', 'itemSection'],
        ]),
    ],
    [
        'Charge Master',
        createAuditReferenceTypeMap([
            ['Ledger', 'ledger'],
            ['Tax Rate', 'itemTax'],
        ]),
    ],
    ['Employee Master', createAuditReferenceTypeMap([['Staff Advance Ledger', 'ledger']])],
    ['Posting Ledger Map', createAuditReferenceTypeMap([['Ledger', 'ledger']])],
    [
        'Print Template',
        createAuditReferenceTypeMap([
            ['Purpose', 'printPurpose'],
            ['Forked From', 'printTemplate'],
        ]),
    ],
    [
        'Print Template Assignments',
        createAuditReferenceTypeMap([
            ['Purpose', 'printPurpose'],
            ['Template', 'printTemplate'],
            ['Printer', 'printerProfile'],
        ]),
    ],
    [
        'Tax Rate Master',
        createAuditReferenceTypeMap([
            ['Supersedes', 'itemTax'],
            ['Ledger', 'ledger'],
        ]),
    ],
    ['Stock Reason Master', createAuditReferenceTypeMap([['Ledger', 'ledger']])],
]);
const MASKED_AUDIT_FIELDS_BY_SCREEN = new Map([
    [
        'Employee Master',
        new Set(['PAN', 'Aadhaar', 'Bank Account No'].map((label) => normalizeAuditFieldLookupToken(label))),
    ],
]);
const NOISE_STAMP_KEY_PATTERN = /(^|_)(sync_date|synced_on|modified_on|modified_by|updated_on|updated_by)$/;
const THEME_TEMPLATE_SCREEN_NAME = 'App Theme Template';
const STYLESHEET_TEXT_KEYS = new Set(['Stylesheet', 'tplQss', 'tpl_qss']);
const deviceDisplayName = (device) => device.devDeviceName?.trim() || device.devCode?.trim() || device.devDeviceUid;
exports.deviceDisplayName = deviceDisplayName;
const MASK_VISIBLE_TAIL = 4;
const maskAuditValue = (value) => {
    const text = value.trim();
    if (!text) {
        return value;
    }
    if (text.length <= MASK_VISIBLE_TAIL) {
        return 'X'.repeat(text.length);
    }
    return 'X'.repeat(text.length - MASK_VISIBLE_TAIL) + text.slice(-MASK_VISIBLE_TAIL);
};
exports.maskAuditValue = maskAuditValue;
const SAME_SCREEN_RECORD_EXPANSION_BY_SCREEN_NAME = new Map([
    [
        'Print Template',
        async (prisma, ptlId) => {
            if (!UUID_PATTERN.test(ptlId)) {
                return [];
            }
            const versions = await prisma.printTemplateVersion.findMany({
                where: { ptvTemplateId: ptlId },
                select: { ptvId: true },
            });
            const versionIds = versions.map((version) => version.ptvId);
            if (versionIds.length === 0) {
                return [];
            }
            const datasets = await prisma.printTemplateDataset.findMany({
                where: { ptdVersionId: { in: versionIds } },
                select: { ptdId: true },
            });
            return [...versionIds, ...datasets.map((dataset) => dataset.ptdId)];
        },
    ],
    [
        'App Settings',
        async (prisma, recordPk) => {
            let settingKey = recordPk;
            let target = {};
            if (UUID_PATTERN.test(recordPk)) {
                const override = await prisma.appSettingValue.findUnique({
                    where: { asvId: recordPk },
                    select: {
                        asvSettingKey: true,
                        asvScope: true,
                        asvCompanyId: true,
                        asvBranchId: true,
                        asvDeviceId: true,
                        asvUserId: true,
                    },
                });
                if (!override) {
                    return [];
                }
                settingKey = override.asvSettingKey;
                target = {
                    asvScope: override.asvScope,
                    asvCompanyId: override.asvCompanyId,
                    asvBranchId: override.asvBranchId,
                    asvDeviceId: override.asvDeviceId,
                    asvUserId: override.asvUserId,
                };
            }
            const overrides = await prisma.appSettingValue.findMany({
                where: { asvSettingKey: settingKey, ...target },
                select: { asvId: true },
            });
            return overrides.map((override) => override.asvId);
        },
    ],
    [
        'Posting Ledger Map',
        async (prisma, recordPk) => {
            let role = recordPk.trim().toUpperCase();
            if (UUID_PATTERN.test(recordPk)) {
                const mapping = await prisma.accLedgerMap.findUnique({
                    where: { almId: recordPk },
                    select: { almRole: true },
                });
                if (!mapping) {
                    return [];
                }
                role = mapping.almRole;
            }
            const mappings = await prisma.accLedgerMap.findMany({
                where: { almRole: role },
                select: { almId: true },
            });
            return mappings.map((mapping) => mapping.almId);
        },
    ],
    [
        'Tax Rate Master',
        async (prisma, taxId) => {
            if (!UUID_PATTERN.test(taxId)) {
                return [];
            }
            const lines = await prisma.taxRateLedger.findMany({
                where: { trlTaxId: taxId },
                select: { trlId: true },
            });
            return lines.map((line) => line.trlId);
        },
    ],
]);
const RELATED_AUDIT_SCREENS_BY_SCREEN_NAME = new Map([
    [
        'Item Master',
        [
            {
                screenName: 'Item Unit Conversion Master',
                findChildPks: async (prisma, itemId) => {
                    const rows = await prisma.itemUnitConversion.findMany({
                        where: { iucItemId: itemId },
                        select: { iucId: true },
                    });
                    return rows.map((row) => row.iucId);
                },
            },
            {
                screenName: 'Item Price Master',
                findChildPks: async (prisma, itemId) => {
                    const rows = await prisma.itemPriceMaster.findMany({
                        where: { ipmItemId: itemId },
                        select: { ipmId: true },
                    });
                    return rows.map((row) => row.ipmId);
                },
            },
            {
                screenName: 'Item EAN Code Master',
                findChildPks: async (prisma, itemId) => {
                    const rows = await prisma.itemEanCode.findMany({
                        where: { eanItemId: itemId },
                        select: { eanId: true },
                    });
                    return rows.map((row) => row.eanId);
                },
            },
            {
                screenName: 'Item Reorder Master',
                findChildPks: async (prisma, itemId) => {
                    const rows = await prisma.itemReorder.findMany({
                        where: { irItemId: itemId },
                        select: { irId: true },
                    });
                    return rows.map((row) => row.irId);
                },
            },
        ],
    ],
]);
let AuditLogService = class AuditLogService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async captureScreenSnapshot(input, tx) {
        const client = tx ?? this.prisma;
        const screen = await client.auditScreen.findFirst({
            where: {
                screenId: input.screenId,
                screenStatus: true,
            },
            select: {
                screenId: true,
            },
        });
        if (!screen) {
            throwAuditLogInvalid(`No active audit screen found with id ${input.screenId}`, 'screenId', audit_log_error_codes_1.AuditLogErrorCode.SCREEN_NOT_FOUND);
        }
        return null;
    }
    async list(queryDto, scope) {
        const limit = Math.min(queryDto.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
        const page = queryDto.page ?? DEFAULT_PAGE;
        const cursor = queryDto.cursor?.trim() || undefined;
        const includeTotal = queryDto.include_total === true;
        const { where, compositeHistory } = await this.buildWhereClause(queryDto);
        if (scope?.screenIds) {
            where.AND = [...this.whereAndOf(where), { logScreenId: { in: scope.screenIds } }];
        }
        const orderBy = [
            { logDate: 'desc' },
            { logId: 'desc' },
        ];
        const findArgs = {
            where,
            select: AUDIT_LOG_SELECT,
            orderBy,
            take: limit,
            ...(cursor
                ? { cursor: { logId: cursor }, skip: 1 }
                : { skip: (page - 1) * limit }),
        };
        const [records, total] = await Promise.all([
            this.prisma.auditLog.findMany(findArgs),
            includeTotal ? this.prisma.auditLog.count({ where }) : Promise.resolve(null),
        ]);
        const preparedRecords = records
            .map((r) => this.prepareAuditLogListRecord(r))
            .filter((prepared) => !compositeHistory ||
            prepared.record.logAction !== 'update' ||
            !this.isEmptyChange(prepared.changedFields));
        const userIds = [
            ...new Set(records.map((r) => r.logUserId).filter((id) => id !== null)),
        ];
        const branchIds = [
            ...new Set(records.map((r) => r.logBranchId).filter((id) => id !== null)),
        ];
        const [userNameById, branchNameById, auditReferenceNameLookup] = await Promise.all([
            this.getUserNameByIds(userIds),
            this.getBranchNameByIds(branchIds),
            this.getAuditReferenceNameLookup(preparedRecords),
        ]);
        const nextCursor = records.length === limit ? (records[records.length - 1]?.logId ?? null) : null;
        return {
            items: preparedRecords.map((r) => this.toListItem(r, userNameById, branchNameById, auditReferenceNameLookup)),
            meta: {
                page: cursor ? null : page,
                limit,
                total,
                total_pages: total !== null ? Math.ceil(total / limit) : null,
                next_cursor: nextCursor,
            },
        };
    }
    whereAndOf(where) {
        if (!where.AND) {
            return [];
        }
        return Array.isArray(where.AND) ? where.AND : [where.AND];
    }
    async buildWhereClause(queryDto) {
        const where = {};
        if (queryDto.action?.trim()) {
            where.logAction = this.normalizeAction(queryDto.action);
        }
        const recordScope = await this.buildRecordScopeFilter(queryDto);
        if (queryDto.screen_id !== undefined && !recordScope?.composite) {
            where.logScreenId = queryDto.screen_id;
        }
        if (recordScope) {
            where.AND = [recordScope.filter];
        }
        const dateFrom = queryDto.date_from
            ? this.parseDateBoundary(queryDto.date_from, 'start')
            : undefined;
        const dateTo = queryDto.date_to ? this.parseDateBoundary(queryDto.date_to, 'end') : undefined;
        if (dateFrom && dateTo && dateFrom > dateTo) {
            throwAuditLogInvalid('date_from must be less than or equal to date_to', 'date_from', audit_log_error_codes_1.AuditLogErrorCode.DATE_RANGE_INVALID);
        }
        if (dateFrom || dateTo) {
            where.logDate = {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
            };
        }
        if (queryDto.search?.trim()) {
            const search = queryDto.search.trim();
            where.OR = [
                { logTableName: { contains: search, mode: 'insensitive' } },
                { logPk: { contains: search, mode: 'insensitive' } },
                { logDisplayName: { contains: search, mode: 'insensitive' } },
                { logNotes: { contains: search, mode: 'insensitive' } },
                { auditScreen: { is: { screenName: { contains: search, mode: 'insensitive' } } } },
            ];
        }
        return { where, compositeHistory: recordScope?.composite ?? false };
    }
    async buildRecordScopeFilter(queryDto) {
        const screenName = queryDto.screen_name?.trim();
        const recordPk = queryDto.record_pk?.trim();
        const screenFilter = screenName
            ? { auditScreen: { is: { screenName } } }
            : {};
        if (!recordPk) {
            return screenName ? { filter: screenFilter, composite: false } : null;
        }
        const expandScreenName = screenName ??
            (queryDto.screen_id !== undefined ? await this.screenNameOf(queryDto.screen_id) : null);
        const expandSameScreen = expandScreenName
            ? SAME_SCREEN_RECORD_EXPANSION_BY_SCREEN_NAME.get(expandScreenName)
            : undefined;
        const ownPkFilter = expandSameScreen
            ? { in: [...new Set([recordPk, ...(await expandSameScreen(this.prisma, recordPk))])] }
            : recordPk;
        const relatedScreens = expandScreenName
            ? RELATED_AUDIT_SCREENS_BY_SCREEN_NAME.get(expandScreenName)
            : undefined;
        if (!relatedScreens || !UUID_PATTERN.test(recordPk)) {
            return { filter: { ...screenFilter, logPk: ownPkFilter }, composite: false };
        }
        const ownScreenFilter = {
            ...screenFilter,
            ...(queryDto.screen_id !== undefined ? { logScreenId: queryDto.screen_id } : {}),
        };
        const relatedFilters = await Promise.all(relatedScreens.map(async (relatedScreen) => {
            const childPks = await relatedScreen.findChildPks(this.prisma, recordPk);
            if (childPks.length === 0) {
                return null;
            }
            return {
                auditScreen: { is: { screenName: relatedScreen.screenName } },
                logPk: { in: childPks },
            };
        }));
        return {
            filter: {
                OR: [
                    { ...ownScreenFilter, logPk: ownPkFilter },
                    ...relatedFilters.filter((relatedFilter) => relatedFilter !== null),
                ],
            },
            composite: true,
        };
    }
    async screenNameOf(screenId) {
        const screen = await this.prisma.auditScreen.findFirst({
            where: { screenId },
            select: { screenName: true },
        });
        return screen?.screenName ?? null;
    }
    async createAuditLog(input, tx) {
        const client = tx ?? this.prisma;
        const action = this.normalizeAction(input.action);
        const prismaAction = action;
        const normalizedTableName = input.tableName.trim();
        if (!normalizedTableName) {
            throwAuditLogInvalid('tableName is required for audit log', 'tableName', audit_log_error_codes_1.AuditLogErrorCode.TABLE_NAME_REQUIRED);
        }
        const resolvedUserId = this.resolveAuditUserId(input.userId);
        const resolvedIpAddress = this.resolveAuditIpAddress();
        const data = {
            logAction: prismaAction,
            logScreenId: input.screenId,
            logTableName: normalizedTableName,
            logPk: this.normalizePk(input.pk),
            logDisplayName: this.normalizeOptionalText(input.displayName),
            logEntityId: this.normalizeUuid(input.entityId),
            logOriginalRecord: this.toJsonInput(input.originalRecord),
            logModifiedRecord: this.toJsonInput(input.modifiedRecord),
            logChangedFields: this.toJsonInput(input.changedFields),
            logUserId: resolvedUserId,
            logBranchId: this.normalizeUuid(input.branchId),
            logIp: resolvedIpAddress,
            logNotes: this.normalizeOptionalText(input.notes),
        };
        await client.auditLog.create({
            data,
        });
    }
    async logEntityChange(input, tx) {
        const client = tx ?? this.prisma;
        const action = this.normalizeAction(input.action);
        const screen = await this.resolveAuditScreen(input, client);
        const screenId = screen.screenId;
        const originalRecord = this.projectAuditRecord(this.toNullableJson(input.originalRecord), screen.auditFields, screen.presentFieldsOnly);
        const isModifiedRecordProvided = input.modifiedRecord !== undefined;
        let modifiedRecord = this.projectAuditRecord(this.toNullableJson(input.modifiedRecord), screen.auditFields, screen.presentFieldsOnly);
        if (!isModifiedRecordProvided) {
            const pk = this.normalizePk(input.pk);
            if (pk !== null) {
                modifiedRecord = this.projectAuditRecord(await this.captureScreenSnapshot({
                    screenId,
                    keyNo: pk,
                    accYear: input.accYear ?? null,
                }, tx), screen.auditFields, screen.presentFieldsOnly);
            }
        }
        if (!isModifiedRecordProvided && modifiedRecord === null) {
            throwAuditLogInvalid('modifiedRecord is required when auto snapshot is unavailable', 'modifiedRecord', audit_log_error_codes_1.AuditLogErrorCode.RECORD_REQUIRED);
        }
        if (action === 'insert') {
            const insertOriginalRecord = originalRecord ?? modifiedRecord;
            if (insertOriginalRecord === null) {
                throwAuditLogInvalid('originalRecord or modifiedRecord is required for insert audit log', 'modifiedRecord', audit_log_error_codes_1.AuditLogErrorCode.RECORD_REQUIRED);
            }
            await this.createAuditLog({
                action,
                screenId,
                tableName: input.tableName,
                pk: input.pk,
                displayName: input.displayName,
                entityId: input.entityId,
                originalRecord: insertOriginalRecord,
                modifiedRecord: undefined,
                changedFields: undefined,
                userId: input.userId,
                branchId: input.branchId,
                notes: input.notes,
            }, tx);
            return;
        }
        if (action === 'update' && (originalRecord === null || modifiedRecord === null)) {
            throwAuditLogInvalid('originalRecord and modifiedRecord are required for update audit log', 'originalRecord', audit_log_error_codes_1.AuditLogErrorCode.RECORD_REQUIRED);
        }
        const computedChangedFields = this.computeChangedFields(originalRecord, modifiedRecord);
        const changedFields = screen.isTransaction
            ? computedChangedFields
            : this.dropNoiseStamps(computedChangedFields);
        if (action === 'update' && input.skipWhenUnchanged && this.isEmptyChange(changedFields)) {
            return;
        }
        await this.createAuditLog({
            action,
            screenId,
            tableName: input.tableName,
            pk: input.pk,
            displayName: input.displayName,
            entityId: input.entityId,
            originalRecord,
            modifiedRecord,
            changedFields,
            userId: input.userId,
            branchId: input.branchId,
            notes: input.notes,
        }, tx);
    }
    async logDocumentRevision(input, tx) {
        const client = tx ?? this.prisma;
        const tableName = input.tableName.trim();
        const docId = this.normalizePk(input.docId);
        if (!tableName || docId === null) {
            throwAuditLogInvalid('tableName and docId are required for a document revision', 'docId', audit_log_error_codes_1.AuditLogErrorCode.REVISION_KEY_REQUIRED);
        }
        const after = this.toNullableJson(input.after);
        if (after === null) {
            throwAuditLogInvalid('after is required for a document revision', 'after', audit_log_error_codes_1.AuditLogErrorCode.REVISION_AFTER_REQUIRED);
        }
        const before = this.toNullableJson(input.before);
        const screen = await this.resolveAuditScreen({ action: 'update', tableName, screenName: input.screenName, screenType: 'transaction' }, client);
        const changedFields = before === null
            ? null
            : this.computeChangedFields(this.documentHeaderOf(before), this.documentHeaderOf(after));
        const last = await client.auditLog.aggregate({
            _max: { logRevNo: true },
            where: { logScreenId: screen.screenId, logPk: docId, logRevNo: { not: null } },
        });
        const revNo = (last._max.logRevNo ?? 0) + 1;
        await client.auditLog.create({
            data: {
                logAction: before === null ? 'insert' : 'update',
                logScreenId: screen.screenId,
                logTableName: tableName,
                logPk: docId,
                logEntityId: this.normalizeUuid(docId),
                logDisplayName: this.normalizeOptionalText(input.displayName),
                logOriginalRecord: before === null ? client_1.Prisma.DbNull : before,
                logModifiedRecord: after,
                logChangedFields: changedFields === null ? client_1.Prisma.DbNull : changedFields,
                logUserId: this.resolveAuditUserId(input.userId),
                logBranchId: this.normalizeUuid(input.branchId),
                logDeviceName: await this.resolveDeviceName(client, input.deviceId),
                logIp: this.resolveAuditIpAddress(),
                logNotes: this.normalizeOptionalText(input.notes),
                logRevNo: revNo,
            },
        });
        return { revNo };
    }
    documentHeaderOf(document) {
        if (!this.isJsonObject(document)) {
            return document;
        }
        const header = document.header ?? null;
        if (this.isJsonObject(header)) {
            return header;
        }
        return Object.fromEntries(Object.entries(document).filter(([, value]) => !Array.isArray(value)));
    }
    async resolveDeviceName(client, documentDeviceId) {
        const devId = this.normalizeUuid(this.requestContextService.getDeviceId()) ??
            this.normalizeUuid(documentDeviceId);
        if (!devId) {
            return null;
        }
        const device = await client.deviceMaster.findUnique({
            where: { devId },
            select: { devDeviceName: true, devDeviceUid: true },
        });
        return device ? device.devDeviceName?.trim() || device.devDeviceUid : null;
    }
    async resolveAuditScreen(input, tx) {
        if (input.screenId !== undefined) {
            if (!Number.isInteger(input.screenId) || input.screenId <= 0) {
                throwAuditLogInvalid('screenId must be a positive integer', 'screenId', audit_log_error_codes_1.AuditLogErrorCode.SCREEN_ID_INVALID);
            }
            const existingScreen = await tx.auditScreen.findFirst({
                where: {
                    screenId: input.screenId,
                    screenStatus: true,
                },
                select: {
                    screenId: true,
                    screenName: true,
                    screenType: true,
                    screenAuditSql: true,
                },
            });
            if (!existingScreen) {
                throwAuditLogInvalid(`No active audit screen found with id ${input.screenId}`, 'screenId', audit_log_error_codes_1.AuditLogErrorCode.SCREEN_NOT_FOUND);
            }
            const resolvedScreen = await this.syncAuditScreenSqlIfNeeded(tx, existingScreen);
            return {
                screenId: resolvedScreen.screenId,
                auditFields: this.extractAuditFields(resolvedScreen.screenAuditSql),
                presentFieldsOnly: audit_screen_sql_constants_1.AUDIT_SCREENS_RECORDING_PRESENT_FIELDS_ONLY.has(existingScreen.screenName),
                isTransaction: existingScreen.screenType === 'transaction',
            };
        }
        const screenName = input.screenName?.trim();
        if (!screenName) {
            throwAuditLogInvalid('Either screenId or screenName is required', 'screenName', audit_log_error_codes_1.AuditLogErrorCode.SCREEN_REQUIRED);
        }
        const existingScreen = await tx.auditScreen.findFirst({
            where: {
                screenName,
                screenStatus: true,
            },
            select: {
                screenId: true,
                screenName: true,
                screenType: true,
                screenAuditSql: true,
            },
            orderBy: {
                screenId: 'asc',
            },
        });
        if (existingScreen) {
            const resolvedScreen = await this.syncAuditScreenSqlIfNeeded(tx, existingScreen);
            return {
                screenId: resolvedScreen.screenId,
                auditFields: this.extractAuditFields(resolvedScreen.screenAuditSql),
                presentFieldsOnly: audit_screen_sql_constants_1.AUDIT_SCREENS_RECORDING_PRESENT_FIELDS_ONLY.has(existingScreen.screenName),
                isTransaction: existingScreen.screenType === 'transaction',
            };
        }
        const screenAuditSql = (0, audit_screen_sql_constants_1.getAuditScreenSql)(screenName);
        const screenType = this.normalizeScreenType(input.screenType);
        const createdScreen = await tx.auditScreen.create({
            data: {
                screenName,
                screenType,
                screenStatus: true,
                screenAuditSql,
            },
            select: {
                screenId: true,
                screenAuditSql: true,
            },
        });
        return {
            screenId: createdScreen.screenId,
            auditFields: this.extractAuditFields(createdScreen.screenAuditSql),
            presentFieldsOnly: audit_screen_sql_constants_1.AUDIT_SCREENS_RECORDING_PRESENT_FIELDS_ONLY.has(screenName),
            isTransaction: screenType === 'transaction',
        };
    }
    async syncAuditScreenSqlIfNeeded(tx, screen) {
        const desiredScreenAuditSql = (0, audit_screen_sql_constants_1.getAuditScreenSql)(screen.screenName);
        if (!desiredScreenAuditSql || screen.screenAuditSql === desiredScreenAuditSql) {
            return {
                screenId: screen.screenId,
                screenAuditSql: screen.screenAuditSql,
            };
        }
        return tx.auditScreen.update({
            where: {
                screenId: screen.screenId,
            },
            data: {
                screenAuditSql: desiredScreenAuditSql,
            },
            select: {
                screenId: true,
                screenAuditSql: true,
            },
        });
    }
    normalizeAction(action) {
        const normalizedAction = action.trim().toLowerCase();
        switch (normalizedAction) {
            case 'new':
                return 'insert';
            case 'insert':
            case 'update':
            case 'approve':
            case 'cancel':
                return normalizedAction;
            default:
                throwAuditLogInvalid(`Unsupported audit action: ${action}`, 'action', audit_log_error_codes_1.AuditLogErrorCode.ACTION_UNSUPPORTED);
        }
    }
    parseDateBoundary(value, boundary) {
        const normalized = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
            return new Date(`${normalized}${suffix}`);
        }
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) {
            throwAuditLogInvalid(`Invalid date value: ${value}`, boundary === 'start' ? 'date_from' : 'date_to', audit_log_error_codes_1.AuditLogErrorCode.DATE_INVALID);
        }
        return parsed;
    }
    toListItem(preparedRecord, userNameById, branchNameById, auditReferenceNameLookup) {
        const { record, screenName } = preparedRecord;
        const maskedFields = MASKED_AUDIT_FIELDS_BY_SCREEN.get(screenName);
        const forView = (value) => {
            const named = this.resolveAuditReferenceNames(value, screenName, auditReferenceNameLookup);
            return maskedFields ? this.maskAuditFields(named, maskedFields) : named;
        };
        const originalRecord = forView(preparedRecord.originalRecord);
        const modifiedRecord = forView(preparedRecord.modifiedRecord);
        const changedFields = forView(preparedRecord.changedFields);
        const displayName = (0, audit_item_history_1.itemChildDisplayName)(screenName, modifiedRecord ?? originalRecord) ??
            this.normalizeOptionalText(record.logDisplayName) ??
            this.findAuditDisplayName(modifiedRecord) ??
            this.findAuditDisplayName(originalRecord);
        const userName = record.logUserId ? (userNameById.get(record.logUserId) ?? null) : null;
        const branchName = record.logBranchId ? (branchNameById.get(record.logBranchId) ?? null) : null;
        return {
            log_id: record.logId,
            log_date: record.logDate.toISOString(),
            log_action: record.logAction === 'insert' ? 'New' : record.logAction,
            log_screen_id: record.logScreenId,
            screen_name: screenName,
            log_table_name: record.logTableName,
            log_pk: displayName ?? record.logPk,
            log_display_name: displayName,
            log_original_record: originalRecord,
            log_modified_record: modifiedRecord,
            log_changed_fields: changedFields,
            log_user_id: userName ? null : record.logUserId,
            log_user_name: userName,
            log_branch_id: branchName ? null : record.logBranchId,
            log_branch_name: branchName,
            log_notes: record.logNotes,
            log_entity_id: record.logEntityId,
            log_rev_no: record.logRevNo,
            log_device_name: record.logDeviceName,
        };
    }
    maskAuditFields(value, maskedFields) {
        if (value === null || !this.isJsonObject(value)) {
            return value;
        }
        const maskLeaf = (leaf) => typeof leaf === 'string' ? (0, exports.maskAuditValue)(leaf) : leaf;
        const masked = {};
        for (const [fieldName, fieldValue] of Object.entries(value)) {
            const normalizedFieldValue = (fieldValue ?? null);
            if (!maskedFields.has(this.normalizeAuditFieldLookup(fieldName))) {
                masked[fieldName] = this.isJsonObject(normalizedFieldValue)
                    ? this.maskAuditFields(normalizedFieldValue, maskedFields)
                    : normalizedFieldValue;
                continue;
            }
            masked[fieldName] = this.isAuditDiffLeaf(normalizedFieldValue)
                ? { from: maskLeaf(normalizedFieldValue.from), to: maskLeaf(normalizedFieldValue.to) }
                : maskLeaf(normalizedFieldValue);
        }
        return masked;
    }
    prepareAuditLogListRecord(record) {
        const screenName = record.auditScreen.screenName;
        const auditFields = this.extractAuditFields((0, audit_screen_sql_constants_1.getAuditScreenSql)(screenName));
        let originalRecord = this.renameAuditRecordFields(record.logOriginalRecord, auditFields);
        let modifiedRecord = this.renameAuditRecordFields(record.logModifiedRecord, auditFields);
        let changedFields = this.renameAuditRecordFields(record.logChangedFields, auditFields);
        if (screenName === THEME_TEMPLATE_SCREEN_NAME) {
            originalRecord = this.digestStylesheetText(originalRecord);
            modifiedRecord = this.digestStylesheetText(modifiedRecord);
            changedFields = this.digestStylesheetChange(changedFields);
        }
        if (record.auditScreen.screenType !== 'transaction') {
            changedFields = this.dropNoiseStamps(changedFields);
        }
        return { record, screenName, auditFields, originalRecord, modifiedRecord, changedFields };
    }
    isNoiseStampKey(key) {
        return NOISE_STAMP_KEY_PATTERN.test(this.toSnakeCase(key));
    }
    dropNoiseStamps(changedFields) {
        if (changedFields === null || !this.isJsonObject(changedFields)) {
            return changedFields;
        }
        return Object.fromEntries(Object.entries(changedFields).filter(([key]) => !this.isNoiseStampKey(key)));
    }
    isEmptyChange(changedFields) {
        return (changedFields === null ||
            (this.isJsonObject(changedFields) && Object.keys(changedFields).length === 0));
    }
    digestStylesheetText(record) {
        if (record === null || !this.isJsonObject(record)) {
            return record;
        }
        const digested = {};
        for (const [key, value] of Object.entries(record)) {
            if (!STYLESHEET_TEXT_KEYS.has(key)) {
                digested[key] = value ?? null;
                continue;
            }
            Object.assign(digested, this.stylesheetDigestFields(value ?? null));
        }
        return digested;
    }
    digestStylesheetChange(changedFields) {
        if (changedFields === null || !this.isJsonObject(changedFields)) {
            return changedFields;
        }
        const digested = {};
        for (const [key, value] of Object.entries(changedFields)) {
            const change = value ?? null;
            if (!STYLESHEET_TEXT_KEYS.has(key) || !this.isAuditDiffLeaf(change)) {
                digested[key] = change;
                continue;
            }
            const from = this.stylesheetDigestFields(change.from);
            const to = this.stylesheetDigestFields(change.to);
            for (const label of Object.keys(to)) {
                if (from[label] !== to[label]) {
                    digested[label] = { from: from[label] ?? null, to: to[label] ?? null };
                }
            }
        }
        return digested;
    }
    stylesheetDigestFields(text) {
        if (typeof text !== 'string') {
            return { 'Stylesheet Hash': null, 'Stylesheet Size': null, 'Stylesheet Lines': null };
        }
        const digest = (0, audit_text_digest_1.stylesheetDigest)(text);
        return {
            'Stylesheet Hash': digest.stylesheetHash,
            'Stylesheet Size': digest.stylesheetSize,
            'Stylesheet Lines': digest.stylesheetLines,
        };
    }
    renameAuditRecordFields(record, auditFields) {
        if (record === null || auditFields.length === 0 || !this.isJsonObject(record)) {
            return record;
        }
        const renamedRecord = {};
        for (const [key, value] of Object.entries(record)) {
            const auditField = this.findAuditFieldDefinitionByKey(key, auditFields);
            const targetKey = auditField?.targetFieldName ?? key;
            renamedRecord[targetKey] = value;
        }
        return renamedRecord;
    }
    findAuditFieldDefinitionByKey(key, auditFields) {
        const lookupTokens = new Set(this.buildAuditFieldLookupTokens(key));
        if (lookupTokens.size === 0) {
            return null;
        }
        for (const auditField of auditFields) {
            const candidateFieldNames = [...auditField.sourceFieldNames, auditField.targetFieldName];
            for (const candidateFieldName of candidateFieldNames) {
                const candidateTokens = this.buildAuditFieldLookupTokens(candidateFieldName);
                if (candidateTokens.some((token) => lookupTokens.has(token))) {
                    return auditField;
                }
            }
        }
        return null;
    }
    async getAuditReferenceNameLookup(preparedRecords) {
        const referenceIdsByType = new Map();
        for (const preparedRecord of preparedRecords) {
            this.collectAuditReferenceIds(preparedRecord.originalRecord, preparedRecord.screenName, referenceIdsByType);
            this.collectAuditReferenceIds(preparedRecord.modifiedRecord, preparedRecord.screenName, referenceIdsByType);
            this.collectAuditReferenceIds(preparedRecord.changedFields, preparedRecord.screenName, referenceIdsByType);
        }
        const entries = await Promise.all(Array.from(referenceIdsByType.entries()).map(async ([lookupType, ids]) => [
            lookupType,
            await this.fetchAuditReferenceNameMap(lookupType, Array.from(ids)),
        ]));
        return Object.fromEntries(entries);
    }
    collectAuditReferenceIds(value, screenName, referenceIdsByType) {
        if (value === null) {
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                this.collectAuditReferenceIds(item, screenName, referenceIdsByType);
            }
            return;
        }
        if (!this.isJsonObject(value)) {
            return;
        }
        for (const [fieldName, fieldValue] of Object.entries(value)) {
            const normalizedFieldValue = (fieldValue ?? null);
            const lookupType = this.resolveAuditFieldReferenceType(screenName, fieldName);
            if (!lookupType) {
                this.collectAuditReferenceIds(normalizedFieldValue, screenName, referenceIdsByType);
                continue;
            }
            if (this.isAuditDiffLeaf(normalizedFieldValue)) {
                this.collectAuditReferenceLeafId(normalizedFieldValue.from, lookupType, referenceIdsByType);
                this.collectAuditReferenceLeafId(normalizedFieldValue.to, lookupType, referenceIdsByType);
                continue;
            }
            this.collectAuditReferenceLeafId(normalizedFieldValue, lookupType, referenceIdsByType);
        }
    }
    collectAuditReferenceLeafId(value, lookupType, referenceIdsByType) {
        if (value === null) {
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                this.collectAuditReferenceLeafId(item, lookupType, referenceIdsByType);
            }
            return;
        }
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
            return;
        }
        const normalizedValue = String(value).trim();
        if (!normalizedValue || !this.isValidAuditReferenceId(lookupType, normalizedValue)) {
            return;
        }
        const existingIds = referenceIdsByType.get(lookupType) ?? new Set();
        existingIds.add(normalizedValue);
        referenceIdsByType.set(lookupType, existingIds);
    }
    resolveAuditReferenceNames(value, screenName, auditReferenceNameLookup) {
        if (value === null) {
            return null;
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.resolveAuditReferenceNames(item, screenName, auditReferenceNameLookup));
        }
        if (!this.isJsonObject(value)) {
            return value;
        }
        const transformedValue = {};
        for (const [fieldName, fieldValue] of Object.entries(value)) {
            const normalizedFieldValue = (fieldValue ?? null);
            const lookupType = this.resolveAuditFieldReferenceType(screenName, fieldName);
            if (!lookupType) {
                transformedValue[fieldName] = this.resolveAuditReferenceNames(normalizedFieldValue, screenName, auditReferenceNameLookup);
                continue;
            }
            if (this.isAuditDiffLeaf(normalizedFieldValue)) {
                transformedValue[fieldName] = {
                    from: this.resolveAuditReferenceLeafValue(normalizedFieldValue.from, lookupType, auditReferenceNameLookup),
                    to: this.resolveAuditReferenceLeafValue(normalizedFieldValue.to, lookupType, auditReferenceNameLookup),
                };
                continue;
            }
            transformedValue[fieldName] = this.resolveAuditReferenceLeafValue(normalizedFieldValue, lookupType, auditReferenceNameLookup);
        }
        return transformedValue;
    }
    resolveAuditReferenceLeafValue(value, lookupType, auditReferenceNameLookup) {
        if (value === null) {
            return null;
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.resolveAuditReferenceLeafValue(item, lookupType, auditReferenceNameLookup));
        }
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
            return value;
        }
        const normalizedValue = String(value).trim();
        if (!normalizedValue) {
            return value;
        }
        return auditReferenceNameLookup[lookupType]?.get(normalizedValue) ?? value;
    }
    resolveAuditFieldReferenceType(screenName, fieldName) {
        const normalizedFieldName = this.normalizeAuditFieldLookup(fieldName);
        const screenResolver = SCREEN_AUDIT_FIELD_REFERENCE_TYPES.get(screenName);
        if (screenResolver?.has(normalizedFieldName)) {
            return screenResolver.get(normalizedFieldName) ?? null;
        }
        const globalType = GLOBAL_AUDIT_FIELD_REFERENCE_TYPES.get(normalizedFieldName);
        if (globalType) {
            return globalType;
        }
        return USER_STAMP_KEY_PATTERN.test(this.toSnakeCase(fieldName)) ? 'user' : null;
    }
    isValidAuditReferenceId(lookupType, value) {
        if (lookupType === 'tenderType') {
            return NUMERIC_ID_PATTERN.test(value);
        }
        return UUID_PATTERN.test(value);
    }
    isAuditDiffLeaf(value) {
        return (this.isJsonObject(value) &&
            Object.prototype.hasOwnProperty.call(value, 'from') &&
            Object.prototype.hasOwnProperty.call(value, 'to'));
    }
    findAuditDisplayName(value) {
        if (!this.isJsonObject(value)) {
            return null;
        }
        for (const [fieldName, fieldValue] of Object.entries(value)) {
            const normalizedFieldValue = (fieldValue ?? null);
            if (!DISPLAY_FIELD_PATTERN.test(fieldName) ||
                fieldName.toLowerCase().startsWith('parent ') ||
                fieldName.toLowerCase().includes('contact')) {
                continue;
            }
            if (normalizedFieldValue === null ||
                Array.isArray(normalizedFieldValue) ||
                this.isJsonObject(normalizedFieldValue)) {
                continue;
            }
            const normalizedValue = String(normalizedFieldValue).trim();
            if (normalizedValue) {
                return normalizedValue;
            }
        }
        return null;
    }
    async fetchAuditReferenceNameMap(lookupType, ids) {
        if (ids.length === 0) {
            return new Map();
        }
        switch (lookupType) {
            case 'accountGroup': {
                const groups = await this.prisma.accGroupMaster.findMany({
                    where: {
                        accGroupId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        accGroupId: true,
                        accGroupName: true,
                    },
                });
                return new Map(groups.map((group) => [group.accGroupId, group.accGroupName]));
            }
            case 'area': {
                const areas = await this.prisma.areaMaster.findMany({
                    where: {
                        armId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        armId: true,
                        armName: true,
                    },
                });
                return new Map(areas.map((area) => [area.armId, area.armName]));
            }
            case 'branch':
                return this.getBranchNameByIds(ids);
            case 'category': {
                const categories = await this.prisma.categoryMaster.findMany({
                    where: {
                        categoryId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        categoryId: true,
                        categoryName: true,
                    },
                });
                return new Map(categories.map((category) => [category.categoryId, category.categoryName]));
            }
            case 'city': {
                const cities = await this.prisma.cityMaster.findMany({
                    where: {
                        ctmId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        ctmId: true,
                        ctmName: true,
                    },
                });
                return new Map(cities.map((city) => [city.ctmId, city.ctmName]));
            }
            case 'company': {
                const companies = await this.prisma.company.findMany({
                    where: {
                        compId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        compId: true,
                        compName: true,
                    },
                });
                return new Map(companies.map((company) => [company.compId, company.compName]));
            }
            case 'customer': {
                const customers = await this.prisma.customer.findMany({
                    where: {
                        cusId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        cusId: true,
                        cusName: true,
                        cusCode: true,
                    },
                });
                return new Map(customers.map((customer) => [
                    customer.cusId,
                    customer.cusName?.trim() || customer.cusCode?.trim() || customer.cusId,
                ]));
            }
            case 'customerGroup': {
                const groups = await this.prisma.custGroup.findMany({
                    where: {
                        cgrId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        cgrId: true,
                        cgrName: true,
                    },
                });
                return new Map(groups.map((group) => [group.cgrId, group.cgrName]));
            }
            case 'device': {
                const devices = await this.prisma.deviceMaster.findMany({
                    where: { devId: { in: [...ids] } },
                    select: { devId: true, devDeviceName: true, devCode: true, devDeviceUid: true },
                });
                return new Map(devices.map((device) => [device.devId, (0, exports.deviceDisplayName)(device)]));
            }
            case 'employee': {
                const employees = await this.prisma.employeeMaster.findMany({
                    where: { empId: { in: [...ids] } },
                    select: { empId: true, empName: true, empCode: true },
                });
                return new Map(employees.map((employee) => [
                    employee.empId,
                    employee.empName?.trim() || employee.empCode?.trim() || employee.empId,
                ]));
            }
            case 'printPurpose': {
                const purposes = await this.prisma.printPurpose.findMany({
                    where: { ppoId: { in: [...ids] } },
                    select: { ppoId: true, ppoName: true },
                });
                return new Map(purposes.map((purpose) => [purpose.ppoId, purpose.ppoName]));
            }
            case 'printTemplate': {
                const templates = await this.prisma.printTemplate.findMany({
                    where: { ptlId: { in: [...ids] } },
                    select: { ptlId: true, ptlName: true, ptlCode: true },
                });
                return new Map(templates.map((template) => [
                    template.ptlId,
                    `${template.ptlName} (${template.ptlCode})`,
                ]));
            }
            case 'printerProfile': {
                const printers = await this.prisma.printerProfile.findMany({
                    where: { prfId: { in: [...ids] } },
                    select: { prfId: true, prfName: true },
                });
                return new Map(printers.map((printer) => [printer.prfId, printer.prfName]));
            }
            case 'user':
                return this.getUserNameByIds(ids);
            case 'employeeDepartment': {
                const departments = await this.prisma.employeeDepartment.findMany({
                    where: {
                        edptId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        edptId: true,
                        edptName: true,
                    },
                });
                return new Map(departments.map((department) => [department.edptId, department.edptName]));
            }
            case 'employeeDesignation': {
                const designations = await this.prisma.employeeDesignation.findMany({
                    where: {
                        edId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        edId: true,
                        edName: true,
                    },
                });
                return new Map(designations.map((designation) => [designation.edId, designation.edName]));
            }
            case 'godownGroup': {
                const godownLocations = await this.prisma.godownLocation.findMany({
                    where: {
                        gdlId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        gdlId: true,
                        gdlName: true,
                        gdlParentId: true,
                        gdlLevel: true,
                        gdlSort: true,
                    },
                    orderBy: [{ gdlLevel: 'asc' }, { gdlSort: 'asc' }, { gdlName: 'asc' }],
                });
                const godownNameById = new Map();
                for (const location of godownLocations) {
                    if (!godownNameById.has(location.gdlId)) {
                        godownNameById.set(location.gdlId, location.gdlName);
                    }
                }
                return godownNameById;
            }
            case 'godownLocation': {
                const locations = await this.prisma.godownLocation.findMany({
                    where: {
                        gdlId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        gdlId: true,
                        gdlName: true,
                    },
                });
                return new Map(locations.map((location) => [location.gdlId, location.gdlName]));
            }
            case 'item': {
                const items = await this.prisma.itemMaster.findMany({
                    where: {
                        itemId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        itemId: true,
                        itemNameEn: true,
                    },
                });
                return new Map(items.map((item) => [item.itemId, item.itemNameEn]));
            }
            case 'itemBrand': {
                const brands = await this.prisma.itemBrandMaster.findMany({
                    where: {
                        brand_id: {
                            in: [...ids],
                        },
                    },
                    select: {
                        brand_id: true,
                        brand_name: true,
                    },
                });
                return new Map(brands.map((brand) => [brand.brand_id, brand.brand_name]));
            }
            case 'itemGroup': {
                const groups = await this.prisma.itemGroupMaster.findMany({
                    where: {
                        itgId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        itgId: true,
                        itgName: true,
                    },
                });
                return new Map(groups.map((group) => [group.itgId, group.itgName]));
            }
            case 'itemSection': {
                const sections = await this.prisma.itemSectionMaster.findMany({
                    where: {
                        secId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        secId: true,
                        secName: true,
                    },
                });
                return new Map(sections.map((section) => [section.secId, section.secName]));
            }
            case 'itemTax': {
                const taxes = await this.prisma.taxRateMaster.findMany({
                    where: {
                        taxId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        taxId: true,
                        taxName: true,
                    },
                });
                return new Map(taxes.map((tax) => [tax.taxId, tax.taxName]));
            }
            case 'ledger': {
                const ledgers = await this.prisma.accLedgerMaster.findMany({
                    where: {
                        ledId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        ledId: true,
                        ledName: true,
                    },
                });
                return new Map(ledgers.map((ledger) => [ledger.ledId, ledger.ledName]));
            }
            case 'state': {
                const states = await this.prisma.stateMaster.findMany({
                    where: {
                        stmId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        stmId: true,
                        stmName: true,
                    },
                });
                return new Map(states.map((state) => [state.stmId, state.stmName]));
            }
            case 'supplierGroup': {
                const groups = await this.prisma.supplierGroup.findMany({
                    where: {
                        spgId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        spgId: true,
                        spgName: true,
                    },
                });
                return new Map(groups.map((group) => [group.spgId, group.spgName]));
            }
            case 'tenderType': {
                const tenderTypeIds = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id));
                const tenderTypes = await this.prisma.accTenderType.findMany({
                    where: {
                        ttmTypeId: {
                            in: tenderTypeIds,
                        },
                    },
                    select: {
                        ttmTypeId: true,
                        ttmTypeName: true,
                    },
                });
                return new Map(tenderTypes.map((tenderType) => [
                    tenderType.ttmTypeId.toString(),
                    tenderType.ttmTypeName,
                ]));
            }
            case 'unit': {
                const units = await this.prisma.unit.findMany({
                    where: {
                        unit_id: {
                            in: [...ids],
                        },
                    },
                    select: {
                        unit_id: true,
                        unit_name: true,
                    },
                });
                return new Map(units.map((unit) => [unit.unit_id, unit.unit_name]));
            }
            case 'unitConversion': {
                const conversions = await this.prisma.itemUnitConversion.findMany({
                    where: {
                        iucId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        iucId: true,
                        unit: {
                            select: {
                                unit_name: true,
                            },
                        },
                    },
                });
                return new Map(conversions.map((conversion) => [conversion.iucId, conversion.unit.unit_name]));
            }
            case 'unitRate': {
                const unitRates = await this.prisma.itemPriceMaster.findMany({
                    where: {
                        ipmId: {
                            in: [...ids],
                        },
                    },
                    select: {
                        ipmId: true,
                        item: {
                            select: {
                                itemNameEn: true,
                            },
                        },
                        itemUnitConversion: {
                            select: {
                                unit: {
                                    select: {
                                        unit_name: true,
                                    },
                                },
                            },
                        },
                        godown: {
                            select: {
                                gdlName: true,
                            },
                        },
                    },
                });
                return new Map(unitRates.map((unitRate) => [
                    unitRate.ipmId,
                    [
                        unitRate.item.itemNameEn,
                        unitRate.itemUnitConversion.unit.unit_name,
                        unitRate.godown?.gdlName,
                    ]
                        .filter(Boolean)
                        .join(' / '),
                ]));
            }
        }
    }
    async getUserNameByIds(userIds) {
        const users = await this.prisma.userMaster.findMany({
            where: {
                usrId: {
                    in: [...userIds],
                },
            },
            select: {
                usrId: true,
                usrDisplayName: true,
                usrLoginName: true,
            },
        });
        return new Map(users.map((user) => [user.usrId, user.usrDisplayName?.trim() || user.usrLoginName]));
    }
    async getBranchNameByIds(branchIds) {
        const branches = await this.prisma.branchMaster.findMany({
            where: {
                brId: {
                    in: [...branchIds],
                },
            },
            select: {
                brId: true,
                brName: true,
            },
        });
        return new Map(branches.map((branch) => [branch.brId, branch.brName]));
    }
    normalizeScreenType(screenType) {
        const normalizedScreenType = screenType?.trim().toLowerCase();
        switch (normalizedScreenType) {
            case undefined:
            case '':
            case 'other':
                return 'other';
            case 'master':
                return 'master';
            case 'transaction':
                return 'transaction';
            case 'settings':
                return 'settings';
            default:
                throwAuditLogInvalid(`Unsupported audit screen type: ${screenType}`, 'screenType', audit_log_error_codes_1.AuditLogErrorCode.SCREEN_TYPE_UNSUPPORTED);
        }
    }
    projectAuditRecord(record, auditFields, presentFieldsOnly = false) {
        if (record === null || auditFields.length === 0 || !this.isJsonObject(record)) {
            return record;
        }
        const projectedRecord = {};
        for (const auditField of auditFields) {
            const key = this.findAuditFieldSourceKey(record, auditField);
            if (key === null) {
                if (!presentFieldsOnly) {
                    projectedRecord[auditField.targetFieldName] = null;
                }
                continue;
            }
            projectedRecord[auditField.targetFieldName] = record[key] ?? null;
        }
        return projectedRecord;
    }
    findAuditFieldSourceKey(record, auditField) {
        for (const sourceFieldName of auditField.sourceFieldNames) {
            const sourceKey = this.findAuditFieldKey(record, sourceFieldName);
            if (sourceKey) {
                return sourceKey;
            }
        }
        return this.findAuditFieldKey(record, auditField.targetFieldName);
    }
    findAuditFieldKey(record, auditFieldName) {
        const lookupTokens = new Set(this.buildAuditFieldLookupTokens(auditFieldName));
        if (lookupTokens.size === 0) {
            return null;
        }
        for (const key of Object.keys(record)) {
            const keyTokens = this.buildAuditFieldLookupTokens(key);
            if (keyTokens.some((token) => lookupTokens.has(token))) {
                return key;
            }
        }
        return null;
    }
    buildAuditFieldLookupTokens(value) {
        const normalizedValue = value.trim();
        if (!normalizedValue) {
            return [];
        }
        const normalizedSnake = this.toSnakeCase(normalizedValue);
        return Array.from(new Set([
            this.normalizeAuditFieldLookup(normalizedValue),
            normalizedSnake,
            this.normalizeAuditFieldLookup(this.toCamelCase(normalizedSnake)),
        ].filter(Boolean)));
    }
    extractAuditFields(screenAuditSql) {
        const normalizedSql = screenAuditSql?.trim();
        if (!normalizedSql) {
            return [];
        }
        const selectClause = extractSelectList(normalizedSql);
        if (selectClause === null) {
            return [];
        }
        const fields = this.splitSelectClause(selectClause)
            .map((fieldExpression) => this.extractAuditFieldDefinition(fieldExpression))
            .filter((field) => Boolean(field));
        const seen = new Set();
        return fields.filter((field) => {
            if (seen.has(field.targetFieldName)) {
                return false;
            }
            seen.add(field.targetFieldName);
            return true;
        });
    }
    splitSelectClause(selectClause) {
        return splitTopLevel(selectClause, ',');
    }
    extractAuditFieldDefinition(fieldExpression) {
        const normalizedExpression = fieldExpression.trim();
        if (!normalizedExpression) {
            return null;
        }
        const explicitAliasMatch = normalizedExpression.match(/^(?<source>[\s\S]+?)\s+as\s+("(?<quotedAlias>[^"]+)"|(?<alias>[A-Za-z_][A-Za-z0-9_]*))\s*$/i);
        if (explicitAliasMatch?.groups) {
            const targetFieldName = explicitAliasMatch.groups.quotedAlias ?? explicitAliasMatch.groups.alias ?? null;
            if (!targetFieldName) {
                return null;
            }
            const sourceFieldNames = this.extractSourceFieldNames(explicitAliasMatch.groups.source);
            return {
                sourceFieldName: sourceFieldNames[0] ?? null,
                sourceFieldNames,
                targetFieldName,
            };
        }
        const sourceFieldName = this.extractSourceFieldName(normalizedExpression);
        if (!sourceFieldName) {
            return null;
        }
        return {
            sourceFieldName,
            sourceFieldNames: [sourceFieldName],
            targetFieldName: sourceFieldName,
        };
    }
    extractSourceFieldNames(expression) {
        const coalesceArguments = coalesceArgumentsOf(expression);
        if (coalesceArguments) {
            return coalesceArguments
                .map((argument) => this.extractSourceFieldName(argument))
                .filter((fieldName) => Boolean(fieldName));
        }
        const sourceFieldName = this.extractSourceFieldName(expression);
        return sourceFieldName ? [sourceFieldName] : [];
    }
    extractSourceFieldName(expression) {
        const expressionWithoutCast = expression
            .trim()
            .replace(/::\s*("[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(\[\])?\s*$/g, '')
            .trim();
        const quotedIdentifierMatch = expressionWithoutCast.match(/"([^"]+)"\s*$/);
        if (quotedIdentifierMatch) {
            return quotedIdentifierMatch[1];
        }
        const identifierMatch = expressionWithoutCast.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
        return identifierMatch?.[1] ?? null;
    }
    toSnakeCase(value) {
        return this.normalizeAuditFieldLookup(value.replace(/([a-z0-9])([A-Z])/g, '$1_$2'));
    }
    toCamelCase(value) {
        const normalized = this.normalizeAuditFieldLookup(value);
        if (!normalized) {
            return '';
        }
        return normalized
            .split('_')
            .filter(Boolean)
            .map((segment, index) => index === 0 ? segment : `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
            .join('');
    }
    normalizeAuditFieldLookup(value) {
        return normalizeAuditFieldLookupToken(value);
    }
    computeChangedFields(originalRecord, modifiedRecord) {
        const diff = this.computeJsonDiff(originalRecord, modifiedRecord);
        return diff ?? null;
    }
    computeJsonDiff(left, right) {
        if (this.areJsonValuesEqual(left, right)) {
            return undefined;
        }
        if (this.isJsonObject(left) && this.isJsonObject(right)) {
            const diff = {};
            const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
            for (const key of keys) {
                const hasLeft = Object.prototype.hasOwnProperty.call(left, key);
                const hasRight = Object.prototype.hasOwnProperty.call(right, key);
                const leftValue = hasLeft ? left[key] : null;
                const rightValue = hasRight ? right[key] : null;
                const childDiff = this.computeJsonDiff(leftValue, rightValue);
                if (childDiff !== undefined) {
                    diff[key] = childDiff;
                }
            }
            return Object.keys(diff).length > 0 ? diff : undefined;
        }
        return {
            from: left ?? null,
            to: right ?? null,
        };
    }
    areJsonValuesEqual(left, right) {
        if (left === right) {
            return true;
        }
        if (left === null || right === null) {
            return false;
        }
        if (Array.isArray(left) && Array.isArray(right)) {
            if (left.length !== right.length) {
                return false;
            }
            for (let index = 0; index < left.length; index += 1) {
                if (!this.areJsonValuesEqual(left[index], right[index])) {
                    return false;
                }
            }
            return true;
        }
        if (this.isJsonObject(left) && this.isJsonObject(right)) {
            const leftKeys = Object.keys(left);
            const rightKeys = Object.keys(right);
            if (leftKeys.length !== rightKeys.length) {
                return false;
            }
            for (const key of leftKeys) {
                if (!Object.prototype.hasOwnProperty.call(right, key)) {
                    return false;
                }
                if (!this.areJsonValuesEqual(left[key], right[key])) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
    isJsonObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }
    toJsonInput(value) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null) {
            return client_1.Prisma.JsonNull;
        }
        return this.normalizeJsonValue(value);
    }
    toNullableJson(value) {
        if (value === undefined || value === null) {
            return null;
        }
        return this.normalizeJsonValue(value);
    }
    normalizeJsonValue(value) {
        return JSON.parse(JSON.stringify(value, (_key, nestedValue) => typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue));
    }
    normalizePk(value) {
        if (value === undefined || value === null) {
            return null;
        }
        const normalized = String(value).trim();
        return normalized || null;
    }
    normalizeOptionalText(value) {
        if (value === undefined || value === null) {
            return null;
        }
        const normalized = value.trim();
        return normalized || null;
    }
    normalizeUuid(value) {
        if (value === undefined || value === null) {
            return null;
        }
        const normalized = String(value).trim();
        if (!normalized) {
            return null;
        }
        return UUID_PATTERN.test(normalized) ? normalized : null;
    }
    resolveAuditUserId(providedUserId) {
        const explicitUserId = this.normalizeUuid(providedUserId);
        if (explicitUserId) {
            return explicitUserId;
        }
        return this.normalizeUuid(this.requestContextService.getUserId());
    }
    resolveAuditIpAddress() {
        const requestIpAddress = this.requestContextService.getIpAddress();
        return this.normalizeIpAddress(requestIpAddress);
    }
    normalizeIpAddress(value) {
        if (!value) {
            return null;
        }
        const normalized = value.trim();
        if (!normalized) {
            return null;
        }
        return (0, node_net_1.isIP)(normalized) === 0 ? null : normalized;
    }
};
exports.AuditLogService = AuditLogService;
exports.AuditLogService = AuditLogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], AuditLogService);
function scanUnquoted(text, visit) {
    let depth = 0;
    let quote = null;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quote !== null) {
            if (character === quote) {
                quote = null;
            }
            continue;
        }
        if (character === "'" || character === '"') {
            quote = character;
            continue;
        }
        if (visit(index, depth) === true) {
            return;
        }
        if (character === '(' || character === '[') {
            depth += 1;
        }
        else if ((character === ')' || character === ']') && depth > 0) {
            depth -= 1;
        }
    }
}
function splitTopLevel(text, separator) {
    const cuts = [];
    scanUnquoted(text, (index, depth) => {
        if (depth === 0 && text[index] === separator) {
            cuts.push(index);
        }
    });
    const parts = [];
    let start = 0;
    for (const cut of [...cuts, text.length]) {
        const part = text.slice(start, cut).trim();
        if (part) {
            parts.push(part);
        }
        start = cut + 1;
    }
    return parts;
}
const SQL_WORD_CHARACTER = /[A-Za-z0-9_$]/;
function extractSelectList(sql) {
    const head = /^\s*select\s+/i.exec(sql);
    if (!head) {
        return null;
    }
    const body = sql.slice(head[0].length);
    let end = -1;
    scanUnquoted(body, (index, depth) => {
        if (depth === 0 &&
            body.slice(index, index + 4).toLowerCase() === 'from' &&
            !SQL_WORD_CHARACTER.test(body[index - 1] ?? ' ') &&
            !SQL_WORD_CHARACTER.test(body[index + 4] ?? ' ')) {
            end = index;
            return true;
        }
        return false;
    });
    if (end < 0) {
        return null;
    }
    const selectList = body.slice(0, end).trim();
    return selectList || null;
}
function coalesceArgumentsOf(expression) {
    const text = expression
        .trim()
        .replace(/::\s*("[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(\[\])?\s*$/, '')
        .trim();
    const head = /^coalesce\s*\(/i.exec(text);
    if (!head || !text.endsWith(')')) {
        return null;
    }
    const open = head[0].length - 1;
    let close = -1;
    scanUnquoted(text, (index, depth) => {
        if (index > open && depth === 1 && text[index] === ')') {
            close = index;
            return true;
        }
        return false;
    });
    if (close !== text.length - 1) {
        return null;
    }
    return splitTopLevel(text.slice(open + 1, close), ',');
}
function throwAuditLogInvalid(message, field, code) {
    (0, module_shared_utils_1.throwBadRequest)(message, [{ field, message, code }]);
}
//# sourceMappingURL=audit-log.service.js.map