import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { SavePrintTemplateAssignmentDto } from '../../print-template-assignment/dto/save-print-template-assignment.dto';
import { SavePrintTemplateDto } from './save-print-template.dto';

const PURPOSE = '01a041fa-d3c1-76b2-85e8-86494f756d06';
const TEMPLATE = '01a04322-b45f-7d14-952f-bc3e3645b903';

/** Every failing property path, walking the nested arrays. */
const failingPaths = (errors: ValidationError[], prefix = ''): string[] =>
  errors.flatMap((error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    return error.children?.length ? failingPaths(error.children, path) : [path];
  });

const pathsOf = (plain: object): string[] =>
  failingPaths(validateSync(plainToInstance(SavePrintTemplateDto, plain)));

describe('SavePrintTemplateDto', () => {
  it('stores a JSON_BANDS design sent as an object as its JSON text', () => {
    const dto = plainToInstance(SavePrintTemplateDto, {
      versions: [{ ptvBody: { bands: [{ kind: 'header' }] } }],
    });

    expect(dto.versions?.[0].ptvBody).toBe('{"bands":[{"kind":"header"}]}');
    expect(validateSync(dto)).toEqual([]);
  });

  it('keeps a design sent as text exactly as it came', () => {
    const dto = plainToInstance(SavePrintTemplateDto, {
      versions: [{ ptvEngine: 'ESCPOS_TEXT', ptvBody: '{{company.name}}\n' }],
    });

    expect(dto.versions?.[0].ptvBody).toBe('{{company.name}}\n');
  });

  it('refuses a design that is neither an object nor text', () => {
    expect(pathsOf({ versions: [{ ptvBody: 42 }] })).toEqual(['versions.0.ptvBody']);
  });

  it.each([
    [{ versions: [{ ptvStatus: 'ARCHIVED' }] }, 'versions.0.ptvStatus'],
    [{ versions: [{ ptvEngine: 'WORD' }] }, 'versions.0.ptvEngine'],
    [{ versions: [{ ptvOrientation: 'SIDEWAYS' }] }, 'versions.0.ptvOrientation'],
    [{ versions: [{ datasets: [{ ptdRole: 'CHILD' }] }] }, 'versions.0.datasets.0.ptdRole'],
    [{ versions: [{ datasets: [{ ptdSourceKind: 'VIEW' }] }] }, 'versions.0.datasets.0.ptdSourceKind'],
  ])('refuses a word outside the vocabulary: %o', (plain, path) => {
    expect(pathsOf(plain)).toEqual([path]);
  });

  it('accepts every vocabulary word the schema allows', () => {
    expect(
      pathsOf({
        versions: [
          {
            ptvStatus: 'RETIRED',
            ptvEngine: 'QTRPT_XML',
            ptvOrientation: 'LANDSCAPE',
            datasets: [{ ptdRole: 'MASTER', ptdSourceKind: 'SQL' }],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('caps a request at twenty revisions', () => {
    const versions = Array.from({ length: 21 }, () => ({}));

    expect(pathsOf({ versions })).toEqual(['versions']);
  });
});

describe('SavePrintTemplateAssignmentDto', () => {
  const assignmentPaths = (plain: object): string[] =>
    failingPaths(validateSync(plainToInstance(SavePrintTemplateAssignmentDto, plain)));

  const base = { ptaPurposeId: PURPOSE, ptaTemplateId: TEMPLATE };

  it.each(['PRINT', 'PREVIEW', 'PDF', 'EMAIL', 'WHATSAPP', 'ESCPOS'])(
    'accepts the output mode %s',
    (mode) => {
      expect(assignmentPaths({ ...base, ptaOutputMode: mode })).toEqual([]);
    },
  );

  it('refuses FILE, which the schema dropped', () => {
    expect(assignmentPaths({ ...base, ptaOutputMode: 'FILE' })).toEqual(['ptaOutputMode']);
  });

  it('keeps the copy count between 1 and 9', () => {
    expect(assignmentPaths({ ...base, ptaCopies: 0 })).toEqual(['ptaCopies']);
    expect(assignmentPaths({ ...base, ptaCopies: 10 })).toEqual(['ptaCopies']);
    expect(assignmentPaths({ ...base, ptaCopies: 9 })).toEqual([]);
  });
});
