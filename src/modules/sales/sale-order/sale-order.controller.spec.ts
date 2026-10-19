import { SaleOrderController } from './sale-order.controller';
import { SaleOrderService } from './sale-order.service';
import { SaleOrderLifecycleService } from './sale-order-lifecycle.service';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { AmendSaleOrderDto } from './dto/sale-order-lifecycle.dto';
import { SaleOrderPayload } from './types/sale-order-api.types';

const ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46a101';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a102';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a103';
const ACC_YEAR = '2026-2027';
const KEYS = { soId: ORDER_ID, soCompanyId: COMPANY_ID, soBranchId: BRANCH_ID, soAccYear: ACC_YEAR };

const PAYLOAD = { soId: ORDER_ID, soOrderRefno: 'sor00101' } as unknown as SaleOrderPayload;
const SHORT = { code: 'SALES_RESERVE_SHORT', line: 2, short: 1.5, message: 'short' };

const saveDto = (overrides: Partial<SaveSaleOrderDto> = {}): SaveSaleOrderDto =>
  ({ soCompanyId: COMPANY_ID, soBranchId: BRANCH_ID, ...overrides }) as SaveSaleOrderDto;

describe('SaleOrderController', () => {
  let orders: {
    save: jest.Mock;
    getById: jest.Mock;
    getSrcDocPendingAmount: jest.Mock;
    cancelOpenLines: jest.Mock;
  };
  let lifecycle: {
    saveAndPost: jest.Mock;
    deleteDraft: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    amend: jest.Mock;
  };
  let controller: SaleOrderController;

  beforeEach(() => {
    orders = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      getSrcDocPendingAmount: jest.fn().mockResolvedValue({ pendingAmount: 250 }),
      cancelOpenLines: jest.fn().mockResolvedValue({ cancelledLines: 2 }),
    };
    lifecycle = {
      saveAndPost: jest.fn().mockResolvedValue({ ...PAYLOAD, warnings: [] }),
      deleteDraft: jest.fn().mockResolvedValue({ soId: ORDER_ID, deleted: true }),
      post: jest.fn().mockResolvedValue({ soStatus: 'CONFIRMED', warnings: [] }),
      cancel: jest.fn().mockResolvedValue({ soStatus: 'CANCELLED', cancelledLines: 3 }),
      amend: jest.fn().mockResolvedValue({ ...PAYLOAD, soRevisionNo: 2 }),
    };
    controller = new SaleOrderController(
      orders as unknown as SaleOrderService,
      lifecycle as unknown as SaleOrderLifecycleService,
    );
  });

  describe('save', () => {
    it('saves a plain create as a draft through the order service', async () => {
      const dto = saveDto();

      await expect(controller.save(dto)).resolves.toEqual({
        success: true,
        message: 'Order created successfully',
        data: PAYLOAD,
      });
      expect(orders.save).toHaveBeenCalledWith(dto);
      expect(lifecycle.saveAndPost).not.toHaveBeenCalled();
    });

    it('words a save with soId as an update', async () => {
      await expect(controller.save(saveDto({ soId: ORDER_ID }))).resolves.toMatchObject({
        message: 'Order updated successfully',
      });
    });

    it('treats a status the post would leave as a save-and-confirm too', async () => {
      // A non-confirming status is just a column value for the plain save.
      await controller.save(saveDto({ soStatus: 'DRAFT' }));
      expect(orders.save).toHaveBeenCalledTimes(1);

      await controller.save(saveDto({ soStatus: 'confirmed' }));
      expect(lifecycle.saveAndPost).toHaveBeenCalledTimes(1);
      expect(orders.save).toHaveBeenCalledTimes(1);
    });

    it('confirms in one call on post: true and says so', async () => {
      const dto = saveDto({ post: true });

      await expect(controller.save(dto)).resolves.toEqual({
        success: true,
        message: 'Order created and confirmed',
        data: { ...PAYLOAD, warnings: [] },
      });
      expect(lifecycle.saveAndPost).toHaveBeenCalledWith(dto);
      expect(orders.save).not.toHaveBeenCalled();
    });

    it('counts the reservation shortfalls into the message', async () => {
      lifecycle.saveAndPost.mockResolvedValue({ ...PAYLOAD, warnings: [SHORT, SHORT] });

      await expect(controller.save(saveDto({ soId: ORDER_ID, post: true }))).resolves.toMatchObject({
        message: 'Order updated and confirmed — 2 line(s) short on reservation',
      });
    });
  });

  it('wraps a fetched order', async () => {
    await expect(controller.getById(ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'Order fetched successfully',
      data: PAYLOAD,
    });
    expect(orders.getById).toHaveBeenCalledWith(ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
  });

  it('hands the pending-amount tuple straight to the service', async () => {
    await expect(controller.getPendingAmount('sales order', ORDER_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'Pending amount fetched successfully',
      data: { pendingAmount: 250 },
    });
    expect(orders.getSrcDocPendingAmount).toHaveBeenCalledWith('sales order', ORDER_ID, ACC_YEAR);
  });

  it('cancels open lines by the source tuple and the body', async () => {
    const body = { soiCancelReason: 'Customer withdrew' };

    await expect(controller.cancelLines('SALES', ORDER_ID, ACC_YEAR, body)).resolves.toEqual({
      success: true,
      message: 'Order lines cancelled successfully',
      data: { cancelledLines: 2 },
    });
    expect(orders.cancelOpenLines).toHaveBeenCalledWith('SALES', ORDER_ID, ACC_YEAR, body);
  });

  it('deletes through the lifecycle, which refuses anything but a draft', async () => {
    await expect(controller.remove(ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'Order deleted successfully',
      data: { soId: ORDER_ID, deleted: true },
    });
    expect(lifecycle.deleteDraft).toHaveBeenCalledWith(KEYS);
  });

  it('wraps the three lifecycle verbs', async () => {
    await expect(controller.postOrder(KEYS)).resolves.toEqual({
      success: true,
      message: 'Order confirmed successfully',
      data: { soStatus: 'CONFIRMED', warnings: [] },
    });
    await expect(controller.cancelOrder({ ...KEYS, reason: 'Duplicate' })).resolves.toEqual({
      success: true,
      message: 'Order cancelled successfully',
      data: { soStatus: 'CANCELLED', cancelledLines: 3 },
    });
    const amend = { ...KEYS, baseRevision: 1, editRemark: 'Qty change' } as AmendSaleOrderDto;
    await expect(controller.amendOrder(amend)).resolves.toEqual({
      success: true,
      message: 'Order amended successfully',
      data: { ...PAYLOAD, soRevisionNo: 2 },
    });
    expect(lifecycle.cancel).toHaveBeenCalledWith({ ...KEYS, reason: 'Duplicate' });
    expect(lifecycle.amend).toHaveBeenCalledWith(amend);
  });
});
