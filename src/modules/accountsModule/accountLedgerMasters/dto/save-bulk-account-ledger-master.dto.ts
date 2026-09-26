import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { SaveAccountLedgerMasterDto } from './save-account-ledger-master.dto';

/**
 * Bulk upsert: a non-empty array of ledgers. Each entry follows the same
 * create/update rules as the single save (create when `ledId` is absent, update
 * when present) and the whole batch is persisted in one transaction (all-or-nothing).
 */
export class SaveBulkAccountLedgerMasterDto {
  @ApiProperty({ type: SaveAccountLedgerMasterDto, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SaveAccountLedgerMasterDto)
  data!: SaveAccountLedgerMasterDto[];
}
