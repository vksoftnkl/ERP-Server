import { BadRequestException } from '@nestjs/common';
import { SaveItemEanCodeDto } from '../../modules/items-ean-code-master/dto/save-item-ean-code.dto';
import {
  hasRequestPayload,
  validateDto,
  validateSingleOrArrayDto,
} from './request-payload-validation.util';

describe('request payload validation util', () => {
  it('detects when a request body is effectively empty', () => {
    expect(hasRequestPayload(undefined)).toBe(false);
    expect(hasRequestPayload(null)).toBe(false);
    expect(hasRequestPayload({})).toBe(false);
    expect(hasRequestPayload([])).toBe(true);
  });

  it('validates a single dto payload', async () => {
    const result = await validateDto(
      {
        ean_item_id: '019c6f6c-be87-7a11-8905-36092c46fd07',
        ean_unit_id: '019c6f6c-be87-7a11-8905-36092c46fd08',
        ean_code: '8901234567890',
      },
      SaveItemEanCodeDto,
    );

    expect(result).toBeInstanceOf(SaveItemEanCodeDto);
  });

  it('validates array payloads and reports indexed failures', async () => {
    await expect(
      validateSingleOrArrayDto(
        [
          {
            ean_item_id: '019c6f6c-be87-7a11-8905-36092c46fd07',
            ean_unit_id: '019c6f6c-be87-7a11-8905-36092c46fd08',
            ean_code: '8901234567890',
          },
          {
            ean_item_id: 'invalid',
            ean_unit_id: '019c6f6c-be87-7a11-8905-36092c46fd08',
            ean_code: '8901234567890',
          },
        ],
        SaveItemEanCodeDto,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects empty arrays', async () => {
    await expect(validateSingleOrArrayDto([], SaveItemEanCodeDto)).rejects.toThrow(
      BadRequestException,
    );
  });
});
