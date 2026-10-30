import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  BranchMasterErrorDetail,
  BranchMasterErrorResponse,
} from './types/branch-master-api.types';

@Catch()
export class BranchMasterExceptionFilter extends SettingsExceptionFilter<
  BranchMasterErrorDetail,
  BranchMasterErrorResponse
> {
  constructor() {
    super(/\b(br[A-Za-z0-9]+|compId)\b/);
  }
}
