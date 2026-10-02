import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { z } from 'zod';

import { api } from '../api/client';
import {
  CivicButton,
  CivicHeading,
  CivicText,
  FormError,
  Screen,
  SubmitButton,
  TextField,
} from '../components/civic';
import { useServerForm } from '../forms/useServerForm';
import { useT } from '../i18n';
import { safeReturnTo } from '../session/returnTo';
import { authCall, rateLimitMinutes } from './call';
import { setPending } from './pending';

/** WF-SIGNIN-1. Same answer for every address: the screen never says whether an account exists. */
export function SignInScreen() {
  const t = useT();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const schema = useMemo(
    () => z.object({ email: z.string().trim().email(t('auth.email.invalid')) }),
    [t],
  );
  const { form, bind, submit, formError, busy } = useServerForm(schema, {
    defaultValues: { email: '' },
  });
  const limited = form.formState.errors.root?.message;

  const onSubmit = submit(async (v) => {
    form.clearErrors('root');
    try {
      await authCall(api.POST('/v1/auth/code', { body: { email: v.email } }));
    } catch (e) {
      const minutes = rateLimitMinutes(e);
      if (minutes) return form.setError('root', { message: t('auth.rateLimited', { minutes }) });
      throw e; // offline and server errors go to the form kit
    }
    setPending(v.email, 'signin'); // memory only, never the URL
    form.reset();
    const safe = safeReturnTo(returnTo);
    router.push(
      safe === '/' ? '/sign-in/code' : { pathname: '/sign-in/code', params: { returnTo: safe } },
    );
  });

  return (
    <Screen>
      <CivicHeading level={1}>{t('auth.signin.title')}</CivicHeading>
      <CivicText>{t('auth.signin.body')}</CivicText>
      <FormError message={limited ?? formError} />
      <TextField
        label={t('auth.email.label')}
        accessibilityLabel={t('auth.email.label')}
        required
        inputMode="email"
        autoComplete="email"
        textContentType="emailAddress"
        {...bind('email')}
      />
      <SubmitButton label={t('auth.send')} busy={busy} onPress={() => void onSubmit()} />
      <CivicText variant="caption" muted>
        {t('auth.signin.noAccount')}
      </CivicText>
      <CivicButton
        variant="secondary"
        label={t('auth.signin.haveInvite')}
        accessibilityLabel={t('auth.signin.haveInvite')}
        onPress={() => router.push('/sign-up')}
      />
    </Screen>
  );
}
