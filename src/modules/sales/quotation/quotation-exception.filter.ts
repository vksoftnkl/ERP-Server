import { Catch, ExceptionFilter, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class QuotationExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException) {
    throw exception;
  }
}
