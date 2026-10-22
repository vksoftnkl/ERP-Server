import { TenderDayBookController } from './tender-day-book.controller';
import { TenderDayBookService } from './tender-day-book.service';
import type { NoTenderPayload, TenderDayBookPayload } from './tender-day-book.types';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const QUERY = { companyId: COMPANY_ID, accYear: '2026-2027', fromDate: '2026-10-16' };

const dayBookOf = (groups: number) =>
  ({ groups: Array.from({ length: groups }, () => ({})) }) as unknown as TenderDayBookPayload;

const noTenderOf = (count: number) => ({ count }) as unknown as NoTenderPayload;

describe('TenderDayBookController', () => {
  let service: { dayBook: jest.Mock; noTender: jest.Mock };
  let controller: TenderDayBookController;

  beforeEach(() => {
    service = { dayBook: jest.fn(), noTender: jest.fn() };
    controller = new TenderDayBookController(service as unknown as TenderDayBookService);
  });

  it('wraps the Day Book and counts its tender groups', async () => {
    const data = dayBookOf(3);
    service.dayBook.mockResolvedValue(data);

    await expect(controller.dayBook(QUERY)).resolves.toEqual({
      success: true,
      message: '3 tender group(s)',
      data,
    });
    expect(service.dayBook).toHaveBeenCalledWith(QUERY);
  });

  it('says every money line has its tender when the list is empty', async () => {
    const data = noTenderOf(0);
    service.noTender.mockResolvedValue(data);

    await expect(controller.noTender(QUERY)).resolves.toEqual({
      success: true,
      message: 'Every money line has its tender',
      data,
    });
    expect(service.noTender).toHaveBeenCalledWith(QUERY);
  });

  it('counts the money lines with no tender otherwise', async () => {
    service.noTender.mockResolvedValue(noTenderOf(403));

    await expect(controller.noTender(QUERY)).resolves.toMatchObject({
      message: '403 money line(s) with no tender',
    });
  });

  it('passes a refusal through', async () => {
    const refusal = new Error('refused');
    service.dayBook.mockRejectedValue(refusal);

    await expect(controller.dayBook(QUERY)).rejects.toBe(refusal);
  });
});
