import { ModuleErrorDetail } from 'src/common/utils/module-service.utils';
import {
  PTV_CONTEXT_PARAMS,
  PTV_PARAM_NAME_PATTERN,
  PTV_PARAM_TYPES,
  PtvParamType,
} from '../../print-template/print-template.constants';
import { toScalarText } from './scalar-text';

/**
 * §3's operator prompts — `ptv_params` — checked against what the operator
 * actually answered.
 *
 * The declaration lives ON THE VERSION rather than on the dataset, and the
 * reason is worth repeating because it shapes this file: "The operator is asked
 * ONCE — if dataset 1 declared from_date as DATE required and dataset 3
 * declared it as TEXT optional there is no answer to what the screen should
 * ask — and print_log.plg_params is one jsonb object per render, not one per
 * dataset." So there is one set of answers per render, validated once, here,
 * and every dataset binds from the same map.
 *
 * ck_ptv_params_is_array only proves the column is an array. Everything about
 * an ENTRY — that it has a name, that its type is one of six — is this file's
 * to enforce, and it enforces it at RENDER as well as at save, because a
 * revision published by an older build is still expected to print.
 */

export interface ParamSpec {
  readonly name: string;
  readonly type: PtvParamType;
  readonly required: boolean;
  readonly label: string;
  readonly defaultValue: unknown;
}

export class RenderParamError extends Error {
  constructor(
    message: string,
    readonly details: ModuleErrorDetail[],
  ) {
    super(message);
    this.name = 'RenderParamError';
  }
}

/**
 * The declaration, read defensively.
 *
 * A malformed entry is DROPPED with an error rather than guessed at: an entry
 * with no name cannot be answered, and one with an unknown type has no
 * coercion, so binding it would mean sending PostgreSQL a value of a shape
 * nobody chose.
 */
export function readParamSpecs(raw: unknown): { specs: ParamSpec[]; errors: ModuleErrorDetail[] } {
  const errors: ModuleErrorDetail[] = [];
  const specs: ParamSpec[] = [];

  if (raw === null || raw === undefined) return { specs, errors };

  if (!Array.isArray(raw)) {
    errors.push({
      field: 'ptvParams',
      message: `ptvParams must be a JSON array of prompts; this revision holds ${typeof raw}.`,
    });
    return { specs, errors };
  }

  for (const [index, entry] of raw.entries()) {
    const path = `ptvParams[${index}]`;

    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      errors.push({ field: path, message: 'Each prompt must be an object.' });
      continue;
    }

    const record = entry as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';

    if (!PTV_PARAM_NAME_PATTERN.test(name)) {
      errors.push({
        field: `${path}.name`,
        message: `'${name}' is not a usable prompt name — lower case, starting with a letter, ${'letters, digits and underscores only'}.`,
      });
      continue;
    }

    // "Declaring one as a USER prompt is a mistake worth naming, because the
    // render would then ask the operator for something it already knows."
    if ((PTV_CONTEXT_PARAMS as readonly string[]).includes(name)) {
      errors.push({
        field: `${path}.name`,
        message:
          `'${name}' is a CONTEXT parameter the server already holds, not something to ask for. ` +
          `The closed set is ${PTV_CONTEXT_PARAMS.join(', ')} — remove this prompt; queries can ` +
          `bind :${name} without it.`,
      });
      continue;
    }

    const type = typeof record.type === 'string' ? record.type.toUpperCase() : 'TEXT';
    if (!(PTV_PARAM_TYPES as readonly string[]).includes(type)) {
      errors.push({
        field: `${path}.type`,
        message: `'${String(record.type)}' is not a prompt type. One of: ${PTV_PARAM_TYPES.join(', ')}.`,
      });
      continue;
    }

    specs.push({
      name,
      type: type as PtvParamType,
      required: record.required === true,
      label: typeof record.label === 'string' && record.label ? record.label : name,
      defaultValue: record.default ?? record.defaultValue ?? null,
    });
  }

  return { specs, errors };
}

/**
 * One prompt's answer, coerced to its declared type.
 *
 * Not cosmetic. A dataset filtering `sb_bill_date >= :from_date` with a JS Date
 * bound as a timestamp behaves differently from the same value as a date
 * string, and a numeric id arriving as text makes PostgreSQL pick a different
 * plan or refuse the comparison outright.
 */
function coerce(spec: ParamSpec, value: unknown, errors: ModuleErrorDetail[]): unknown {
  if (value === null || value === undefined || value === '') return null;

  switch (spec.type) {
    case 'NUMBER': {
      const parsed = typeof value === 'number' ? value : Number(toScalarText(value).trim());
      if (!Number.isFinite(parsed)) {
        errors.push({
          field: `params.${spec.name}`,
          message: `'${spec.label}' expects a number; got '${toScalarText(value)}'.`,
        });
        return null;
      }
      return parsed;
    }

    case 'BOOLEAN':
      return typeof value === 'boolean'
        ? value
        : /^(true|1|yes|y)$/i.test(toScalarText(value).trim());

    case 'DATE': {
      // The date's TEXT form is the whole value: a calendar date names no
      // instant, so parsing it into a Date only invites a timezone to move it.
      const text = toScalarText(value).trim();
      const iso = /^\d{4}-\d{2}-\d{2}/.exec(text);
      if (!iso) {
        errors.push({
          field: `params.${spec.name}`,
          message: `'${spec.label}' expects a date as YYYY-MM-DD; got '${text}'.`,
        });
        return null;
      }
      return iso[0];
    }

    case 'DATETIME': {
      const parsed = value instanceof Date ? value : new Date(toScalarText(value));
      if (Number.isNaN(parsed.getTime())) {
        errors.push({
          field: `params.${spec.name}`,
          message: `'${spec.label}' expects a date and time; got '${toScalarText(value)}'.`,
        });
        return null;
      }
      return parsed.toISOString();
    }

    case 'UUID': {
      const text = toScalarText(value).trim();
      if (
        !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(text)
      ) {
        errors.push({
          field: `params.${spec.name}`,
          message: `'${spec.label}' expects an id; got '${text}'.`,
        });
        return null;
      }
      // Left as text: PostgreSQL casts a text literal to uuid on comparison,
      // and letting it do so beats a second uuid parser here.
      return text;
    }

    default:
      return toScalarText(value);
  }
}

/**
 * The answers to bind, from the answers supplied.
 *
 * An answer nobody asked for is refused rather than ignored. It is almost
 * always a spelling mistake, and the alternative — dropping it quietly — means
 * the query binds the DEFAULT instead and the report comes back subtly wrong
 * with nothing anywhere saying why.
 */
export function resolveRenderParams(
  rawSpecs: unknown,
  supplied: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const { specs, errors } = readParamSpecs(rawSpecs);
  const declared = new Set(specs.map((spec) => spec.name));

  for (const name of Object.keys(supplied)) {
    if (declared.has(name)) continue;
    errors.push({
      field: `params.${name}`,
      message: (PTV_CONTEXT_PARAMS as readonly string[]).includes(name)
        ? `'${name}' is a context parameter the server supplies itself — it cannot be sent with the request.`
        : `This revision has no prompt named '${name}'. It asks for: ${
            specs.map((spec) => spec.name).join(', ') || 'nothing'
          }.`,
    });
  }

  const values: Record<string, unknown> = {};
  for (const spec of specs) {
    const answer = Object.prototype.hasOwnProperty.call(supplied, spec.name)
      ? supplied[spec.name]
      : spec.defaultValue;

    const coerced = coerce(spec, answer, errors);

    if (coerced === null && spec.required) {
      errors.push({
        field: `params.${spec.name}`,
        message: `'${spec.label}' is required by this revision and was not answered.`,
      });
    }

    values[spec.name] = coerced;
  }

  if (errors.length > 0) {
    throw new RenderParamError('The render parameters are not what this revision asks for', errors);
  }

  return values;
}
