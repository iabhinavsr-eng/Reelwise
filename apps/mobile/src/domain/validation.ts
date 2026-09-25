const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MIN_PASSWORD_LENGTH = 8;

export function validateName(name: string): string | null {
  return name.trim().length === 0 ? 'Enter your name.' : null;
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Enter your email.';
  if (!EMAIL_RE.test(value)) return 'That email doesn’t look quite right.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Choose a password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

/**
 * Accepts what people actually type ("mybiz.com", "www.mybiz.com/about",
 * "https://mybiz.com") and returns a canonical https URL, or null.
 */
export function normalizeWebsiteUrl(input: string): string | null {
  let value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  // Require a real-looking public hostname: label(s) + a TLD of 2+ letters.
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
  if (host.split('.').some((label) => !label || label.startsWith('-') || label.endsWith('-'))) return null;
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  return `${url.protocol}//${host}${path}`;
}

export function validateWebsiteUrl(input: string): string | null {
  if (!input.trim()) return 'Enter your website address.';
  return normalizeWebsiteUrl(input) ? null : 'Enter a website like yourbusiness.com';
}

/** "https://www.brightsmile.com/about" → "brightsmile.com" */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
