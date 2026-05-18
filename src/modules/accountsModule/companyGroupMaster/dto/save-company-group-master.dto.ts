import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalBoolean, OptionalUuid, TrimmedString } from 'src/common/dto/dtoDecorators';

const toUniqueStringArray = (value: unknown): string[] => {
  const toDistinct = (input: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of input) {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return out;
  };

  if (Array.isArray(value)) {
    const normalized = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return toDistinct(normalized);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        return toDistinct(normalized);
      }
    } catch {
      // Fall back to CSV parsing.
    }

    return toDistinct(
      trimmed
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    );
  }

  return [];
};

export class SaveCompanyGroupMasterDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'When provided, request updates the group' })
  @OptionalUuid()
  cogGroupId?: string;

  @ApiProperty({ maxLength: 80 })
  @TrimmedString(80)
  @IsNotEmpty()
  cogGroupName!: string;

  @ApiProperty({ type: [String], description: 'UUID list of company ids mapped to group' })
  @Transform(({ value }) => toUniqueStringArray(value))
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  cogCompanyIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @OptionalBoolean()
  cogIsActive?: boolean;
}
