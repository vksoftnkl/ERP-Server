import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveItemBrandDto } from './save-item-brand.dto';

describe('SaveItemBrandDto', () => {
  it('accepts brand_photo as plain base64 string', () => {
    const dto = plainToInstance(SaveItemBrandDto, {
      brand_name: 'Acme',
      brand_photo: 'c2FtcGxlLWltYWdl',
    });

    const errors = validateSync(dto);

    expect(dto.brand_photo).toBe('c2FtcGxlLWltYWdl');
    expect(errors).toHaveLength(0);
  });

  it('accepts brand_photo as data url', () => {
    const dto = plainToInstance(SaveItemBrandDto, {
      brand_name: 'Acme',
      brand_photo: 'data:image/png;base64,c2FtcGxlLWltYWdl',
    });

    const errors = validateSync(dto);

    expect(dto.brand_photo).toBe('data:image/png;base64,c2FtcGxlLWltYWdl');
    expect(errors).toHaveLength(0);
  });

  it('rejects client supplied brand_path_ids in request body', async () => {
    const validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      validationPipe.transform(
        {
          brand_name: 'Acme',
          brand_path_ids: ['018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678'],
        },
        {
          type: 'body',
          metatype: SaveItemBrandDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
