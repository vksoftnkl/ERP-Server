import { Global, Module } from '@nestjs/common';
import { ConfiguredGridSqlService } from './configured-grid-sql.service';
import { ConfiguredGridSqlController } from './configured-grid-sql.controller';
@Global()
@Module({
  controllers: [ConfiguredGridSqlController],
  providers: [ConfiguredGridSqlService],
  exports: [ConfiguredGridSqlService],
})
export class ConfiguredGridSqlModule {}