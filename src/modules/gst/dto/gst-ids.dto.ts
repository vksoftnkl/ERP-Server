import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';

/** `gpvId` of /gst/providers/get (query), /delete and /restore (body). */
export class GstProviderIdDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  gpvId!: string;
}

/** `gpsId` of /gst/provider-services/delete. */
export class GstProviderServiceIdDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  gpsId!: string;
}

/** `gpeId` of /gst/provider-endpoints/get (query) and /delete (body). */
export class GstProviderEndpointIdDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  gpeId!: string;
}

/** `gfmId` of /gst/provider-field-maps/delete. */
export class GstProviderFieldMapIdDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  gfmId!: string;
}

/** `gemId` of /gst/provider-error-maps/delete. */
export class GstProviderErrorMapIdDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  gemId!: string;
}

/** `gpaId` of /gst/provider-accounts/get (query) and /delete (body). */
export class GstProviderAccountIdDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  gpaId!: string;
}

/** `gccId` of /gst/company-credentials/get, /status (query), /delete, /restore, /verify (body). */
export class GstCompanyCredentialIdDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  gccId!: string;
}
