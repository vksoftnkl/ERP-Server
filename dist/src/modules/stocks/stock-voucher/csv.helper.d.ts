export interface CsvTable {
    headers: string[];
    rows: CsvRow[];
}
export interface CsvRow {
    lineNo: number;
    cells: Record<string, string>;
}
export declare function parseCsv(text: string): string[][];
export declare function readCsvTable(text: string): CsvTable;
