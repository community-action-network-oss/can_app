import { FieldError } from './FormField';

/** Form-level summary for errors that belong to no single field. Renders nothing when empty. */
export function FormError({ message }: { message?: string }) {
  return message ? <FieldError message={message} /> : null;
}
