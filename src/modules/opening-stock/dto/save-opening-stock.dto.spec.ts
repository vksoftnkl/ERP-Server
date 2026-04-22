import { ValidationPipe } from '@nestjs/common';
import { SaveOpeningStockDto } from './save-opening-stock.dto';

describe('SaveOpeningStockDto', () => {
  it('accepts vchr_type_id as an alias for avh_voucher_type_id', async () => {
    const validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const result = (await validationPipe.transform(
      {
        header: {
          osh_acc_year: '2025-2026',
          osh_company_id: '01960231-76f1-7ef5-bbb1-63d6f1df0001',
          osh_branch_id: '01960231-76f1-7ef5-bbb1-63d6f1df0002',
          vchr_type_id: '7',
          osh_voucher_date: '2026-03-28T10:00:00.000Z',
          avh_party_id: '01960231-76f1-7ef5-bbb1-63d6f1df0003',
          osh_device_type: 'WEB',
          osh_counter_id: 'COUNTER-1',
        },
        audit_notes: '  Updated item quantities after stock count  ',
        details: [
          {
            osl_item_id: '01960231-76f1-7ef5-bbb1-63d6f1df0006',
            osl_unit_id: '01960231-76f1-7ef5-bbb1-63d6f1df0007',
            osl_godown_id: '01960231-76f1-7ef5-bbb1-63d6f1df0009',
            osl_qty: '5',
          },
        ],
      },
      {
        type: 'body',
        metatype: SaveOpeningStockDto,
      },
    )) as SaveOpeningStockDto;

    expect(result.header.avh_voucher_type_id).toBe(7);
    expect(result.audit_notes).toBe('Updated item quantities after stock count');
    expect(result.details[0].osl_qty).toBe(5);
  });
});
