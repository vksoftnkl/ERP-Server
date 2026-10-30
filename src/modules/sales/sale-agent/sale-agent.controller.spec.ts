import { SaleAgentController } from './sale-agent.controller';
import { SaleAgentService } from './sale-agent.service';
import { SaleAgentPayload } from './types/sale-agent-api.types';

const SA_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e203';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e205';

const PAYLOAD = { saId: SA_ID, saName: 'Agent One' } as SaleAgentPayload;

describe('SaleAgentController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: SaleAgentController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ saId: SA_ID, deleted: true }),
    };
    controller = new SaleAgentController(service as unknown as SaleAgentService);
  });

  it('words a save without saId as a create', async () => {
    const body = { saCompanyId: COMPANY_ID, saGroupId: GROUP_ID, saName: 'Agent One' };

    await expect(controller.save(body)).resolves.toEqual({
      success: true,
      message: 'Sale agent created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(body);
  });

  it('words a save with saId as an update', async () => {
    await expect(
      controller.save({ saId: SA_ID, saCompanyId: COMPANY_ID, saGroupId: GROUP_ID, saName: 'X' }),
    ).resolves.toMatchObject({ message: 'Sale agent updated successfully' });
  });

  it('wraps a single agent', async () => {
    await expect(controller.getById(SA_ID)).resolves.toEqual({
      success: true,
      message: 'Sale agent fetched successfully',
      data: PAYLOAD,
    });
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(SA_ID)).resolves.toEqual({
      success: true,
      message: 'Sale agent deleted successfully',
      data: { saId: SA_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(SA_ID);
  });
});
