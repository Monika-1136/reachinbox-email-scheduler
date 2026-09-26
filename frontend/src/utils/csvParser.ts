import { CsvParseResponse, ParsedCsvRecipient } from '../types';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function parseEmailListClient(rawContent: string): CsvParseResponse {
  if (!rawContent || !rawContent.trim()) {
    return {
      validEmails: [],
      invalidCount: 0,
      duplicateCount: 0,
      totalDetected: 0,
      recipients: [],
    };
  }

  const tokens = rawContent
    .split(/[\r\n,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seenEmails = new Set<string>();
  const recipients: ParsedCsvRecipient[] = [];
  const validEmails: string[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const rawToken of tokens) {
    let candidate = rawToken.replace(/^["']|["']$/g, '').trim();
    const angleBracketMatch = candidate.match(/<([^>]+)>/);
    if (angleBracketMatch) {
      candidate = angleBracketMatch[1].trim();
    } else if (candidate.includes(' ')) {
      const subTokens = candidate.split(/\s+/).filter(Boolean);
      for (const sub of subTokens) {
        processCandidate(sub);
      }
      continue;
    }

    processCandidate(candidate);
  }

  function processCandidate(candidate: string) {
    if (!candidate) return;

    const lower = candidate.toLowerCase();
    if (['email', 'emails', 'recipient', 'recipients', 'mail', 'to', 'lead', 'leads'].includes(lower)) {
      return;
    }

    const isValid = EMAIL_REGEX.test(candidate);

    if (!isValid) {
      invalidCount++;
      recipients.push({
        email: candidate,
        isValid: false,
        error: 'Malformed email format',
      });
      return;
    }

    const normalized = candidate.toLowerCase();
    if (seenEmails.has(normalized)) {
      duplicateCount++;
      recipients.push({
        email: candidate,
        isValid: false,
        error: 'Duplicate email address',
      });
      return;
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
