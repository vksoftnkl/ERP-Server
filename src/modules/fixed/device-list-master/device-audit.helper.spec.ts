import { deviceAuditDisplayName, deviceSaveNotes } from './device-audit.helper';

describe('device audit helper (review list 11-19, 239.9)', () => {
  it('names the device by its name, else its code, else its uid', () => {
    expect(
      deviceAuditDisplayName({ devDeviceName: ' Counter 1 ', devCode: 'D1', devDeviceUid: 'U' }),
    ).toBe('Counter 1');
    expect(deviceAuditDisplayName({ devDeviceName: '', devCode: 'D1', devDeviceUid: 'U' })).toBe(
      'D1',
    );
    expect(deviceAuditDisplayName({ devDeviceName: null, devCode: null, devDeviceUid: 'U' })).toBe(
      'U',
    );
  });

  it('notes block / unblock and active / inactive, with the block reason', () => {
    const on = { devIsBlocked: false, devBlockReason: null, devIsActive: true };
    expect(deviceSaveNotes('Device updated', on, on)).toBe('Device updated');
    expect(
      deviceSaveNotes('Device updated', on, {
        ...on,
        devIsBlocked: true,
        devBlockReason: 'Stolen',
      }),
    ).toBe('Device updated; device blocked: Stolen');
    expect(
      deviceSaveNotes(
        'Device updated',
        { ...on, devIsBlocked: true, devIsActive: false },
        { ...on, devIsBlocked: false, devIsActive: true },
      ),
    ).toBe('Device updated; device unblocked; device made active');
    expect(deviceSaveNotes('Device updated', on, { ...on, devIsActive: false })).toBe(
      'Device updated; device made inactive',
    );
  });
});
