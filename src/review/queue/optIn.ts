import { api } from '../../api/client';
import { unwrap } from '../../api/unwrap';

export const REVIEW_OPT_IN_KEY = 'review-opt-in';
export const reviewOptInKey = (handle?: string) => [REVIEW_OPT_IN_KEY, handle] as const;
export const loadReviewOptIn = () => unwrap(api.GET('/v1/me/review-opt-in'));
