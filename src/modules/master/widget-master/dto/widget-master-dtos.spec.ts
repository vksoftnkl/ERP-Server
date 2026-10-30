import { HttpException, Type } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { ListWidgetQueryDto } from './list-widget-query.dto';
import { SaveBulkWidgetDto } from './save-bulk-widget.dto';
import { SaveWidgetDto } from './save-widget.dto';
import { UpdateWidgetVisibilityDto } from './update-widget-visibility.dto';
import { WidgetConfigQueryDto } from './widget-config-query.dto';

const SECTION = {
  sectionMenuId: 10,
  sectionName: 'Primary Information',
  sectionGuiName: 'Primary Information',
  sectionPlatform: 'Web',
};
const VISIBILITY_SECTION = {
  sectionId: 1,
  sectionGuiName: 'Primary',
  sectionVisibility: true,
  fields: [{ fieldId: 5, fieldSecondaryText: '', fieldVisibility: false }],
};
const pipe = createHouseValidationPipe();

const transform = <T extends object>(value: unknown, metatype: Type<T>, type: 'body' | 'query') =>
  pipe.transform(value, { type, metatype }) as Promise<T>;

/** The fields the house pipe refused (dotted for nested ones); [] when it let the value through. */
async function refusedFields<T extends object>(
  value: unknown,
  metatype: Type<T>,
  type: 'body' | 'query' = 'body',
): Promise<string[]> {
  try {
    await transform(value, metatype, type);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map(
      (detail) => detail.field,
    );
  }
}

describe('SaveWidgetDto (through the house pipe)', () => {
  it('accepts a section without fields', async () => {
    await expect(refusedFields(SECTION, SaveWidgetDto)).resolves.toEqual([]);
  });

  it('accepts a section with fields and reads string ids as numbers', async () => {
    const dto = await transform(
      {
        ...SECTION,
        sectionId: '1',
        sectionMenuId: '10',
        fields: [{ fieldId: '5', fieldName: ' item_name ', fieldGuiName: '', fieldPosition: '2' }],
      },
      SaveWidgetDto,
      'body',
    );

    expect(dto).toMatchObject({
      sectionId: 1,
      sectionMenuId: 10,
      fields: [{ fieldId: 5, fieldName: 'item_name', fieldPosition: 2 }],
    });
  });

  it.each([
    ['no menu', { ...SECTION, sectionMenuId: undefined }],
    ['a menu of 0', { ...SECTION, sectionMenuId: 0 }],
    ['a blank section name', { ...SECTION, sectionName: '  ' }],
    ['no GUI name', { ...SECTION, sectionGuiName: undefined }],
    ['a section name over 255 characters', { ...SECTION, sectionName: 'S'.repeat(256) }],
    ['a platform outside the three', { ...SECTION, sectionPlatform: 'Tablet' }],
    ['a negative position', { ...SECTION, sectionPosition: -1 }],
    ['a field with no name', { ...SECTION, fields: [{ fieldGuiName: 'Code' }] }],
    ['a field id of 0', { ...SECTION, fields: [{ fieldId: 0, fieldName: 'x' }] }],
    ['fields that are not a list', { ...SECTION, fields: { fieldName: 'x' } }],
  ])('refuses %s', async (_label, body) => {
    await expect(refusedFields(body, SaveWidgetDto)).resolves.not.toEqual([]);
  });
});

describe('SaveBulkWidgetDto (through the house pipe)', () => {
  it('accepts a list of sections', async () => {
    await expect(
      refusedFields({ data: [SECTION, { ...SECTION, sectionName: 'Price' }] }, SaveBulkWidgetDto),
    ).resolves.toEqual([]);
  });

  it.each([
    ['an empty list', { data: [] }],
    ['no list', {}],
    ['a section that fails validation', { data: [{ ...SECTION, sectionPlatform: 'Tablet' }] }],
  ])('refuses %s', async (_label, body) => {
    await expect(refusedFields(body, SaveBulkWidgetDto)).resolves.not.toEqual([]);
  });
});

describe('UpdateWidgetVisibilityDto (through the house pipe)', () => {
  it('accepts sections with their fields', async () => {
    await expect(
      refusedFields({ data: [VISIBILITY_SECTION] }, UpdateWidgetVisibilityDto),
    ).resolves.toEqual([]);
  });

  it.each([
    ['an empty list', { data: [] }],
    [
      'a section with no visibility flag',
      { data: [{ ...VISIBILITY_SECTION, sectionVisibility: undefined }] },
    ],
    ['a section with no fields list', { data: [{ ...VISIBILITY_SECTION, fields: undefined }] }],
    [
      'a field with no visibility flag',
      { data: [{ ...VISIBILITY_SECTION, fields: [{ fieldId: 5, fieldSecondaryText: '' }] }] },
    ],
  ])('refuses %s', async (_label, body) => {
    await expect(refusedFields(body, UpdateWidgetVisibilityDto)).resolves.not.toEqual([]);
  });
});

describe('ListWidgetQueryDto (through the house pipe)', () => {
  it('reads query-string ids as numbers', async () => {
    const dto = await transform(
      { sectionId: '1', sectionMenuId: '10', sectionPlatform: 'Mobile', search: 'code' },
      ListWidgetQueryDto,
      'query',
    );

    expect(dto).toMatchObject({ sectionId: 1, sectionMenuId: 10, sectionPlatform: 'Mobile' });
  });

  it.each([
    ['a section id of 0', { sectionId: '0' }, 'sectionId'],
    ['a platform outside the three', { sectionPlatform: 'Tablet' }, 'sectionPlatform'],
    ['a search over 255 characters', { search: 's'.repeat(256) }, 'search'],
  ])('refuses %s', async (_label, query, field) => {
    await expect(refusedFields(query, ListWidgetQueryDto, 'query')).resolves.toEqual([field]);
  });
});

describe('WidgetConfigQueryDto (through the house pipe)', () => {
  it('accepts a menu with each visibility filter', async () => {
    for (const visibility of ['false', 'all']) {
      await expect(
        refusedFields({ menu_id: '10', visibility }, WidgetConfigQueryDto, 'query'),
      ).resolves.toEqual([]);
    }
  });

  it.each([
    ['no menu', {}, 'menu_id'],
    ['a menu of 0', { menu_id: '0' }, 'menu_id'],
    ['visibility=true, which is not a filter', { menu_id: '10', visibility: 'true' }, 'visibility'],
    ['a platform outside the three', { menu_id: '10', platform: 'Tablet' }, 'platform'],
  ])('refuses %s', async (_label, query, field) => {
    await expect(refusedFields(query, WidgetConfigQueryDto, 'query')).resolves.toEqual([field]);
  });
});
