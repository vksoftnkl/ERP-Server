import { DeliveryChallanController } from './delivery-challan.controller';
import { DeliveryChallanService } from './delivery-challan.service';
import type { SaveDeliveryChallanDto } from './dto/save-delivery-challan.dto';

const DC_ID = '019c6f6c-be87-7a11-8905-36092c46d001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46d002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46d003';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46d005';
const ACC_YEAR = '2026-2027';

const KEYS = {
  sdcId: DC_ID,
  sdcCompanyId: COMPANY_ID,
  sdcBranchId: BRANCH_ID,
  sdcAccYear: ACC_YEAR,
};
const DOC = { sdcId: DC_ID, sdcStatus: 'DRAFT' };
const POSTED = { sdcId: DC_ID, sdcStatus: 'POSTED' };

const saveBody = (overrides: Record<string, unknown> = {}) =>
  ({
    ...KEYS,
    sdcId: undefined,
    sdcCustId: CUST_ID,
    ...overrides,
  }) as unknown as SaveDeliveryChallanDto;

describe('DeliveryChallanController', () => {
  let service: {
    save: jest.Mock;
    saveAndPost: jest.Mock;
    validate: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    amend: jest.Mock;
    delete: jest.Mock;
    get: jest.Mock;
    openForBill: jest.Mock;
    convertPurpose: jest.Mock;
    transport: jest.Mock;
  };
  let controller: DeliveryChallanController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(DOC),
      saveAndPost: jest.fn().mockResolvedValue(POSTED),
      validate: jest.fn().mockResolvedValue({ ok: true, refusals: [], warnings: [] }),
      post: jest.fn().mockResolvedValue(POSTED),
      cancel: jest.fn().mockResolvedValue({ sdcStatus: 'CANCELLED' }),
      amend: jest.fn().mockResolvedValue({ ...POSTED, sdcRevisionNo: 2 }),
      delete: jest.fn().mockResolvedValue({ sdcId: DC_ID, deleted: true }),
      get: jest.fn().mockResolvedValue(DOC),
      openForBill: jest.fn().mockResolvedValue([{ sdcId: DC_ID }]),
      convertPurpose: jest.fn().mockResolvedValue({ ...POSTED, sdcPurpose: 'JOB_WORK' }),
      transport: jest.fn().mockResolvedValue({ transporterName: 'VRL' }),
    };
    controller = new DeliveryChallanController(service as unknown as DeliveryChallanService);
  });

  describe('create', () => {
    it('words a save without sdcId as a create and saves a draft', async () => {
      const dto = saveBody();

      await expect(controller.save(dto)).resolves.toEqual({
        success: true,
        message: 'Challan created successfully',
        data: DOC,
      });
      expect(service.save).toHaveBeenCalledWith(dto);
      expect(service.saveAndPost).not.toHaveBeenCalled();
    });

    it('words a save with sdcId as an update', async () => {
      await expect(controller.save(saveBody({ sdcId: DC_ID }))).resolves.toMatchObject({
        message: 'Challan updated successfully',
      });
    });

    it('saves and posts in one call on post: true (notes 106)', async () => {
      const dto = saveBody({ post: true });

      await expect(controller.save(dto)).resolves.toEqual({
        success: true,
        message: 'Challan created and posted successfully',
        data: POSTED,
      });
      expect(service.saveAndPost).toHaveBeenCalledWith(dto);
      expect(service.save).not.toHaveBeenCalled();
    });

    it.each(['POSTED', 'posted'])('reads sdcStatus %p as the same instruction', async (status) => {
      await expect(
        controller.save(saveBody({ sdcId: DC_ID, sdcStatus: status })),
      ).resolves.toMatchObject({ message: 'Challan updated and posted successfully' });
      expect(service.saveAndPost).toHaveBeenCalled();
    });

    it.each([
      ['post: false', { post: false }],
      ['a DRAFT status', { sdcStatus: 'DRAFT' }],
      ['a null status', { sdcStatus: null }],
    ])('saves a draft on %s', async (_label, overrides) => {
      await controller.save(saveBody(overrides));

      expect(service.save).toHaveBeenCalled();
      expect(service.saveAndPost).not.toHaveBeenCalled();
    });
  });

  it('wraps validate, post, cancel, amend and delete', async () => {
    const amendDto = { ...KEYS, baseRevision: 1, editRemark: 'Qty' } as never;

    await expect(controller.validate(saveBody())).resolves.toEqual({
      success: true,
      message: 'Challan validated',
      data: { ok: true, refusals: [], warnings: [] },
    });
    await expect(controller.post(KEYS)).resolves.toEqual({
      success: true,
      message: 'Challan posted successfully',
      data: POSTED,
    });
    await expect(controller.cancel({ ...KEYS, reason: 'Wrong customer' })).resolves.toEqual({
      success: true,
      message: 'Challan cancelled successfully',
      data: { sdcStatus: 'CANCELLED' },
    });
    await expect(controller.amend(amendDto)).resolves.toMatchObject({
      message: 'Challan amended successfully',
      data: { sdcRevisionNo: 2 },
    });
    await expect(controller.remove(KEYS)).resolves.toEqual({
      success: true,
      message: 'Draft challan deleted successfully',
      data: { sdcId: DC_ID, deleted: true },
    });
    expect(service.post).toHaveBeenCalledWith(KEYS);
    expect(service.cancel).toHaveBeenCalledWith({ ...KEYS, reason: 'Wrong customer' });
    expect(service.amend).toHaveBeenCalledWith(amendDto);
    expect(service.delete).toHaveBeenCalledWith(KEYS);
  });

  it('hands get the four keys the store reads', async () => {
    await expect(controller.get(DC_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'Challan fetched successfully',
      data: DOC,
    });
    expect(service.get).toHaveBeenCalledWith({
      id: DC_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      accYear: ACC_YEAR,
    });
  });

  it('reads an empty accYear on open-for-bill as every year', async () => {
    await expect(controller.openForBill(COMPANY_ID, BRANCH_ID, CUST_ID, '')).resolves.toEqual({
      success: true,
      message: 'Open challans fetched',
      data: [{ sdcId: DC_ID }],
    });
    expect(service.openForBill).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      partyId: CUST_ID,
      accYear: null,
    });

    await controller.openForBill(COMPANY_ID, BRANCH_ID, CUST_ID, ACC_YEAR);
    expect(service.openForBill).toHaveBeenLastCalledWith(
      expect.objectContaining({ accYear: ACC_YEAR }),
    );
  });

  it('wraps convert-purpose and transport', async () => {
    const convert = { ...KEYS, purpose: 'JOB_WORK' as const, remark: 'Polishing' };
    const transport = { ...KEYS, transport: { transporterName: 'VRL' } } as never;

    await expect(controller.convertPurpose(convert)).resolves.toMatchObject({
      success: true,
      message: 'Purpose converted',
      data: { sdcPurpose: 'JOB_WORK' },
    });
    await expect(controller.transport(transport)).resolves.toEqual({
      success: true,
      message: 'Transport details saved',
      data: { transporterName: 'VRL' },
    });
    expect(service.convertPurpose).toHaveBeenCalledWith(convert);
    expect(service.transport).toHaveBeenCalledWith(transport);
  });
});
