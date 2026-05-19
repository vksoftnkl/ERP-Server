import { Global, Module } from '@nestjs/common';
import { ConfiguredGridSqlService } from './configured-grid-sql.service';
@Global()
@Module({
  providers: [ConfiguredGridSqlService],
  exports: [ConfiguredGridSqlService],
})
export class ConfiguredGridSqlModule {}