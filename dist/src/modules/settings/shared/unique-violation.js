"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUniqueViolationOf = isUniqueViolationOf;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
function isUniqueViolationOf(error, indexName, column) {
    if (!(0, module_service_utils_1.isUniqueConstraintError)(error)) {
        return false;
    }
    const meta = error.meta ?? {};
    const text = [
        (0, module_service_utils_1.violatedConstraintOf)(error),
        typeof meta.message === 'string' ? meta.message : null,
        error instanceof Error ? error.message : null,
    ]
        .filter((part) => Boolean(part))
        .join(' ')
        .toLowerCase();
    return (text.includes(indexName.toLowerCase()) ||
        new RegExp(`(^|[^a-z0-9_])${column.toLowerCase()}($|[^a-z0-9_])`).test(text));
}
//# sourceMappingURL=unique-violation.js.map