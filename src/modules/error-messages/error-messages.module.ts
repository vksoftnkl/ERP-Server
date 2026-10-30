import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ErrorMessagesController } from './error-messages.controller';
import { ErrorMessageService } from './error-messages.service';
import { ErrorWordingInterceptor } from './error-wording.interceptor';

/**
 * Notes 120 — the plain error wording on the server: fixed.error_message in
 * memory (ErrorMessageService, read by every exception filter through
 * common/error-wording), GET /error-messages for the apps, and the wording of
 * `warnings[]` / `refusals[]` on success bodies (ErrorWordingInterceptor).
 */
@Module({
  controllers: [ErrorMessagesController],
  providers: [ErrorMessageService, { provide: APP_INTERCEPTOR, useClass: ErrorWordingInterceptor }],
  exports: [ErrorMessageService],
})
export class ErrorMessagesModule {}
