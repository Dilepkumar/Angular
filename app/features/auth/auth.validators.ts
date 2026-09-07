import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/;
export const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;

export function emailOrPhone(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = (c.value as string)?.trim() ?? '';
    if (!v) return null;
    return (EMAIL_RE.test(v) || PHONE_RE.test(v)) ? null : { emailOrPhone: true };
  };
}

export function strongPassword(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value as string ?? '';
    const e: ValidationErrors = {};
    if (!/[A-Z]/.test(v)) e['uppercase'] = true;
    if (!/[a-z]/.test(v)) e['lowercase'] = true;
    if (!/\d/.test(v)) e['digit'] = true;
    if (!/[^A-Za-z0-9]/.test(v)) e['special'] = true;
    return Object.keys(e).length ? e : null;
  };
}

export function passwordsMatch(): ValidatorFn {
  return (g: AbstractControl): ValidationErrors | null => {
    const pw = g.get('password')?.value, cp = g.get('confirmPassword')?.value;
    return pw && cp && pw !== cp ? { mismatch: true } : null;
  };
}

export function passwordScore(v: string): number {
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return s;
}
