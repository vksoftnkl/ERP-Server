import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveItemSectionDto } from './save-item-section.dto';

describe('SaveItemSectionDto', () => {
  it('accepts sec_photo as a plain base64 string', () => {
    const dto = plainToInstance(SaveItemSectionDto, {
      sec_name: 'Dairy',
      sec_photo: 'c2FtcGxlLWltYWdl',
    });

    const errors = validateSync(dto);

    expect(dto.sec_photo).toBe('c2FtcGxlLWltYWdl');
    expect(errors).toHaveLength(0);
  });

  it('accepts sec_photo as a data url', () => {
    const dto = plainToInstance(SaveItemSectionDto, {
      sec_name: 'Dairy',
      sec_photo: 'data:image/png;base64,c2FtcGxlLWltYWdl',
    });

    const errors = validateSync(dto);

    expect(dto.sec_photo).toBe('data:image/png;base64,c2FtcGxlLWltYWdl');
    expect(errors).toHaveLength(0);
  });

  it('rejects client supplied sec_path_ids in request body', async () => {
    const validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      validationPipe.transform(
        {
          sec_name: 'Dairy',
          sec_path_ids: ['018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679'],
        },
        {
          type: 'body',
          metatype: SaveItemSectionDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
