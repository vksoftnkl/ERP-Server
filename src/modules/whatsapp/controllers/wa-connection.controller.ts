import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { WaActivateDto, WaCompanyDto, WaDisconnectDto, WaSettingsSaveDto, WaTestDto } from '../dto/wa.dto';
import { WaConnectionService } from '../wa-connection.service';
import { WaExceptionFilter } from '../wa-exception.filter';
import { WaSettingsService } from '../wa-settings.service';
import { WaStore } from '../wa-store.service';
import { WA_MENU } from '../wa.constants';

const ok = <T>(message: string, data: T) => ({ success: true as const, message, data });

/** Plan §5.3 "307: connection and settings" — /api/v1/whatsapp/connection/* and /settings/*. */
@ApiTags('WhatsApp')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('whatsapp')
@UseFilters(WaExceptionFilter)
export class WaConnectionController {
  constructor(
    private readonly connection: WaConnectionService,
    private readonly settings: WaSettingsService,
    private readonly store: WaStore,
  ) {}

  @Get('connection/get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'The company\'s WhatsApp link (307 View): state NOT_ACTIVATED | ACTIVATED | CONNECTING | CONNECTED | DISCONNECTED | ' +
      'SUSPENDED, shop, key prefix, number, quality, limit, usedToday, last poll, relayReachable, templates[]. 403 WA_RIGHT_VIEW.',
  })
  async get(@Query() q: WaCompanyDto) {
    return ok('WhatsApp connection', await this.connection.get(q.companyId));
  }

  @Post('connection/activate')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      "Activate with VK's code (307 Edit) → { state, shopCode, keyPrefix }. 404 LOOKUP_COMPANY_NOT_FOUND; 422 WA_ACTIVATION_INVALID; 409 WA_ALREADY_ACTIVATED " +
      '(send replace: true for a re-key code); 503 WA_KEY_MISSING / WA_RELAY_NOT_SET / WA_RELAY_UNREACHABLE; 409 WA_SITE_OFFLINE.',
  })
  async activate(@Body() dto: WaActivateDto) {
    return ok('WhatsApp activated', await this.connection.activate(dto));
  }

  @Post('connection/connect-start')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'A 15-minute link to the Embedded Signup page (307 Edit) → { connectUrl, expiresAt }; state CONNECTING. ' +
      '409 WA_NOT_ACTIVATED / WA_ALREADY_CONNECTED / WA_SHOP_SUSPENDED / WA_KEY_REVOKED.',
  })
  async connectStart(@Body() dto: WaCompanyDto) {
    return ok('Open the link in the browser to connect the number', await this.connection.connectStart(dto));
  }

  @Post('connection/refresh')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Pull the connection and events from the relay now (307 View); answers as /connection/get.' })
  async refresh(@Body() dto: WaCompanyDto) {
    return ok('WhatsApp connection refreshed', await this.connection.refresh(dto));
  }

  @Post('connection/disconnect')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Disconnect the number (307 Edit) → { state: DISCONNECTED }. 409 WA_NOT_CONNECTED.' })
  async disconnect(@Body() dto: WaDisconnectDto) {
    return ok('WhatsApp disconnected', await this.connection.disconnect(dto));
  }

  @Post('connection/rotate-key')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'A new relay key (307 Edit) → { keyPrefix, rotatedOn, oldKeyValidUntil }.' })
  async rotateKey(@Body() dto: WaCompanyDto) {
    return ok('WhatsApp key rotated', await this.connection.rotateKey(dto));
  }

  @Post('connection/test')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Send hello_world to a number (307 View) → { wmlId, accYear, status, phone, phoneSource, templateName, lang, langNote, ' +
      'errorCode, errorText }. A relay / Meta failure is status FAILED with its code (200); 400 WA_BAD_NUMBER; 409 WA_NOT_CONNECTED.',
  })
  async test(@Body() dto: WaTestDto) {
    return ok('WhatsApp test sent', await this.connection.test(dto));
  }

  @Get('settings/get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'The whatsapp.* company settings + onPostTypes[{ vchrTypeId, vchrTypeName, vchrParentId, kind, templateName, on }] (307 View).',
  })
  async settingsGet(@Query() q: WaCompanyDto) {
    await this.store.right(WA_MENU.WHATSAPP, 'view', 'open WhatsApp settings');
    return ok('WhatsApp settings', await this.settings.get(q.companyId));
  }

  @Post('settings/save')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Save any of the settings and onPostTypes[{ vchrTypeId, on }] (307 Edit; the ticks are this company\'s ' +
      'whatsapp.on_post_types); answers as /settings/get. 400 WA_SETTING_INVALID (one per bad field, field = the key); ' +
      '409 WA_SITE_OFFLINE.',
  })
  async settingsSave(@Body() dto: WaSettingsSaveDto) {
    await this.store.right(WA_MENU.WHATSAPP, 'edit', 'change WhatsApp settings');
    this.store.assertMainServer();
    const { companyId, ...rest } = dto;
    return ok('WhatsApp settings saved', await this.settings.save(companyId, rest as Record<string, unknown>));
  }
}
