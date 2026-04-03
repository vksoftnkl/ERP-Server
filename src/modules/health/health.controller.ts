import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, ServiceUnavailableException, Version } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@CacheTTL(0)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Get API health status' })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ type: HttpErrorResponseDto })
  async getHealth(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    database: { status: 'up' | 'down' };
    cache: { status: 'up' | 'down' | 'disabled' };
  }> {
    const status = await this.healthService.check();

    if (status.database.status === 'down' || status.cache.status === 'down') {
      throw new ServiceUnavailableException(status);
    }

    return status;
  }
}
