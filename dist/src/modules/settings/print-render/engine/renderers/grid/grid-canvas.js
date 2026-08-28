"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridCanvas = exports.DEFAULT_STYLE = void 0;
exports.DEFAULT_STYLE = {
    bold: false,
    underline: false,
    doubleWidth: false,
    doubleHeight: false,
    centered: false,
};
const sameStyle = (left, right) => left.bold === right.bold &&
    left.underline === right.underline &&
    left.doubleWidth === right.doubleWidth &&
    left.doubleHeight === right.doubleHeight &&
    left.centered === right.centered;
const MAX_ROWS = 20_000;
const MAX_COLUMNS = 2_000;
class GridCanvas {
    columns;
    rows = [];
    clippedColumns = 0;
    clippedRows = 0;
    constructor(columns) {
        this.columns = columns;
        if (columns < 1 || columns > MAX_COLUMNS) {
            throw new Error(`GridCanvas column budget ${columns} is out of range 1..${MAX_COLUMNS}`);
        }
    }
    get rowCount() {
        return this.rows.length;
    }
    get clipped() {
        return { columns: this.clippedColumns, rows: this.clippedRows };
    }
    write(row, col, text, style = exports.DEFAULT_STYLE, maxWidth) {
        if (!text) {
            return;
        }
        const targetRow = Math.round(row);
        const targetCol = Math.round(col);
        if (targetRow < 0 || targetRow >= MAX_ROWS) {
            this.clippedRows += 1;
            return;
        }
        const budget = maxWidth === undefined
            ? this.columns - targetCol
            : Math.min(maxWidth, this.columns - targetCol);
        if (budget <= 0) {
            this.clippedColumns += 1;
            return;
        }
        const characters = [...text];
        const cells = this.ensureRow(targetRow);
        for (let index = 0; index < characters.length; index += 1) {
            const column = targetCol + index;
            if (column < 0) {
                continue;
            }
            if (index >= budget || column >= this.columns) {
                this.clippedColumns += 1;
                break;
            }
            cells[column] = { char: characters[index], style };
        }
    }
    writeRight(row, endCol, text, style = exports.DEFAULT_STYLE) {
        const characters = [...text];
        this.write(row, Math.round(endCol) - characters.length, text, style);
    }
    writeCentered(row, col, width, text, style = exports.DEFAULT_STYLE) {
        const characters = [...text];
        const offset = Math.max(0, Math.floor((width - characters.length) / 2));
        this.write(row, col + offset, text, style, width);
    }
    fillRow(row, fromCol, toCol, character, style = exports.DEFAULT_STYLE) {
        const start = Math.max(0, Math.round(Math.min(fromCol, toCol)));
        const end = Math.min(this.columns, Math.round(Math.max(fromCol, toCol)) + 1);
        if (end <= start) {
            return;
        }
        this.write(row, start, (character || '-').repeat(end - start), style);
    }
    fillColumn(col, fromRow, toRow, character, style = exports.DEFAULT_STYLE) {
        const start = Math.max(0, Math.round(Math.min(fromRow, toRow)));
        const end = Math.round(Math.max(fromRow, toRow));
        for (let row = start; row <= end; row += 1) {
            this.write(row, col, character || '|', style);
        }
    }
    runsForRow(row) {
        const cells = this.rows[row];
        if (!cells) {
            return [];
        }
        let lastUsed = -1;
        for (let column = cells.length - 1; column >= 0; column -= 1) {
            if (cells[column] && cells[column].char !== ' ') {
                lastUsed = column;
                break;
            }
        }
        if (lastUsed < 0) {
            return [];
        }
        const runs = [];
        let current = null;
        for (let column = 0; column <= lastUsed; column += 1) {
            const cell = cells[column] ?? { char: ' ', style: exports.DEFAULT_STYLE };
            if (current && sameStyle(current.style, cell.style)) {
                current.chars.push(cell.char);
                continue;
            }
            if (current) {
                runs.push({ col: current.col, text: current.chars.join(''), style: current.style });
            }
            current = { col: column, chars: [cell.char], style: cell.style };
        }
        if (current) {
            runs.push({ col: current.col, text: current.chars.join(''), style: current.style });
        }
        return runs;
    }
    allRuns() {
        return Array.from({ length: this.rows.length }, (_unused, row) => this.runsForRow(row));
    }
    toText() {
        return Array.from({ length: this.rows.length }, (_unused, row) => {
            const cells = this.rows[row];
            if (!cells || cells.length === 0) {
                return '';
            }
            let line = '';
            for (let column = 0; column < cells.length; column += 1) {
                line += cells[column]?.char ?? ' ';
            }
            return line.replace(/\s+$/, '');
        }).join('\n');
    }
    ensureRow(row) {
        while (this.rows.length <= row) {
            this.rows.push([]);
        }
        return this.rows[row];
    }
}
exports.GridCanvas = GridCanvas;
//# sourceMappingURL=grid-canvas.js.map