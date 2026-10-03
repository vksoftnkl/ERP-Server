import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { GstAuthService } from './client/gst-auth.service';
import { GstHttpClient } from './client/gst-http.client';
import { GstCompanyCredentialService } from './config/gst-company-credential.service';
import { GstConfigSupport } from './config/gst-config.support';
import { GstCryptoService } from './config/gst-crypto.service';
import { GstProviderAccountService } from './config/gst-provider-account.service';
import { GstProviderPartsService } from './config/gst-provider-parts.service';
import { GstProviderService } from './config/gst-provider.service';
import { GstCompanyCredentialController } from './controllers/gst-company-credential.controller';
import { GstProviderAccountController } from './controllers/gst-provider-account.controller';
import {
  GstProviderEndpointController,
  GstProviderErrorMapController,
  GstProviderFieldMapController,
  GstProviderServiceController,
} from './controllers/gst-provider-parts.controllers';
import { GstProviderController } from './controllers/gst-provider.controller';
import { GstExceptionFilter } from './gst-exception.filter';

/**
 * The GSP layer (plan-backend-gsp.md §1), first slice: the config routes the
 * GST Providers / GST Credentials screens call (notes 79 R1–R9). Document
 * routes, the worker and the payload builders are later phases.
 */
@Module({
  imports: [AuditLogModule],
  controllers: [
    GstProviderController,
    GstProviderServiceController,
    GstProviderEndpointController,
    GstProviderFieldMapController,
    GstProviderErrorMapController,
    GstProviderAccountController,
    GstCompanyCredentialController,
  ],
  providers: [
    GstCryptoService,
    GstConfigSupport,
    GstProviderService,
    GstProviderPartsService,
    GstProviderAccountService,
    GstCompanyCredentialService,
    GstHttpClient,
    GstAuthService,
    GstExceptionFilter,
  ],
  exports: [GstCryptoService, GstAuthService, GstHttpClient],
})
export class GstModule {}
