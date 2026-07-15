import { parseISO, isValid } from "date-fns";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a `from`/`to` query param. Returns null unless the value is a
 * strictly-formatted, real ISO date (YYYY-MM-DD).
 */
export function parseDateParam(value: string | undefined): Date | null {
  if (!value || !ISO_DATE_RE.test(value)) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}
