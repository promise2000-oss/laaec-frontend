/**
 * Public API surface for pages. Backed by the typed mock adapter (D-05);
 * no request leaves the browser.
 */

import {
  clearMockCalls,
  failNextCall as armMockFailure,
  getMockCalls,
  resetMockFailures,
  setPortalStateOverride,
} from './mock';

export {
  callApi,
  failNextCall,
  resetMockFailures,
  setPortalStateOverride,
  mockAuthenticate,
  mockAuthenticateAdmin,
  mockCompleteAdminPasswordChallenge,
} from './mock';
export type { MockAuthSuccess, MockAdminClaims, MockAdminAuthOutcome, MockAdminAuthSuccess } from './mock';
export { ApiHttpError, RETRYABLE_STATUSES, isRetryableStatus } from './errors';
export type { ActionName, ApiMap, ApiRequest, ApiResponse, ApiEnvelope } from './contract';
export { GET_ACTIONS, POST_ACTIONS } from './contract';

/**
 * Dev-only test seam: lets browser verification runs arm one-shot mock
 * failures (RF-98 retry paths, UC-10 error envelopes) from `page.evaluate`,
 * flip the portal-state fixture to reach `/login/`'s closed-portal branch
 * (RF-8), and read/clear the bounded call log for payload assertions (D-27).
 * `import.meta.env.DEV` is false in production builds, so the whole block is
 * tree-shaken out of `dist/`.
 */
if (import.meta.env.DEV) {
  (window as unknown as { __LAEC_MOCK__?: unknown }).__LAEC_MOCK__ = {
    failNextCall: armMockFailure,
    resetMockFailures,
    setPortalState: setPortalStateOverride,
    getCalls: getMockCalls,
    clearCalls: clearMockCalls,
  };
}
