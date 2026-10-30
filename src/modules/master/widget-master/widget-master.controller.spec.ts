import { WidgetMasterController } from './widget-master.controller';
import { WidgetMasterService } from './widget-master.service';
import { WidgetMasterPayload, WidgetPlatform } from './types/widget-master-api.types';

const SECTION = {
  sectionId: 1,
  sectionName: 'Primary Information',
  fields: [],
} as unknown as WidgetMasterPayload;
const BODY = {
  sectionMenuId: 10,
  sectionName: 'Primary Information',
  sectionGuiName: 'Primary Information',
  sectionPlatform: WidgetPlatform.Web,
};

describe('WidgetMasterController', () => {
  let service: {
    save: jest.Mock;
    saveBulk: jest.Mock;
    list: jest.Mock;
    getConfig: jest.Mock;
    updateVisibility: jest.Mock;
    delete: jest.Mock;
  };
  let controller: WidgetMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(SECTION),
      saveBulk: jest.fn().mockResolvedValue([SECTION]),
      list: jest.fn().mockResolvedValue([SECTION]),
      getConfig: jest.fn().mockResolvedValue([SECTION]),
      updateVisibility: jest.fn().mockResolvedValue([SECTION]),
      delete: jest.fn().mockResolvedValue({ sectionId: 1, deleted: true }),
    };
    controller = new WidgetMasterController(service as unknown as WidgetMasterService);
  });

  it.each([
    ['created', BODY, 'Widget section created successfully'],
    ['updated', { ...BODY, sectionId: 1 }, 'Widget section updated successfully'],
  ])('save says %s by whether the body names a sectionId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: SECTION });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it.each([
    ['saveBulk', () => controller.saveBulk({ data: [BODY] }), 'Widget sections saved successfully'],
    ['list', () => controller.list({ sectionMenuId: 10 }), 'Widgets fetched successfully'],
    [
      'getConfig',
      () => controller.getConfig({ menu_id: 10 }),
      'Widget config fetched successfully',
    ],
    [
      'updateVisibility',
      () =>
        controller.updateVisibility({
          data: [{ sectionId: 1, sectionGuiName: 'P', sectionVisibility: true, fields: [] }],
        }),
      'Widget visibility updated successfully',
    ],
  ])('%s wraps the sections', async (_label, call, message) => {
    await expect(call()).resolves.toEqual({ success: true, message, data: [SECTION] });
  });

  it('remove deletes by section id and wraps the result', async () => {
    await expect(controller.remove(1)).resolves.toEqual({
      success: true,
      message: 'Widget section deleted successfully',
      data: { sectionId: 1, deleted: true },
    });
    expect(service.delete).toHaveBeenCalledWith(1);
  });
});
