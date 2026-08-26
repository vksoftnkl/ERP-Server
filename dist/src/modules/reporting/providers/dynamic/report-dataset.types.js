"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATASET_PARAM_NAME_PATTERN = exports.isReservedDatasetParam = exports.MANDATORY_SCOPE_PARAM = exports.RESERVED_DATASET_PARAMS = void 0;
exports.RESERVED_DATASET_PARAMS = {
    p_company_id: 'companyId',
    p_branch_id: 'branchId',
    p_acc_year: 'accYear',
    p_doc_id: 'docId',
    p_user_id: 'userId',
};
exports.MANDATORY_SCOPE_PARAM = 'p_company_id';
const isReservedDatasetParam = (name) => Object.prototype.hasOwnProperty.call(exports.RESERVED_DATASET_PARAMS, name);
exports.isReservedDatasetParam = isReservedDatasetParam;
exports.DATASET_PARAM_NAME_PATTERN = /^p_[a-z0-9]+(?:_[a-z0-9]+)*$/;
//# sourceMappingURL=report-dataset.types.js.map