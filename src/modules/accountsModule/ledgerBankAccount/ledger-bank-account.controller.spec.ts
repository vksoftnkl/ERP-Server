import { LedgerBankAccountController } from './ledger-bank-account.controller';
import { LedgerBankAccountService } from './ledger-bank-account.service';
import { LedgerBankAccountPayload } from './types/ledger-bank-account-api.types';

const LBA_ID = '019c6f6c-be87-7a11-8905-36092c46d101';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46d103';
const ACCOUNT = { lbaId: LBA_ID, lbaLedgerId: LEDGER_ID } as LedgerBankAccountPayload;
const BODY = {
  lbaLedgerId: LEDGER_ID,
  lbaAccountHolder: 'Acme Industries Pvt Ltd',
  lbaBankName: 'HDFC Bank',
  lbaAccountNo: '50100123456789',
};

describe('LedgerBankAccountController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: LedgerBankAccountController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(ACCOUNT),
      getById: jest.fn().mockResolvedValue(ACCOUNT),
      softDelete: jest.fn().mockResolvedValue({ lbaId: LBA_ID, deleted: true }),
    };
    controller = new LedgerBankAccountController(service as unknown as LedgerBankAccountService);
  });

  it.each([
    ['created', BODY, 'Ledger bank account created successfully'],
    ['updated', { ...BODY, lbaId: LBA_ID }, 'Ledger bank account updated successfully'],
  ])('save says %s by whether the body names an lbaId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: ACCOUNT });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('getById fetches by id and wraps the account', async () => {
    await expect(controller.getById(LBA_ID)).resolves.toEqual({
      success: true,
      message: 'Ledger bank account fetched successfully',
      data: ACCOUNT,
    });
    expect(service.getById).toHaveBeenCalledWith(LBA_ID);
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove(LBA_ID)).resolves.toEqual({
      success: true,
      message: 'Ledger bank account deleted successfully',
      data: { lbaId: LBA_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(LBA_ID);
  });
});
