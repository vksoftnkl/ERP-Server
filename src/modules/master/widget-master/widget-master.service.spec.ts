import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { FormField, FormSection } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { SaveWidgetDto } from './dto/save-widget.dto';
import { createHouseValidationPipe } from '../../../common/validation/house-validation';
import { WidgetPlatform, WidgetVisibilityFilter } from './types/widget-master-api.types';
import { WIDGET_ERROR } from './types/widget-master-error-codes';
import { WidgetMasterService } from './widget-master.service';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f4ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const UPDATED_ON = new Date('2026-10-02T09:00:00.000Z');
const FIELD_ORDER_BY = [{ fieldPosition: 'asc' }, { fieldId: 'asc' }];
const SECTION_ORDER_BY = [{ sectionPosition: 'asc' }, { sectionId: 'asc' }];

const makeField = (overrides: Partial<FormField> = {}): FormField => ({
  fieldId: 5,
  fieldSectionId: 1,
  fieldName: 'item_name',
  fieldGuiName: 'English Name',
  fieldSecondaryText: null,
  fieldPosition: 0,
  fieldVisibility: true,
  fieldSyncDate: null,
  fieldCreatedOn: CREATED_ON,
  fieldCreatedBy: USER_ID,
  fieldUpdatedOn: UPDATED_ON,
  fieldUpdatedBy: null,
  ...overrides,
});

type SectionWithFields = FormSection & { fields: FormField[] };

const makeSection = (overrides: Partial<SectionWithFields> = {}): SectionWithFields => ({
  sectionId: 1,
  sectionMenuId: 10,
  sectionName: 'Primary Information',
  sectionGuiName: 'Primary Information',
  sectionPosition: 0,
  sectionVisibility: true,
  sectionPlatform: 'Web',
  sectionSyncDate: null,
  sectionCreatedOn: CREATED_ON,
  sectionCreatedBy: USER_ID,
  sectionUpdatedOn: UPDATED_ON,
  sectionUpdatedBy: null,
  fields: [makeField()],
  ...overrides,
});

const saveDto = (overrides: Partial<SaveWidgetDto> = {}): SaveWidgetDto => ({
  sectionMenuId: 10,
  sectionName: 'Primary Information',
  sectionGuiName: 'Primary Information',
  sectionPlatform: WidgetPlatform.Web,
  ...overrides,
});

type Args = {
  where: Record<string, unknown>;
  data?: Record<string, unknown>;
  include?: unknown;
  select?: unknown;
  orderBy?: unknown;
};

type PrismaMock = {
  formSection: {
    findMany: jest.Mock<Promise<SectionWithFields[]>, [Args]>;
    findUnique: jest.Mock<Promise<Partial<FormSection> | null>, [Args]>;
    findUniqueOrThrow: jest.Mock<Promise<SectionWithFields>, [Args]>;
    create: jest.Mock<Promise<SectionWithFields>, [Args]>;
    update: jest.Mock<Promise<FormSection>, [Args]>;
    delete: jest.Mock<Promise<FormSection>, [Args]>;
  };
  formField: {
    findMany: jest.Mock<Promise<Array<{ fieldId: number }>>, [Args]>;
    findUnique: jest.Mock<Promise<{ fieldSectionId: number } | null>, [Args]>;
    create: jest.Mock<Promise<FormField>, [Args]>;
    update: jest.Mock<Promise<FormField>, [Args]>;
    deleteMany: jest.Mock<Promise<{ count: number }>, [Args]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

/** The refusal body a thrown HttpException carries. */
const bodyOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error.getResponse();
    throw error;
  }
  throw new Error('expected the call to refuse');
};

describe('WidgetMasterService', () => {
  let service: WidgetMasterService;
  let prisma: PrismaMock;
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      formSection: {
        findMany: jest.fn<Promise<SectionWithFields[]>, [Args]>(() =>
          Promise.resolve([makeSection()]),
        ),
        findUnique: jest.fn<Promise<Partial<FormSection> | null>, [Args]>(({ where }) =>
          Promise.resolve(where.sectionId === 1 ? makeSection() : null),
        ),
        findUniqueOrThrow: jest.fn<Promise<SectionWithFields>, [Args]>(() =>
          Promise.resolve(makeSection()),
        ),
        create: jest.fn<Promise<SectionWithFields>, [Args]>(() =>
          Promise.resolve(makeSection({ sectionId: 7 })),
        ),
        update: jest.fn<Promise<FormSection>, [Args]>(() => Promise.resolve(makeSection())),
        delete: jest.fn<Promise<FormSection>, [Args]>(() => Promise.resolve(makeSection())),
      },
      formField: {
        findMany: jest.fn<Promise<Array<{ fieldId: number }>>, [Args]>(() =>
          Promise.resolve([{ fieldId: 5 }, { fieldId: 6 }]),
        ),
        findUnique: jest.fn<Promise<{ fieldSectionId: number } | null>, [Args]>(() =>
          Promise.resolve({ fieldSectionId: 1 }),
        ),
        create: jest.fn<Promise<FormField>, [Args]>(() => Promise.resolve(makeField())),
        update: jest.fn<Promise<FormField>, [Args]>(() => Promise.resolve(makeField())),
        deleteMany: jest.fn<Promise<{ count: number }>, [Args]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    service = new WidgetMasterService(
      prisma as unknown as PrismaService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('save — create (no sectionId)', () => {
    it('creates the section with defaults and its fields in one write', async () => {
      await service.save(
        saveDto({
          sectionName: ' Primary Information ',
          fields: [
            { fieldName: ' item_name ', fieldGuiName: 'English Name', fieldPosition: 0 },
            { fieldName: 'item_code' },
          ],
        }),
      );

      expect(prisma.formSection.create).toHaveBeenCalledWith({
        data: {
          sectionMenuId: 10,
          sectionName: 'Primary Information',
          sectionGuiName: 'Primary Information',
          sectionPosition: 0,
          sectionVisibility: true,
          sectionPlatform: 'Web',
          sectionCreatedOn: expect.any(Date) as Date,
          sectionCreatedBy: USER_ID,
          fields: {
            create: [
              {
                fieldName: 'item_name',
                fieldGuiName: 'English Name',
                fieldSecondaryText: null,
                fieldPosition: 0,
                fieldVisibility: true,
                fieldCreatedBy: USER_ID,
                fieldUpdatedBy: null,
              },
              {
                fieldName: 'item_code',
                fieldGuiName: null,
                fieldSecondaryText: null,
                fieldPosition: 0,
                fieldVisibility: true,
                fieldCreatedBy: USER_ID,
                fieldUpdatedBy: null,
              },
            ],
          },
        },
        include: { fields: { orderBy: FIELD_ORDER_BY } },
      });
    });

    it('creates a section without fields when the body has none', async () => {
      await service.save(saveDto({ sectionPosition: 3, sectionVisibility: false }));

      const { data } = prisma.formSection.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('fields');
      expect(data).toMatchObject({ sectionPosition: 3, sectionVisibility: false });
    });

    it('returns the section with every timestamp as ISO', async () => {
      await expect(service.save(saveDto())).resolves.toEqual({
        sectionId: 7,
        sectionMenuId: 10,
        sectionName: 'Primary Information',
        sectionGuiName: 'Primary Information',
        sectionPosition: 0,
        sectionVisibility: true,
        sectionPlatform: 'Web',
        sectionSyncDate: null,
        sectionCreatedOn: CREATED_ON.toISOString(),
        sectionCreatedBy: USER_ID,
        sectionUpdatedOn: UPDATED_ON.toISOString(),
        sectionUpdatedBy: null,
        fields: [
          {
            fieldId: 5,
            fieldSectionId: 1,
            fieldName: 'item_name',
            fieldGuiName: 'English Name',
            fieldSecondaryText: null,
            fieldPosition: 0,
            fieldVisibility: true,
            fieldSyncDate: null,
            fieldCreatedOn: CREATED_ON.toISOString(),
            fieldCreatedBy: USER_ID,
            fieldUpdatedOn: UPDATED_ON.toISOString(),
            fieldUpdatedBy: null,
          },
        ],
      });
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.save(saveDto());

      expect(prisma.formSection.create.mock.calls[0][0].data!.sectionCreatedBy).toBe(DEFAULT_ACTOR);
    });
  });

  describe('save — update (sectionId sent)', () => {
    it('updates the section, keeping its position and visibility when not sent', async () => {
      prisma.formSection.findUnique.mockResolvedValueOnce(
        makeSection({ sectionPosition: 4, sectionVisibility: false }),
      );

      await service.save(saveDto({ sectionId: 1, sectionName: ' Renamed ' }));

      expect(prisma.formSection.update).toHaveBeenCalledWith({
        where: { sectionId: 1 },
        data: {
          sectionMenuId: 10,
          sectionName: 'Renamed',
          sectionGuiName: 'Primary Information',
          sectionPosition: 4,
          sectionVisibility: false,
          sectionPlatform: 'Web',
          sectionUpdatedBy: USER_ID,
          sectionUpdatedOn: expect.any(Date) as Date,
        },
      });
      expect(prisma.formSection.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { sectionId: 1 },
        include: { fields: { orderBy: FIELD_ORDER_BY } },
      });
    });

    it('leaves the fields alone when the body omits them', async () => {
      await service.save(saveDto({ sectionId: 1 }));

      expect(prisma.formField.findMany).not.toHaveBeenCalled();
      expect(prisma.formField.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes every field when the body sends an empty list', async () => {
      await service.save(saveDto({ sectionId: 1, fields: [] }));

      expect(prisma.formField.deleteMany).toHaveBeenCalledWith({
        where: { fieldId: { in: [5, 6] } },
      });
      expect(prisma.formField.create).not.toHaveBeenCalled();
    });

    // Full sync: update by fieldId, create the rest, delete what is not sent.
    it('syncs the fields: updates the kept one, creates the new one, deletes the dropped one', async () => {
      await service.save(
        saveDto({
          sectionId: 1,
          fields: [
            { fieldId: 5, fieldName: ' item_name ', fieldGuiName: 'Name', fieldPosition: 2 },
            { fieldName: 'item_barcode', fieldGuiName: 'Barcode' },
          ],
        }),
      );

      expect(prisma.formField.findMany).toHaveBeenCalledWith({
        where: { fieldSectionId: 1 },
        select: { fieldId: true },
      });
      expect(prisma.formField.deleteMany).toHaveBeenCalledWith({ where: { fieldId: { in: [6] } } });
      expect(prisma.formField.update).toHaveBeenCalledWith({
        where: { fieldId: 5 },
        data: {
          fieldName: 'item_name',
          fieldGuiName: 'Name',
          fieldPosition: 2,
          fieldUpdatedBy: USER_ID,
          fieldUpdatedOn: expect.any(Date) as Date,
        },
      });
      expect(prisma.formField.create).toHaveBeenCalledWith({
        data: {
          fieldName: 'item_barcode',
          fieldGuiName: 'Barcode',
          fieldSecondaryText: null,
          fieldPosition: 0,
          fieldVisibility: true,
          fieldCreatedBy: USER_ID,
          fieldUpdatedBy: null,
          fieldSectionId: 1,
        },
      });
    });

    // dto-own-undefined trap: through the house ValidationPipe every declared field of
    // a nested field row is own (undefined when left out); left out keeps, null clears.
    it('keeps a field label and secondary text a piped body leaves out, and clears them on null', async () => {
      const dto = (await createHouseValidationPipe().transform(
        {
          sectionId: 1,
          sectionMenuId: 10,
          sectionName: 'Primary Information',
          sectionGuiName: 'Primary Information',
          sectionPlatform: 'Web',
          fields: [
            { fieldId: 5, fieldName: 'item_name' },
            { fieldId: 6, fieldName: 'item_code', fieldGuiName: null, fieldSecondaryText: '' },
          ],
        },
        { type: 'body', metatype: SaveWidgetDto },
      )) as SaveWidgetDto;
      expect(Object.prototype.hasOwnProperty.call(dto.fields![0], 'fieldGuiName')).toBe(true);

      await service.save(dto);

      const dataFor = (fieldId: number) =>
        (
          prisma.formField.update.mock.calls.find(
            ([args]) => (args.where as { fieldId: number }).fieldId === fieldId,
          )![0] as { data: Record<string, unknown> }
        ).data;
      expect(dataFor(5)).not.toHaveProperty('fieldGuiName');
      expect(dataFor(5)).not.toHaveProperty('fieldSecondaryText');
      expect(dataFor(6)).toMatchObject({ fieldGuiName: null, fieldSecondaryText: null });
    });

    // A fieldId from another section is not this section's to update.
    it('creates a new field for a fieldId the section does not hold', async () => {
      await service.save(saveDto({ sectionId: 1, fields: [{ fieldId: 99, fieldName: 'x' }] }));

      expect(prisma.formField.update).not.toHaveBeenCalled();
      expect(prisma.formField.create.mock.calls[0][0].data).toMatchObject({
        fieldName: 'x',
        fieldSectionId: 1,
      });
      expect(prisma.formField.create.mock.calls[0][0].data).not.toHaveProperty('fieldId');
    });

    it('refuses a section id with no row', async () => {
      const promise = service.save(saveDto({ sectionId: 2 }));

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Section not found',
        errors: [
          {
            field: 'sectionId',
            message: 'No section found with sectionId 2',
            code: WIDGET_ERROR.SECTION_NOT_FOUND,
          },
        ],
      });
      expect(prisma.formSection.update).not.toHaveBeenCalled();
    });

    it.each([[0], [-3], [1.5]])('refuses a sectionId of %p', async (sectionId) => {
      await expect(bodyOf(service.save(saveDto({ sectionId })))).resolves.toMatchObject({
        errors: [{ field: 'sectionId', code: WIDGET_ERROR.SECTION_ID_INVALID }],
      });
    });
  });

  describe('saveBulk', () => {
    it('saves every section in one transaction, in order', async () => {
      prisma.formSection.create
        .mockResolvedValueOnce(makeSection({ sectionId: 7 }))
        .mockResolvedValueOnce(makeSection({ sectionId: 8 }));

      const results = await service.saveBulk({
        data: [saveDto(), saveDto({ sectionName: 'Price Details' }), saveDto({ sectionId: 1 })],
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(results.map((section) => section.sectionId)).toEqual([7, 8, 1]);
      expect(prisma.formSection.update).toHaveBeenCalledTimes(1);
    });

    it('fails the whole batch on a missing section', async () => {
      await expect(
        service.saveBulk({ data: [saveDto(), saveDto({ sectionId: 2 })] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('lists every section with its fields, in position order', async () => {
      await service.list({});

      expect(prisma.formSection.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: SECTION_ORDER_BY,
        include: { fields: { orderBy: FIELD_ORDER_BY } },
      });
    });

    it('filters by section, menu and platform', async () => {
      await service.list({
        sectionId: 1,
        sectionMenuId: 10,
        sectionPlatform: WidgetPlatform.Mobile,
      });

      expect(prisma.formSection.findMany.mock.calls[0][0].where).toEqual({
        sectionId: 1,
        sectionMenuId: 10,
        sectionPlatform: 'Mobile',
      });
    });

    it('searches the section names and every field text with the trimmed term', async () => {
      await service.list({ search: '  code ' });

      expect(prisma.formSection.findMany.mock.calls[0][0].where).toEqual({
        OR: [
          { sectionName: { contains: 'code', mode: 'insensitive' } },
          { sectionGuiName: { contains: 'code', mode: 'insensitive' } },
          { fields: { some: { fieldName: { contains: 'code', mode: 'insensitive' } } } },
          { fields: { some: { fieldGuiName: { contains: 'code', mode: 'insensitive' } } } },
          { fields: { some: { fieldSecondaryText: { contains: 'code', mode: 'insensitive' } } } },
        ],
      });
    });

    it('reads a blank search as no search', async () => {
      await service.list({ search: '   ' });

      expect(prisma.formSection.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('getConfig', () => {
    it('returns every section of the menu and all its fields by default', async () => {
      await service.getConfig({ menu_id: 10 });

      expect(prisma.formSection.findMany).toHaveBeenCalledWith({
        where: { sectionMenuId: 10 },
        orderBy: SECTION_ORDER_BY,
        include: { fields: { where: undefined, orderBy: FIELD_ORDER_BY } },
      });
    });

    it('treats visibility=all as no filter', async () => {
      await service.getConfig({ menu_id: 10, visibility: WidgetVisibilityFilter.All });

      expect(prisma.formSection.findMany.mock.calls[0][0].where).toEqual({ sectionMenuId: 10 });
    });

    it('with visibility=false returns hidden sections, their hidden fields and any with secondary text', async () => {
      await service.getConfig({
        menu_id: 10,
        visibility: WidgetVisibilityFilter.False,
        platform: WidgetPlatform.Desktop,
      });

      expect(prisma.formSection.findMany).toHaveBeenCalledWith({
        where: { sectionMenuId: 10, sectionPlatform: 'Desktop', sectionVisibility: false },
        orderBy: SECTION_ORDER_BY,
        include: {
          fields: {
            where: { OR: [{ fieldVisibility: false }, { fieldSecondaryText: { not: null } }] },
            orderBy: FIELD_ORDER_BY,
          },
        },
      });
    });
  });

  describe('updateVisibility', () => {
    const visibilityDto = {
      data: [
        {
          sectionId: 1,
          sectionGuiName: ' Primary ',
          sectionVisibility: false,
          fields: [{ fieldId: 5, fieldSecondaryText: ' hint ', fieldVisibility: false }],
        },
      ],
    };

    it('updates each section and field, then returns the sections re-read', async () => {
      const result = await service.updateVisibility(visibilityDto);

      expect(prisma.formSection.update).toHaveBeenCalledWith({
        where: { sectionId: 1 },
        data: {
          sectionGuiName: 'Primary',
          sectionVisibility: false,
          sectionUpdatedBy: USER_ID,
          sectionUpdatedOn: expect.any(Date) as Date,
        },
      });
      expect(prisma.formField.update).toHaveBeenCalledWith({
        where: { fieldId: 5 },
        data: {
          fieldSecondaryText: 'hint',
          fieldVisibility: false,
          fieldUpdatedBy: USER_ID,
          fieldUpdatedOn: expect.any(Date) as Date,
        },
      });
      expect(prisma.formSection.findMany).toHaveBeenCalledWith({
        where: { sectionId: { in: [1] } },
        orderBy: SECTION_ORDER_BY,
        include: { fields: { orderBy: FIELD_ORDER_BY } },
      });
      expect(result).toHaveLength(1);
    });

    it('refuses a section with no row', async () => {
      const dto = { data: [{ ...visibilityDto.data[0], sectionId: 2 }] };

      await expect(bodyOf(service.updateVisibility(dto))).resolves.toMatchObject({
        errors: [{ field: 'sectionId', code: WIDGET_ERROR.SECTION_NOT_FOUND }],
      });
      expect(prisma.formSection.update).not.toHaveBeenCalled();
    });

    it.each([
      ['has no row', null],
      ['belongs to another section', { fieldSectionId: 3 }],
    ])('refuses a field that %s', async (_label, field) => {
      prisma.formField.findUnique.mockResolvedValueOnce(field);

      const promise = service.updateVisibility(visibilityDto);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Field not found',
        errors: [
          {
            field: 'fieldId',
            message: 'No field found with fieldId 5 under sectionId 1',
            code: WIDGET_ERROR.FIELD_NOT_FOUND,
          },
        ],
      });
      expect(prisma.formField.update).not.toHaveBeenCalled();
    });

    it('refuses a section id that is not a positive integer before opening a transaction', async () => {
      const dto = { data: [{ ...visibilityDto.data[0], sectionId: 0 }] };

      await expect(service.updateVisibility(dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a field id that is not a positive integer', async () => {
      const dto = {
        data: [
          {
            ...visibilityDto.data[0],
            fields: [{ ...visibilityDto.data[0].fields[0], fieldId: -1 }],
          },
        ],
      };

      await expect(bodyOf(service.updateVisibility(dto))).resolves.toMatchObject({
        errors: [{ field: 'fieldId', code: WIDGET_ERROR.FIELD_ID_INVALID }],
      });
    });
  });

  describe('delete', () => {
    // The fields go with it through the form_field FK cascade.
    it('deletes the section', async () => {
      await expect(service.delete(1)).resolves.toEqual({ sectionId: 1, deleted: true });

      expect(prisma.formSection.delete).toHaveBeenCalledWith({ where: { sectionId: 1 } });
      expect(prisma.formField.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses a section with no row', async () => {
      await expect(bodyOf(service.delete(2))).resolves.toMatchObject({
        errors: [{ field: 'sectionId', code: WIDGET_ERROR.SECTION_NOT_FOUND }],
      });
      expect(prisma.formSection.delete).not.toHaveBeenCalled();
    });

    it('refuses a section id that is not a positive integer', async () => {
      await expect(bodyOf(service.delete(0))).resolves.toMatchObject({
        errors: [{ code: WIDGET_ERROR.SECTION_ID_INVALID }],
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
