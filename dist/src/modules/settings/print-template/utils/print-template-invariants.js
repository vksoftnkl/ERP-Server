"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectTemplateInvariantErrors = collectTemplateInvariantErrors;
exports.collectVersionInvariantErrors = collectVersionInvariantErrors;
exports.collectDatasetInvariantErrors = collectDatasetInvariantErrors;
exports.collectDatasetSetInvariantErrors = collectDatasetSetInvariantErrors;
const print_template_constants_1 = require("../print-template.constants");
const print_template_sql_guards_1 = require("./print-template-sql-guards");
const at = (path, field) => (path ? `${path}.${field}` : field);
function checkTemplateCodeShape(template, errors) {
    if (!print_template_constants_1.PTL_CODE_PATTERN.test(template.ptlCode)) {
        errors.push({
            field: 'ptlCode',
            message: 'ptlCode may contain only letters, digits, underscore and hyphen',
        });
    }
}
function checkTemplateNotOwnFork(template, errors) {
    if (template.ptlForkedFromId !== null && template.ptlForkedFromId === template.ptlId) {
        errors.push({
            field: 'ptlForkedFromId',
            message: 'A template cannot be forked from itself',
        });
    }
}
function checkTemplateForkPair(template, errors) {
    const hasId = template.ptlForkedFromId !== null;
    const hasRev = template.ptlForkedFromRev !== null;
    if (hasId !== hasRev) {
        errors.push({
            field: hasId ? 'ptlForkedFromRev' : 'ptlForkedFromId',
            message: 'ptlForkedFromId and ptlForkedFromRev are a pair — send both to record where a clone ' +
                'came from, or neither',
        });
    }
}
function checkTemplateSortOrder(template, errors) {
    if (!Number.isInteger(template.ptlSortOrder) || template.ptlSortOrder < 0) {
        errors.push({ field: 'ptlSortOrder', message: 'ptlSortOrder must be 0 or more' });
    }
}
function collectTemplateInvariantErrors(template) {
    const errors = [];
    checkTemplateCodeShape(template, errors);
    checkTemplateNotOwnFork(template, errors);
    checkTemplateForkPair(template, errors);
    checkTemplateSortOrder(template, errors);
    return errors;
}
function checkVersionStatus(version, path, errors) {
    if (!print_template_constants_1.PTV_STATUSES.includes(version.ptvStatus)) {
        errors.push({
            field: at(path, 'ptvStatus'),
            message: `ptvStatus must be one of ${print_template_constants_1.PTV_STATUSES.join(', ')}`,
        });
    }
}
function checkVersionEngine(version, path, errors) {
    if (!print_template_constants_1.PTV_ENGINES.includes(version.ptvEngine)) {
        errors.push({
            field: at(path, 'ptvEngine'),
            message: `ptvEngine must be one of ${print_template_constants_1.PTV_ENGINES.join(', ')}`,
        });
    }
}
function checkVersionBody(version, path, errors) {
    const length = version.ptvBody.length;
    if (length < print_template_constants_1.PTV_BODY_MIN_LENGTH || length > print_template_constants_1.PTV_BODY_MAX_LENGTH) {
        errors.push({
            field: at(path, 'ptvBody'),
            message: `ptvBody must be between ${print_template_constants_1.PTV_BODY_MIN_LENGTH} and ${print_template_constants_1.PTV_BODY_MAX_LENGTH} characters`,
        });
        return;
    }
    if (version.ptvEngine !== print_template_constants_1.PTV_JSON_ENGINE) {
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(version.ptvBody);
    }
    catch {
        errors.push({
            field: at(path, 'ptvBody'),
            message: `ptvBody must be a JSON object when ptvEngine is ${print_template_constants_1.PTV_JSON_ENGINE} — it did not parse as JSON`,
        });
        return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        errors.push({
            field: at(path, 'ptvBody'),
            message: `ptvBody must be a JSON OBJECT when ptvEngine is ${print_template_constants_1.PTV_JSON_ENGINE} — an array, a number or null will not do`,
        });
    }
}
function checkVersionRevNo(version, path, errors) {
    if (!Number.isInteger(version.ptvRevNo) || version.ptvRevNo <= 0) {
        errors.push({
            field: at(path, 'ptvRevNo'),
            message: 'ptvRevNo must be a positive integer',
        });
    }
}
function checkVersionOrientation(version, path, errors) {
    if (!print_template_constants_1.PTV_ORIENTATIONS.includes(version.ptvOrientation)) {
        errors.push({
            field: at(path, 'ptvOrientation'),
            message: `ptvOrientation must be one of ${print_template_constants_1.PTV_ORIENTATIONS.join(', ')}`,
        });
    }
}
function checkVersionGeometry(version, path, errors) {
    if (version.ptvWidthMm !== null && !(version.ptvWidthMm > 0)) {
        errors.push({
            field: at(path, 'ptvWidthMm'),
            message: 'ptvWidthMm must be greater than 0, or null to take it from the paper',
        });
    }
    if (version.ptvHeightMm !== null && !(version.ptvHeightMm > 0)) {
        errors.push({
            field: at(path, 'ptvHeightMm'),
            message: 'ptvHeightMm must be greater than 0, or null to take it from the paper',
        });
    }
    const margins = [
        ['ptvMarginTopMm', version.ptvMarginTopMm],
        ['ptvMarginBottomMm', version.ptvMarginBottomMm],
        ['ptvMarginLeftMm', version.ptvMarginLeftMm],
        ['ptvMarginRightMm', version.ptvMarginRightMm],
    ];
    for (const [field, value] of margins) {
        if (!(value >= 0)) {
            errors.push({ field: at(path, field), message: `${field} must be 0 or more` });
        }
    }
    if (version.ptvColumns !== null &&
        (!Number.isInteger(version.ptvColumns) ||
            version.ptvColumns < print_template_constants_1.PTV_COLUMNS_MIN ||
            version.ptvColumns > print_template_constants_1.PTV_COLUMNS_MAX)) {
        errors.push({
            field: at(path, 'ptvColumns'),
            message: `ptvColumns must be between ${print_template_constants_1.PTV_COLUMNS_MIN} and ${print_template_constants_1.PTV_COLUMNS_MAX}, or null for a ` +
                'page engine where characters per line mean nothing',
        });
    }
}
function checkVersionPublished(version, path, errors) {
    if (version.ptvStatus === 'PUBLISHED' && !version.ptvApprovedBy) {
        errors.push({
            field: at(path, 'ptvApprovedBy'),
            message: 'A PUBLISHED version must name its approver in ptvApprovedBy',
        });
    }
}
function checkVersionLang(version, path, errors) {
    if (!print_template_constants_1.PTV_LANG_PATTERN.test(version.ptvLang)) {
        errors.push({
            field: at(path, 'ptvLang'),
            message: 'ptvLang must look like "en" or "en-IN" — two lower-case letters, optional -REGION',
        });
    }
}
function checkVersionParams(version, path, errors) {
    const params = version.ptvParams;
    if (params === null || params === undefined) {
        return;
    }
    if (!Array.isArray(params)) {
        errors.push({
            field: at(path, 'ptvParams'),
            message: 'ptvParams must be a JSON array of prompt declarations, or null',
        });
        return;
    }
    const seen = new Map();
    params.forEach((entry, index) => {
        const field = at(path, `ptvParams[${index}]`);
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
            errors.push({ field, message: 'Each ptvParams entry must be an object' });
            return;
        }
        const record = entry;
        const name = record.name;
        if (typeof name !== 'string' || !print_template_constants_1.PTV_PARAM_NAME_PATTERN.test(name)) {
            errors.push({
                field: `${field}.name`,
                message: 'name must be lower snake case, starting with a letter — it is what :name binds',
            });
        }
        else {
            const first = seen.get(name);
            if (first !== undefined) {
                errors.push({
                    field: `${field}.name`,
                    message: `Prompts ${first + 1} and ${index + 1} both declare "${name}"`,
                });
            }
            seen.set(name, index);
        }
        if (record.type !== undefined &&
            (typeof record.type !== 'string' ||
                !print_template_constants_1.PTV_PARAM_TYPES.includes(record.type))) {
            errors.push({
                field: `${field}.type`,
                message: `type must be one of ${print_template_constants_1.PTV_PARAM_TYPES.join(', ')}`,
            });
        }
        if (record.required !== undefined && typeof record.required !== 'boolean') {
            errors.push({ field: `${field}.required`, message: 'required must be true or false' });
        }
        if (record.label !== undefined && typeof record.label !== 'string') {
            errors.push({ field: `${field}.label`, message: 'label must be a string' });
        }
    });
}
function collectVersionInvariantErrors(version, path = '') {
    const errors = [];
    checkVersionStatus(version, path, errors);
    checkVersionEngine(version, path, errors);
    checkVersionBody(version, path, errors);
    checkVersionRevNo(version, path, errors);
    checkVersionOrientation(version, path, errors);
    checkVersionGeometry(version, path, errors);
    checkVersionPublished(version, path, errors);
    checkVersionLang(version, path, errors);
    checkVersionParams(version, path, errors);
    return errors;
}
function checkDatasetRole(dataset, path, errors) {
    if (!print_template_constants_1.PTD_ROLES.includes(dataset.ptdRole)) {
        errors.push({
            field: at(path, 'ptdRole'),
            message: `ptdRole must be one of ${print_template_constants_1.PTD_ROLES.join(', ')}`,
        });
    }
}
function checkDatasetSourceKind(dataset, path, errors) {
    if (!print_template_constants_1.PTD_SOURCE_KINDS.includes(dataset.ptdSourceKind)) {
        errors.push({
            field: at(path, 'ptdSourceKind'),
            message: `ptdSourceKind must be one of ${print_template_constants_1.PTD_SOURCE_KINDS.join(', ')}`,
        });
    }
}
function checkDatasetSourceBiconditional(dataset, path, errors) {
    const isProvider = dataset.ptdSourceKind === 'PROVIDER';
    const isSql = dataset.ptdSourceKind === 'SQL';
    if (isProvider !== (dataset.ptdProviderCode !== null)) {
        errors.push({
            field: at(path, 'ptdProviderCode'),
            message: isProvider
                ? 'A PROVIDER dataset must name ptdProviderCode'
                : 'ptdProviderCode belongs to a PROVIDER dataset — clear it or set ptdSourceKind to PROVIDER',
        });
    }
    if (isSql !== (dataset.ptdSql !== null)) {
        errors.push({
            field: at(path, 'ptdSql'),
            message: isSql
                ? 'A SQL dataset must carry ptdSql'
                : 'ptdSql belongs to a SQL dataset — clear it or set ptdSourceKind to SQL',
        });
    }
}
function checkDatasetMasterIsZero(dataset, path, errors) {
    const isMaster = dataset.ptdRole === 'MASTER';
    const isZero = dataset.ptdDatasetNo === print_template_constants_1.PTD_MASTER_DATASET_NO;
    if (isMaster !== isZero) {
        errors.push({
            field: at(path, 'ptdDatasetNo'),
            message: isMaster
                ? `The MASTER dataset must be number ${print_template_constants_1.PTD_MASTER_DATASET_NO}`
                : `Dataset number ${print_template_constants_1.PTD_MASTER_DATASET_NO} is reserved for the MASTER — number a DETAIL from 1`,
        });
    }
}
function checkDatasetNoRange(dataset, path, errors) {
    if (!Number.isInteger(dataset.ptdDatasetNo) ||
        dataset.ptdDatasetNo < print_template_constants_1.PTD_DATASET_NO_MIN ||
        dataset.ptdDatasetNo > print_template_constants_1.PTD_DATASET_NO_MAX) {
        errors.push({
            field: at(path, 'ptdDatasetNo'),
            message: `ptdDatasetNo must be between ${print_template_constants_1.PTD_DATASET_NO_MIN} and ${print_template_constants_1.PTD_DATASET_NO_MAX}`,
        });
    }
}
function checkDatasetNameShape(dataset, path, errors) {
    if (!print_template_constants_1.PTD_NAME_PATTERN.test(dataset.ptdName)) {
        errors.push({
            field: at(path, 'ptdName'),
            message: 'ptdName must be lower snake case, starting with a letter — "items", "bill_header"',
        });
    }
}
function checkDatasetProviderShape(dataset, path, errors) {
    if (dataset.ptdProviderCode !== null && !print_template_constants_1.PTD_PROVIDER_PATTERN.test(dataset.ptdProviderCode)) {
        errors.push({
            field: at(path, 'ptdProviderCode'),
            message: 'ptdProviderCode must be dotted lower snake case — "sales.bill.tax_summary"',
        });
    }
}
function checkDatasetParent(dataset, path, errors) {
    if (dataset.ptdParentNo === null) {
        return;
    }
    if (dataset.ptdParentNo === dataset.ptdDatasetNo) {
        errors.push({
            field: at(path, 'ptdParentNo'),
            message: 'A dataset cannot be its own parent',
        });
    }
    if (dataset.ptdRole === 'MASTER') {
        errors.push({
            field: at(path, 'ptdParentNo'),
            message: 'The MASTER dataset is the header context and has no parent',
        });
    }
}
function checkDatasetLinkFields(dataset, path, errors) {
    const hasParent = dataset.ptdParentNo !== null;
    const hasLink = dataset.ptdLinkFields !== null;
    if (hasParent !== hasLink) {
        errors.push({
            field: hasParent ? at(path, 'ptdLinkFields') : at(path, 'ptdParentNo'),
            message: 'ptdParentNo and ptdLinkFields are a pair — a nested dataset must say WHICH dataset it ' +
                'hangs off and HOW the rows match',
        });
    }
    if (dataset.ptdLinkFields !== null && !print_template_constants_1.PTD_LINK_FIELDS_PATTERN.test(dataset.ptdLinkFields)) {
        errors.push({
            field: at(path, 'ptdLinkFields'),
            message: 'ptdLinkFields must be parent=child pairs, comma separated, no spaces — ' +
                '"sbi_id=line_id" or "sb_id=bill_id,sbi_slno=slno". Both sides are output columns; ' +
                'neither is a bound parameter.',
        });
    }
}
function checkDatasetLimits(dataset, path, errors) {
    if (!Number.isInteger(dataset.ptdRowLimit) ||
        dataset.ptdRowLimit < print_template_constants_1.PTD_ROW_LIMIT_MIN ||
        dataset.ptdRowLimit > print_template_constants_1.PTD_ROW_LIMIT_MAX) {
        errors.push({
            field: at(path, 'ptdRowLimit'),
            message: `ptdRowLimit must be between ${print_template_constants_1.PTD_ROW_LIMIT_MIN} and ${print_template_constants_1.PTD_ROW_LIMIT_MAX}`,
        });
    }
    if (!Number.isInteger(dataset.ptdTimeoutMs) ||
        dataset.ptdTimeoutMs < print_template_constants_1.PTD_TIMEOUT_MS_MIN ||
        dataset.ptdTimeoutMs > print_template_constants_1.PTD_TIMEOUT_MS_MAX) {
        errors.push({
            field: at(path, 'ptdTimeoutMs'),
            message: `ptdTimeoutMs must be between ${print_template_constants_1.PTD_TIMEOUT_MS_MIN} and ${print_template_constants_1.PTD_TIMEOUT_MS_MAX} ms`,
        });
    }
}
function collectDatasetInvariantErrors(dataset, path = '') {
    const errors = [];
    checkDatasetRole(dataset, path, errors);
    checkDatasetSourceKind(dataset, path, errors);
    checkDatasetSourceBiconditional(dataset, path, errors);
    checkDatasetMasterIsZero(dataset, path, errors);
    checkDatasetNoRange(dataset, path, errors);
    checkDatasetNameShape(dataset, path, errors);
    checkDatasetProviderShape(dataset, path, errors);
    checkDatasetParent(dataset, path, errors);
    checkDatasetLinkFields(dataset, path, errors);
    checkDatasetLimits(dataset, path, errors);
    if (dataset.ptdSourceKind === 'SQL' && dataset.ptdSql !== null) {
        errors.push(...(0, print_template_sql_guards_1.collectDatasetSqlErrors)(dataset.ptdSql, dataset.ptdRequiresCompany, at(path, 'ptdSql')));
    }
    return errors;
}
function collectDatasetSetInvariantErrors(datasets) {
    const errors = [];
    const byNumber = new Map();
    const byName = new Map();
    const masters = [];
    datasets.forEach(({ dataset, path }, index) => {
        const clashNumber = byNumber.get(dataset.ptdDatasetNo);
        if (clashNumber !== undefined) {
            errors.push({
                field: at(path, 'ptdDatasetNo'),
                message: `Datasets ${clashNumber + 1} and ${index + 1} both claim number ${dataset.ptdDatasetNo}`,
            });
        }
        else {
            byNumber.set(dataset.ptdDatasetNo, index);
        }
        const clashName = byName.get(dataset.ptdName);
        if (clashName !== undefined) {
            errors.push({
                field: at(path, 'ptdName'),
                message: `Datasets ${clashName + 1} and ${index + 1} are both named "${dataset.ptdName}"`,
            });
        }
        else {
            byName.set(dataset.ptdName, index);
        }
        if (dataset.ptdRole === 'MASTER') {
            masters.push(index);
        }
    });
    if (masters.length > 1) {
        const [, second] = masters;
        errors.push({
            field: at(datasets[second].path, 'ptdRole'),
            message: `A version may hold at most one MASTER dataset; rows ${masters
                .map((index) => index + 1)
                .join(', ')} all claim it`,
        });
    }
    datasets.forEach(({ dataset, path }) => {
        if (dataset.ptdParentNo !== null && !byNumber.has(dataset.ptdParentNo)) {
            errors.push({
                field: at(path, 'ptdParentNo'),
                message: `No dataset in this version is numbered ${dataset.ptdParentNo}`,
            });
        }
    });
    errors.push(...collectParentCycleErrors(datasets, byNumber));
    return errors;
}
function collectParentCycleErrors(datasets, byNumber) {
    const errors = [];
    datasets.forEach(({ dataset, path }) => {
        const seen = new Set([dataset.ptdDatasetNo]);
        let parentNo = dataset.ptdParentNo;
        while (parentNo !== null && parentNo !== undefined) {
            if (seen.has(parentNo)) {
                errors.push({
                    field: at(path, 'ptdParentNo'),
                    message: `Dataset "${dataset.ptdName}" is nested inside itself through dataset ${parentNo}`,
                });
                return;
            }
            seen.add(parentNo);
            const index = byNumber.get(parentNo);
            if (index === undefined) {
                return;
            }
            parentNo = datasets[index].dataset.ptdParentNo;
        }
    });
    return errors;
}
//# sourceMappingURL=print-template-invariants.js.map