import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveItemEanCodeDto } from './save-item-ean-code.dto';

describe('SaveItemEanCodeDto', () => {
  it('maps empty ean_godown_id to null', () => {
    const dto = plainToInstance(SaveItemEanCodeDto, {
      ean_item_id: '019c6f6c-be87-7a11-8905-36092c46fd07',
      ean_unit_id: '019c6f6c-be87-7a11-8905-36092c46fd08',
      ean_code: '8901234567890',
      ean_godown_id: '',
    });

    const errors = validateSync(dto);

    expect(dto.ean_godown_id).toBeNull();
    expect(errors).toHaveLength(0);
  });

  it('normalizes boolean values from string payload', () => {
    const dto = plainToInstance(SaveItemEanCodeDto, {
      ean_item_id: '019c6f6c-be87-7a11-8905-36092c46fd07',
      ean_unit_id: '019c6f6c-be87-7a11-8905-36092c46fd08',
      ean_code: '8901234567890',
      ean_is_default: 'true',
      ean_is_active: '0',
    });

    const errors = validateSync(dto);

    expect(dto.ean_is_default).toBe(true);
    expect(dto.ean_is_active).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it('rejects client supplied ean_is_deleted in request body', async () => {
    const validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      validationPipe.transform(
        {
          ean_item_id: '019c6f6c-be87-7a11-8905-36092c46fd07',
          ean_unit_id: '019c6f6c-be87-7a11-8905-36092c46fd08',
          ean_code: '8901234567890',
          ean_is_deleted: true,
        },
        {
          type: 'body',
          metatype: SaveItemEanCodeDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
