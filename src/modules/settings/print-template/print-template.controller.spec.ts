import { PrintTemplateController } from './print-template.controller';
import { PrintTemplateService } from './print-template.service';
import { PrintTemplatePayload } from './types/print-template-api.types';

const TEMPLATE_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const USER = '01963d86-caf0-7b26-89f0-58ac380a2d60';

const PAYLOAD = { ptlId: TEMPLATE_ID, ptlCode: 'SALE_INVOICE_A4' } as PrintTemplatePayload;

describe('PrintTemplateController', () => {
  let service: {
    saveTemplate: jest.Mock;
    getTemplateById: jest.Mock;
    listTemplates: jest.Mock;
    softDeleteTemplate: jest.Mock;
  };
  let controller: PrintTemplateController;

  beforeEach(() => {
    service = {
      saveTemplate: jest.fn().mockResolvedValue(PAYLOAD),
      getTemplateById: jest.fn().mockResolvedValue(PAYLOAD),
      listTemplates: jest
        .fn()
        .mockResolvedValue({ items: [PAYLOAD], page: 2, limit: 10, total: 11, total_pages: 2 }),
      softDeleteTemplate: jest.fn().mockResolvedValue({ deleted: true, ptlId: TEMPLATE_ID }),
    };
    controller = new PrintTemplateController(service as unknown as PrintTemplateService);
  });

  it('words a save without ptlId as a create', async () => {
    const dto = { ptlCode: 'SALE_INVOICE_A4' };

    await expect(controller.saveTemplate(dto)).resolves.toEqual({
      success: true,
      message: 'Print template created successfully',
      data: PAYLOAD,
    });
    expect(service.saveTemplate).toHaveBeenCalledWith(dto);
  });

  it('words a save with ptlId as an update', async () => {
    await expect(controller.saveTemplate({ ptlId: TEMPLATE_ID })).resolves.toMatchObject({
      message: 'Print template updated successfully',
    });
  });

  it('reads live revisions only unless the query asks for deleted ones', async () => {
    await expect(controller.getTemplate({ ptlId: TEMPLATE_ID })).resolves.toEqual({
      success: true,
      message: 'Print template fetched successfully',
      data: PAYLOAD,
    });
    await controller.getTemplate({ ptlId: TEMPLATE_ID, includeDeletedVersions: true });

    expect(service.getTemplateById).toHaveBeenNthCalledWith(1, TEMPLATE_ID, false);
    expect(service.getTemplateById).toHaveBeenNthCalledWith(2, TEMPLATE_ID, true);
  });

  it('splits the list result into data and meta', async () => {
    await expect(controller.listTemplates({ page: 2, limit: 10 })).resolves.toEqual({
      success: true,
      message: 'Print templates fetched successfully',
      data: [PAYLOAD],
      meta: { page: 2, limit: 10, total: 11, total_pages: 2 },
    });
  });

  it('passes the id and the named actor to the delete', async () => {
    await expect(
      controller.deleteTemplate({ ptlId: TEMPLATE_ID, ptlModifiedBy: USER }),
    ).resolves.toEqual({
      success: true,
      message: 'Print template deleted successfully',
      data: { deleted: true, ptlId: TEMPLATE_ID },
    });
    expect(service.softDeleteTemplate).toHaveBeenCalledWith(TEMPLATE_ID, USER);
  });
});
