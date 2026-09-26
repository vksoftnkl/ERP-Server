import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveItemGroupDto } from './save-item-group.dto';

describe('SaveItemGroupDto', () => {
  it('accepts itg_photo object with data_base64', () => {
    const dto = plainToInstance(SaveItemGroupDto, {
      itg_name: 'Raw Materials',
      itg_photo: {
        data_base64: 'c2FtcGxlLWltYWdl',
      },
    });

    const errors = validateSync(dto);

    expect(dto.itg_photo).toBe('c2FtcGxlLWltYWdl');
    expect(errors).toHaveLength(0);
  });

  it('accepts itg_photo object with data_url', () => {
    const dto = plainToInstance(SaveItemGroupDto, {
      itg_name: 'Raw Materials',
      itg_photo: {
        data_url: 'data:image/png;base64,c2FtcGxlLWltYWdl',
      },
    });

    const errors = validateSync(dto);

    expect(dto.itg_photo).toBe('data:image/png;base64,c2FtcGxlLWltYWdl');
    expect(errors).toHaveLength(0);
  });

  it('rejects client supplied itg_path_ids_cache in request body', async () => {
    const validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      validationPipe.transform(
        {
          itg_name: 'Raw Materials',
          itg_path_ids_cache: ['018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678'],
        },
        {
          type: 'body',
          metatype: SaveItemGroupDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
