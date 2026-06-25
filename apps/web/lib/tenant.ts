/**
 * Pilot tenant.
 *
 * In V1 the owner portal operates within a single tenant (Change Connected,
 * "the Change Hub" — tenant #1). Once owner auth (Cognito) is wired, the tenant
 * id comes from the authenticated owner's session instead of this constant.
 */
export const PILOT_TENANT_ID = 'change-connected';

export const PILOT_TENANT = {
  id: PILOT_TENANT_ID,
  name: 'Change Connected',
  instanceName: 'Change Hub',
} as const;
