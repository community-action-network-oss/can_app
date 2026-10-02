// In-memory only, on purpose: the email must never reach the URL, storage or rendered text.
// ponytail: module variable, no subscribe; screens read it once when they mount.
let email: string | undefined;
let flow: 'signup' | 'signin' = 'signin';

export const setPending = (e: string, f: 'signup' | 'signin') => {
  email = e;
  flow = f;
};
export const getPending = () => ({ email, flow });
export const clearPending = () => {
  email = undefined;
  flow = 'signin';
};

// Native session token: memory only. Persisting it is founder-gated, so it is not stored anywhere else.
let nativeToken: string | undefined;
export const setNativeToken = (t?: string) => {
  nativeToken = t;
};
export const getNativeToken = () => nativeToken;
