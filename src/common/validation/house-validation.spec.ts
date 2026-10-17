import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { createHouseValidationPipe, validationCode } from './house-validation';

class LineDto {
  @IsInt()
  @Min(1)
  qty!: number;
}

class BodyDto {
  @IsUUID()
  sbSessionId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines!: LineDto[];
}

async function refusal(value: unknown): Promise<{
  success: boolean;
  message: string;
  errors: { field: string; code: string; message: string }[];
}> {
  const pipe = createHouseValidationPipe();
  try {
    await pipe.transform(value, { type: 'body', metatype: BodyDto, data: undefined });
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse() as never;
  }
  throw new Error('expected a refusal');
}

describe('house validation (notes 119 §4)', () => {
  it('names the constraint in upper snake case', () => {
    expect(validationCode('isNotEmpty')).toBe('VALIDATION_IS_NOT_EMPTY');
    expect(validationCode('isUuid')).toBe('VALIDATION_IS_UUID');
    expect(validationCode('isISO8601')).toBe('VALIDATION_IS_ISO8601');
    expect(validationCode('arrayMinSize')).toBe('VALIDATION_ARRAY_MIN_SIZE');
    expect(validationCode('whitelistValidation')).toBe('VALIDATION_WHITELIST');
  });

  it('answers in the house shape, one coded error per field, nested by path', async () => {
    const body = await refusal({
      sbSessionId: 'not-a-uuid',
      name: '',
      lines: [{ qty: 2 }, { qty: 0 }],
      extra: 1,
    });
    expect(body.success).toBe(false);
    expect(body.message).toBe('Validation failed');
    const byField = Object.fromEntries(body.errors.map((e) => [e.field, e]));
    expect(byField.sbSessionId).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_IS_UUID',
        message: 'sbSessionId must be a UUID',
      }),
    );
    expect(byField.name.code).toBe('VALIDATION_IS_NOT_EMPTY');
    expect(byField['lines.1.qty'].code).toBe('VALIDATION_MIN');
    expect(byField.extra).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_WHITELIST',
        message: 'property extra should not exist',
      }),
    );
    expect(body.errors.filter((e) => e.field === 'name')).toHaveLength(1);
  });

  it('keeps the global pipe’s transform: a valid body comes back typed', async () => {
    const pipe = createHouseValidationPipe();
    const out = (await pipe.transform(
      { sbSessionId: '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d', name: 'x', lines: [{ qty: '3' }] },
      { type: 'body', metatype: BodyDto, data: undefined },
    )) as BodyDto;
    expect(out).toBeInstanceOf(BodyDto);
    expect(out.lines[0]).toBeInstanceOf(LineDto);
    expect(out.lines[0].qty).toBe(3);
  });
});
