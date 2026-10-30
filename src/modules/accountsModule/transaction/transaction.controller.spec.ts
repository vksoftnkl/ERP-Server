import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { GetPartyAdjustableCreditsDto } from './dto/get-party-adjustable-credits.dto';
import { AdjustableCredit } from './types/transaction-api.types';

const QUERY: GetPartyAdjustableCreditsDto = {
  companyId: '019c6f6c-be87-7a11-8905-36092c46e001',
  partyId: '019c6f6c-be87-7a11-8905-36092c46e002',
};

describe('TransactionController', () => {
  let service: { getPartyAdjustableCredits: jest.Mock };
  let controller: TransactionController;

  beforeEach(() => {
    service = { getPartyAdjustableCredits: jest.fn().mockResolvedValue([]) };
    controller = new TransactionController(service as unknown as TransactionService);
  });

  it('passes the query through and wraps the credits', async () => {
    const credits = [{ billId: 'b1' }] as unknown as AdjustableCredit[];
    service.getPartyAdjustableCredits.mockResolvedValue(credits);

    await expect(controller.get(QUERY)).resolves.toEqual({
      success: true,
      message: 'Party adjustable credits fetched successfully',
      data: credits,
    });
    expect(service.getPartyAdjustableCredits).toHaveBeenCalledWith(QUERY);
  });

  it('wraps an empty list the same way', async () => {
    await expect(controller.get(QUERY)).resolves.toEqual({
      success: true,
      message: 'Party adjustable credits fetched successfully',
      data: [],
    });
  });
});
