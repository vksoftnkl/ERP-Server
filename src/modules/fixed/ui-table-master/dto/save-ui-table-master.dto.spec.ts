import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveUiTableColumnDto } from './save-ui-table-column.dto';
import { SaveUiTableMasterDto } from './save-ui-table-master.dto';
import { SaveUiTableVisibilitySettingsDto } from './save-ui-table-visibility-settings.dto';

const erroredFields = <T extends object>(cls: new () => T, plain: object): string[] =>
  validateSync(plainToInstance(cls, plain)).map((error) => error.property);

describe('SaveUiTableMasterDto', () => {
  it('requires uiTblName on a create', () => {
    expect(erroredFields(SaveUiTableMasterDto, {})).toEqual(['uiTblName']);
  });

  it('lets an update leave uiTblName out', () => {
    expect(erroredFields(SaveUiTableMasterDto, { uiTblId: '7' })).toEqual([]);
  });

  it('refuses a uiTblId that is not a whole number', () => {
    expect(erroredFields(SaveUiTableMasterDto, { uiTblId: '7a', uiTblName: 'Grid' })).toEqual([
      'uiTblId',
    ]);
  });

  it('validates the nested columns', () => {
    const [error] = validateSync(
      plainToInstance(SaveUiTableMasterDto, {
        uiTblName: 'Grid',
        uiTblColumns: [{ uiTblClmName: 'Item' }, { uiTblClmName: '' }],
      }),
    );

    expect(error.property).toBe('uiTblColumns');
    expect(error.children?.[0].property).toBe('1');
  });
});

describe('SaveUiTableColumnDto', () => {
  const columnOf = (plain: object) => plainToInstance(SaveUiTableColumnDto, plain);

  it('reads a numeric width sent as text', () => {
    const column = columnOf({ uiTblClmName: 'Item', uiTblClmColumnWidth: ' 12.5 ' });

    expect(column.uiTblClmColumnWidth).toBe(12.5);
    expect(validateSync(column)).toEqual([]);
  });

  it('reads an empty width as null', () => {
    expect(columnOf({ uiTblClmName: 'Item', uiTblClmColumnWidth: '' }).uiTblClmColumnWidth).toBe(
      null,
    );
  });

  it('refuses a width that is not a number', () => {
    expect(
      erroredFields(SaveUiTableColumnDto, { uiTblClmName: 'Item', uiTblClmColumnWidth: 'wide' }),
    ).toEqual(['uiTblClmColumnWidth']);
  });

  it('reads whole-number positions sent as text and refuses fractional ones', () => {
    const column = columnOf({ uiTblClmName: 'Item', uiTblClmColumnPosition: '3' });

    expect(column.uiTblClmColumnPosition).toBe(3);
    expect(
      erroredFields(SaveUiTableColumnDto, { uiTblClmName: 'Item', uiTblClmColumnPosition: '3.5' }),
    ).toEqual(['uiTblClmColumnPosition']);
    expect(
      erroredFields(SaveUiTableColumnDto, { uiTblClmName: 'Item', uiTblClmNextColumn: 1.5 }),
    ).toEqual(['uiTblClmNextColumn']);
  });

  it('lets the neighbour columns be cleared with null or an empty string', () => {
    const column = columnOf({
      uiTblClmName: 'Item',
      uiTblClmNextColumn: null,
      uiTblClmPreviousColumn: '',
    });

    expect(column.uiTblClmNextColumn).toBeNull();
    expect(column.uiTblClmPreviousColumn).toBeNull();
    expect(validateSync(column)).toEqual([]);
  });

  it('requires a column name', () => {
    expect(erroredFields(SaveUiTableColumnDto, { uiTblClmName: '   ' })).toEqual(['uiTblClmName']);
  });
});

describe('SaveUiTableVisibilitySettingsDto', () => {
  it('takes a numeric column id and trims it to text', () => {
    const dto = plainToInstance(SaveUiTableVisibilitySettingsDto, {
      columns: [{ uiTblClmId: 70, uiTblClmColumnVisibility: false }],
    });

    expect(dto.columns[0].uiTblClmId).toBe('70');
    expect(validateSync(dto)).toEqual([]);
  });

  it('refuses a column id with a sign', () => {
    const [error] = validateSync(
      plainToInstance(SaveUiTableVisibilitySettingsDto, { columns: [{ uiTblClmId: '-70' }] }),
    );

    expect(error.children?.[0].children?.[0].property).toBe('uiTblClmId');
  });
});
