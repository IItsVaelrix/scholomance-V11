# Audio Upload Functionality - Detailed Bug Report Analysis

## Executive Summary

The audio upload functionality in the AmbientOrb/Listen page system has **critical authorization and security issues** that prevent it from working correctly in production environments. The upload feature is designed but fundamentally broken due to mismatched authentication mechanisms between frontend and backend.

---

## System Architecture Overview

### Components Involved

1. **Frontend Upload UI** (`src/pages/Listen/ListenPage.jsx`)
2. **Audio Player Hook** (`src/hooks/useAmbientPlayer.jsx`)
3. **Audio Player Service** (`src/lib/ambient/ambientPlayer.service.js`)
4. **Backend Upload Endpoint** (`codex/server/index.js`)
5. **AmbientOrb Component** (`src/components/AmbientOrb.jsx`)

---

## Critical Bug #1: Authorization Mechanism Mismatch

### Severity: **CRITICAL** 🔴

### Description

The backend requires authentication via **TWO DIFFERENT METHODS** that are incompatible with each other:

#### Backend Authorization Logic (`codex/server/index.js:147-158`)

```javascript
function isAudioRequestAuthorized(request) {
  if (!IS_PRODUCTION) {
    return true;  // ✅ Works in development
  }
  if (request.session?.user) {
    return true;  // ✅ Session-based auth
  }
  return isAudioAdminRequest(request);  // ❌ Token-based auth
}
```

#### Frontend Token Handling (`src/hooks/useAmbientPlayer.jsx:27-36`)

```javascript
const buildAudioApiUrl = useCallback(
  (path) => {
    if (!adminToken || !import.meta.env.PROD) {
      return path;  // ❌ Token NOT added in production!
    }
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}admin=${encodeURIComponent(adminToken)}`;
  },
  [adminToken]
);
```

### Root Cause

**The frontend adds the admin token as a QUERY PARAMETER, but the backend expects it as a HEADER.**

#### Backend Token Validation (`codex/server/index.js:139-145`)

```javascript
function isAudioAdminRequest(request) {
  const headerToken = readHeaderAsString(request.headers['x-audio-admin-token']);
  if (!headerToken || !AUDIO_ADMIN_TOKEN) {
    return false;
  }
  return secureTokenEquals(headerToken, AUDIO_ADMIN_TOKEN);
}
```

### Impact

- ✅ **Development**: Works (bypasses auth check)
- ❌ **Production without session**: Upload returns **401 Unauthorized**
- ❌ **Production with admin token**: Token sent as query param, backend expects header → **401 Unauthorized**
- ⚠️ **Production with user session**: Works BUT exposes upload to ALL authenticated users (security risk)

---

## Critical Bug #2: Production Token Bypass Logic

### Severity: **HIGH** 🟠

### Description

The frontend has contradictory logic that prevents the admin token from being used in production:

```javascript
// src/hooks/useAmbientPlayer.jsx:28-30
if (!adminToken || !import.meta.env.PROD) {
  return path;  // Returns path WITHOUT token in production!
}
```

This condition means:
- **Development**: Token NOT added (but auth bypassed anyway)
- **Production**: Token NOT added (auth fails!)

### Expected Behavior

Should be:
```javascript
if (!adminToken) {
  return path;
}
// Add token in BOTH dev and prod
```

---

## Critical Bug #3: Missing CSRF Token for Upload

### Severity: **HIGH** 🟠

### Description

The upload endpoint requires CSRF protection but the frontend doesn't provide it:

#### Backend Requirement (`codex/server/index.js:467`)

```javascript
fastify.post('/api/upload', async (request, reply) => {
  // CSRF validation happens in preValidation hook
  if (!isAudioRequestAuthorized(request)) {
    // ...
  }
```

#### Frontend Upload (`src/pages/Listen/ListenPage.jsx:145-151`)

```javascript
const res = await fetch(buildAdminApiUrl("/api/upload"), {
  method: "POST",
  body: formData,
  // ❌ Missing: headers with CSRF token
});
```

### Impact

Even if authorization worked, the upload would fail CSRF validation in production.

---

## Bug #4: Token Exposure in URL

### Severity: **MEDIUM** 🟡 (Security)

### Description

The current implementation sends the admin token as a query parameter:

```javascript
// src/pages/Listen/ListenPage.jsx:31
const adminToken = searchParams.get("admin");
```

### Security Issues

1. **URL Logging**: Tokens appear in server logs, browser history, analytics
2. **Referrer Leakage**: Token exposed in HTTP Referer header
3. **Cache Pollution**: URLs with tokens may be cached
4. **Social Engineering**: Easy to share URLs with embedded tokens

### Best Practice

Tokens should be sent in headers, not URLs.

---

## Bug #5: Inconsistent Token Validation

### Severity: **MEDIUM** 🟡

### Description

The backend has a hardcoded token check for admin access:

```javascript
// src/pages/Listen/ListenPage.jsx:32
const isAdmin = adminToken === "echo";
```

But the backend expects:

```javascript
// codex/server/index.js:88-95
function getAudioAdminToken() {
  const token = typeof process.env.AUDIO_ADMIN_TOKEN === 'string'
    ? process.env.AUDIO_ADMIN_TOKEN.trim()
    : '';
  if (IS_PRODUCTION && token.length === 0) {
    throw new Error('AUDIO_ADMIN_TOKEN environment variable is required in production');
  }
  return token.length > 0 ? token : null;
}
```

### Impact

- Frontend checks for `"echo"` hardcoded string
- Backend checks for `process.env.AUDIO_ADMIN_TOKEN`
- These may not match, causing confusion

---

## Bug #6: Missing Error Handling for Token Mismatch

### Severity: **LOW** 🟢

### Description

When upload fails with 401, the error message is generic:

```javascript
// src/pages/Listen/ListenPage.jsx:157-159
} else if (res.status === 401) {
  setUploadStatus("Upload failed: unauthorized.");
}
```

No indication of whether it's:
- Missing token
- Invalid token
- Token in wrong format
- Session expired

---

## Bug #7: Dynamic Schools Not Integrated with AmbientOrb

### Severity: **LOW** 🟢

### Description

The `AmbientOrb` component doesn't receive or display dynamic schools from uploads. It only shows static schools from the configuration.

```javascript
// src/components/AmbientOrb.jsx:8-18
export default function AmbientOrb({ unlockedSchools, variant = "fixed", interactionMode = "full" }) {
  const {
    // ... gets dynamicSchools from hook
    dynamicSchools,  // ✅ Available but not used in UI
  } = useAmbientPlayer(unlockedSchools);
```

The orb displays school info but doesn't distinguish between static and dynamic schools visually.

---

## Reproduction Steps

### Scenario 1: Production Upload Attempt

1. Deploy to production with `NODE_ENV=production`
2. Set `AUDIO_ADMIN_TOKEN=mysecrettoken` in environment
3. Navigate to `/listen?admin=echo`
4. Attempt to upload an audio file
5. **Result**: 401 Unauthorized (token not in header)

### Scenario 2: Development Upload

1. Run locally with `NODE_ENV=development`
2. Navigate to `/listen?admin=echo`
3. Upload an audio file
4. **Result**: ✅ Success (auth bypassed)

### Scenario 3: Authenticated User Upload

1. Deploy to production
2. Log in as regular user (creates session)
3. Navigate to `/listen` (no admin param)
4. **Result**: Upload UI not visible (requires `?admin=echo`)
5. Navigate to `/listen?admin=echo`
6. **Result**: Upload UI visible, upload succeeds (session auth)
7. **Security Issue**: Any authenticated user can upload

---

## Recommended Fixes

### Fix #1: Align Token Transmission (CRITICAL)

**Option A: Use Headers (Recommended)**

```javascript
// src/pages/Listen/ListenPage.jsx
const handleUpload = async (e) => {
  // ...
  const headers = {};
  if (isAdmin && adminToken) {
    headers['x-audio-admin-token'] = adminToken;
  }
  
  const res = await fetch("/api/upload", {
    method: "POST",
    headers,
    body: formData,
  });
  // ...
};
```

**Option B: Accept Query Params in Backend**

```javascript
// codex/server/index.js
function isAudioAdminRequest(request) {
  const headerToken = readHeaderAsString(request.headers['x-audio-admin-token']);
  const queryToken = request.query?.admin; // Add query param support
  const token = headerToken || queryToken;
  
  if (!token || !AUDIO_ADMIN_TOKEN) {
    return false;
  }
  return secureTokenEquals(token, AUDIO_ADMIN_TOKEN);
}
```

### Fix #2: Remove Production Bypass

```javascript
// src/hooks/useAmbientPlayer.jsx
const buildAudioApiUrl = useCallback(
  (path) => {
    if (!adminToken) {
      return path;
    }
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}admin=${encodeURIComponent(adminToken)}`;
  },
  [adminToken]
);
```

### Fix #3: Add CSRF Token

```javascript
// src/pages/Listen/ListenPage.jsx
const handleUpload = async (e) => {
  // Fetch CSRF token first
  const csrfRes = await fetch('/auth/csrf-token');
  const { token: csrfToken } = await csrfRes.json();
  
  const headers = {
    'x-csrf-token': csrfToken,
  };
  
  if (isAdmin && adminToken) {
    headers['x-audio-admin-token'] = adminToken;
  }
  
  const res = await fetch("/api/upload", {
    method: "POST",
    headers,
    body: formData,
  });
  // ...
};
```

### Fix #4: Improve Error Messages

```javascript
// src/pages/Listen/ListenPage.jsx
} else if (res.status === 401) {
  const errorData = await res.json().catch(() => ({}));
  setUploadStatus(`Upload failed: ${errorData.message || 'unauthorized'}`);
}
```

### Fix #5: Secure Token Handling

Instead of URL params, use:
1. Environment variables for server-side token
2. Secure cookie or localStorage for client-side token
3. Header-based transmission only

---

## Testing Recommendations

### Unit Tests Needed

1. ✅ Token header extraction (backend)
2. ✅ Token query param extraction (backend)
3. ✅ Authorization logic with session
4. ✅ Authorization logic with token
5. ❌ CSRF token validation (missing)
6. ❌ Upload with invalid token (missing)

### Integration Tests Needed

1. ❌ End-to-end upload flow in production mode
2. ❌ Upload with session auth
3. ❌ Upload with token auth
4. ❌ Upload without auth (should fail)
5. ❌ Dynamic school playback after upload

---

## Security Recommendations

1. **Never expose tokens in URLs** - Use headers only
2. **Implement proper RBAC** - Don't rely on hardcoded "echo" string
3. **Add upload rate limiting** - Already present but needs testing
4. **Validate file types server-side** - Already present ✅
5. **Scan uploaded files** - Consider malware scanning
6. **Implement file size limits** - Already present (50MB) ✅
7. **Add audit logging** - Track who uploads what

---

## Conclusion

The audio upload functionality is **fundamentally broken in production** due to:

1. ❌ Token sent as query param, expected as header
2. ❌ Production logic prevents token from being sent
3. ❌ Missing CSRF token
4. ⚠️ Security issues with token exposure
5. ⚠️ Inconsistent authorization checks

**Priority**: Fix #1 and #2 are CRITICAL and must be addressed before production deployment.

**Estimated Fix Time**: 2-4 hours for critical fixes, 1 day for complete solution with tests.
