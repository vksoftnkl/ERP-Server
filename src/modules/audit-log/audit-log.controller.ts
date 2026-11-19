import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Header, Query, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { AuditLogErrorResponseDto, AuditLogSuccessListDto } from './dto/audit-log-response.dto';
import { AuditLogAccessService } from './audit-log-access.service';
import { AuditLogService } from './audit-log.service';
import {
  AuditLogListItem,
  AuditLogListMeta,
  AuditLogSuccessResponse,
} from './types/audit-log-api.types';
import { API_VERSION } from '../../common/constants/api-version';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
// What a caller may read depends on its rights now (review list 11-19 step 3): the HTTP
// cache keys on the URL alone, so a cached answer would reach a user without them.
@CacheTTL(0)
@Controller(['audit-logs', 'audit-log'])
export class AuditLogController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly auditLogAccessService: AuditLogAccessService,
  ) {}

  @Get('list')
  @Version(API_VERSION)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List audit logs with search and date filters',
    description:
      'Rights (user_menus.um_can_view, no SUPER ADMIN bypass): a History call (screen_id or ' +
      "screen_name + record_pk) needs View on that screen's menu (any one of its menus when it " +
      'has several); the Audit Logs report (no record_pk) needs View on Audit Logs (menu 106) ' +
      "and, when it names a screen, on that screen's menu; across all screens it lists only " +
      'the screens the caller holds View on. A screen no menu shows is read by an ADMIN or ' +
      'SUPER ADMIN only. Refusal: 403 AUDIT_LOG_RIGHT_VIEW (field userId).',
  })
  @ApiOkResponse({ type: AuditLogSuccessListDto })
  @ApiBadRequestResponse({ type: AuditLogErrorResponseDto })
  @ApiForbiddenResponse({
    type: AuditLogErrorResponseDto,
    description: 'AUDIT_LOG_RIGHT_VIEW — no View right on the screen’s menu / on Audit Logs',
  })
  async list(
    @Query() queryDto: ListAuditLogQueryDto,
  ): Promise<AuditLogSuccessResponse<AuditLogListItem[], AuditLogListMeta>> {
    const scope = await this.auditLogAccessService.resolveReadScope(queryDto);
    const result = await this.auditLogService.list(queryDto, scope);

    return {
      success: true,
      message: 'Audit logs fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
}
