import { describe, it, expect } from 'vitest';
import { parseEmailList } from '../src/utils/csvParser';

describe('CSV & Text Email Parser', () => {
  it('should parse standard newline-separated emails and ignore header', () => {
    const raw = `email\nalice@example.com\nbob@example.com\ncharlie@example.com`;
    const result = parseEmailList(raw);

    expect(result.validEmails).toEqual([
      'alice@example.com',
      'bob@example.com',
      'charlie@example.com',
    ]);
    expect(result.invalidCount).toBe(0);
    expect(result.duplicateCount).toBe(0);
    expect(result.totalDetected).toBe(3);
  });

  it('should handle comma and semicolon separated inputs', () => {
    const raw = `alice@example.com, bob@example.com; charlie@example.com`;
    const result = parseEmailList(raw);

    expect(result.validEmails.length).toBe(3);
    expect(result.validEmails).toContain('bob@example.com');
  });

  it('should detect and filter malformed email addresses', () => {
    const raw = `valid@domain.com\ninvalid-email\nanother@invalid@domain.com\nuser@sub.domain.org`;
    const result = parseEmailList(raw);

    expect(result.validEmails).toEqual(['valid@domain.com', 'user@sub.domain.org']);
    expect(result.invalidCount).toBe(2);
    expect(result.recipients.find((r) => r.email === 'invalid-email')?.isValid).toBe(false);
  });

  it('should detect and prevent duplicate recipients (case-insensitive)', () => {
    const raw = `lead@reachinbox.ai\nLEAD@reachinbox.ai\nlead@REACHINBOX.AI\nsecond@domain.com`;
    const result = parseEmailList(raw);

    expect(result.validEmails).toEqual(['lead@reachinbox.ai', 'second@domain.com']);
    expect(result.duplicateCount).toBe(2);
  });

  it('should handle empty or whitespace-only content cleanly', () => {
    const result = parseEmailList('   \n\n  ');
    expect(result.validEmails).toEqual([]);
    expect(result.totalDetected).toBe(0);
  });
});
