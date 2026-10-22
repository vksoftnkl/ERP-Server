import { parseCsv, readCsvTable } from './csv.helper';

// The common shapes (quoted commas, doubled quotes, line endings, the BOM) are
// pinned beside the importer in stock-voucher-import.helper.spec.ts. These are
// the edges a spreadsheet produces less often but still produces.
describe('csv.helper', () => {
  describe('parseCsv', () => {
    it('reads nothing from an empty file', () => {
      expect(parseCsv('')).toEqual([]);
    });

    it('keeps an empty quoted field as an empty cell', () => {
      expect(parseCsv('a,"",c')).toEqual([['a', '', 'c']]);
    });

    it('keeps empty cells between commas, including a trailing one', () => {
      expect(parseCsv('a,,c,')).toEqual([['a', '', 'c', '']]);
    });

    it('keeps a blank line as a row of one empty cell for the table reader to drop', () => {
      expect(parseCsv('a\n\nb')).toEqual([['a'], [''], ['b']]);
    });

    it('keeps a CRLF inside a quoted field as part of the field', () => {
      expect(parseCsv('"one\r\ntwo",3')).toEqual([['one\r\ntwo', '3']]);
    });

    it('does not trim cells — that is the table reader’s decision', () => {
      expect(parseCsv(' a , b ')).toEqual([[' a ', ' b ']]);
    });
  });

  describe('readCsvTable', () => {
    it('answers no headers and no rows for an empty file', () => {
      expect(readCsvTable('')).toEqual({ headers: [], rows: [] });
    });

    it('answers the headers and no rows for a header-only file', () => {
      expect(readCsvTable('item_code,qty\n')).toEqual({ headers: ['item_code', 'qty'], rows: [] });
    });

    it('fills a short row’s missing cells with "" rather than undefined', () => {
      const table = readCsvTable('item_code,unit_name,qty\nSALT,BOX');

      expect(table.rows).toEqual([
        { lineNo: 2, cells: { item_code: 'SALT', unit_name: 'BOX', qty: '' } },
      ]);
    });

    it('ignores cells past the last header', () => {
      const table = readCsvTable('item_code,qty\nSALT,10,stray,extra');

      expect(table.rows[0].cells).toEqual({ item_code: 'SALT', qty: '10' });
    });

    it('trims every cell value', () => {
      const table = readCsvTable('item_code,qty\n  SALT  , 10 ');

      expect(table.rows[0].cells).toEqual({ item_code: 'SALT', qty: '10' });
    });

    it('drops a whitespace-only row and keeps file line numbers for the rest', () => {
      const table = readCsvTable('item_code,qty\nSALT,10\n  ,  \nSUGAR,5');

      expect(table.rows.map((row) => row.lineNo)).toEqual([2, 4]);
    });

    it('counts a quoted multi-line cell as one row', () => {
      const table = readCsvTable('item_code,remarks\nSALT,"two\nlines"\nSUGAR,x');

      expect(table.rows).toHaveLength(2);
      expect(table.rows[0].cells.remarks).toBe('two\nlines');
    });
  });
});
