export interface CellStyle {
    readonly bold: boolean;
    readonly underline: boolean;
    readonly doubleWidth: boolean;
    readonly doubleHeight: boolean;
    readonly centered: boolean;
}
export declare const DEFAULT_STYLE: CellStyle;
export interface StyledRun {
    readonly col: number;
    readonly text: string;
    readonly style: CellStyle;
}
export declare class GridCanvas {
    readonly columns: number;
    private readonly rows;
    private clippedColumns;
    private clippedRows;
    constructor(columns: number);
    get rowCount(): number;
    get clipped(): {
        columns: number;
        rows: number;
    };
    write(row: number, col: number, text: string, style?: CellStyle, maxWidth?: number): void;
    writeRight(row: number, endCol: number, text: string, style?: CellStyle): void;
    writeCentered(row: number, col: number, width: number, text: string, style?: CellStyle): void;
    fillRow(row: number, fromCol: number, toCol: number, character: string, style?: CellStyle): void;
    fillColumn(col: number, fromRow: number, toRow: number, character: string, style?: CellStyle): void;
    runsForRow(row: number): StyledRun[];
    allRuns(): StyledRun[][];
    toText(): string;
    private ensureRow;
}
