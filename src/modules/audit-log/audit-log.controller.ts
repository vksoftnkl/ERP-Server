import { Controller, Get, Query, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { AuditLogErrorResponseDto, AuditLogSuccessListDto } from './dto/audit-log-response.dto';
import { AuditLogService } from './audit-log.service';
import {
  AuditLogListItem,
  AuditLogListMeta,
  AuditLogSuccessResponse,
} from './types/audit-log-api.types';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List audit logs with search and date filters' })
  @ApiOkResponse({ type: AuditLogSuccessListDto })
  @ApiBadRequestResponse({ type: AuditLogErrorResponseDto })
  async list(
    @Query() queryDto: ListAuditLogQueryDto,
  ): Promise<AuditLogSuccessResponse<AuditLogListItem[], AuditLogListMeta>> {
    const result = await this.auditLogService.list(queryDto);

    return {
      success: true,
      message: 'Audit logs fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
}
