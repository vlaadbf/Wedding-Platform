export const PRIVACY_NOTICE_VERSION = '2026-09-16-draft-v1';

export function hasSensitiveDetails(records: Record<string, unknown>[]) {
  return records.some((record) =>
    ['allergies', 'needs'].some(
      (key) => typeof record[key] === 'string' && record[key].trim().length > 0,
    ),
  );
}
