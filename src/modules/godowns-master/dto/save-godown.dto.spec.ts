import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SaveGodownDto } from './save-godown.dto';

describe('SaveGodownDto', () => {
  it('rejects client supplied gdl_path_ids_cache in request body', async () => {
    const validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      validationPipe.transform(
        {
          gdl_godown_id: '019c6f6c-be87-7a11-8905-36092c46fd07',
          gdl_branch_id: '019c6f6c-be87-7a11-8905-36092c46fd08',
          gdl_name: 'Rack A1',
          gdl_path_ids_cache: ['019c6f6c-be87-7a11-8905-36092c46fd06'],
        },
        {
          type: 'body',
          metatype: SaveGodownDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
