type BatchSequence = {
  prefix: string;
  numericValue: number;
  width: number;
};

const normalizeBatchNo = (value: string | null | undefined): string | null => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
};

const normalizeBatchNoKey = (value: string): string => value.trim().toLowerCase();

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

export const generateNextBatchNo = (existingBatchNos: string[]): string => {
  const normalizedBatchNos = new Set(
    existingBatchNos
      .map((batchNo) => normalizeBatchNo(batchNo))
      .filter((value): value is string => Boolean(value))
      .map((batchNo) => normalizeBatchNoKey(batchNo)),
  );
  const sequencedBatchNos = existingBatchNos
    .map((batchNo) => parseBatchNoSequence(batchNo))
    .filter((candidate): candidate is BatchSequence => candidate !== null);

  let prefix = 'B-';
  let width = 1;
  let nextNumber = 1;

  if (sequencedBatchNos.length > 0) {
    const nextSequence = sequencedBatchNos.reduce<BatchSequence | null>((highest, candidate) => {
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
