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
  it('accepts legacy godown_* payload keys', async () => {
    const validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const result = (await validationPipe.transform(
      {
        godown_id: '019c6f6c-be87-7a11-8905-36092c46fd07',
        branch_id: '019c6f6c-be87-7a11-8905-36092c46fd08',
        godown_name: 'Rack A1',
        godown_code: 'RACK-A1',
        godown_alias: 'A1',
        godown_description: 'Primary rack',
        godown_sort: '3',
        is_active: 'true',
      },
      {
        type: 'body',
        metatype: SaveGodownDto,
      },
    )) as SaveGodownDto;
    expect(result.godown_id).toBe('019c6f6c-be87-7a11-8905-36092c46fd07');
    expect(result.branch_id).toBe('019c6f6c-be87-7a11-8905-36092c46fd08');
    expect(result.godown_name).toBe('Rack A1');
    expect(result.godown_code).toBe('RACK-A1');
    expect(result.godown_alias).toBe('A1');
    expect(result.godown_description).toBe('Primary rack');
    expect(result.godown_sort).toBe(3);
    expect(result.is_active).toBe(true);
  });
});