"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATES_ACCOUNT_GROUP_ID = exports.STATE_AUDIT_SCREEN_NAME = exports.STATE_TABLE_NAME = exports.DEFAULT_PAGE = exports.DEFAULT_LIMIT = exports.DEFAULT_ACTOR = void 0;
exports.ensureStateNameIsUnique = ensureStateNameIsUnique;
exports.applyStateOptionalFields = applyStateOptionalFields;
exports.normalizeRequiredStateName = normalizeRequiredStateName;
exports.toStatePayload = toStatePayload;
exports.resolveStateActor = resolveStateActor;
exports.handleStateWriteError = handleStateWriteError;
exports.throwStateNotFound = throwStateNotFound;
exports.throwStateBadRequest = throwStateBadRequest;
exports.buildStateErrorResponse = buildStateErrorResponse;
const module_service_utils_1 = require("../../../../common/utils/module-service.utils");
Object.defineProperty(exports, "DEFAULT_ACTOR", { enumerable: true, get: function () { return module_service_utils_1.DEFAULT_ACTOR; } });
Object.defineProperty(exports, "DEFAULT_LIMIT", { enumerable: true, get: function () { return module_service_utils_1.DEFAULT_LIMIT; } });
Object.defineProperty(exports, "DEFAULT_PAGE", { enumerable: true, get: function () { return module_service_utils_1.DEFAULT_PAGE; } });
exports.STATE_TABLE_NAME = 'state master';
exports.STATE_AUDIT_SCREEN_NAME = 'State Master';
exports.STATES_ACCOUNT_GROUP_ID = '019f081c-6764-73b0-b397-3f30a6efe73e';
const STATE_OPTIONAL_FIELDS = ['stmAlias', 'stmShort', 'stmOrder', 'stmDescription', 'stmIsActive'];
async function ensureStateNameIsUnique(tx, stateName, excludeId) {
    const existing = await tx.stateMaster.findFirst({
        where: {
            stmIsDeleted: false,
            stmName: {
                equals: stateName,
                mode: 'insensitive',
            },
            ...(excludeId
                ? {
                    stmId: {
                        not: excludeId,
                    },
                }
                : {}),
        },
        select: {
            stmId: true,
        },
    });
    if (existing) {
        (0, module_service_utils_1.throwSalesConflict)('State name already exists', [
            {
                field: 'stmName',
                message: 'Duplicate state name is not allowed',
            },
        ]);
    }
}
function applyStateOptionalFields(data, saveStateDto) {
    (0, module_service_utils_1.applyPresentFields)(data, saveStateDto, STATE_OPTIONAL_FIELDS);
}
function normalizeRequiredStateName(name) {
    return (0, module_service_utils_1.normalizeRequiredText)(name, 'stmName');
}
function toStatePayload(record) {
    return {
        stmId: record.stmId,
        stmName: record.stmName,
        stmAlias: record.stmAlias,
        stmShort: record.stmShort,
        stmOrder: (0, module_service_utils_1.toNumber)(record.stmOrder),
        stmDescription: record.stmDescription,
        stmIsActive: record.stmIsActive,
        stmIsDeleted: record.stmIsDeleted,
        stmSyncDate: record.stmSyncDate ? record.stmSyncDate.toISOString() : null,
        stmCreatedOn: record.stmCreatedOn.toISOString(),
        stmCreatedBy: record.stmCreatedBy,
        stmModifiedOn: record.stmModifiedOn.toISOString(),
        stmModifiedBy: record.stmModifiedBy,
    };
}
function resolveStateActor(value, userId = null) {
    return (0, module_service_utils_1.resolveActor)(value, userId);
}
function handleStateWriteError(error) {
    (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'State already exists', [
        {
            field: 'stmName',
            message: 'Duplicate stmName is not allowed',
        },
    ]);
}
function throwStateNotFound(stmId) {
    (0, module_service_utils_1.throwSalesNotFound)('State not found', 'stmId', `No active state found with id ${stmId}`);
}
function throwStateBadRequest(message, errors) {
    (0, module_service_utils_1.throwSalesBadRequest)(message, errors);
}
function buildStateErrorResponse(message, errors = []) {
    return (0, module_service_utils_1.buildSalesErrorResponse)(message, errors);
}
//# sourceMappingURL=state.utils.js.map