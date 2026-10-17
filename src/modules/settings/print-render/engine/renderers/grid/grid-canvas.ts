/**
 * A character matrix with per-cell styling.
 *
 * Both raw renderers build their page here first and only then serialise it to
 * escape codes. The reason is that a character grid and a stream of printer
 * commands have opposite shapes: the layout tree hands over primitives in
 * z-order, at arbitrary (row, col) positions, possibly overlapping — while a
 * printer accepts one strictly ordered pass, top to bottom, left to right, with
 * style changes bracketed around the runs they apply to.
 *
 * Writing straight to a byte stream would therefore mean either sorting the
 * primitives first (and still not handling overlap) or emitting a positioning
 * command per element, which on a dot matrix means a carriage return and
 * re-seek per field — slow, and the thing this whole path exists to avoid.
 */

export interface CellStyle {
  readonly bold: boolean;
  readonly underline: boolean;
  /** ESC/POS double-width and double-height, for a receipt's total line. */
  readonly doubleWidth: boolean;
  readonly doubleHeight: boolean;
  /** ESC/POS alignment is a per-line command, not per-run. */
  readonly centered: boolean;
}

export const DEFAULT_STYLE: CellStyle = {
  bold: false,
  underline: false,
  doubleWidth: false,
  doubleHeight: false,
  centered: false,
};

interface Cell {
  char: string;
  style: CellStyle;
}

/** A maximal run of adjacent cells sharing one style. */
export interface StyledRun {
  readonly col: number;
  readonly text: string;
  readonly style: CellStyle;
}

const sameStyle = (left: CellStyle, right: CellStyle): boolean =>
  left.bold === right.bold &&
  left.underline === right.underline &&
  left.doubleWidth === right.doubleWidth &&
  left.doubleHeight === right.doubleHeight &&
  left.centered === right.centered;

/** Hard ceilings so a bad template cannot allocate an unbounded matrix. */
const MAX_ROWS = 20_000;
const MAX_COLUMNS = 2_000;

export class GridCanvas {
  private readonly rows: Cell[][] = [];

  /** Cells that fell outside the column budget, for the overflow warning. */
  private clippedColumns = 0;

  private clippedRows = 0;

  constructor(readonly columns: number) {
    if (columns < 1 || columns > MAX_COLUMNS) {
      throw new Error(`GridCanvas column budget ${columns} is out of range 1..${MAX_COLUMNS}`);
    }
  }

  get rowCount(): number {
    return this.rows.length;
  }

  get clipped(): { columns: number; rows: number } {
    return { columns: this.clippedColumns, rows: this.clippedRows };
  }

  /**
   * Write text starting at (row, col).
   *
   * Later writes overwrite earlier ones, which is what makes z-order work: the
   * layout engine hands primitives over in ascending z, so a label written over
   * a rule replaces the rule's dashes rather than being lost behind them.
   *
   * `maxWidth` clips rather than wraps. Wrapping is the layout engine's job and
   * it has already happened; a renderer that re-wrapped would disagree with the
   * measurement the page was paginated against.
   */
  write(
    row: number,
    col: number,
    text: string,
    style: CellStyle = DEFAULT_STYLE,
    maxWidth?: number,
  ): void {
    if (!text) {
      return;
    }

    const targetRow = Math.round(row);
    const targetCol = Math.round(col);

    if (targetRow < 0 || targetRow >= MAX_ROWS) {
      this.clippedRows += 1;
      return;
    }

    const budget =
      maxWidth === undefined
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

  /** Write text right-aligned so it ENDS at `endCol` (exclusive). */
  writeRight(row: number, endCol: number, text: string, style: CellStyle = DEFAULT_STYLE): void {
    const characters = [...text];
    this.write(row, Math.round(endCol) - characters.length, text, style);
  }

  /** Write text centred within [col, col + width). */
  writeCentered(
    row: number,
    col: number,
    width: number,
    text: string,
    style: CellStyle = DEFAULT_STYLE,
  ): void {
    const characters = [...text];
    const offset = Math.max(0, Math.floor((width - characters.length) / 2));
    this.write(row, col + offset, text, style, width);
  }

  /** Fill a horizontal run with one repeated character — a rule. */
  fillRow(
    row: number,
    fromCol: number,
    toCol: number,
    character: string,
    style: CellStyle = DEFAULT_STYLE,
  ): void {
    const start = Math.max(0, Math.round(Math.min(fromCol, toCol)));
    const end = Math.min(this.columns, Math.round(Math.max(fromCol, toCol)) + 1);
    if (end <= start) {
      return;
    }
    this.write(row, start, (character || '-').repeat(end - start), style);
  }

  /** Fill a vertical run — a column rule between two boxed sections. */
  fillColumn(
    col: number,
    fromRow: number,
    toRow: number,
    character: string,
    style: CellStyle = DEFAULT_STYLE,
  ): void {
    const start = Math.max(0, Math.round(Math.min(fromRow, toRow)));
    const end = Math.round(Math.max(fromRow, toRow));
    for (let row = start; row <= end; row += 1) {
      this.write(row, col, character || '|', style);
    }
  }

  /**
   * Serialise one row into maximal same-style runs, trailing blanks trimmed.
   *
   * Trimming matters on a dot matrix: trailing spaces are real print head
   * movement, and a 132-column form padded to full width on every line is
   * measurably slower than one that stops at the last glyph.
   */
  runsForRow(row: number): StyledRun[] {
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

    const runs: StyledRun[] = [];
    let current: { col: number; chars: string[]; style: CellStyle } | null = null;

    for (let column = 0; column <= lastUsed; column += 1) {
      const cell = cells[column] ?? { char: ' ', style: DEFAULT_STYLE };

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

  /** Every row's runs, in order. Rows never written come back empty. */
  allRuns(): StyledRun[][] {
    return Array.from({ length: this.rows.length }, (_unused, row) => this.runsForRow(row));
  }

  /**
   * Plain-text rendering, for tests and for the debug endpoint.
   *
   * Iterates by index rather than mapping the cell array: a cell array is
   * SPARSE (write leaves holes for the columns before its start), and
   * Array.map skips holes — which would drop every leading blank and shift the
   * whole row left.
   */
  toText(): string {
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

  private ensureRow(row: number): Cell[] {
    while (this.rows.length <= row) {
      this.rows.push([]);
    }
    return this.rows[row];
  }
}
