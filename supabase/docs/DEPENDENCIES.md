# Project Dependencies & Versions

## Runtime & Environment

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18.x+ | Runtime (local dev) |
| Deno | 1.x+ | Edge Functions runtime |
| PostgreSQL | 14+ | Database |
| Supabase CLI | 1.x+ | Local development |

## NPM Packages (package.json)

### Core Dependencies

**Supabase Client**
```json
"@supabase/supabase-js": "^2.39.0"
```
- Used in: All Edge Functions
- Purpose: Database access, authentication
- Docs: https://supabase.io/docs/reference/javascript

**NLP Library**
```json
"compromise": "^14.0.0"
```
- Used in: nlp.ts (intent detection)
- Purpose: Text processing, linguistic analysis
- License: MIT

### Optional Dependencies

None currently, but may include:
- `axios` — HTTP requests (currently built-in to Deno)
- `lodash` — Utility functions

### Dev Dependencies

```json
"deno": "^1.40.0"
```
- Used in: Local function testing

## Edge Function Dependencies (deno.json)

Each function has its own `deno.json`:

```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2",
    "compromise": "npm:compromise@^14"
  }
}
```

**Import Syntax:**
```typescript
import { createClient } from '@supabase/supabase-js';
import nlp from 'compromise';
```

## Database Extensions

Enabled in PostgreSQL:

| Extension | Purpose |
|-----------|---------|
| uuid-ossp | Generate UUID values |
| pg_cron | Schedule cron jobs |

## System Dependencies

| System | Version | Purpose |
|--------|---------|---------|
| Git | 2.x+ | Version control |
| PowerShell | 5.1+ (Windows) | Local development |
| curl/wget | Latest | Testing API endpoints |

## Dependency Constraint Strategy

**Fixed Versions:** ^2.x (caret allows patch updates only)

**Rationale:**
- Security fixes applied automatically
- Minor version updates tested manually
- Major version updates require code review

## Version Update Process

### Check for Updates
```bash
npm outdated
# Shows: Package Current Wanted Latest Location
```

### Update Packages
```bash
# Update single package
npm install @supabase/supabase-js@latest

# Update all packages (with caution)
npm update
```

### Test After Update
```bash
# Local function testing
supabase functions serve

# Run integration tests
npm test (if tests exist)
```

## Known Compatibility

### Node.js ↔ Deno
- Both support ES6 modules
- Some APIs differ (Deno has no `console` object by default)
- `supabase-js` works in both runtimes

### Compromise NLP
- Supports English text only
- ~10KB gzipped
- Good for keyword extraction
- Lightweight alternative to larger NLP libs

## Vulnerability Scanning

### Check for Security Issues
```bash
npm audit
# Shows: vulnerabilities that need addressing
```

### Fix Vulnerabilities
```bash
npm audit fix
# Auto-fixes known vulnerabilities
```

### Manual Review
```bash
npm audit --json
# Output in JSON for programmatic processing
```

## Breaking Changes & Migration Guide

### Supabase.js 2.x → Future 3.x
- API surface will remain similar
- Auth flows may change
- Database API should remain stable

### How to Prepare
- Pin to current versions
- Follow Supabase changelog
- Test major updates in staging first

## Production Readiness Checklist

- ✅ All dependencies pinned (no ^)
- ✅ No deprecated packages
- ✅ npm audit = 0 vulnerabilities
- ✅ Tested with Node.js LTS
- ✅ Edge Functions tested locally
- ✅ Database migrations applied

---

**Last Updated:** June 2026 | **Maintenance:** Monthly security audits
