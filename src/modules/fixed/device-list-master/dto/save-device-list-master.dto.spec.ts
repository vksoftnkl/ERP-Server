import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DevicePlatform, DeviceType } from '../types/device-list-master-enum';
import { SaveDeviceListMasterDto } from './save-device-list-master.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fc02';

const erroredFields = (plain: object): string[] =>
  validateSync(plainToInstance(SaveDeviceListMasterDto, plain)).map((error) => error.property);

describe('SaveDeviceListMasterDto', () => {
  it('requires devDeviceUid when the type is left out, since that means Desktop', () => {
    const [error] = validateSync(plainToInstance(SaveDeviceListMasterDto, {}));

    expect(error.property).toBe('devDeviceUid');
    expect(Object.values(error.constraints ?? {})).toContain(
      'devDeviceUid is required when devDeviceType is Desktop',
    );
  });

  it('requires devDeviceUid on a Desktop device', () => {
    expect(erroredFields({ devDeviceType: DeviceType.DESKTOP, devDeviceUid: '' })).toEqual([
      'devDeviceUid',
    ]);
  });

  it.each([DeviceType.MOBILE, DeviceType.WEB])('lets a %s device leave the uid out', (type) => {
    expect(erroredFields({ devDeviceType: type })).toEqual([]);
  });

  it('accepts a full Desktop device', () => {
    expect(
      erroredFields({
        devCompanyId: COMPANY_ID,
        devDeviceUid: 'DESK-0001',
        devDeviceType: DeviceType.DESKTOP,
        devPlatform: DevicePlatform.WINDOWS,
        devIsBlocked: false,
      }),
    ).toEqual([]);
  });

  it('refuses a device type outside the enum', () => {
    expect(erroredFields({ devDeviceType: 'Tablet', devDeviceUid: 'T-1' })).toEqual([
      'devDeviceType',
    ]);
  });

  it('refuses a platform outside the enum but lets it be null', () => {
    expect(erroredFields({ devDeviceUid: 'D-1', devPlatform: 'BeOS' })).toEqual(['devPlatform']);
    expect(erroredFields({ devDeviceUid: 'D-1', devPlatform: null })).toEqual([]);
  });

  it('refuses a company id that is not a uuid', () => {
    expect(erroredFields({ devDeviceUid: 'D-1', devCompanyId: 'company-1' })).toEqual([
      'devCompanyId',
    ]);
  });
});
