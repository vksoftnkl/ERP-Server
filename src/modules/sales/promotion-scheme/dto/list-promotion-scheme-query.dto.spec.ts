import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListPromotionSchemeQueryDto } from './list-promotion-scheme-query.dto';

/**
 * Query DTOs go through the same pipe main.ts installs — forbidNonWhitelisted
 * included, which is the whole reason the `company`/`branch` aliases have to be
 * declared properties rather than read straight off the query string.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const meta = { type: 'query' as const, metatype: ListPromotionSchemeQueryDto };

const COMPANY = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const BRANCH = '01963d86-caf0-7b26-89f0-58ac380a2d60';

const validate = (query: Record<string, unknown>): Promise<ListPromotionSchemeQueryDto> =>
  pipe.transform(query, meta) as Promise<ListPromotionSchemeQueryDto>;

/** The field messages live on the exception response, not on `error.message`. */
const messagesFrom = async (query: Record<string, unknown>): Promise<string[]> => {
  try {
    await validate(query);
  } catch (error) {
    const response = (error as BadRequestException).getResponse() as { message?: string[] };
    return response.message ?? [];
  }
  throw new Error('expected the query to be rejected');
};

describe('ListPromotionSchemeQueryDto', () => {
  it('accepts the canonical prm_ spellings', async () => {
    const dto = await validate({ prm_comp_id: COMPANY, prm_branch_id: BRANCH });

    expect(dto.prm_comp_id).toBe(COMPANY);
    expect(dto.prm_branch_id).toBe(BRANCH);
  });

  it('accepts company and branch as aliases', async () => {
    const dto = await validate({ company: COMPANY, branch: BRANCH });

    expect(dto.prm_comp_id).toBe(COMPANY);
    expect(dto.prm_branch_id).toBe(BRANCH);
  });

  it('leaves prm_branch_id undefined when no branch is sent', async () => {
    const dto = await validate({ company: COMPANY });

    expect(dto.prm_comp_id).toBe(COMPANY);
    expect(dto.prm_branch_id).toBeUndefined();
  });

  it('accepts a branch with no company', async () => {
    const dto = await validate({ branch: BRANCH });

    expect(dto.prm_comp_id).toBeUndefined();
    expect(dto.prm_branch_id).toBe(BRANCH);
  });

  it('accepts an empty query — both params are optional', async () => {
    const dto = await validate({});

    expect(dto.prm_comp_id).toBeUndefined();
    expect(dto.prm_branch_id).toBeUndefined();
  });

  it('still rejects a company that is sent but is not a uuid', async () => {
    await expect(messagesFrom({ company: 'not-a-uuid' })).resolves.toContain(
      'prm_comp_id must be a valid UUID',
    );
  });
});
