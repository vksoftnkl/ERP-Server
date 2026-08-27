"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_INCLUDE = exports.VERSION_INCLUDE = exports.DATASET_ORDER_BY = void 0;
exports.toDatasetPayload = toDatasetPayload;
exports.toVersionPayload = toVersionPayload;
exports.toTemplatePayload = toTemplatePayload;
exports.handlePrintTemplateWriteError = handlePrintTemplateWriteError;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../../common/utils/module-service.utils");
exports.DATASET_ORDER_BY = [
    { ptdSortOrder: 'asc' },
    { ptdDatasetNo: 'asc' },
    { ptdId: 'asc' },
];
exports.VERSION_INCLUDE = {
    datasets: {
        where: { ptdIsDeleted: false },
        orderBy: exports.DATASET_ORDER_BY,
    },
};
exports.TEMPLATE_INCLUDE = {
    company: { select: { compName: true } },
    purpose: { select: { ppoCode: true, ppoName: true } },
    forkedFrom: { select: { ptlCode: true } },
    publishedRev: { select: { ptvRevNo: true } },
    versions: {
        where: { ptvIsDeleted: false },
        orderBy: { ptvRevNo: 'desc' },
        include: exports.VERSION_INCLUDE,
    },
};
const toIso = (value) => (value === null ? null : value.toISOString());
function toDatasetPayload(row) {
    return {
        ptdId: row.ptdId,
        ptdVersionId: row.ptdVersionId,
        ptdRole: row.ptdRole,
        ptdDatasetNo: row.ptdDatasetNo,
        ptdSortOrder: row.ptdSortOrder,
        ptdName: row.ptdName,
        ptdLabel: row.ptdLabel,
        ptdSourceKind: row.ptdSourceKind,
        ptdProviderCode: row.ptdProviderCode,
        ptdSql: row.ptdSql,
        ptdSqlNorm: row.ptdSqlNorm,
        ptdRequiresCompany: row.ptdRequiresCompany,
        ptdParentNo: row.ptdParentNo,
        ptdLinkFields: row.ptdLinkFields,
        ptdRowLimit: row.ptdRowLimit,
        ptdTimeoutMs: row.ptdTimeoutMs,
        ptdRemarks: row.ptdRemarks,
        ptdIsDeleted: row.ptdIsDeleted,
        ptdSyncDate: toIso(row.ptdSyncDate),
        ptdCreatedOn: row.ptdCreatedOn.toISOString(),
        ptdCreatedBy: row.ptdCreatedBy,
        ptdModifiedOn: toIso(row.ptdModifiedOn),
        ptdModifiedBy: row.ptdModifiedBy,
    };
}
function toVersionPayload(row, publishedRevId) {
    return {
        ptvId: row.ptvId,
        ptvTemplateId: row.ptvTemplateId,
        ptvRevNo: row.ptvRevNo,
        ptvStatus: row.ptvStatus,
        ptvEngine: row.ptvEngine,
        ptvBody: row.ptvBody,
        ptvSchemaVer: row.ptvSchemaVer,
        ptvPaperCode: row.ptvPaperCode,
        ptvOrientation: row.ptvOrientation,
        ptvWidthMm: (0, module_service_utils_1.toNullableNumber)(row.ptvWidthMm),
        ptvHeightMm: (0, module_service_utils_1.toNullableNumber)(row.ptvHeightMm),
        ptvMarginTopMm: (0, module_service_utils_1.toNumber)(row.ptvMarginTopMm),
        ptvMarginBottomMm: (0, module_service_utils_1.toNumber)(row.ptvMarginBottomMm),
        ptvMarginLeftMm: (0, module_service_utils_1.toNumber)(row.ptvMarginLeftMm),
        ptvMarginRightMm: (0, module_service_utils_1.toNumber)(row.ptvMarginRightMm),
        ptvColumns: row.ptvColumns,
        ptvLang: row.ptvLang,
        ptvFontFamily: row.ptvFontFamily,
        ptvParams: row.ptvParams ?? null,
        ptvNote: row.ptvNote,
        ptvApprovedOn: toIso(row.ptvApprovedOn),
        ptvApprovedBy: row.ptvApprovedBy,
        ptvIsDeleted: row.ptvIsDeleted,
        ptvSyncDate: toIso(row.ptvSyncDate),
        ptvCreatedOn: row.ptvCreatedOn.toISOString(),
        ptvCreatedBy: row.ptvCreatedBy,
        ptvModifiedOn: toIso(row.ptvModifiedOn),
        ptvModifiedBy: row.ptvModifiedBy,
        ptvIsPublishedRev: publishedRevId !== null && publishedRevId === row.ptvId,
        ptvIsEditable: row.ptvStatus === 'DRAFT',
        datasets: (row.datasets ?? []).map(toDatasetPayload),
    };
}
function toTemplatePayload(row) {
    return {
        ptlId: row.ptlId,
        ptlCompanyId: row.ptlCompanyId,
        ptlCompanyName: row.company?.compName ?? null,
        ptlPurposeId: row.ptlPurposeId,
        ptlPurposeCode: row.purpose?.ppoCode ?? null,
        ptlPurposeName: row.purpose?.ppoName ?? null,
        ptlCode: row.ptlCode,
        ptlName: row.ptlName,
        ptlDescription: row.ptlDescription,
        ptlPublishedRevId: row.ptlPublishedRevId,
        ptlPublishedRevNo: row.publishedRev?.ptvRevNo ?? null,
        ptlForkedFromId: row.ptlForkedFromId,
        ptlForkedFromCode: row.forkedFrom?.ptlCode ?? null,
        ptlForkedFromRev: row.ptlForkedFromRev,
        ptlSortOrder: row.ptlSortOrder,
        ptlCompanyKey: row.ptlCompanyKey,
        ptlIsActive: row.ptlIsActive,
        ptlIsDeleted: row.ptlIsDeleted,
        ptlSyncDate: toIso(row.ptlSyncDate),
        ptlCreatedOn: row.ptlCreatedOn.toISOString(),
        ptlCreatedBy: row.ptlCreatedBy,
        ptlModifiedOn: toIso(row.ptlModifiedOn),
        ptlModifiedBy: row.ptlModifiedBy,
        versions: (row.versions ?? []).map((version) => toVersionPayload(version, row.ptlPublishedRevId)),
    };
}
function handlePrintTemplateWriteError(error) {
    if ((0, module_service_utils_1.isUniqueConstraintError)(error)) {
        const target = describeUniqueTarget(error);
        (0, module_service_utils_1.throwSettingsConflict)(target.message, [{ field: target.field, message: target.detail }]);
        return;
    }
    if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
        (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', [
            {
                field: resolveForeignKeyField(error),
                message: 'Referenced record was not found, or is still in use by another row',
            },
        ]);
        return;
    }
    const constraint = matchCheckConstraint(error);
    if (constraint) {
        (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', [
            {
                field: fieldForConstraint(constraint),
                message: `The database refused this row: ${constraint}. See the printing schema notes for what it enforces.`,
            },
        ]);
    }
}
function describeUniqueTarget(error) {
    const target = uniqueTargetText(error);
    if (target.includes('ptv_rev_no') || target.includes('ptvRevNo')) {
        return {
            field: 'ptvRevNo',
            message: 'Duplicate revision number',
            detail: 'This template already has a version with that ptvRevNo. Revision numbers are dense, ' +
                'unique and never reused — omit ptvRevNo and the next one is assigned.',
        };
    }
    if (target.includes('ptd_dataset_no') || target.includes('ptdDatasetNo')) {
        return {
            field: 'ptdDatasetNo',
            message: 'Duplicate dataset number',
            detail: 'Another dataset on this version already claims that number',
        };
    }
    if (target.includes('ptd_name') || target.includes('ptdName')) {
        return {
            field: 'ptdName',
            message: 'Duplicate dataset name',
            detail: 'Another dataset on this version already has that name',
        };
    }
    if (target.includes('ptd_role') || target.includes('one_master')) {
        return {
            field: 'ptdRole',
            message: 'Duplicate MASTER dataset',
            detail: 'A version may hold at most one MASTER dataset',
        };
    }
    if (target.includes('ptl_code') || target.includes('ptlCode')) {
        return {
            field: 'ptlCode',
            message: 'Duplicate template code',
            detail: 'A template with that code already exists for this owner',
        };
    }
    return {
        field: 'request',
        message: 'Duplicate print template data is not allowed',
        detail: 'A record with the same unique values already exists',
    };
}
function uniqueTargetText(error) {
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError)) {
        return '';
    }
    const target = error.meta?.target;
    if (Array.isArray(target)) {
        return target.join(',');
    }
    if (typeof target === 'string') {
        return target;
    }
    return error.message;
}
function resolveForeignKeyField(error) {
    const text = error instanceof Error ? error.message : String(error);
    const known = [
        [/fk_ptl_company|ptl_company_id/, 'ptlCompanyId'],
        [/fk_ptl_purpose|ptl_purpose_id/, 'ptlPurposeId'],
        [/fk_ptl_forked_from|ptl_forked_from_id/, 'ptlForkedFromId'],
        [/fk_ptl_published_rev|ptl_published_rev_id/, 'ptlPublishedRevId'],
        [/fk_ptv_template|ptv_template_id/, 'ptvTemplateId'],
        [/fk_ptv_approved_by|ptv_approved_by/, 'ptvApprovedBy'],
        [/fk_ptd_version|ptd_version_id/, 'ptdVersionId'],
    ];
    for (const [pattern, field] of known) {
        if (pattern.test(text)) {
            return field;
        }
    }
    return 'request';
}
function matchCheckConstraint(error) {
    const text = error instanceof Error ? error.message : String(error);
    return text.match(/\bck_pt[dlv]_[a-z0-9_]+/)?.[0] ?? null;
}
function fieldForConstraint(constraint) {
    if (constraint.startsWith('ck_ptl_'))
        return 'ptlCode';
    if (constraint.startsWith('ck_ptv_'))
        return 'ptvBody';
    if (constraint.startsWith('ck_ptd_sql'))
        return 'ptdSql';
    if (constraint.startsWith('ck_ptd_'))
        return 'ptdName';
    return 'request';
}
//# sourceMappingURL=print-template.utils.js.map