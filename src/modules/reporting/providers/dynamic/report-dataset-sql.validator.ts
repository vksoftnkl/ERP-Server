import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfiguredGridSqlService } from '../../../../common/configured-grid-sql/configured-grid-sql.service';
import {
  DATASET_PARAM_NAME_PATTERN,
  MANDATORY_SCOPE_PARAM,
  RESERVED_DATASET_PARAMS,
  ReportDatasetParamSpec,
  isReservedDatasetParam,
} from './report-dataset.types';

/**
 * The gate every runtime dataset passes before it is stored.
 *
 * Three layers, and it is worth being explicit about which one does what,
 * because only the first is unique to reporting:
 *
 *   1. SCOPE (here)      the SQL must reference p_company_id, and every p_*
 *                        token in it must be reserved or declared.
 *   2. SHAPE (delegated) SELECT-only, single statement, no comments, no DDL,
 *                        no positional params — ConfiguredGridSqlService, the
 *                        same rules the configured grids already run under.
 *   3. EXECUTION         PgService.queryReadOnly: a dedicated read-only role
 *                        where configured, and default_transaction_read_only
 *                        in every case, so anything that slips past 1 and 2
 *                        is still refused by Postgres itself.
 *
 * Layer 1 is the one that replaces a human. In a compiled provider a developer
 * guaranteed the company predicate by writing it; a stored query can simply
 * omit it, and the omission is invisible until a customer sees another
 * company's figures. Requiring the token does not prove the predicate is
 * CORRECT — `WHERE 1 = 1 OR x = p_company_id` would pass — which is why the
 * authoring permission is vendor-only and why RLS on the read-only role is the
 * right next hardening step.
 */

/** Tokens must be namespaced so a runtime dataset can never shadow a compiled one. */
export const DYNAMIC_TOKEN_PREFIX = 'custom.';
const TOKEN_PATTERN = /^custom\.[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/** Any `p_*` word in the SQL, quoted or bare. */
const PARAM_TOKEN_PATTERN = /'?\b(p_[a-z0-9]+(?:_[a-z0-9]+)*)\b'?/gi;

export interface ValidateDatasetSqlOptions {
  readonly sql: string;
  readonly params: readonly ReportDatasetParamSpec[];
}

export interface ValidatedDatasetSql {
  readonly normalizedSql: string;
  readonly reservedParamsUsed: string[];
  readonly declaredParamsUsed: string[];
}

@Injectable()
export class ReportDatasetSqlValidator {
  constructor(private readonly configuredGridSql: ConfiguredGridSqlService) {}

  /** Token namespace. Rejected early because it is the cheapest check. */
  assertValidToken(token: string): void {
    if (!TOKEN_PATTERN.test(token)) {
      throw new BadRequestException(
        `Dataset token '${token}' is invalid. Runtime datasets must be namespaced ` +
          `'${DYNAMIC_TOKEN_PREFIX}<name>' in lowercase, e.g. 'custom.sales.daybook'. ` +
          'The prefix is what guarantees a runtime dataset can never shadow a compiled provider.',
      );
    }
  }

  assertValidParamSpecs(params: readonly ReportDatasetParamSpec[]): void {
    const seen = new Set<string>();

    for (const param of params) {
      if (!DATASET_PARAM_NAME_PATTERN.test(param.name)) {
        throw new BadRequestException(
          `Parameter '${param.name}' is invalid. Names must be lowercase snake_case ` +
            "beginning 'p_', e.g. 'p_party_id'.",
        );
      }
      if (isReservedDatasetParam(param.name)) {
        throw new BadRequestException(
          `Parameter '${param.name}' is reserved and bound from the request context ` +
            'automatically. Remove it from the declared parameters — declaring it would ' +
            'let a caller supply the value, which is exactly what must not be possible.',
        );
      }
      if (seen.has(param.name)) {
        throw new BadRequestException(`Parameter '${param.name}' is declared more than once`);
      }
      seen.add(param.name);
    }
  }

  /**
   * Validate the SQL body and reconcile its tokens against the declared params.
   *
   * The reconciliation is bidirectional on purpose. An UNDECLARED token is the
   * dangerous direction: it binds nothing, so it survives into the query as a
   * bare identifier and either errors or — worse, behind a cast — matches
   * nothing and prints an empty statement. An UNUSED declaration is merely
   * dead config, but it is almost always the same typo seen from the other
   * end, so it is reported too rather than trimmed silently.
   */
  validate(options: ValidateDatasetSqlOptions): ValidatedDatasetSql {
    const shape = this.configuredGridSql.validateBaseSql({ sql: options.sql });
    if (!shape.isValid) {
      throw new BadRequestException(shape.message);
    }

    const normalizedSql = shape.normalizedSql;
    const tokensInSql = this.extractParamTokens(normalizedSql);

    if (!tokensInSql.has(MANDATORY_SCOPE_PARAM)) {
      throw new BadRequestException(
        `Dataset SQL must reference the ${MANDATORY_SCOPE_PARAM} token — it is what scopes ` +
          'the query to the printing company. Add it to the WHERE clause, e.g. ' +
          '`WHERE sb_company_id = p_company_id`.',
      );
    }

    const declaredNames = new Set(options.params.map((param) => param.name));
    const reservedParamsUsed: string[] = [];
    const declaredParamsUsed: string[] = [];
    const undeclared: string[] = [];

    for (const token of tokensInSql) {
      if (isReservedDatasetParam(token)) {
        reservedParamsUsed.push(token);
      } else if (declaredNames.has(token)) {
        declaredParamsUsed.push(token);
      } else {
        undeclared.push(token);
      }
    }

    if (undeclared.length > 0) {
      throw new BadRequestException(
        `Undeclared parameter token(s) in dataset SQL: ${undeclared.sort().join(', ')}. ` +
          `Declare them, or correct the spelling. Reserved tokens are: ` +
          `${Object.keys(RESERVED_DATASET_PARAMS).join(', ')}.`,
      );
    }

    const unused = [...declaredNames].filter((name) => !tokensInSql.has(name));
    if (unused.length > 0) {
      throw new BadRequestException(
        `Declared parameter(s) never used in the SQL: ${unused.sort().join(', ')}. ` +
          'A parameter that appears nowhere binds nothing — this is usually a spelling ' +
          'mismatch with the token in the query.',
      );
    }

    return {
      normalizedSql,
      reservedParamsUsed: reservedParamsUsed.sort(),
      declaredParamsUsed: declaredParamsUsed.sort(),
    };
  }

  private extractParamTokens(sql: string): Set<string> {
    const tokens = new Set<string>();
    // A fresh regex per call — PARAM_TOKEN_PATTERN is /g and carries lastIndex.
    const pattern = new RegExp(PARAM_TOKEN_PATTERN.source, PARAM_TOKEN_PATTERN.flags);
    let match = pattern.exec(sql);
    while (match !== null) {
      tokens.add(match[1].toLowerCase());
      match = pattern.exec(sql);
    }
    return tokens;
  }
}
