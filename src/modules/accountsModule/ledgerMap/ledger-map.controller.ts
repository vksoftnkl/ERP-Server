import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import {
  LedgerMapErrorResponseDto,
  LedgerMapRolesSuccessDto,
  LedgerMapSuccessDeleteDto,
  LedgerMapSuccessSingleDto,
} from './dto/ledger-map-response.dto';
import { DeleteLedgerMapQueryDto, SaveLedgerMapDto } from './dto/save-ledger-map.dto';
import { LedgerMapExceptionFilter } from './ledger-map-exception.filter';
import { LedgerMapService } from './ledger-map.service';
import type {
  LedgerMapDeletePayload,
  LedgerMapRolePayload,
  LedgerMapSuccessResponse,
} from './types/ledger-map-api.types';

/**
 * Role -> ledger: where every posting engine looks up the account a
 * DISCOUNT_ALLOWED, an OUTPUT_CGST or a ROUND_OFF lands in.
 *
 * Three routes, and no list route: grid 106 (SETUP - POSTING LEDGER MAP) is
 * already registered and the client reads lists through
 * `/configured-grid-sql/run` like every other screen. `/roles` is not that
 * list — it is the CATALOGUE, joined to the mappings, so a role with nothing
 * against it is shown as loudly as a mapped one. A grid over acc_ledger_map
 * cannot show a row that does not exist.
 *
 * The scope is the SHARED set: one ledger per role, the same for every company
 * and branch. The schema allows a scoped override and fn_ledger_for already
 * prefers one; this API deliberately does not open that door until somebody
 * needs it.
 */
@ApiTags('Posting Ledger Map')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('ledger-map')
@UseFilters(LedgerMapExceptionFilter)
export class LedgerMapController {
  constructor(private readonly ledgerMapService: LedgerMapService) {}

  @Get('roles')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Every posting role, with the ledger it resolves to — or with nothing',
    description:
      'The server owns this list, not the client. A role with no mapping comes back with ' +
      'ledgerId null, which is the case the setup screen exists to show; expectedLedgerType is ' +
      'the filter the ledger picker should apply, and usedBy names the documents that post it.',
  })
  @ApiOkResponse({ type: LedgerMapRolesSuccessDto })
  async listRoles(): Promise<LedgerMapSuccessResponse<LedgerMapRolePayload[]>> {
    const data = await this.ledgerMapService.listRoles();

    return {
      success: true,
      message: 'Posting roles fetched successfully',
      data,
    };
  }

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Map a role to a ledger, or re-point an existing mapping (by almId presence)',
    description:
      'Refuses a role the catalogue does not know, a ledger that does not exist, a deleted or ' +
      'inactive ledger, a ledger of the wrong type for the role, and a second mapping for a role ' +
      'that already has one. almCompanyId / almBranchId / almSupplyNature are not accepted.',
  })
  @ApiCreatedResponse({ type: LedgerMapSuccessSingleDto })
  @ApiBadRequestResponse({ type: LedgerMapErrorResponseDto })
  @ApiConflictResponse({ type: LedgerMapErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerMapErrorResponseDto })
  async save(
    @Body() saveLedgerMapDto: SaveLedgerMapDto,
  ): Promise<LedgerMapSuccessResponse<LedgerMapRolePayload>> {
    const data = await this.ledgerMapService.save(saveLedgerMapDto);

    return {
      success: true,
      message: saveLedgerMapDto.almId
        ? 'Posting ledger mapping updated successfully'
        : 'Posting ledger mapped successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Remove a mapping — refused while a deployed engine still posts that role',
    description:
      'Soft delete. An unmapped role is not a blank screen, it is a posting that fails at the ' +
      'moment money is being taken, so a role any document resolves is refused with those ' +
      'documents named. A role nothing posts yet may be unmapped freely.',
  })
  @ApiOkResponse({ type: LedgerMapSuccessDeleteDto })
  @ApiBadRequestResponse({ type: LedgerMapErrorResponseDto })
  @ApiConflictResponse({ type: LedgerMapErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerMapErrorResponseDto })
  async remove(
    @Query() query: DeleteLedgerMapQueryDto,
  ): Promise<LedgerMapSuccessResponse<LedgerMapDeletePayload>> {
    const data = await this.ledgerMapService.softDelete(query.almId);

    return {
      success: true,
      message: 'Posting ledger mapping removed successfully',
      data,
    };
  }
}
