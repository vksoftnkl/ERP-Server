"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDatasetSql = normalizeDatasetSql;
exports.collectDatasetSqlErrors = collectDatasetSqlErrors;
const print_template_constants_1 = require("../print-template.constants");
function normalizeDatasetSql(sql) {
    return (sql ?? '')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--.*$/gm, ' ')
        .replace(/'(?:[^']|'')*'/g, ' @lit ')
        .replace(/"[^"]*"/g, ' @id ')
        .replace(/::/g, ' ')
        .toLowerCase();
}
function countMatches(subject, pattern) {
    return subject.match(pattern)?.length ?? 0;
}
function collectDatasetSqlErrors(sql, requiresCompany, field) {
    const errors = [];
    const norm = normalizeDatasetSql(sql);
    const push = (message) => {
        errors.push({ field, message });
    };
    if (sql.length < print_template_constants_1.PTD_SQL_MIN_LENGTH || sql.length > print_template_constants_1.PTD_SQL_MAX_LENGTH) {
        push(`${field} must be between ${print_template_constants_1.PTD_SQL_MIN_LENGTH} and ${print_template_constants_1.PTD_SQL_MAX_LENGTH} characters ` +
            `(this one is ${sql.length})`);
        return errors;
    }
    if (/\$[A-Za-z_0-9]*\$/.test(sql)) {
        push('Dollar quoting ($$ … $$) is not allowed — it hides text from the normaliser that every ' +
            "other check reads. Use ordinary '…' literals.");
    }
    if (norm.includes("'") || norm.includes('"')) {
        push("An unpaired quote survived normalisation. Check that every '…' literal is closed and " +
            "that a literal apostrophe is doubled ('it''s'), and that every \"identifier\" is closed.");
    }
    if (/\/\*|\*\//.test(norm)) {
        push('An unterminated or nested block comment was left behind. PostgreSQL allows /* nested */ ' +
            'comments, which this stripper deliberately does not — remove them.');
    }
    if (/;/.test(norm.replace(/\s*;\s*$/, ''))) {
        push('Only one statement is allowed. A single trailing ";" is fine, anything after it is not.');
    }
    if (!/^\(*\s*(select|with)\b/.test(norm.trim())) {
        push('A dataset query must start with SELECT or WITH.');
    }
    const write = norm.match(/\b(insert|update|delete|merge|truncate|copy|grant|revoke)\b/);
    if (write) {
        push(`A dataset query may not write. Found "${write[1]}" — a data-modifying CTE is still a ` +
            'write. If the word is part of a column name such as last_updated_on, it is safe and ' +
            'this guard did not fire on it.');
    }
    const escape = norm.match(/\b(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|dblink|dblink_exec|pg_sleep|pg_terminate_backend|pg_cancel_backend|set_config|current_setting|pg_authid|pg_shadow)\b/);
    if (escape) {
        push(`"${escape[1]}" reaches outside the query — the filesystem, the network or the catalog — ` +
            'and is not allowed in a dataset query.');
    }
    if (/:(?![a-z_])/.test(norm)) {
        push('A ":" that is not a parameter. Parameters are :name — lower case, starting with a letter ' +
            'or underscore. Note that an array slice such as arr[2:5] trips this too; rewrite it ' +
            'with a function.');
    }
    if (countMatches(sql.replace(/::/g, ' '), /:[A-Za-z_]/g) !== countMatches(norm, /:[A-Za-z_]/g)) {
        push('A parameter is written inside a string literal or a comment. Parameters are BOUND, not ' +
            "pasted: write  x = :company_id , never  x = ':company_id' . (A :name mentioned in a " +
            '"--" comment reads the same way to this check — move it out of the comment.)');
    }
    if (requiresCompany && !/:company_id\b/.test(norm)) {
        push('The query must be company-scoped: bind :company_id somewhere in it. Set ' +
            'ptdRequiresCompany to false only for genuinely global data, such as a state-code list. ' +
            '(If it IS scoped, check for a "--" inside a string literal — that mangles the residue ' +
            'this check reads.)');
    }
    return errors;
}
//# sourceMappingURL=print-template-sql-guards.js.map