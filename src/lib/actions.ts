import type { ZodError } from 'zod';
import { fieldErrors } from './validation';

/** The shape every `useActionState` form in the app shares. */
export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Free-form payload for multi-step forms (e.g. the created submission id). */
  data?: Record<string, unknown>;
}

export const IDLE: ActionState = {};

/**
 * `data` can carry the submitted values back, so a form that React resets after
 * the action (its uncontrolled fields return to their defaults) can use them as
 * the new defaults instead of losing what was typed.
 */
export function fail(message: string, errors?: Record<string, string>, data?: Record<string, unknown>): ActionState {
  return { ok: false, message, errors, data };
}

export function invalid(error: ZodError): ActionState {
  const errors = fieldErrors(error);
  return { ok: false, message: Object.values(errors)[0] ?? 'Please check the form.', errors };
}

export function ok(message?: string, data?: Record<string, unknown>): ActionState {
  return { ok: true, message, data };
}

/** Read a FormData value as a trimmed string. */
export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function bool(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

export function strList(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Empty string -> null, for nullable timestamp/uuid columns. */
export function nullable(value: string): string | null {
  return value === '' ? null : value;
}
