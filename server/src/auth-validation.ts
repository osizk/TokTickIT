export type ValidationResult =
  | { ok: true; value?: string }
  | { ok: false; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { ok: false, message: "Email is required." };
  }
  const normalized = normalizeEmail(value);
  if (normalized.length === 0 || normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  return { ok: true, value: normalized };
}

export function validateUserName(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { ok: false, message: "Name is required." };
  }
  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > 100) {
    return { ok: false, message: "Name must be 2-100 characters." };
  }
  return { ok: true, value: normalized };
}

export function validatePassword(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { ok: false, message: "Password is required." };
  }
  if (value.length < 12 || value.length > 128 || value.trim() !== value) {
    return { ok: false, message: "Password must be 12-128 characters without surrounding whitespace." };
  }
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return { ok: false, message: "Password must include uppercase, lowercase, number, and symbol characters." };
  }
  return { ok: true };
}
