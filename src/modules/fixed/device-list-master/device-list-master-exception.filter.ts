import { Catch } from '@nestjs/common';
import { FixedExceptionFilter } from '../utils/fixed-exception-filter.utils';
import {
  DeviceListMasterErrorDetail,
  DeviceListMasterErrorResponse,
} from './types/device-list-master-api.types';

@Catch()
export class DeviceListMasterExceptionFilter extends FixedExceptionFilter<
  DeviceListMasterErrorDetail,
  DeviceListMasterErrorResponse
> {
  constructor() {
    super(/\b(dev[A-Za-z0-9]+)\b/);
  }
}
