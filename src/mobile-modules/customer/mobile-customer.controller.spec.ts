import { MobileCustomerController } from './mobile-customer.controller';
import type { MobileCustomerService } from './mobile-customer.service';
import type { CustomerService } from '../../modules/sales/customer/customer.service';
import type { DataChangeService } from '../../common/data-changes/data-change.service';
import type { UpdateMobileCustomerDto } from './dto/mobile-customer.dto';

const CUS_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e104';

const body = {
  cusName: 'Sri Velan Agencies',
  cusStateName: 'Tamil Nadu',
  cusStateCode: '33',
  cusAreaId: AREA_ID,
  cusGroupId: GROUP_ID,
  cusPriceLevelId: 1,
};

describe('MobileCustomerController', () => {
  let mobile: { list: jest.Mock; getById: jest.Mock; formOptions: jest.Mock };
  let customers: { save: jest.Mock; deleteCheck: jest.Mock; softDelete: jest.Mock };
  let publish: jest.Mock;
  let controller: MobileCustomerController;

  beforeEach(() => {
    mobile = {
      list: jest.fn().mockResolvedValue({ items: [] }),
      getById: jest.fn().mockResolvedValue({ cusId: CUS_ID }),
      formOptions: jest.fn().mockResolvedValue({ areas: [] }),
    };
    customers = {
      save: jest.fn().mockResolvedValue({ cusId: CUS_ID, partySync: { otherRoleUpdated: false } }),
      deleteCheck: jest.fn().mockResolvedValue({ canDelete: true }),
      softDelete: jest.fn().mockResolvedValue({ cusId: CUS_ID, deleted: true }),
    };
    publish = jest.fn();
    controller = new MobileCustomerController(
      mobile as unknown as MobileCustomerService,
      customers as unknown as CustomerService,
      { publish } as unknown as DataChangeService,
    );
  });

  it('lists through the mobile service', async () => {
    const res = await controller.list({ search: 'sri', filter: 'OUTSTANDING' });
    expect(mobile.list).toHaveBeenCalledWith({ search: 'sri', filter: 'OUTSTANDING' });
    expect(res).toEqual({
      success: true,
      message: 'Customers fetched successfully',
      data: { items: [] },
    });
  });

  it('serves the form options and one customer', async () => {
    await expect(controller.options()).resolves.toEqual(
      expect.objectContaining({ success: true, data: { areas: [] } }),
    );
    await expect(controller.getById(CUS_ID)).resolves.toEqual(
      expect.objectContaining({ data: { cusId: CUS_ID } }),
    );
  });

  it('creates through the desktop save', async () => {
    const res = await controller.create(body, {});
    expect(customers.save).toHaveBeenCalledWith(body);
    expect(res.message).toBe('Customer created successfully');
    expect(publish).not.toHaveBeenCalled();
  });

  it('updates through the desktop save and announces the supplier when the sync touched it', async () => {
    customers.save.mockResolvedValue({ cusId: CUS_ID, partySync: { otherRoleUpdated: true } });
    const dto = { ...body, cusId: CUS_ID } as UpdateMobileCustomerDto;

    const res = await controller.update(dto, { user: { sid: 'sid-a' } });

    expect(customers.save).toHaveBeenCalledWith(dto);
    expect(res.message).toBe('Customer updated successfully');
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'suppliers', originSessionId: 'sid-a' }),
    );
  });

  it('delete-checks and deletes through the desktop service (menu-10 right lives there)', async () => {
    await controller.deleteCheck(CUS_ID);
    await controller.remove(CUS_ID);
    expect(customers.deleteCheck).toHaveBeenCalledWith(CUS_ID);
    expect(customers.softDelete).toHaveBeenCalledWith(CUS_ID);
  });
});
