"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRINT_TEMPLATE_SCREEN_NAME = exports.PTD_REMARKS_MAX_LENGTH = exports.PTD_SQL_MAX_LENGTH = exports.PTD_SQL_MIN_LENGTH = exports.PTD_DEFAULT_TIMEOUT_MS = exports.PTD_TIMEOUT_MS_MAX = exports.PTD_TIMEOUT_MS_MIN = exports.PTD_DEFAULT_ROW_LIMIT = exports.PTD_ROW_LIMIT_MAX = exports.PTD_ROW_LIMIT_MIN = exports.PTD_LINK_FIELDS_MAX_LENGTH = exports.PTD_LINK_FIELDS_PATTERN = exports.PTD_PROVIDER_MAX_LENGTH = exports.PTD_PROVIDER_PATTERN = exports.PTD_LABEL_MAX_LENGTH = exports.PTD_NAME_MAX_LENGTH = exports.PTD_NAME_PATTERN = exports.PTD_DATASET_NO_MAX = exports.PTD_DATASET_NO_MIN = exports.PTD_MASTER_DATASET_NO = exports.PTD_DEFAULT_SOURCE_KIND = exports.PTD_SOURCE_KINDS = exports.PTD_DEFAULT_ROLE = exports.PTD_ROLES = exports.PTV_PARAM_NAME_PATTERN = exports.PTV_CONTEXT_PARAMS = exports.PTV_PARAM_TYPES = exports.PTV_NOTE_MAX_LENGTH = exports.PTV_FONT_FAMILY_MAX_LENGTH = exports.PTV_PAPER_CODE_MAX_LENGTH = exports.PTV_DEFAULT_LANG = exports.PTV_LANG_PATTERN = exports.PTV_COLUMNS_MAX = exports.PTV_COLUMNS_MIN = exports.PTV_BODY_MAX_LENGTH = exports.PTV_BODY_MIN_LENGTH = exports.PTV_DEFAULT_ORIENTATION = exports.PTV_ORIENTATIONS = exports.PTV_JSON_ENGINE = exports.PTV_DEFAULT_ENGINE = exports.PTV_ENGINES = exports.PTV_DEFAULT_STATUS = exports.PTV_STATUSES = exports.PTL_NAME_MAX_LENGTH = exports.PTL_CODE_MAX_LENGTH = exports.PTL_CODE_PATTERN = void 0;
exports.PTL_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
exports.PTL_CODE_MAX_LENGTH = 60;
exports.PTL_NAME_MAX_LENGTH = 120;
exports.PTV_STATUSES = ['DRAFT', 'PUBLISHED', 'RETIRED'];
exports.PTV_DEFAULT_STATUS = 'DRAFT';
exports.PTV_ENGINES = ['JSON_BANDS', 'HTML_CSS', 'QTRPT_XML', 'ESCPOS_TEXT', 'RAW'];
exports.PTV_DEFAULT_ENGINE = 'JSON_BANDS';
exports.PTV_JSON_ENGINE = 'JSON_BANDS';
exports.PTV_ORIENTATIONS = ['PORTRAIT', 'LANDSCAPE'];
exports.PTV_DEFAULT_ORIENTATION = 'PORTRAIT';
exports.PTV_BODY_MIN_LENGTH = 1;
exports.PTV_BODY_MAX_LENGTH = 4_000_000;
exports.PTV_COLUMNS_MIN = 20;
exports.PTV_COLUMNS_MAX = 250;
exports.PTV_LANG_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
exports.PTV_DEFAULT_LANG = 'en-IN';
exports.PTV_PAPER_CODE_MAX_LENGTH = 20;
exports.PTV_FONT_FAMILY_MAX_LENGTH = 80;
exports.PTV_NOTE_MAX_LENGTH = 250;
exports.PTV_PARAM_TYPES = ['TEXT', 'NUMBER', 'DATE', 'DATETIME', 'BOOLEAN', 'UUID'];
exports.PTV_CONTEXT_PARAMS = [
    'company_id',
    'branch_id',
    'acc_year',
    'doc_id',
    'user_id',
    'device_id',
];
exports.PTV_PARAM_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
exports.PTD_ROLES = ['MASTER', 'DETAIL'];
exports.PTD_DEFAULT_ROLE = 'DETAIL';
exports.PTD_SOURCE_KINDS = ['PROVIDER', 'SQL'];
exports.PTD_DEFAULT_SOURCE_KIND = 'PROVIDER';
exports.PTD_MASTER_DATASET_NO = 0;
exports.PTD_DATASET_NO_MIN = 0;
exports.PTD_DATASET_NO_MAX = 99;
exports.PTD_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
exports.PTD_NAME_MAX_LENGTH = 40;
exports.PTD_LABEL_MAX_LENGTH = 120;
exports.PTD_PROVIDER_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
exports.PTD_PROVIDER_MAX_LENGTH = 80;
exports.PTD_LINK_FIELDS_PATTERN = /^[a-z][a-z0-9_]*=[a-z][a-z0-9_]*(,[a-z][a-z0-9_]*=[a-z][a-z0-9_]*)*$/;
exports.PTD_LINK_FIELDS_MAX_LENGTH = 200;
exports.PTD_ROW_LIMIT_MIN = 1;
exports.PTD_ROW_LIMIT_MAX = 200_000;
exports.PTD_DEFAULT_ROW_LIMIT = 5_000;
exports.PTD_TIMEOUT_MS_MIN = 100;
exports.PTD_TIMEOUT_MS_MAX = 120_000;
exports.PTD_DEFAULT_TIMEOUT_MS = 15_000;
exports.PTD_SQL_MIN_LENGTH = 20;
exports.PTD_SQL_MAX_LENGTH = 20_000;
exports.PTD_REMARKS_MAX_LENGTH = 250;
exports.PRINT_TEMPLATE_SCREEN_NAME = 'Print Template';
//# sourceMappingURL=print-template.constants.js.map