import { NotFoundException } from '@nestjs/common';
import { SaveQuotationDto } from './dto/save-quotation.dto';
import { QuotationController } from './quotation.controller';
import { QuotationService } from './quotation.service';
import { QuotationPayload } from './types/quotation-api.types';

const QUOTE_ID = '019c6f6c-be87-7a11-8905-36092c46e601';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e602';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e603';
const ACC_YEAR = '2026-2027';

const PAYLOAD = {
  sqId: QUOTE_ID,
  sqQuoteRefno: 'quo00042',
  items: [],
  charges: [],
} as unknown as QuotationPayload;

describe('QuotationController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: QuotationController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ sqId: QUOTE_ID, deleted: true }),
    };
    controller = new QuotationController(service as unknown as QuotationService);
  });

  it('words a save without sqId as a create and hands the whole body over', async () => {
    const dto = { sqCompanyId: COMPANY_ID, sqCustName: 'Acme' } as SaveQuotationDto;

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Quotation created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with sqId as an update', async () => {
    await expect(
      controller.save({ sqId: QUOTE_ID, sqCustName: 'Acme' } as SaveQuotationDto),
    ).resolves.toMatchObject({ message: 'Quotation updated successfully' });
  });

  it('looks a quotation up by id, passing the whole address down in order', async () => {
    await expect(
      controller.getById(QUOTE_ID, undefined, COMPANY_ID, BRANCH_ID, ACC_YEAR),
    ).resolves.toEqual({
      success: true,
      message: 'Quotation fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(
      QUOTE_ID,
      undefined,
      COMPANY_ID,
      BRANCH_ID,
      ACC_YEAR,
    );
  });

  it('looks a quotation up by its quote number alone', async () => {
    await controller.getById(undefined, 'quo00042', COMPANY_ID, BRANCH_ID, ACC_YEAR);

    expect(service.getById).toHaveBeenCalledWith(
      undefined,
      'quo00042',
      COMPANY_ID,
      BRANCH_ID,
      ACC_YEAR,
    );
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'Quotation deleted successfully',
      data: { sqId: QUOTE_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
  });

  it('lets a service refusal reach the filter unchanged', async () => {
    const refusal = new NotFoundException({ success: false, message: 'Quotation not found' });
    service.softDelete.mockRejectedValue(refusal);

    await expect(controller.remove(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).rejects.toBe(
      refusal,
    );
  });
});
