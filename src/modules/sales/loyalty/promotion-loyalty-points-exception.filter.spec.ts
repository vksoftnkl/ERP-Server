import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PromotionLoyaltyPointsExceptionFilter } from './promotion-loyalty-points-exception.filter';

describe('PromotionLoyaltyPointsExceptionFilter', () => {
  let filter: PromotionLoyaltyPointsExceptionFilter;

  const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  const createHost = (response: ReturnType<typeof createResponse>) =>
    ({
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    }) as never;

  beforeEach(() => {
    filter = new PromotionLoyaltyPointsExceptionFilter();
  });

  it('passes through module-shaped error responses', () => {
    const response = createResponse();
    const exception = new BadRequestException({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'lsc_name', message: 'lsc_name is required' }],
    });

    filter.catch(exception, createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'lsc_name', message: 'lsc_name is required' }],
    });
  });

  it('maps validation payload arrays into field-based errors', () => {
    const response = createResponse();
    const exception = new BadRequestException({
      message: [
        'ls_end_date must be greater than or equal to ls_start_date',
        'gift_points must be greater than 0',
      ],
    });

    filter.catch(exception, createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'ls_end_date',
          message: 'ls_end_date must be greater than or equal to ls_start_date',
        },
        {
          field: 'gift_points',
          message: 'gift_points must be greater than 0',
        },
      ],
    });
  });

  it('returns a generic 500 payload for unexpected exceptions', () => {
    const response = createResponse();

    filter.catch(new Error('boom'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [],
    });
  });

  it('falls back to exception message when the HTTP response payload is not module-shaped', () => {
    const response = createResponse();
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not found',
      errors: [],
    });
  });
});
