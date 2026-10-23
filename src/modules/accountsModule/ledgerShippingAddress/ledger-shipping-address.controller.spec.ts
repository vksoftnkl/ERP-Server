import { BadRequestException, HttpException } from '@nestjs/common';
import { LedgerShippingAddressController } from './ledger-shipping-address.controller';
import { LedgerShippingAddressService } from './ledger-shipping-address.service';
import { LedgerShippingAddressPayload } from './types/ledger-shipping-address-api.types';
import { LedgerShippingAddressErrorCode } from './types/ledger-shipping-address-error-codes';

const SAA_ID = '019c6f6c-be87-7a11-8905-36092c46f301';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46f302';
const ADDRESS = { saaId: SAA_ID, saaLedgerId: LEDGER_ID } as LedgerShippingAddressPayload;
const BODY = { saaLedgerId: LEDGER_ID, saaGstin: '29ABCDE1234F1Z5' };

describe('LedgerShippingAddressController', () => {
  let service: {
    save: jest.Mock;
    getById: jest.Mock;
    listByLedger: jest.Mock;
    softDelete: jest.Mock;
  };
  let controller: LedgerShippingAddressController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(ADDRESS),
      getById: jest.fn().mockResolvedValue(ADDRESS),
      listByLedger: jest.fn().mockResolvedValue({ data: [ADDRESS], total: 1 }),
      softDelete: jest.fn().mockResolvedValue({ saaId: SAA_ID, deleted: true }),
    };
    controller = new LedgerShippingAddressController(
      service as unknown as LedgerShippingAddressService,
    );
  });

  it.each([
    ['created', BODY, 'Ledger shipping address created successfully'],
    ['updated', { ...BODY, saaId: SAA_ID }, 'Ledger shipping address updated successfully'],
  ])('save says %s by whether the body names a saaId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: ADDRESS });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  describe('getById', () => {
    it('fetches one address by saaId', async () => {
      await expect(controller.getById(SAA_ID, undefined)).resolves.toEqual({
        success: true,
        message: 'Ledger shipping address fetched successfully',
        data: ADDRESS,
      });
      expect(service.listByLedger).not.toHaveBeenCalled();
    });

    it('lists a ledger addresses by ledgerId', async () => {
      await expect(controller.getById(undefined, LEDGER_ID)).resolves.toEqual({
        success: true,
        message: 'Ledger shipping addresses fetched successfully',
        data: { data: [ADDRESS], total: 1 },
      });
      expect(service.listByLedger).toHaveBeenCalledWith(LEDGER_ID);
    });

    it('prefers saaId when both are sent', async () => {
      await controller.getById(SAA_ID, LEDGER_ID);

      expect(service.getById).toHaveBeenCalledWith(SAA_ID);
      expect(service.listByLedger).not.toHaveBeenCalled();
    });

    it('refuses neither with SHIPPING_ID_REQUIRED', async () => {
      const error = await controller.getById(undefined, undefined).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as HttpException).getResponse()).toEqual({
        success: false,
        message: 'Either saaId or ledgerId is required',
        errors: [
          {
            field: 'ledgerId',
            message: "Pass saaId to fetch one address, or ledgerId to list a ledger's addresses",
            code: LedgerShippingAddressErrorCode.ID_REQUIRED,
          },
        ],
      });
      expect(service.getById).not.toHaveBeenCalled();
    });
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove(SAA_ID)).resolves.toEqual({
      success: true,
      message: 'Ledger shipping address deleted successfully',
      data: { saaId: SAA_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(SAA_ID);
  });
});
