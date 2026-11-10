import {
  applyDecorators,
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { clientInfoOf } from '../../common/client-info/client-info';
import { API_VERSION } from '../../common/constants/api-version';
import { Public } from '../../common/decorators/public.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { AppUpdateInfoDto, CheckUpdateQueryDto } from './dto/check-update.dto';
import {
  CreateReleaseDto,
  ListReleasesQueryDto,
  ReleaseKeyParamsDto,
  ReleaseResponseDto,
  UpdateReleaseDto,
} from './dto/release.dto';
import {
  InstallationSummaryQueryDto,
  LegacyUsageQueryDto,
  ListInstallationsQueryDto,
} from './dto/support-query.dto';
import { OpsKeyGuard, opsActorOf } from './guards/ops-key.guard';
import { AppUpdateService } from './services/app-update.service';
import {
  ClientInstallationService,
  type InstallationRow,
  type PlatformInstallationSummary,
} from './services/client-installation.service';
import { LegacyUsageService, type LegacyUsageRow } from './services/legacy-usage.service';
import { AppVersionErrorCode, appVersionErrorBody } from './types/app-version-error-codes';

/** A release / support route: X-Ops-Key instead of a JWT (OpsKeyGuard). */
const OpsRoute = (): MethodDecorator =>
  applyDecorators(
    UseGuards(OpsKeyGuard),
    ApiHeader({ name: 'X-Ops-Key', required: true, description: 'Must equal env OPS_API_KEY' }),
    ApiHeader({
      name: 'X-Ops-Actor',
      required: false,
      description: 'Who is calling, e.g. ci:run-123; stamped into created_by / modified_by',
    }),
    ApiUnauthorizedResponse({
      type: HttpErrorResponseDto,
      description: 'APP_VERSION_OPS_KEY_INVALID',
    }),
    ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'APP_VERSION_OPS_DISABLED' }),
  );

/**
 * Part B Step 2: version tracking and the optional update notice.
 *
 * @Public() for the whole controller: /check must answer before login, and CI
 * holds no JWT. Every other route is guarded by the ops key instead. Nothing
 * here ever refuses a client because of its version. There is no 426 and no
 * minimum build.
 */
@ApiTags('App Version')
@Public()
@Controller('app-version')
export class AppVersionController {
  constructor(
    private readonly updates: AppUpdateService,
    private readonly installations: ClientInstallationService,
    private readonly legacyUsage: LegacyUsageService,
  ) {}

  @Get('check')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Is a newer build available? (public, read-only)',
    description:
      'platform and build come from the query, else from the X-App-Platform / X-App-Build headers.',
  })
  @ApiOkResponse({ type: AppUpdateInfoDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  check(@Query() query: CheckUpdateQueryDto, @Req() request: Request): Promise<AppUpdateInfoDto> {
    const client = clientInfoOf(request);
    const platform = query.platform ?? client.platform;
    const build = query.build ?? client.build;
    if (!platform) {
      throw new BadRequestException(
        appVersionErrorBody(
          'platform is required (?platform= or the X-App-Platform header)',
          'platform',
          AppVersionErrorCode.PLATFORM_REQUIRED,
        ),
      );
    }
    if (build === null || build === undefined) {
      throw new BadRequestException(
        appVersionErrorBody(
          'build is required (?build= or the X-App-Build header)',
          'build',
          AppVersionErrorCode.BUILD_REQUIRED,
        ),
      );
    }
    return this.updates.check(platform, build);
  }

  @Post('releases')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.CREATED)
  @OpsRoute()
  @ApiOperation({ summary: 'Register a released build (CI)' })
  @ApiCreatedResponse({ type: ReleaseResponseDto })
  @ApiConflictResponse({
    type: HttpErrorResponseDto,
    description: 'APP_RELEASE_BUILD_EXISTS | APP_RELEASE_BUILD_TOO_LOW',
  })
  createRelease(
    @Body() dto: CreateReleaseDto,
    @Req() request: Request,
  ): Promise<ReleaseResponseDto> {
    return this.updates.createRelease(dto, opsActorOf(request));
  }

  @Patch('releases/:platform/:build')
  @Version(API_VERSION)
  @OpsRoute()
  @ApiOperation({ summary: 'Change a release: severity, notes, link; isDeleted:true yanks it' })
  @ApiOkResponse({ type: ReleaseResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'APP_RELEASE_NOT_FOUND' })
  updateRelease(
    @Param() params: ReleaseKeyParamsDto,
    @Body() dto: UpdateReleaseDto,
    @Req() request: Request,
  ): Promise<ReleaseResponseDto> {
    return this.updates.updateRelease(params.platform, params.build, dto, opsActorOf(request));
  }

  @Get('releases')
  @Version(API_VERSION)
  @OpsRoute()
  @ApiOperation({ summary: 'Live releases, newest build first' })
  @ApiOkResponse({ type: ReleaseResponseDto, isArray: true })
  listReleases(@Query() query: ListReleasesQueryDto): Promise<ReleaseResponseDto[]> {
    return this.updates.listReleases(query.platform);
  }

  @Get('installations')
  @Version(API_VERSION)
  @OpsRoute()
  @ApiOperation({ summary: 'Which user / device runs which build, last seen first (support)' })
  listInstallations(
    @Query() query: ListInstallationsQueryDto,
  ): Promise<{ total: number; rows: InstallationRow[] }> {
    return this.installations.list(query);
  }

  @Get('installations/summary')
  @Version(API_VERSION)
  @OpsRoute()
  @ApiOperation({
    summary: 'Per platform: builds in use, the oldest active build, how many are behind (support)',
  })
  installationSummary(
    @Query() query: InstallationSummaryQueryDto,
  ): Promise<PlatformInstallationSummary[]> {
    return this.installations.summary(query);
  }

  @Get('legacy-usage')
  @Version(API_VERSION)
  @OpsRoute()
  @ApiOperation({ summary: 'How often each legacy field is still used, per build (support)' })
  legacyUsageList(@Query() query: LegacyUsageQueryDto): Promise<LegacyUsageRow[]> {
    return this.legacyUsage.list(query);
  }
}
