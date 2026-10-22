import { BadRequestException, Type } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import {
  GstCompanyCredentialIdDto,
  GstProviderAccountIdDto,
  GstProviderEndpointIdDto,
  GstProviderErrorMapIdDto,
  GstProviderFieldMapIdDto,
  GstProviderIdDto,
  GstProviderServiceIdDto,
} from './gst-ids.dto';

const ID = '019c6f6c-be87-7a11-8905-36092c46e701';
const pipe = createHouseValidationPipe();

async function refusedFields(metatype: Type<unknown>, plain: object): Promise<string[]> {
  try {
    await pipe.transform(plain, { type: 'body', metatype });
    return [];
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    return (error.getResponse() as { errors: { field: string }[] }).errors.map((e) => e.field);
  }
}

describe('gst id DTOs', () => {
  it.each([
    ['GstProviderIdDto', GstProviderIdDto, 'gpvId'],
    ['GstProviderServiceIdDto', GstProviderServiceIdDto, 'gpsId'],
    ['GstProviderEndpointIdDto', GstProviderEndpointIdDto, 'gpeId'],
    ['GstProviderFieldMapIdDto', GstProviderFieldMapIdDto, 'gfmId'],
    ['GstProviderErrorMapIdDto', GstProviderErrorMapIdDto, 'gemId'],
    ['GstProviderAccountIdDto', GstProviderAccountIdDto, 'gpaId'],
    ['GstCompanyCredentialIdDto', GstCompanyCredentialIdDto, 'gccId'],
  ] as const)(
    '%s takes a uuid in %s, trimmed, and nothing else',
    async (_name, metatype, field) => {
      await expect(
        pipe.transform({ [field]: ` ${ID} ` }, { type: 'body', metatype }),
      ).resolves.toMatchObject({ [field]: ID });
      await expect(refusedFields(metatype, {})).resolves.toEqual([field]);
      await expect(refusedFields(metatype, { [field]: '' })).resolves.toEqual([field]);
      await expect(refusedFields(metatype, { [field]: 'NIC' })).resolves.toEqual([field]);
      await expect(refusedFields(metatype, { [field]: ID, extra: 1 })).resolves.toEqual(['extra']);
    },
  );
});
