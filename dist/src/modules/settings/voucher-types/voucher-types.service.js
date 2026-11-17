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
exports.VoucherTypesService = exports.OFFER_BASE_SETTING_KEY = void 0;
exports.uniqueRaceIssue = uniqueRaceIssue;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const offline_site_1 = require("../../../config/offline-site");
const client_1 = require("@prisma/client");
const error_wording_1 = require("../../../common/error-wording/error-wording");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const print_design_usable_sql_1 = require("../print-template-assignment/print-design-usable.sql");
const voucher_types_company_1 = require("./voucher-types-company");
const voucher_types_error_codes_1 = require("./types/voucher-types-error-codes");
const voucher_types_rules_1 = require("./voucher-types.rules");
exports.OFFER_BASE_SETTING_KEY = 'sales.offer_base_bill_type';
const SAVE_LOCK_NAMESPACE = 'accounts.acc_voucher_types.save';
const CODE_LOCK_NAMESPACE = 'accounts.acc_voucher_types.code';
const PURPOSE_CODE_LOCK_NAMESPACE = 'public.print_purpose.clone_code';
const iso = (d) => d.toISOString().slice(0, 10);
function accYearOfIso(date) {
    const d = new Date(`${date}T00:00:00Z`);
    const y = d.getUTCMonth() + 1 >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    return `${y}-${y + 1}`;
}
function istToday() {
    return iso(new Date(Date.now() + 330 * 60_000));
}
const pickBool = (v, fallback) => {
    const t = (v ?? '').trim().toLowerCase();
    if (t === 'true' || t === '1' || t === 'yes')
        return true;
    if (t === 'false' || t === '0' || t === 'no')
        return false;
    return fallback;
};
let VoucherTypesService = class VoucherTypesService {
    prisma;
    ctx;
    auditLogService;
    config;
    constructor(prisma, ctx, auditLogService, config) {
        this.prisma = prisma;
        this.ctx = ctx;
        this.auditLogService = auditLogService;
        this.config = config;
    }
    actor() {
        return this.ctx.getUserId() ?? module_shared_utils_1.DEFAULT_ACTOR;
    }
    assertRight(client, right, action) {
        return (0, rights_1.assertMenuRight)(client, {
            userId: this.ctx.getUserId() ?? null,
            menuId: voucher_types_rules_1.VOUCHER_TYPES_MENU_ID,
            right,
            codePrefix: voucher_types_error_codes_1.VOUCHER_TYPE_RIGHT_PREFIX,
            action,
        });
    }
    assertOnline() {
        if ((0, offline_site_1.isOfflineSite)(this.config)) {
            (0, module_shared_utils_1.throwForbidden)('Voucher types are changed only on the main server', [
                {
                    field: 'request',
                    code: voucher_types_error_codes_1.VoucherTypeErrorCode.OFFLINE,
                    message: 'This install is an offline site (CLOUD_SYNC_ENABLED); voucher types are made and changed on the main server.',
                },
            ]);
        }
    }
    resolveCompany(client, bodyCompanyId) {
        return (0, voucher_types_company_1.resolveVoucherTypeCompany)(client, this.ctx.getCompanyId(), bodyCompanyId);
    }
    companyMismatch(message) {
        (0, voucher_types_company_1.voucherTypeCompanyMismatch)(message);
    }
    notFound(vchrTypeId) {
        (0, module_shared_utils_1.throwNotFound)('Voucher type not found', 'vchrTypeId', `No voucher type ${vchrTypeId}`, voucher_types_error_codes_1.VoucherTypeErrorCode.NOT_FOUND);
    }
    async loadForCompany(client, vchrTypeId, company, forUpdate = false) {
        if (forUpdate) {
            await client.$queryRaw `
        SELECT vchr_type_id FROM accounts.acc_voucher_types WHERE vchr_type_id = ${vchrTypeId}::int FOR UPDATE`;
        }
        const row = await client.accVoucherType.findUnique({ where: { vchrTypeId } });
        if (!row) {
            this.notFound(vchrTypeId);
        }
        if (row.vchrCompanyId && row.vchrCompanyId.toLowerCase() !== company) {
            this.companyMismatch(`Voucher type ${vchrTypeId} belongs to company ${row.vchrCompanyId}`);
        }
        return row;
    }
    async tree(companyId, includeInactive = false) {
        await this.assertRight(this.prisma, 'view', 'open voucher types');
        const company = await this.resolveCompany(this.prisma, companyId);
        const rows = await this.prisma.accVoucherType.findMany({
            where: {
                OR: [{ vchrCompanyId: null }, { vchrCompanyId: company }],
                ...(includeInactive ? {} : { vchrIsActive: true }),
            },
            orderBy: [{ vchrSortOrder: 'asc' }, { vchrTypeId: 'asc' }],
        });
        const childCount = new Map();
        for (const r of rows) {
            if (r.vchrParentId != null) {
                childCount.set(r.vchrParentId, (childCount.get(r.vchrParentId) ?? 0) + 1);
            }
        }
        const bases = rows.filter((r) => r.vchrParentId == null);
        const ordered = [];
        for (const b of bases) {
            ordered.push(b, ...rows.filter((r) => r.vchrParentId === b.vchrTypeId));
        }
        ordered.push(...rows.filter((r) => r.vchrParentId != null && !bases.some((b) => b.vchrTypeId === r.vchrParentId)));
        return {
            nodes: ordered.map((r) => ({
                vchrTypeId: r.vchrTypeId,
                vchrTypeCode: r.vchrTypeCode,
                vchrTypeName: r.vchrTypeName,
                vchrTypeShort: r.vchrTypeShort,
                vchrParentId: r.vchrParentId,
                vchrCompanyId: r.vchrCompanyId,
                vchrNature: r.vchrNature,
                vchrNoPrefix: r.vchrNoPrefix,
                vchrNoSuffix: r.vchrNoSuffix,
                kind: (0, voucher_types_rules_1.kindOf)(r),
                numberedBy: (0, voucher_types_rules_1.numberedByOf)(r),
                vchrIsActive: r.vchrIsActive,
                vchrSortOrder: r.vchrSortOrder,
                childCount: childCount.get(r.vchrTypeId) ?? 0,
                canHaveChildren: (0, voucher_types_rules_1.canHaveChildren)(r),
            })),
        };
    }
    async get(q) {
        await this.assertRight(this.prisma, 'view', 'open voucher types');
        const company = await this.resolveCompany(this.prisma, q.companyId);
        const row = await this.loadForCompany(this.prisma, q.vchrTypeId, company);
        return this.payload(this.prisma, row, company, q.branchId, q.accYear);
    }
    async payload(client, row, company, branchId, accYearIn) {
        const base = row.vchrParentId == null
            ? row
            : await client.accVoucherType.findUnique({ where: { vchrTypeId: row.vchrParentId } });
        const accYear = accYearIn?.trim() || accYearOfIso(istToday());
        const branch = await this.previewBranch(client, company, branchId ?? null);
        const [billCount, inUse, counters, printDocType, offerBase, facts, vouchers, branches] = await Promise.all([
            this.billCount(client, row.vchrTypeId, company),
            this.inUse(client, row.vchrTypeId),
            this.counters(client, row.vchrTypeId, company, accYear, (0, voucher_sequence_helper_1.isDeviceWideSeries)(row)),
            this.printDocType(client, base ?? row),
            (base ?? row).vchrTypeCode === voucher_types_rules_1.SALES_BILL_TYPE_CODE && row.vchrParentId == null
                ? this.readOfferBase(client, company)
                : Promise.resolve(null),
            this.numberingFacts(client, row, company, accYear, branch),
            this.voucherFacts(client, row.vchrTypeId, company, branch?.branchId ?? null, accYear),
            this.branchStates(client, row.vchrTypeId, company, accYear, (0, voucher_sequence_helper_1.isDeviceWideSeries)(row)),
        ]);
        const printDesigns = printDocType
            ? await this.printDesigns(client, printDocType, company, row.vchrParentId == null)
            : [];
        const verdict = (0, voucher_types_rules_1.checkNumbering)({
            mode: row.vchrNumberingMode,
            prefix: row.vchrNoPrefix,
            suffix: row.vchrNoSuffix,
            width: row.vchrNoWidth,
            startNo: row.vchrStartNo,
        }, facts);
        const inherited = this.inheritedOf(base ?? row);
        const deliveryApplies = (0, voucher_types_rules_1.hasDeliveryMode)(row, base);
        const inheritedDeliveryMode = deliveryApplies ? ((base ?? row).vchrDeliveryMode ?? null) : null;
        return {
            type: row,
            inherited,
            deliveryModeApplies: deliveryApplies,
            inheritedDeliveryMode,
            effectiveDeliveryMode: (0, voucher_types_rules_1.effectiveDeliveryMode)(row.vchrDeliveryMode, inheritedDeliveryMode, deliveryApplies),
            kind: (0, voucher_types_rules_1.kindOf)(row),
            numberedBy: (0, voucher_types_rules_1.numberedByOf)(row),
            isBase: (0, voucher_types_rules_1.isBaseType)(row),
            isGstOutward: (0, voucher_types_rules_1.isGstOutward)(row),
            canHaveChildren: (0, voucher_types_rules_1.canHaveChildren)(row),
            allowedMethods: [...voucher_types_rules_1.ALLOWED_METHODS],
            offerBase,
            billCount,
            inUse,
            counters,
            voucherCount: vouchers.voucherCount,
            lastVoucherRefno: vouchers.lastVoucherRefno,
            lastVoucherDate: vouchers.lastVoucherDate,
            branches,
            printDocType,
            printDesigns,
            preview: (0, voucher_types_rules_1.numberedByOf)(row) === 'SCREEN'
                ? { ...verdict.preview, sample: null, length: null, clashWith: null }
                : verdict.preview,
        };
    }
    inheritedOf(base) {
        const out = {
            vchrTypeId: base.vchrTypeId,
            vchrTypeCode: base.vchrTypeCode,
            vchrTypeName: base.vchrTypeName,
        };
        for (const k of voucher_types_rules_1.MIRROR_FIELDS) {
            out[k] = base[k];
        }
        return out;
    }
    async validate(dto) {
        await this.assertRight(this.prisma, 'view', 'open voucher types');
        const company = await this.resolveCompany(this.prisma, dto.companyId);
        const existing = dto.vchrTypeId !== undefined
            ? await this.loadForCompany(this.prisma, dto.vchrTypeId, company)
            : null;
        const judged = await this.judge(this.prisma, dto, existing, company);
        const inheritedDeliveryMode = judged.deliveryApplies
            ? ((judged.isBase ? judged.target.vchrDeliveryMode : judged.base?.vchrDeliveryMode) ?? null)
            : null;
        return {
            ok: judged.errors.length === 0,
            errors: wordIssues(judged.errors),
            warnings: judged.warnings,
            preview: judged.preview,
            vchrDeliveryMode: judged.target.vchrDeliveryMode,
            deliveryModeApplies: judged.deliveryApplies,
            inheritedDeliveryMode,
            effectiveDeliveryMode: (0, voucher_types_rules_1.effectiveDeliveryMode)(judged.target.vchrDeliveryMode, inheritedDeliveryMode, judged.deliveryApplies),
        };
    }
    async save(dto) {
        const isCreate = dto.vchrTypeId === undefined;
        this.assertOnline();
        let company = '';
        const { id, warnings } = await this.prisma.$transaction(async (tx) => {
            await this.assertRight(tx, isCreate ? 'create' : 'edit', isCreate ? 'make voucher types' : 'change voucher types');
            company = await this.resolveCompany(tx, dto.companyId);
            await tx.$queryRaw `
          SELECT count(pg_advisory_xact_lock(hashtext(${SAVE_LOCK_NAMESPACE}), hashtext(${company})))::int AS locked`;
            const existing = isCreate
                ? null
                : await this.loadForCompany(tx, dto.vchrTypeId, company, true);
            const judged = await this.judge(tx, dto, existing, company);
            if (judged.errors.length > 0) {
                (0, module_shared_utils_1.throwUnprocessable)('Voucher type not saved', judged.errors);
            }
            const saved = await this.write(tx, judged, company);
            let offerBaseBefore = null;
            if (judged.offerBase !== undefined &&
                judged.isBase &&
                saved.vchrTypeCode === voucher_types_rules_1.SALES_BILL_TYPE_CODE) {
                offerBaseBefore = await this.readOfferBase(tx, company);
                await this.writeOfferBase(tx, company, judged.offerBase);
            }
            await this.auditLogService.logEntityChange({
                action: isCreate ? 'New' : 'update',
                tableName: voucher_types_rules_1.VOUCHER_TYPES_TABLE_NAME,
                screenName: voucher_types_rules_1.VOUCHER_TYPES_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: String(saved.vchrTypeId),
                displayName: saved.vchrTypeName,
                originalRecord: judged.existing,
                modifiedRecord: saved,
                userId: this.actor(),
                notes: isCreate
                    ? `Voucher type ${saved.vchrTypeCode} created`
                    : `Voucher type ${saved.vchrTypeCode} updated` +
                        (offerBaseBefore !== null && offerBaseBefore !== judged.offerBase
                            ? `; offer Sales Bill itself ${offerBaseBefore} → ${judged.offerBase} for company ${company}`
                            : ''),
            }, tx);
            return { id: saved.vchrTypeId, warnings: judged.warnings };
        }, { timeout: 30000, maxWait: 10000 });
        const row = await this.loadForCompany(this.prisma, id, company);
        const data = await this.payload(this.prisma, row, company, dto.branchId, dto.accYear);
        return { ...data, warnings };
    }
    async judge(client, dto, existing, company) {
        const errors = [];
        const warnings = [];
        const accYear = dto.accYear?.trim() || accYearOfIso(istToday());
        const isCreate = existing === null;
        const isBase = existing !== null && existing.vchrParentId == null;
        let base = null;
        if (isBase) {
            base = existing;
            if (dto.vchrParentId !== undefined && dto.vchrParentId !== null) {
                errors.push((0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.BASE_FIELD_LOCKED, 'vchrParentId', 'A base type has no parent.'));
            }
        }
        else {
            const parentId = dto.vchrParentId !== undefined ? dto.vchrParentId : (existing?.vchrParentId ?? null);
            const parentChanged = existing !== null && parentId !== existing.vchrParentId;
            if (parentChanged && (await this.billCount(client, existing.vchrTypeId, null)) > 0) {
                errors.push((0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.PARENT_LOCKED, 'vchrParentId', `Voucher type ${existing.vchrTypeId} has bills; its parent stays.`));
            }
            const parent = parentId == null
                ? null
                : await client.accVoucherType.findUnique({ where: { vchrTypeId: parentId } });
            if (!parent || !(0, voucher_types_rules_1.canHaveChildren)(parent)) {
                errors.push((0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.PARENT_NOT_ALLOWED, 'vchrParentId', parentId == null
                    ? 'A new voucher type is a child: name its base (Sales Bill).'
                    : `Voucher type ${parentId} cannot have children: only Sales Bill can, and a child cannot.`));
            }
            base =
                parent && (0, voucher_types_rules_1.canHaveChildren)(parent)
                    ? parent
                    : existing?.vchrParentId != null
                        ? await client.accVoucherType.findUnique({
                            where: { vchrTypeId: existing.vchrParentId },
                        })
                        : null;
        }
        const from = existing ?? base;
        const pick = (_field, dtoValue, fallback) => dtoValue !== undefined ? dtoValue : fallback;
        const target = {
            vchrTypeName: pick('vchrTypeName', dto.vchrTypeName?.trim(), existing?.vchrTypeName ?? ''),
            vchrTypeShort: pick('vchrTypeShort', dto.vchrTypeShort?.trim(), existing?.vchrTypeShort ?? ''),
            vchrParentId: isBase
                ? null
                : dto.vchrParentId !== undefined
                    ? dto.vchrParentId
                    : (existing?.vchrParentId ?? null),
            vchrSortOrder: pick('vchrSortOrder', dto.vchrSortOrder, existing?.vchrSortOrder ?? (base ? base.vchrSortOrder + 1 : 0)),
            vchrIsActive: pick('vchrIsActive', dto.vchrIsActive, existing?.vchrIsActive ?? true),
            vchrNumberingMode: pick('vchrNumberingMode', dto.vchrNumberingMode, from?.vchrNumberingMode ?? client_1.VoucherNumberingMode.AUTO),
            vchrNoPrefix: pick('vchrNoPrefix', dto.vchrNoPrefix, existing ? existing.vchrNoPrefix : null),
            vchrNoSuffix: pick('vchrNoSuffix', dto.vchrNoSuffix, existing ? existing.vchrNoSuffix : null),
            vchrNoWidth: pick('vchrNoWidth', dto.vchrNoWidth, from?.vchrNoWidth ?? 5),
            vchrResetFreq: pick('vchrResetFreq', dto.vchrResetFreq, from?.vchrResetFreq ?? client_1.VoucherResetFreq.YEARLY),
            vchrStartNo: pick('vchrStartNo', dto.vchrStartNo, existing?.vchrStartNo ?? 1),
            vchrPrintTitle: pick('vchrPrintTitle', dto.vchrPrintTitle, existing ? existing.vchrPrintTitle : null),
            vchrPrintPurposeId: pick('vchrPrintPurposeId', dto.vchrPrintPurposeId, existing ? existing.vchrPrintPurposeId : null),
            vchrPrintAfterPost: pick('vchrPrintAfterPost', dto.vchrPrintAfterPost, from?.vchrPrintAfterPost ?? false),
            vchrTallyVoucherTypeName: pick('vchrTallyVoucherTypeName', dto.vchrTallyVoucherTypeName, existing ? existing.vchrTallyVoucherTypeName : null),
            vchrDeliveryMode: pick('vchrDeliveryMode', dto.vchrDeliveryMode, existing ? existing.vchrDeliveryMode : null),
        };
        if (!isBase && target.vchrTallyVoucherTypeName === null) {
            target.vchrTallyVoucherTypeName = target.vchrTypeName || null;
        }
        if (isBase) {
            errors.push(...(0, voucher_types_rules_1.lockedFieldChanges)(existing, {
                vchrTypeName: dto.vchrTypeName,
                vchrTypeShort: dto.vchrTypeShort,
                vchrIsActive: dto.vchrIsActive,
                vchrTallyVoucherTypeName: dto.vchrTallyVoucherTypeName,
            }, voucher_types_rules_1.BASE_LOCKED_FIELDS.filter((f) => f !== 'vchrParentId'), 'of a base type is set by the app.'));
        }
        else {
            errors.push(...(0, voucher_types_rules_1.checkChildIdentity)({ name: target.vchrTypeName, abbr: target.vchrTypeShort }, await this.namedRows(client, company), existing?.vchrTypeId ?? null));
        }
        const subject = existing ?? { ...base, vchrTypeId: 0, vchrParentId: target.vchrParentId };
        const screenNumbered = existing !== null && (0, voucher_types_rules_1.numberedByOf)(existing) === 'SCREEN';
        const gstOutward = !!base && (0, voucher_types_rules_1.isGstOutward)(base);
        const gstDocNo = !!base && (0, voucher_types_rules_1.isGstDocNo)(base);
        const branch = await this.previewBranch(client, company, dto.branchId ?? null);
        const facts = await this.numberingFacts(client, {
            ...subject,
            vchrGstSide: base?.vchrGstSide ?? subject.vchrGstSide,
            vchrGstDocNo: base?.vchrGstDocNo ?? subject.vchrGstDocNo,
        }, company, accYear, branch);
        const verdict = (0, voucher_types_rules_1.checkNumbering)({
            mode: target.vchrNumberingMode,
            prefix: target.vchrNoPrefix,
            suffix: target.vchrNoSuffix,
            width: target.vchrNoWidth,
            startNo: target.vchrStartNo,
        }, { ...facts, gstOutward, gstDocNo });
        let preview = verdict.preview;
        if (screenNumbered) {
            errors.push(...(0, voucher_types_rules_1.lockedFieldChanges)(existing, {
                vchrNumberingMode: dto.vchrNumberingMode,
                vchrNoPrefix: dto.vchrNoPrefix,
                vchrNoSuffix: dto.vchrNoSuffix,
                vchrNoWidth: dto.vchrNoWidth,
                vchrResetFreq: dto.vchrResetFreq,
                vchrStartNo: dto.vchrStartNo,
            }, voucher_types_rules_1.NUMBERING_FIELDS, 'is set by the document screen, per device (numbered by its screen).'));
            preview = { ...preview, sample: null, length: null, clashWith: null };
        }
        else {
            const numberingChanged = isCreate || voucher_types_rules_1.NUMBERING_FIELDS.some((k) => !(0, voucher_types_rules_1.sameValue)(target[k], existing[k]));
            if (numberingChanged) {
                errors.push(...verdict.errors);
            }
            warnings.push(...verdict.warnings);
            const formatChanged = existing !== null &&
                ['vchrNoPrefix', 'vchrNoSuffix', 'vchrNoWidth', 'vchrStartNo'].some((k) => !(0, voucher_types_rules_1.sameValue)(target[k], existing[k]));
            if (formatChanged &&
                (await this.hasCounterThisYear(client, existing.vchrTypeId, isBase ? null : company, accYear))) {
                warnings.push((0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeWarningCode.FORMAT_NEXT_COUNTER, 'vchrNoPrefix', 'The new numbering starts with the next counter: next year, or a branch that has not started yet.'));
            }
        }
        const deliveryApplies = (0, voucher_types_rules_1.hasDeliveryMode)(existing ?? { vchrTypeCode: '', vchrParentId: target.vchrParentId ?? base?.vchrTypeId ?? null }, isBase ? existing : base);
        errors.push(...(0, voucher_types_rules_1.checkDeliveryMode)(dto.vchrDeliveryMode, target.vchrDeliveryMode, {
            applies: deliveryApplies,
            isBase,
        }));
        const purposeChanged = target.vchrPrintPurposeId !== (existing?.vchrPrintPurposeId ?? null);
        if (target.vchrPrintPurposeId && purposeChanged) {
            const docType = base ? await this.printDocType(client, base) : null;
            const ok = docType
                ? await this.purposeAllowed(client, target.vchrPrintPurposeId, docType, company, isBase)
                : false;
            if (!ok) {
                errors.push((0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.PURPOSE_INVALID, 'vchrPrintPurposeId', docType
                    ? `Print design ${target.vchrPrintPurposeId} is not a live ${docType} design ${isBase ? 'shared by every company' : 'of this company or shared'}.`
                    : 'This voucher type has no print design to pick.'));
            }
        }
        return {
            existing,
            base,
            isBase,
            target,
            errors,
            warnings,
            preview,
            offerBase: dto.offerBase ?? undefined,
            deliveryApplies,
        };
    }
    async write(tx, j, company) {
        const t = j.target;
        const now = new Date();
        const numbering = {
            vchrNumberingMode: t.vchrNumberingMode,
            vchrNoPrefix: t.vchrNoPrefix,
            vchrNoSuffix: t.vchrNoSuffix,
            vchrNoWidth: t.vchrNoWidth,
            vchrResetFreq: t.vchrResetFreq,
            vchrStartNo: t.vchrStartNo,
        };
        const print = {
            vchrPrintTitle: t.vchrPrintTitle,
            vchrPrintPurposeId: t.vchrPrintPurposeId,
            vchrPrintAfterPost: t.vchrPrintAfterPost,
        };
        try {
            if (j.isBase) {
                const stored = j.existing;
                const wanted = {
                    ...((0, voucher_types_rules_1.numberedByOf)(stored) === 'SCREEN' ? {} : numbering),
                    ...print,
                    vchrSortOrder: t.vchrSortOrder,
                    ...(j.deliveryApplies ? { vchrDeliveryMode: t.vchrDeliveryMode } : {}),
                };
                const changed = Object.fromEntries(Object.entries(wanted).filter(([k, v]) => !(0, voucher_types_rules_1.sameValue)(v, stored[k])));
                if (Object.keys(changed).length === 0) {
                    return stored;
                }
                return await tx.accVoucherType.update({
                    where: { vchrTypeId: stored.vchrTypeId },
                    data: { ...changed, vchrUpdatedOn: now, vchrUpdatedBy: this.actor() },
                });
            }
            const base = j.base;
            const mirror = Object.fromEntries(voucher_types_rules_1.MIRROR_FIELDS.map((k) => [k, base[k]]));
            const identity = {
                vchrTypeName: t.vchrTypeName,
                vchrTypeShort: t.vchrTypeShort,
                vchrSortOrder: t.vchrSortOrder,
                vchrIsActive: t.vchrIsActive,
                vchrTallyVoucherTypeName: t.vchrTallyVoucherTypeName,
                vchrDeliveryMode: j.deliveryApplies ? t.vchrDeliveryMode : null,
            };
            if (j.existing) {
                return await tx.accVoucherType.update({
                    where: { vchrTypeId: j.existing.vchrTypeId },
                    data: {
                        ...identity,
                        ...numbering,
                        ...print,
                        ...mirror,
                        vchrParentId: base.vchrTypeId,
                        vchrUpdatedOn: now,
                        vchrUpdatedBy: this.actor(),
                    },
                });
            }
            await tx.$queryRaw `
        SELECT count(pg_advisory_xact_lock(hashtext(${CODE_LOCK_NAMESPACE}), hashtext(${base.vchrTypeCode})))::int AS locked`;
            const taken = await tx.accVoucherType.findMany({
                where: { vchrTypeCode: { startsWith: `${base.vchrTypeCode}-`, mode: 'insensitive' } },
                select: { vchrTypeCode: true },
            });
            return await tx.accVoucherType.create({
                data: {
                    vchrTypeCode: (0, voucher_types_rules_1.childTypeCode)(base.vchrTypeCode, t.vchrTypeShort, new Set(taken.map((r) => r.vchrTypeCode))),
                    ...identity,
                    ...numbering,
                    ...print,
                    ...mirror,
                    vchrParentId: base.vchrTypeId,
                    vchrCompanyId: company,
                    vchrCreatedBy: this.actor(),
                },
            });
        }
        catch (error) {
            if ((0, module_shared_utils_1.isUniqueConstraintError)(error)) {
                (0, module_shared_utils_1.throwConflict)('Voucher type not saved', [
                    uniqueRaceIssue((0, module_shared_utils_1.violatedConstraintOf)(error)),
                ]);
            }
            throw error;
        }
    }
    async inactivate(dto) {
        this.assertOnline();
        return this.prisma.$transaction(async (tx) => {
            await this.assertRight(tx, 'edit', 'change voucher types');
            const company = await this.resolveCompany(tx, dto.companyId);
            const existing = await this.loadForCompany(tx, dto.vchrTypeId, company, true);
            if (existing.vchrParentId == null) {
                (0, module_shared_utils_1.throwUnprocessable)('A base type stays active', [
                    (0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.BASE_FIELD_LOCKED, 'vchrIsActive', 'The Active of a base type is set by the app (OP-2).'),
                ]);
            }
            const saved = await tx.accVoucherType.update({
                where: { vchrTypeId: existing.vchrTypeId },
                data: { vchrIsActive: false, vchrUpdatedOn: new Date(), vchrUpdatedBy: this.actor() },
            });
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: voucher_types_rules_1.VOUCHER_TYPES_TABLE_NAME,
                screenName: voucher_types_rules_1.VOUCHER_TYPES_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: String(saved.vchrTypeId),
                displayName: saved.vchrTypeName,
                originalRecord: existing,
                modifiedRecord: saved,
                userId: this.actor(),
                notes: `Voucher type ${saved.vchrTypeCode} made inactive`,
            }, tx);
            return {
                vchrTypeId: saved.vchrTypeId,
                vchrIsActive: false,
                name: saved.vchrTypeName,
            };
        });
    }
    async remove(dto) {
        this.assertOnline();
        return this.prisma.$transaction(async (tx) => {
            await this.assertRight(tx, 'delete', 'delete voucher types');
            const company = await this.resolveCompany(tx, dto.companyId);
            const existing = await this.loadForCompany(tx, dto.vchrTypeId, company, true);
            if (existing.vchrParentId == null) {
                (0, module_shared_utils_1.throwUnprocessable)('A base type cannot be deleted', [
                    (0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.BASE_FIELD_LOCKED, 'vchrTypeId', 'A base type is set by the app and cannot be deleted.'),
                ]);
            }
            const inUse = () => (0, module_shared_utils_1.throwConflict)('Voucher type in use', [
                (0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.IN_USE, 'vchrTypeId', `${existing.vchrTypeName} has bills, a counter or vouchers; make it inactive instead.`, { params: { name: existing.vchrTypeName } }),
            ]);
            if (await this.inUse(tx, existing.vchrTypeId)) {
                inUse();
            }
            try {
                await tx.accVoucherType.delete({ where: { vchrTypeId: existing.vchrTypeId } });
            }
            catch (error) {
                if ((0, module_shared_utils_1.isForeignKeyConstraintError)(error)) {
                    inUse();
                }
                throw error;
            }
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: voucher_types_rules_1.VOUCHER_TYPES_TABLE_NAME,
                screenName: voucher_types_rules_1.VOUCHER_TYPES_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: String(existing.vchrTypeId),
                displayName: existing.vchrTypeName,
                originalRecord: existing,
                modifiedRecord: null,
                userId: this.actor(),
                notes: `Voucher type ${existing.vchrTypeCode} deleted (unused)`,
            }, tx);
            return {
                vchrTypeId: existing.vchrTypeId,
                deleted: true,
                name: existing.vchrTypeName,
            };
        });
    }
    async clonePrintDesign(dto) {
        this.assertOnline();
        return this.prisma.$transaction(async (tx) => {
            await this.assertRight(tx, 'create', 'make print designs for voucher types');
            const company = await this.resolveCompany(tx, dto.companyId);
            const code = dto.ppoCode.trim().toUpperCase();
            const [source] = await tx.$queryRaw `
        SELECT ppo_id, ppo_src_module, ppo_doc_type, ppo_copy_count, ppo_copy_labels, ppo_allow_reprint,
               ppo_sort_order, ppo_name
          FROM public.print_purpose
         WHERE lower(ppo_code) = lower(${dto.fromPpoCode.trim()})
           AND ppo_is_deleted = false AND ppo_is_active = true
           AND (ppo_company_id IS NULL OR ppo_company_id = ${company}::uuid)
         ORDER BY ppo_company_id NULLS LAST
         LIMIT 1`;
            if (!source) {
                (0, module_shared_utils_1.throwUnprocessable)('Print design not found', [
                    (0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.PURPOSE_INVALID, 'fromPpoCode', `No live print design ${dto.fromPpoCode} for this company.`),
                ]);
            }
            await tx.$queryRaw `
        SELECT count(pg_advisory_xact_lock(hashtext(${PURPOSE_CODE_LOCK_NAMESPACE}), hashtext(lower(${code}))))::int AS locked`;
            const codeTaken = () => (0, module_shared_utils_1.throwConflict)('Print design code taken', [
                (0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.PURPOSE_CODE_TAKEN, 'ppoCode', `A print design ${code} already exists (shared, this company's or another company's); print design codes are unique across companies.`, {
                    params: { code },
                }),
            ]);
            const [taken] = await tx.$queryRaw `
        SELECT ppo_id FROM public.print_purpose
         WHERE lower(ppo_code) = lower(${code}) AND ppo_is_deleted = false
         LIMIT 1`;
            if (taken) {
                codeTaken();
            }
            const userId = this.ctx.getUserId();
            let created;
            try {
                created = await tx.printPurpose.create({
                    data: {
                        ppoCompanyId: company,
                        ppoCode: code,
                        ppoName: dto.ppoName.trim(),
                        ppoSrcModule: source.ppo_src_module,
                        ppoDocType: source.ppo_doc_type,
                        ppoCopyCount: source.ppo_copy_count,
                        ppoCopyLabels: source.ppo_copy_labels,
                        ppoAllowReprint: source.ppo_allow_reprint,
                        ppoSortOrder: Math.min(source.ppo_sort_order + 1, 32767),
                        ppoNotes: `Cloned from ${dto.fromPpoCode.trim().toUpperCase()} (${source.ppo_name}) in Voucher Types; no layout until one is made in Print Templates.`,
                        ppoCreatedBy: userId && isUuid(userId) ? userId : null,
                    },
                });
            }
            catch (error) {
                if ((0, module_shared_utils_1.isUniqueConstraintError)(error)) {
                    codeTaken();
                }
                throw error;
            }
            return {
                ppoId: created.ppoId,
                ppoCode: created.ppoCode,
                ppoName: created.ppoName,
                ppoCopyCount: created.ppoCopyCount,
                ppoCopyLabels: created.ppoCopyLabels,
                isShared: false,
                hasLayout: false,
                hasAssignment: false,
            };
        });
    }
    async previewBranch(client, company, branchId) {
        const rows = await this.branchRows(client, company, true);
        const named = branchId?.toLowerCase() ?? null;
        return (rows.find((b) => b.branchId === named) ?? rows.find((b) => b.isDefault) ?? rows[0] ?? null);
    }
    async branchRows(client, company, includeInactive = false) {
        const rows = await client.$queryRaw `
      SELECT b.br_id, b.br_name, b.br_comp_id, b.br_is_default,
             upper(COALESCE(NULLIF(btrim(b.br_bill_prefix), ''), NULLIF(btrim(b.br_code), ''))) AS code,
             upper(COALESCE(NULLIF(btrim(b.br_gstin_no), ''), NULLIF(btrim(c.comp_gstin_no), ''))) AS gstin
        FROM public.branch_master b
        JOIN public.companys c ON c.comp_id = b.br_comp_id AND coalesce(c.comp_is_deleted, false) = false
       WHERE b.br_is_deleted = false
         AND (${includeInactive} OR b.br_is_active = true)
         AND (${company}::uuid IS NULL OR b.br_comp_id = ${company}::uuid)
       ORDER BY b.br_is_default DESC, b.br_name`;
        return rows.map((r) => ({
            branchId: r.br_id,
            branchName: r.br_name,
            companyId: r.br_comp_id,
            isDefault: r.br_is_default,
            numberCode: r.code,
            gstin: r.gstin,
        }));
    }
    async numberingFacts(client, subject, company, accYear, previewBranch) {
        const scopeCompany = subject.vchrParentId == null && subject.vchrTypeId !== 0 ? null : company;
        const [branches, seriesRows, deviceCode] = await Promise.all([
            this.branchRows(client, scopeCompany),
            client.accVoucherType.findMany({
                where: scopeCompany
                    ? { OR: [{ vchrCompanyId: null }, { vchrCompanyId: scopeCompany }] }
                    : {},
                select: {
                    vchrTypeId: true,
                    vchrTypeCode: true,
                    vchrTypeName: true,
                    vchrParentId: true,
                    vchrNoPrefix: true,
                    vchrNoSuffix: true,
                },
            }),
            (0, voucher_sequence_helper_1.longestLiveDeviceCode)(client, scopeCompany),
        ]);
        const series = seriesRows
            .filter((r) => (0, voucher_types_rules_1.numberedByOf)(r) === 'COUNTER')
            .map((r) => ({
            vchrTypeId: r.vchrTypeId,
            vchrTypeName: r.vchrTypeName,
            prefix: r.vchrNoPrefix,
            suffix: r.vchrNoSuffix,
        }));
        return {
            vchrTypeId: subject.vchrTypeId === 0 ? null : subject.vchrTypeId,
            accYear,
            gstOutward: (0, voucher_types_rules_1.isGstOutward)(subject),
            gstDocNo: (0, voucher_types_rules_1.isGstDocNo)(subject),
            deviceCode,
            branches,
            previewBranch,
            series,
        };
    }
    async namedRows(client, company) {
        return client.accVoucherType.findMany({
            where: { OR: [{ vchrCompanyId: null }, { vchrCompanyId: company }] },
            select: { vchrTypeId: true, vchrTypeName: true, vchrTypeShort: true },
        });
    }
    async billCount(client, vchrTypeId, company) {
        const [r] = await client.$queryRaw `
      SELECT count(*)::int AS n FROM sales.sale_bill
       WHERE sb_vchr_type_id = ${vchrTypeId}::int AND sb_is_deleted = false
         AND (${company}::uuid IS NULL OR sb_company_id = ${company}::uuid)`;
        return r?.n ?? 0;
    }
    async inUse(client, vchrTypeId) {
        const [r] = await client.$queryRaw `
      SELECT EXISTS (SELECT 1 FROM sales.sale_bill WHERE sb_vchr_type_id = ${vchrTypeId}::int)
          OR EXISTS (SELECT 1 FROM accounts.acc_voucher_seq WHERE seq_vchr_type_id = ${vchrTypeId}::int)
          OR EXISTS (SELECT 1 FROM accounts.acc_voucher_header WHERE avh_voucher_type_id = ${vchrTypeId}::int)
          OR EXISTS (SELECT 1 FROM accounts.acc_bill_balance WHERE abl_voucher_type_id = ${vchrTypeId}::int)
          AS used`;
        return r?.used === true;
    }
    async hasCounterThisYear(client, vchrTypeId, company, accYear) {
        const [r] = await client.$queryRaw `
      SELECT count(*)::int AS n FROM accounts.acc_voucher_seq
       WHERE seq_vchr_type_id = ${vchrTypeId}::int AND seq_acc_year = ${accYear}
         AND seq_is_deleted = false
         AND (${company}::uuid IS NULL OR seq_company_id = ${company}::uuid)`;
        return (r?.n ?? 0) > 0;
    }
    async counters(client, vchrTypeId, company, accYear, deviceWide = false) {
        const rows = await client.$queryRaw `
      SELECT s.seq_branch_id AS branch_id, b.br_name,
             upper(COALESCE(NULLIF(btrim(b.br_bill_prefix), ''), NULLIF(btrim(b.br_code), ''))) AS code,
             s.seq_device_code AS device_code, s.seq_last_no AS last_no, s.seq_last_refno AS last_refno
        FROM accounts.acc_voucher_seq s
        JOIN public.branch_master b ON b.br_id = s.seq_branch_id
       WHERE s.seq_vchr_type_id = ${vchrTypeId}::int AND s.seq_company_id = ${company}::uuid
         AND s.seq_acc_year = ${accYear} AND s.seq_is_deleted = false
       ORDER BY b.br_name, s.seq_device_code`;
        return rows.map((r) => ({
            branchId: r.branch_id,
            branchName: r.br_name,
            branchCode: r.code,
            deviceCode: r.device_code,
            lastNo: r.last_no.toString(),
            lastRefno: r.last_refno,
            allBranches: deviceWide && r.device_code.trim().toUpperCase() !== 'MAIN',
        }));
    }
    async voucherFacts(client, vchrTypeId, company, branchId, accYear) {
        const [[count], [last]] = await Promise.all([
            client.$queryRaw `
        SELECT count(*)::int AS n FROM accounts.acc_voucher_header
         WHERE avh_company_id = ${company}::uuid AND avh_acc_year = ${accYear}::char(9)
           AND avh_voucher_type_id = ${vchrTypeId}::int
           AND avh_is_deleted = false AND avh_voucher_status <> 'DRAFT'`,
            branchId
                ? client.$queryRaw `
            SELECT avh_voucher_refno AS refno, avh_voucher_date AS vdate FROM accounts.acc_voucher_header
             WHERE avh_company_id = ${company}::uuid AND avh_branch_id = ${branchId}::uuid
               AND avh_acc_year = ${accYear}::char(9) AND avh_voucher_type_id = ${vchrTypeId}::int
               AND avh_is_deleted = false AND avh_voucher_status <> 'DRAFT'
             ORDER BY avh_voucher_slno DESC NULLS LAST, avh_created_on DESC
             LIMIT 1`
                : Promise.resolve([]),
        ]);
        return {
            voucherCount: typeof count?.n === 'number' ? count.n : 0,
            lastVoucherRefno: last?.refno ?? null,
            lastVoucherDate: last?.vdate instanceof Date ? iso(last.vdate) : null,
        };
    }
    async branchStates(client, vchrTypeId, company, accYear, deviceWide = false) {
        const rows = await client.$queryRaw `
      SELECT b.br_id, b.br_name, b.br_is_default,
             upper(COALESCE(NULLIF(btrim(b.br_bill_prefix), ''), NULLIF(btrim(b.br_code), ''))) AS code,
             EXISTS (SELECT 1 FROM accounts.acc_voucher_seq s
                      WHERE s.seq_vchr_type_id = ${vchrTypeId}::int AND s.seq_company_id = ${company}::uuid
                        AND (s.seq_branch_id = b.br_id
                             OR (${deviceWide} AND upper(btrim(s.seq_device_code)) <> 'MAIN'))
                        AND s.seq_acc_year = ${accYear}
                        AND s.seq_is_deleted = false) AS has_counter,
             lv.refno
        FROM public.branch_master b
        LEFT JOIN LATERAL (
          SELECT h.avh_voucher_refno AS refno FROM accounts.acc_voucher_header h
           WHERE h.avh_company_id = ${company}::uuid AND h.avh_branch_id = b.br_id
             AND h.avh_acc_year = ${accYear}::char(9) AND h.avh_voucher_type_id = ${vchrTypeId}::int
             AND h.avh_is_deleted = false AND h.avh_voucher_status <> 'DRAFT'
           ORDER BY h.avh_voucher_slno DESC NULLS LAST, h.avh_created_on DESC
           LIMIT 1) lv ON true
       WHERE b.br_comp_id = ${company}::uuid AND b.br_is_deleted = false AND b.br_is_active = true
       ORDER BY b.br_is_default DESC, b.br_name`;
        return rows.map((r) => ({
            branchId: r.br_id,
            branchName: r.br_name,
            branchCode: r.code,
            isDefault: r.br_is_default,
            hasCounter: r.has_counter === true,
            lastVoucherRefno: r.refno ?? null,
        }));
    }
    async printDocType(client, base) {
        let own = null;
        if (base.vchrPrintPurposeId) {
            const p = await client.printPurpose.findUnique({
                where: { ppoId: base.vchrPrintPurposeId },
                select: { ppoDocType: true },
            });
            own = p?.ppoDocType ?? null;
        }
        return (0, voucher_types_rules_1.printDocTypeOf)(base, own);
    }
    async printDesigns(client, docType, company, sharedOnly) {
        const rows = await client.$queryRaw `
      SELECT p.ppo_id, p.ppo_code, p.ppo_name, p.ppo_copy_count, p.ppo_copy_labels,
             p.ppo_company_id IS NULL AS is_shared,
             ${(0, print_design_usable_sql_1.printDesignRuleSql)(print_design_usable_sql_1.PRINT_DESIGN_LAYOUT_RULE, 'p', client_1.Prisma.sql `${company}::uuid`)} AS has_layout,
             ${(0, print_design_usable_sql_1.printDesignRuleSql)(print_design_usable_sql_1.PRINT_DESIGN_ASSIGNMENT_RULE, 'p', client_1.Prisma.sql `${company}::uuid`)} AS has_assignment
        FROM public.print_purpose p
       WHERE p.ppo_doc_type = ${docType} AND p.ppo_is_deleted = false AND p.ppo_is_active = true
         AND (p.ppo_company_id IS NULL OR (${sharedOnly} = false AND p.ppo_company_id = ${company}::uuid))
       ORDER BY p.ppo_sort_order, p.ppo_name`;
        return rows.map((r) => ({
            ppoId: r.ppo_id,
            ppoCode: r.ppo_code,
            ppoName: r.ppo_name,
            ppoCopyCount: r.ppo_copy_count,
            ppoCopyLabels: r.ppo_copy_labels,
            isShared: r.is_shared,
            hasLayout: r.has_layout === true,
            hasAssignment: r.has_assignment === true,
        }));
    }
    async purposeAllowed(client, ppoId, docType, company, sharedOnly) {
        const designs = await this.printDesigns(client, docType, company, sharedOnly);
        return designs.some((d) => d.ppoId === ppoId);
    }
    async readOfferBase(client, company) {
        const [r] = await client.$queryRaw `
      SELECT COALESCE(
        (SELECT asv_value FROM public.app_setting_value
          WHERE asv_setting_key = ${exports.OFFER_BASE_SETTING_KEY} AND asv_scope = 'COMPANY'
            AND asv_company_id = ${company}::uuid AND asv_is_deleted = false LIMIT 1),
        (SELECT asv_value FROM public.app_setting_value
          WHERE asv_setting_key = ${exports.OFFER_BASE_SETTING_KEY} AND asv_scope = 'GLOBAL'
            AND asv_is_deleted = false LIMIT 1),
        (SELECT asd_default_value FROM public.app_setting_def WHERE asd_key = ${exports.OFFER_BASE_SETTING_KEY})) AS v`;
        return pickBool(r?.v, false);
    }
    async writeOfferBase(tx, company, value) {
        const actor = this.actor().slice(0, 50);
        const text = value ? 'true' : 'false';
        const updated = await tx.$executeRaw `
      UPDATE public.app_setting_value
         SET asv_value = ${text}, asv_modified_on = now(), asv_modified_by = ${actor}, asv_sync_date = NULL
       WHERE asv_setting_key = ${exports.OFFER_BASE_SETTING_KEY} AND asv_scope = 'COMPANY'
         AND asv_company_id = ${company}::uuid AND asv_branch_id IS NULL AND asv_device_id IS NULL
         AND asv_user_id IS NULL AND asv_is_deleted = false`;
        if (updated === 0) {
            await tx.$executeRaw `
        INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_company_id, asv_value, asv_remarks, asv_created_by)
        VALUES (${exports.OFFER_BASE_SETTING_KEY}, 'COMPANY', ${company}::uuid, ${text}, 'Voucher Types (menu 303)', ${actor})`;
        }
    }
};
exports.VoucherTypesService = VoucherTypesService;
exports.VoucherTypesService = VoucherTypesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        audit_log_service_1.AuditLogService,
        config_1.ConfigService])
], VoucherTypesService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return UUID.test(v);
}
function uniqueRaceIssue(hit) {
    const what = hit ?? 'unknown index';
    if (hit && /short/i.test(hit)) {
        return (0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.ABBR_TAKEN, 'vchrTypeShort', `Another voucher type took this abbreviation just now (${what}).`);
    }
    if (hit && /name/i.test(hit)) {
        return (0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.NAME_TAKEN, 'vchrTypeName', `Another voucher type took this name just now (${what}).`);
    }
    return (0, voucher_types_rules_1.issue)(voucher_types_error_codes_1.VoucherTypeErrorCode.CODE_TAKEN, 'vchrTypeShort', `Another company made a voucher type with the same system code just now (${what}). Save again: the next free code is taken then.`);
}
function wordIssues(errors) {
    return (0, error_wording_1.withUserWording)({ errors }).errors;
}
//# sourceMappingURL=voucher-types.service.js.map