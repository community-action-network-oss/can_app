import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { get, useForm, type FieldValues, type Path, type UseFormProps } from 'react-hook-form';
import type { TextInput } from 'react-native';
import type { ZodType } from 'zod';

import { ApiError } from '../api/errors';
import { useT } from '../i18n';

/**
 * react-hook-form plus zod, with server errors and focus-first-error.
 * bind(name) gives a TextField its value, handlers, error and ref (dotted names work for nested fields).
 * Input is never cleared on failure.
 */
export function useServerForm<T extends FieldValues>(
  schema: ZodType<T>,
  options?: Omit<UseFormProps<T>, 'resolver'>,
) {
  const t = useT();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<T>({ ...options, resolver: zodResolver(schema as any) as any });
  const [formError, setFormError] = useState<string>();
  const refs = useRef(new Map<string, TextInput | null>());

  // Registration order is render order, so the first entry with an error is the topmost field.
  const focusFirstError = (errors: object) => {
    for (const [name, el] of refs.current) if (el && get(errors, name)) return el.focus();
  };

  const bind = (name: Path<T>) => ({
    value: String(form.watch(name) ?? ''),
    onChangeText: (v: string) => {
      form.setValue(name, v as never, {
        shouldDirty: true,
        shouldValidate: form.formState.isSubmitted,
      });
      setFormError(undefined);
    },
    onBlur: () => void form.trigger(name),
    error: get(form.formState.errors, name)?.message as string | undefined,
    ref: (el: TextInput | null) => void refs.current.set(name, el),
  });

  /** fieldErrors by dotted path onto fields; anything else becomes the form-level error. */
  const applyApiError = (error: unknown) => {
    const fe = error instanceof ApiError ? error.fieldErrors : undefined;
    const keys = fe ? Object.keys(fe) : [];
    if (fe && keys.length) {
      for (const k of keys) form.setError(k as Path<T>, { type: 'server', message: fe[k] });
      setFormError(undefined);
      // setError state lands after render; focus once the errors are readable.
      setTimeout(() => focusFirstError(Object.fromEntries(keys.map((k) => [k, true]))), 0);
    } else {
      setFormError(
        error instanceof ApiError && error.kind === 'offline'
          ? t('common.offline.banner')
          : t('common.error.generic'),
      );
    }
  };

  const submit = (onValid: (values: T) => Promise<unknown> | unknown) =>
    form.handleSubmit(
      async (values) => {
        setFormError(undefined);
        try {
          await onValid(values);
        } catch (e) {
          applyApiError(e);
        }
      },
      (errors) => focusFirstError(errors),
    );

  return { form, bind, submit, applyApiError, formError, busy: form.formState.isSubmitting };
}
