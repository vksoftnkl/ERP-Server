import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { SaveCustomerDto } from './dto/save-customer.dto';
import { CustomerPayload } from './types/customer-api.types';

const CUS_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e104';

const PAYLOAD = { cusId: CUS_ID, cusName: 'Ravi Stores' } as CustomerPayload;

const dto = (overrides: Partial<SaveCustomerDto> = {}): SaveCustomerDto => ({
  cusName: 'Ravi Stores',
  cusStateName: 'Tamil Nadu',
  cusStateCode: '33',
  cusAreaId: AREA_ID,
  cusGroupId: GROUP_ID,
  cusPriceLevelId: 1,
  ...overrides,
});

describe('CustomerController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: CustomerController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ cusId: CUS_ID, deleted: true }),
    };
    controller = new CustomerController(service as unknown as CustomerService, { publish: jest.fn() } as never);
  });

  it('words a save without cusId as a create', async () => {
    const body = dto();

    await expect(controller.save(body, {})).resolves.toEqual({
      success: true,
      message: 'Customer created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(body);
  });

  it('words a save with cusId as an update', async () => {
    await expect(controller.save(dto({ cusId: CUS_ID }), {})).resolves.toMatchObject({
      message: 'Customer updated successfully',
    });
  });

  it('words a link create (cusLinkLedId, no cusId) as a create', async () => {
    await expect(controller.save(dto({ cusLinkLedId: CUS_ID }), {})).resolves.toMatchObject({
      message: 'Customer created successfully',
    });
  });

  it('wraps a single customer', async () => {
    await expect(controller.getById(CUS_ID)).resolves.toEqual({
      success: true,
      message: 'Customer fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(CUS_ID);
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(CUS_ID)).resolves.toEqual({
      success: true,
      message: 'Customer deleted successfully',
      data: { cusId: CUS_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(CUS_ID);
  });
});
