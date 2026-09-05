/**
 * Normalize a phone number to E.164 format required by Square API.
 * Handles US formats: (555) 555-5555, 555-555-5555, 5555555555, +15555555555
 */
export function normalizePhoneE164(phone: string): string {
  const cleaned = phone.trim();

  // Already in E.164 — strip any internal non-digit chars after the +
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\D/g, '');
  }

  const digits = cleaned.replace(/\D/g, '');

  // US 10-digit number
  if (digits.length === 10) return `+1${digits}`;

  // US 11-digit number starting with country code 1
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;

  // Fallback: prefix with + and hope for the best
  return `+${digits}`;
}
