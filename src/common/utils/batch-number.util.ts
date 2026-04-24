type BatchSequence = {
  prefix: string;
  numericValue: number;
  width: number;
};

type GenerateNextBatchNoOptions = {
  prefix?: string | null;
};

const normalizeBatchNo = (value: string | null | undefined): string | null => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
};

const normalizeBatchNoKey = (value: string): string => value.trim().toLowerCase();

const normalizeConfiguredPrefix = (value: string | null | undefined): string | null => {
  const normalizedPrefix = normalizeBatchNo(value);
  if (!normalizedPrefix) {
    return null;
  }
  return /[-_/]$/.test(normalizedPrefix) ? normalizedPrefix : `${normalizedPrefix}-`;
};

const parseBatchNoSequence = (batchNo: string): BatchSequence | null => {
  const normalizedBatchNo = normalizeBatchNo(batchNo);
  if (!normalizedBatchNo) {
    return null;
  }
  const match = normalizedBatchNo.match(/^(.*?)(\d+)$/);
  if (!match) {
    return null;
  }
  const [, prefix, numericPart] = match;
  return {
    prefix,
    numericValue: Number.parseInt(numericPart, 10),
    width: numericPart.length,
  };
};

const formatGeneratedBatchNo = (prefix: string, nextNumber: number, width: number): string => {
  const minimumWidth = Math.max(width, String(nextNumber).length);
  return `${prefix}${String(nextNumber).padStart(minimumWidth, '0')}`;
};

export const generateNextBatchNo = (
  existingBatchNos: string[],
  options: GenerateNextBatchNoOptions = {},
): string => {
  const configuredPrefix = normalizeConfiguredPrefix(options.prefix);
  const normalizedBatchNos = new Set(
    existingBatchNos
      .map((batchNo) => normalizeBatchNo(batchNo))
      .filter((value): value is string => Boolean(value))
      .map((batchNo) => normalizeBatchNoKey(batchNo)),
  );
  const sequencedBatchNos = existingBatchNos
    .map((batchNo) => parseBatchNoSequence(batchNo))
    .filter((candidate): candidate is BatchSequence => candidate !== null);

  let prefix = configuredPrefix ?? 'B-';
  let width = configuredPrefix ? 2 : 1;
  let nextNumber = 1;
  const candidateSequences = configuredPrefix
    ? sequencedBatchNos.filter(
        (sequence) =>
          normalizeBatchNoKey(sequence.prefix) === normalizeBatchNoKey(configuredPrefix),
      )
    : sequencedBatchNos;

  if (candidateSequences.length > 0) {
    const nextSequence = candidateSequences.reduce<BatchSequence | null>((highest, candidate) => {
      if (!highest || candidate.numericValue > highest.numericValue) {
        return candidate;
      }
      return highest;
    }, null);

    if (nextSequence) {
      prefix = nextSequence.prefix;
      width = nextSequence.width;
      nextNumber = nextSequence.numericValue + 1;
    }
  }

  let candidate = formatGeneratedBatchNo(prefix, nextNumber, width);
  while (normalizedBatchNos.has(normalizeBatchNoKey(candidate))) {
    nextNumber += 1;
    candidate = formatGeneratedBatchNo(prefix, nextNumber, width);
  }

  return candidate;
};
