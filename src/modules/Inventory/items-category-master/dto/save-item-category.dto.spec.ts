import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveItemCategoryDto } from './save-item-category.dto';

describe('SaveItemCategoryDto', () => {
  it('accepts category_photo object with data_base64', () => {
    const dto = plainToInstance(SaveItemCategoryDto, {
      category_name: 'Dairy',
      category_photo: {
        data_base64: 'c2FtcGxlLWltYWdl',
      },
    });

    const errors = validateSync(dto);

    expect(dto.category_photo).toBe('c2FtcGxlLWltYWdl');
    expect(errors).toHaveLength(0);
  });

  it('accepts category_photo object with data_url', () => {
    const dto = plainToInstance(SaveItemCategoryDto, {
      category_name: 'Dairy',
      category_photo: {
        data_url: 'data:image/png;base64,c2FtcGxlLWltYWdl',
      },
    });

    const errors = validateSync(dto);

    expect(dto.category_photo).toBe('data:image/png;base64,c2FtcGxlLWltYWdl');
    expect(errors).toHaveLength(0);
  });

  it('rejects client supplied category_path_ids_cache in request body', async () => {
    const validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      validationPipe.transform(
        {
          category_name: 'Dairy',
          category_path_ids_cache: ['018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679'],
        },
        {
          type: 'body',
          metatype: SaveItemCategoryDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
