// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml = require('sanitize-html');

export function sanitizeInput(input: string): string {
  if (!input) return input;
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  });
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeInput(sanitized[key]);
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  }
  return sanitized as T;
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
