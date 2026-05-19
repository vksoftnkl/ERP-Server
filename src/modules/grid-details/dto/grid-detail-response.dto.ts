import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ModuleErrorFieldDto,
  ModuleErrorResponseDto,
  ModuleListMetaDto,
} from '../../../common/utils/module-response.dto';

export {
  ModuleErrorFieldDto as GridDetailErrorFieldDto,
  ModuleErrorResponseDto as GridDetailErrorResponseDto,
  ModuleListMetaDto as GridDetailListMetaDto,
};

export class GridDetailPayloadDto {
  @ApiProperty({ example: '1' })
  grid_id!: string;

  @ApiProperty()
  grid_name!: string;

  @ApiPropertyOptional({ nullable: true })
  grid_description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_sort_column!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_sort_order!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_sql!: string | null;

  @ApiProperty()
  grid_status!: boolean;

  @ApiProperty()
  grid_is_deleted!: boolean;
}

export class GridDetailDeleteResultDto {
  @ApiProperty({ example: '1' })
  grid_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class GridDetailSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid details fetched successfully' })
  message!: string;

  @ApiProperty({ type: GridDetailPayloadDto })
  data!: GridDetailPayloadDto;
}

export class GridDetailSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid details fetched successfully' })
  message!: string;

  @ApiProperty({ type: GridDetailPayloadDto, isArray: true })
  data!: GridDetailPayloadDto[];

  @ApiProperty({ type: ModuleListMetaDto })
  meta!: ModuleListMetaDto;
}

export class GridDetailSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid details deleted successfully' })
  message!: string;

  @ApiProperty({ type: GridDetailDeleteResultDto })
  data!: GridDetailDeleteResultDto;
}
