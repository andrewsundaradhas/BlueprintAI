/**
 * Input/output sanitizers for security-sensitive boundaries.
 *
 * Use safeFilename() before any Content-Disposition header.
 * Use safeCsvCell() for every cell written to a CSV/TSV.
 */

const FILENAME_FALLBACK = "plan";

// ASCII control chars 0x00-0x1F + DEL (0x7F)
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

/**
 * Returns a filename safe to interpolate into a Content-Disposition header.
 * Strips control characters (CR/LF response-splitting), shell-metacharacters,
 * and path-traversal sequences. Caps length at 80 chars.
 */
export function safeFilename(raw: string | undefined | null, fallback = FILENAME_FALLBACK): string {
  if (!raw) return fallback;
  const cleaned = String(raw)
    .replace(CONTROL_CHARS, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")     // only safe printable set
    .replace(/^[._-]+/, "")                // no leading dot/underscore
    .replace(/_+/g, "_")
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Returns a CSV cell safe against formula injection in Excel / Google Sheets /
 * LibreOffice. Cells starting with =, +, -, @, \t, or \r are interpreted as
 * formulas; we prefix with a single quote which the spreadsheet displays but
 * does not execute. Then quote-escape per RFC 4180.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
export function safeCsvCell(value: string | number | undefined | null): string {
  const s = value == null ? "" : String(value);
  const guarded = FORMULA_TRIGGERS.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

/**
 * Strip control chars + cap length before logging or interpolating into a
 * non-HTML / non-JSON sink (terminal, log file, structured logger).
 */
export function sanitizeForLog(s: unknown, max = 200): string {
  if (s == null) return "";
  return String(s).replace(CONTROL_CHARS, " ").slice(0, max);
}
