import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { SaveAppSettingValueDto } from './save-app-setting-value.dto';

/**
 * The write payload — a non-empty ARRAY of overrides, always, even for one.
 *
 * A settings screen saves a page of boxes rather than one box, and the array is
 * ONE transaction: if any entry is refused, none of them are written, so a page
 * can never be left half-applied with the client unable to say which half took.
 *
 * Every entry follows the single-override rules: no `asvId` upserts on the
 * scope target, `asvId` edits that row in place. Errors name the entry they
 * came from — `data[2].asvValue` — so the screen can put the message on the box
 * that caused it.
 */
export class SaveBulkAppSettingValueDto {
  @ApiProperty({ type: SaveAppSettingValueDto, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SaveAppSettingValueDto)
  data!: SaveAppSettingValueDto[];
}
