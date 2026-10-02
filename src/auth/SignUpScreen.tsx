import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { z } from 'zod';

import { api } from '../api/client';
import { ApiError } from '../api/errors';
import {
  CheckboxField,
  CivicHeading,
  CivicText,
  EmergencyNotice,
  FormError,
  Screen,
  SubmitButton,
  TextField,
} from '../components/civic';
import { useServerForm } from '../forms/useServerForm';
import { useT } from '../i18n';
import { authCall, rateLimitMinutes } from './call';
import { setPending } from './pending';

export function SignUpScreen() {
  const t = useT();
  const [limited, setLimited] = useState<number>();
  const schema = useMemo(
    () =>
      z.object({
        inviteCode: z.string().trim().min(1, t('common.validation.required')),
        email: z.string().trim().email(t('auth.email.invalid')),
        ageConfirmed: z.boolean().refine((v) => v, t('auth.age.required')),
      }),
    [t],
  );
  const { form, bind, submit, formError, busy } = useServerForm(schema, {
    defaultValues: { inviteCode: '', email: '', ageConfirmed: false },
  });

  const onSubmit = submit(async (v) => {
    setLimited(undefined);
    try {
      await authCall(api.POST('/v1/auth/signup', { body: v }));
    } catch (e) {
      const minutes = rateLimitMinutes(e);
      if (minutes) return setLimited(minutes);
      if (e instanceof ApiError && e.code === 'invalid_invite') {
        return form.setError('inviteCode', { type: 'server', message: t('auth.invite.invalid') });
      }
      throw e; // offline and server errors go to the form kit
    }
    // The email travels only through memory, never the URL; the field is wiped so it is not left on screen.
    setPending(v.email, 'signup');
    form.reset();
    router.push('/sign-in/code');
  });

  const invite = bind('inviteCode');
  const email = bind('email');
  const age = form.formState.errors.ageConfirmed?.message;
  return (
    <Screen>
      <CivicHeading level={1}>{t('auth.signup.title')}</CivicHeading>
      <CivicText>{t('auth.signup.body')}</CivicText>
      <EmergencyNotice />
      <FormError message={limited ? t('auth.rateLimited', { minutes: limited }) : formError} />
      <TextField
        label={t('auth.invite.label')}
        accessibilityLabel={t('auth.invite.label')}
        required
        {...invite}
      />
      <TextField
        label={t('auth.email.label')}
        accessibilityLabel={t('auth.email.label')}
        hint={t('auth.email.privacy')}
        required
        inputMode="email"
        autoComplete="email"
        textContentType="emailAddress"
        {...email}
      />
      <CheckboxField
        label={t('auth.age.label')}
        checked={form.watch('ageConfirmed')}
        error={age}
        onToggle={() =>
          form.setValue('ageConfirmed', !form.getValues('ageConfirmed'), {
            shouldValidate: form.formState.isSubmitted,
          })
        }
      />
      <CivicText variant="caption" muted>
        {t('auth.email.never')}
      </CivicText>
      <SubmitButton label={t('auth.send')} busy={busy} onPress={() => void onSubmit()} />
    </Screen>
  );
}
