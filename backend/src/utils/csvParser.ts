import { ParsedCsvRecipient } from '../types';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface CsvParseResult {
  validEmails: string[];
  invalidCount: number;
  duplicateCount: number;
  totalDetected: number;
  recipients: ParsedCsvRecipient[];
}

export function parseEmailList(rawContent: string): CsvParseResult {
  if (!rawContent || !rawContent.trim()) {
    return {
      validEmails: [],
      invalidCount: 0,
      duplicateCount: 0,
      totalDetected: 0,
      recipients: [],
    };
  }

  // Split by newlines, commas, or semicolons
  const lines = rawContent.split(/[\r\n,;]+/);
  const seenEmails = new Set<string>();
  const recipients: ParsedCsvRecipient[] = [];
  const validEmails: string[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const rawLine of lines) {
    const candidate = rawLine.trim().replace(/^["']|["']$/g, '');
    if (!candidate) continue;

    // Skip CSV header if present (e.g. 'email', 'emails', 'recipient', 'to')
    const lower = candidate.toLowerCase();
    if (['email', 'emails', 'recipient', 'recipients', 'mail', 'to'].includes(lower)) {
      continue;
    }

    const isValid = EMAIL_REGEX.test(candidate);

    if (!isValid) {
      invalidCount++;
      recipients.push({
        email: candidate,
        isValid: false,
        error: 'Malformed email format',
      });
      continue;
    }

    const normalized = candidate.toLowerCase();
    if (seenEmails.has(normalized)) {
      duplicateCount++;
      recipients.push({
        email: candidate,
        isValid: false,
        error: 'Duplicate email address',
      });
      continue;
    }

    seenEmails.add(normalized);
    validEmails.push(candidate);
    recipients.push({
      email: candidate,
      isValid: true,
    });
  }

  return {
    validEmails,
    invalidCount,
    duplicateCount,
    totalDetected: recipients.length,
    recipients,
  };
}
