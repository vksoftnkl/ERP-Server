"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsv = parseCsv;
exports.readCsvTable = readCsvTable;
const BOM = '﻿';
function parseCsv(text) {
    const input = text.startsWith(BOM) ? text.slice(BOM.length) : text;
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    let index = 0;
    const endCell = () => {
        row.push(cell);
        cell = '';
    };
    const endRow = () => {
        endCell();
        rows.push(row);
        row = [];
    };
    while (index < input.length) {
        const char = input[index];
        if (inQuotes) {
            if (char === '"') {
                if (input[index + 1] === '"') {
                    cell += '"';
                    index += 2;
                    continue;
                }
                inQuotes = false;
                index += 1;
                continue;
            }
            cell += char;
            index += 1;
            continue;
        }
        if (char === '"') {
            inQuotes = true;
            index += 1;
            continue;
        }
        if (char === ',') {
            endCell();
            index += 1;
            continue;
        }
        if (char === '\r' || char === '\n') {
            endRow();
            index += char === '\r' && input[index + 1] === '\n' ? 2 : 1;
            continue;
        }
        cell += char;
        index += 1;
    }
    if (cell !== '' || row.length > 0) {
        endRow();
    }
    return rows;
}
function readCsvTable(text) {
    const rows = parseCsv(text);
    if (!rows.length) {
        return { headers: [], rows: [] };
    }
    const headers = rows[0].map((header) => header.trim().toLowerCase());
    const records = [];
    for (let i = 1; i < rows.length; i += 1) {
        const cells = rows[i];
        if (cells.every((cell) => cell.trim() === '')) {
            continue;
        }
        const record = {};
        headers.forEach((header, column) => {
            record[header] = (cells[column] ?? '').trim();
        });
        records.push({ lineNo: i + 1, cells: record });
    }
    return { headers, rows: records };
}
//# sourceMappingURL=csv.helper.js.map