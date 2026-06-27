# AUTH_BYPASS Mode

**Status:** TEMPORARY - Remove before production launch
**Added:** 2026-06-27
**Purpose:** Allow UI development without full auth flow

---

## What It Does

When `AUTH_BYPASS=true`, the middleware auto-mints an admin session for any protected route (`/dashboard`, `/profiles/*`, `/admin/*`) if no valid session exists.

The bypass session contains:
```json
{
  "kind": "admin",
  "tenantId": "change-connected",
  "email": "bypass@dev.local",
  "role": "owner",
  "exp": "<8 hours from now>"
}
```

## How to Enable

### Local Development
Add to `apps/web/.env.local`:
```
AUTH_BYPASS=true
```

### Amplify (Deployed)
1. Go to AWS Console > Amplify > bench app > Environment variables
2. Add: `AUTH_BYPASS` = `true`
3. Redeploy

## How to Disable

Remove the env var or set `AUTH_BYPASS=false`.

## Files Modified

- `apps/web/middleware.ts` - Added bypass logic (lines 70-108)

## Security Notes

- **Never enable in production** - anyone with the URL can access admin features
- The bypass cookie is httpOnly and signed with the same secret as real sessions
- Session expires after 8 hours (same as real sessions)

## When to Remove

Remove this bypass when:
1. Magic-link auth is fully wired (send email, verify, mint real session)
2. Or Cognito/OAuth is integrated

To remove:
1. Delete the `isAuthBypassEnabled()` and `createBypassSession()` functions from middleware.ts
2. Remove the bypass block from the middleware function
3. Delete this documentation file
4. Remove `AUTH_BYPASS` from all env vars
