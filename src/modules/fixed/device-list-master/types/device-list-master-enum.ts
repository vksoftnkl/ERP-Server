export enum DeviceType {
  DESKTOP = 'Desktop',
  MOBILE = 'Mobile',
  WEB = 'Web',
}
export enum DevicePlatform {
  WINDOWS = 'Windows',
  MACOS = 'macOS',
  LINUX = 'Linux',
  ANDROID = 'Android',
  IOS = 'iOS',
  OTHER = 'Other',
}
/**
 * Notes 119 / 127 §5 — every Device List Master refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps its
 * meaning forever: a new refusal gets a new member.
 */
export enum DeviceListMasterErrorCode {
  /** The device list grid is not configured in grid details. */
  GRID_NOT_CONFIGURED = 'DEVICE_GRID_NOT_CONFIGURED',
  /** No live device with that id — get, update, delete. */
  NOT_FOUND = 'DEVICE_NOT_FOUND',
  /** devDeviceType is not a string, or not one of the device types. */
  TYPE_INVALID = 'DEVICE_TYPE_INVALID',
  /** devPlatform is not a string, or not one of the platforms. */
  PLATFORM_INVALID = 'DEVICE_PLATFORM_INVALID',
  /** devDeviceUid is blank on a Desktop device. */
  UID_REQUIRED = 'DEVICE_UID_REQUIRED',
  /** Another live device of the company has this devDeviceUid (the check or the unique index). */
  UID_DUPLICATE = 'DEVICE_UID_DUPLICATE',
  /** Delete refused: login sessions still name the device. */
  IN_USE = 'DEVICE_IN_USE',
  /** Notes 160 C — another device (live or deleted) already holds this devCode, any case. */
  CODE_DUPLICATE = 'DEVICE_CODE_DUPLICATE',
}
