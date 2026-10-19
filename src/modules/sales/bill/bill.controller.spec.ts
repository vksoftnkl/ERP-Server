import { BillController } from './bill.controller';
import type { BillService } from './bill.service';
import type { BillLifecycleService } from './bill-lifecycle.service';
import type { BillReadService } from './bill-read.service';
import type { BillBandService } from './bill-band.service';
import type { BillRetenderService } from './bill-retender.service';
import type { BillVoidService } from './bill-void.service';
import type { SaveBillDto } from './dto/save-bill.dto';
import type { BillPayload } from './types/bill-api.types';

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46b501';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b502';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b503';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46b504';
const ACC_YEAR = '2026-2027';
const KEYS = { sbId: BILL_ID, sbCompanyId: COMPANY_ID, sbBranchId: BRANCH_ID, sbAccYear: ACC_YEAR };
const PAYLOAD = { sbId: BILL_ID, sbBillRefno: 'BIL/0042' } as unknown as BillPayload;

describe('BillController', () => {
  let bills: { save: jest.Mock; deleteDraft: jest.Mock; getById: jest.Mock };
  let lifecycle: {
    saveAndPost: jest.Mock;
    validate: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    amend: jest.Mock;
  };
  let voids: { void: jest.Mock; check: jest.Mock };
  let read: { openSources: jest.Mock; partyContext: jest.Mock; tenderContext: jest.Mock };
  let band: { deliveryStatus: jest.Mock; updateRemarks: jest.Mock; transport: jest.Mock };
  let retender: { retender: jest.Mock };
  let controller: BillController;

  beforeEach(() => {
    bills = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      deleteDraft: jest.fn().mockResolvedValue({ sbId: BILL_ID, deleted: true }),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
    };
    lifecycle = {
      saveAndPost: jest.fn().mockResolvedValue(PAYLOAD),
      validate: jest.fn().mockResolvedValue({ ok: true }),
      post: jest.fn().mockResolvedValue(PAYLOAD),
      cancel: jest.fn().mockResolvedValue({ sbStatus: 'CANCELLED' }),
      amend: jest.fn().mockResolvedValue(PAYLOAD),
    };
    voids = {
      void: jest.fn().mockResolvedValue({ sbStatus: 'CANCELLED' }),
      check: jest.fn().mockResolvedValue({ route: 'VOID' }),
    };
    read = {
      openSources: jest.fn().mockResolvedValue([]),
      partyContext: jest.fn().mockResolvedValue({ party: {} }),
      tenderContext: jest.fn().mockResolvedValue({ canRetender: true }),
    };
    band = {
      deliveryStatus: jest.fn().mockResolvedValue({ sbDeliveryStatus: 'PACKED' }),
      updateRemarks: jest.fn().mockResolvedValue({ sbRemarks: 'x' }),
      transport: jest.fn().mockResolvedValue({ lrNo: 'LR1' }),
    };
    retender = { retender: jest.fn().mockResolvedValue(PAYLOAD) };
    controller = new BillController(
      bills as unknown as BillService,
      lifecycle as unknown as BillLifecycleService,
      voids as unknown as BillVoidService,
      read as unknown as BillReadService,
      band as unknown as BillBandService,
      retender as unknown as BillRetenderService,
    );
  });

  describe('create', () => {
    it('saves a plain body as a draft', async () => {
      const dto = { sbCompanyId: COMPANY_ID } as SaveBillDto;

      await expect(controller.save(dto)).resolves.toEqual({
        success: true,
        message: 'Bill created successfully',
        data: PAYLOAD,
      });
      expect(bills.save).toHaveBeenCalledWith(dto);
      expect(lifecycle.saveAndPost).not.toHaveBeenCalled();
    });

    it('words a save of an existing draft as an update', async () => {
      await expect(controller.save({ sbId: BILL_ID } as SaveBillDto)).resolves.toMatchObject({
        message: 'Bill updated successfully',
      });
    });

    it.each([
      [{ post: true }, 'Bill created and posted successfully'],
      [{ sbStatus: 'posted' }, 'Bill created and posted successfully'],
      [{ sbId: BILL_ID, post: true }, 'Bill updated and posted successfully'],
    ])('treats %o as save-and-post', async (body, message) => {
      const dto = body as unknown as SaveBillDto;

      await expect(controller.save(dto)).resolves.toEqual({
        success: true,
        message,
        data: PAYLOAD,
      });
      expect(lifecycle.saveAndPost).toHaveBeenCalledWith(dto);
      expect(bills.save).not.toHaveBeenCalled();
    });

    it('ignores any other sbStatus and post: false', async () => {
      await controller.save({ sbStatus: 'DRAFT', post: false } as unknown as SaveBillDto);

      expect(bills.save).toHaveBeenCalled();
      expect(lifecycle.saveAndPost).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['validate', () => controller.validate(KEYS as never), 'validate', 'Bill validated'],
    ['post', () => controller.post(KEYS as never), 'post', 'Bill posted successfully'],
    ['cancel', () => controller.cancel(KEYS as never), 'cancel', 'Bill cancelled successfully'],
    ['amend', () => controller.amend(KEYS as never), 'amend', 'Bill amended successfully'],
  ] as const)('%s hands the body to the lifecycle', async (_name, call, method, message) => {
    const result = await call();

    expect(lifecycle[method]).toHaveBeenCalledWith(KEYS);
    expect(result).toMatchObject({ success: true, message });
  });

  it('voids through the void service and answers the void check', async () => {
    await expect(controller.void(KEYS as never)).resolves.toMatchObject({
      message: 'Bill voided successfully',
    });
    await expect(controller.voidCheck(KEYS)).resolves.toEqual({
      success: true,
      message: 'Void check',
      data: { route: 'VOID' },
    });
    expect(voids.check).toHaveBeenCalledWith(KEYS);
  });

  it('deletes a draft through the bill service', async () => {
    await expect(controller.remove(KEYS as never)).resolves.toEqual({
      success: true,
      message: 'Draft bill deleted successfully',
      data: { sbId: BILL_ID, deleted: true },
    });
  });

  it('gets the bill by its four keys', async () => {
    await expect(controller.getById(BILL_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'Bill fetched successfully',
      data: PAYLOAD,
    });
    expect(bills.getById).toHaveBeenCalledWith(BILL_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
  });

  describe('open-sources', () => {
    it('reads kind=order (any case) as ORDER and an empty year as none', async () => {
      await controller.openSources(COMPANY_ID, BRANCH_ID, PARTY_ID, 'order', '');

      expect(read.openSources).toHaveBeenCalledWith({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        partyId: PARTY_ID,
        kind: 'ORDER',
        accYear: null,
      });
    });

    it('reads every other kind as DC', async () => {
      await controller.openSources(COMPANY_ID, BRANCH_ID, PARTY_ID, 'anything', ACC_YEAR);

      expect(read.openSources).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'DC', accYear: ACC_YEAR }),
      );
    });
  });

  it('asks for the party context with no bill date when none is sent', async () => {
    await expect(
      controller.partyContext(PARTY_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR, ''),
    ).resolves.toMatchObject({ message: 'Party context fetched' });
    expect(read.partyContext).toHaveBeenCalledWith({
      partyId: PARTY_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      accYear: ACC_YEAR,
      billDate: null,
    });
  });

  it('wraps the three band verbs', async () => {
    await expect(controller.deliveryStatus({ ...KEYS, event: 'PACKED' })).resolves.toEqual({
      success: true,
      message: 'Delivery status updated',
      data: { sbDeliveryStatus: 'PACKED' },
    });
    await expect(
      controller.updateRemarks({ ...KEYS, sbRemarks: 'x', editRemark: 'typo' }),
    ).resolves.toMatchObject({ message: 'Remarks updated', data: { sbRemarks: 'x' } });
    await expect(controller.transport({ ...KEYS } as never)).resolves.toMatchObject({
      message: 'Transport details saved',
    });
  });

  it('reads the tender context and re-tenders', async () => {
    await expect(
      controller.tenderContext(BILL_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR),
    ).resolves.toMatchObject({ message: 'Tender context fetched', data: { canRetender: true } });
    expect(read.tenderContext).toHaveBeenCalledWith(KEYS);
    await expect(controller.retender(KEYS as never)).resolves.toMatchObject({
      message: 'Bill re-tendered successfully',
      data: PAYLOAD,
    });
  });
});
