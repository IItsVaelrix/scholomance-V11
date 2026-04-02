# Engineering Rulebook
## Mandatory Quality Gates

> **Authority:** This rulebook is enforced by Law 7 (Security Before Features) and Law 6 (Determinism Is Non-Negotiable).
> 
> **Status:** Binding on all agents. No exceptions.

---

## Rule 1: No Commit Without Lint

**The Rule:**
```
git commit → npm run lint → PASS required
```

**Enforcement:**
- Pre-commit hook MUST run `npm run lint`
- Lint errors = commit blocked
- No `--no-verify` bypasses without Angel approval

**Violation = Escalation:**
```
ESCALATION: LINT_BYPASS
- Agent: [who bypassed]
- Reason: [why bypass was requested]
- Risk: [what lint rules were skipped]
- Needs: Angel approval
```

---

## Rule 2: No Merge Without Tests

**The Rule:**
```
git merge → npm run test → PASS required
```

**Enforcement:**
- CI pipeline MUST run full test suite
- Test failures = merge blocked
- Flaky tests = quarantine, not ignore

**Test Coverage Requirements:**

| Change Type | Minimum Coverage |
|-------------|------------------|
| New feature | 80% of new code |
| Bug fix | Test for the bug |
| Refactor | No coverage regression |
| Performance | Benchmark included |

**Violation = Escalation:**
```
ESCALATION: TEST_BYPASS
- Agent: [who bypassed]
- Reason: [why tests were skipped]
- Coverage Gap: [what is untested]
- Risk: [what could break]
- Needs: Angel approval
```

---

## Rule 3: Dependency Whitelisting

**The Rule:**
```
Only pre-approved packages may be imported.
```

**Enforcement:**
- Import statements checked in CI
- Unknown packages = build failure
- No exceptions without Angel approval

**Approved Packages:**

| Category | Packages |
|----------|----------|
| **UI Framework** | React, Framer Motion |
| **Game Engine** | Phaser |
| **Validation** | Zod |
| **Testing** | Vitest, Playwright |
| **Build** | Vite, TypeScript |
| **Existing Project** | react-resizable-panels (layout) |

**New Package Request:**
```
ESCALATION: NEW_DEPENDENCY
- Package: [name + version]
- Purpose: [why needed]
- Alternatives Considered: [what else was evaluated]
- Bundle Impact: [estimated KB]
- Security Review: [npm audit, maintenance status]
- Needs: Angel approval
```

**Security Requirements for New Packages:**
- [ ] >1000 weekly downloads (or well-known maintainer)
- [ ] No critical/high vulnerabilities (npm audit)
- [ ] Active maintenance (commits in last 90 days)
- [ ] Source available (no obfuscated code)
- [ ] License compatible (MIT/Apache/BSD preferred)

---

## Rule 4: No Deploy Without QA Battery

**The Rule:**
```
npm run build → npm run test:qa → PASS required
```

**QA Battery Includes:**
- Unit tests (vitest)
- Integration tests
- Visual regression (Playwright)
- Bytecode determinism checks
- Performance budget validation

**Enforcement:**
- QA battery runs on every PR
- Red CI = no merge
- Flaky test = block merge until fixed

**QA Pass Checklist:**

```markdown
## QA Signoff Template

- [ ] Lint: PASS
- [ ] Unit Tests: PASS
- [ ] Integration Tests: PASS
- [ ] Visual Regression: PASS (or baselines updated)
- [ ] Bytecode Determinism: PASS
- [ ] Performance Budget: PASS
- [ ] Accessibility: PASS
- [ ] Security Scan: PASS

Agent: [name]
Timestamp: [ISO 8601]
```

---

## Rule 5: Bytecode Determinism Is Mandatory

**The Rule:**
```
Same input → Same bytecode → Same output
```

**Enforcement:**
- All state changes emit bytecode
- Bytecode is hashed and compared
- Hash mismatch = test failure

**Determinism Test Template:**
```typescript
it('produces deterministic bytecode', () => {
  const bytecode1 = compileBlueprint(input);
  const bytecode2 = compileBlueprint(input);
  expect(hash(bytecode1)).toBe(hash(bytecode2));
});
```

**Violation = Escalation:**
```
ESCALATION: DETERMINISM_VIOLATION
- Component: [what produced non-deterministic output]
- Input: [what was the input]
- Output1: [first run output hash]
- Output2: [second run output hash]
- Root Cause: [why outputs differed]
- Fix: [how determinism is restored]
```

---

## Rule 6: Performance Budget Is Law

**The Rule:**
```
Frame budget: 16ms (60fps)
Bundle budget: 500KB initial load
Memory budget: 50MB idle
```

**Enforcement:**
- Performance tests run on every PR
- Budget violation = build failure
- Regression > 5% = escalation

**Performance Test Template:**
```typescript
it('stays within frame budget', () => {
  const frameTime = measureFrameTime(() => {
    renderComponent();
  });
  expect(frameTime.p95).toBeLessThan(16);
});
```

**Violation = Escalation:**
```
ESCALATION: PERFORMANCE_REGRESSION
- Metric: [frameTime/bundleSize/memory]
- Before: [previous value]
- After: [new value]
- Regression: [% increase]
- Root Cause: [what caused regression]
- Fix: [how budget is restored]
```

---

## Rule 7: Accessibility Is Non-Negotiable

**The Rule:**
```
WCAG 2.1 AA compliance required
```

**Enforcement:**
- A11y tests run on every PR
- Violation = build failure
- Manual audit for new components

**A11y Checklist:**
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast passes (4.5:1 minimum)
- [ ] Screen reader tested
- [ ] Reduced motion respected

**Violation = Escalation:**
```
ESCALATION: ACCESSIBILITY_VIOLATION
- Component: [what failed a11y]
- WCAG Criterion: [which criterion failed]
- Impact: [who is affected]
- Fix: [how compliance is achieved]
```

---

## Rule 8: Security Review Gates Features

**The Rule:**
```
New input surface → Security review → Approval required
```

**Enforcement:**
- Security scan on every PR
- Allow-list validation required
- No user input reaches database without sanitization

**Security Checklist:**
- [ ] Input validation (allow-list, not deny-list)
- [ ] Output encoding (React escapes by default)
- [ ] No eval(), new Function(), innerHTML
- [ ] Auth tokens in httpOnly cookies
- [ ] CSRF tokens on state-changing requests
- [ ] Rate limiting on public endpoints

**Violation = Escalation:**
```
ESCALATION: SECURITY_GAP
- Surface: [what input surface]
- Risk: [what attack is possible]
- Severity: [CRITICAL/HIGH/MEDIUM/LOW]
- Fix: [how vulnerability is closed]
```

---

## Rule 9: Documentation Updates Required

**The Rule:**
```
Code change → Docs updated → PR complete
```

**Enforcement:**
- Docs check in CI
- Missing docs = PR blocked
- API changes need schema updates

**Documentation Checklist:**
- [ ] README updated (if user-facing change)
- [ ] API docs updated (if API changed)
- [ ] VAELRIX_LAW.md updated (if architecture changed)
- [ ] SCHEMA_CONTRACT.md updated (if data shapes changed)
- [ ] Daily wrapup written (if significant change)

**Violation = Escalation:**
```
ESCALATION: DOCS_GAP
- Change: [what was changed]
- Missing Docs: [what documentation is missing]
- Impact: [who needs this documentation]
- Fix: [how documentation is updated]
```

---

## Rule 10: Rollback Plan Required

**The Rule:**
```
Deploy without rollback plan = prohibited
```

**Enforcement:**
- Rollback plan in every deployment PR
- Rollback tested quarterly
- Rollback time < 5 minutes

**Rollback Plan Template:**
```markdown
## Rollback Plan

**Trigger Conditions:**
- [ ] Error rate > 1%
- [ ] Performance regression > 20%
- [ ] Critical bug discovered

**Rollback Steps:**
1. [Step 1: e.g., git revert <commit>]
2. [Step 2: e.g., redeploy previous version]
3. [Step 3: e.g., notify users]

**Rollback Owner:** [who executes rollback]
**Communication Plan:** [how users are notified]
```

---

## Rule 11: Post-Mortem Required For Production Incidents

**The Rule:**
```
Production incident → Post-mortem → Lessons learned → Law update if needed
```

**Enforcement:**
- Post-mortem within 48 hours
- Blameless analysis
- Action items tracked to completion

**Post-Mortem Template:**
```markdown
## Post-Mortem: [Incident Name]

**Date:** [ISO 8601]
**Duration:** [how long incident lasted]
**Severity:** [SEV-1/SEV-2/SEV-3]

### What Happened
[Timeline of events]

### Root Cause
[Technical root cause]

### What Went Well
[What worked during incident response]

### What Went Poorly
[What failed or was difficult]

### Action Items
- [ ] [Action 1] → [Owner] → [Due Date]
- [ ] [Action 2] → [Owner] → [Due Date]

### Law Updates Required
- [ ] VAELRIX_LAW.md update needed? [Yes/No]
- [ ] Which law? [Law number]
- [ ] Proposed change: [what change]
```

---

## Enforcement Mechanism

### Pre-Commit Hooks
```bash
#!/bin/bash
# .husky/pre-commit

npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Lint failed. Commit blocked."
  exit 1
fi

npm run test:changed
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Commit blocked."
  exit 1
fi

echo "✅ Pre-commit checks passed."
exit 0
```

### CI Pipeline
```yaml
# .github/workflows/qa-gates.yml

name: QA Gates

on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test

  qa-battery:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:qa

  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:performance

  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:a11y

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run security:scan
```

---

## Escalation Paths

| Violation Type | Escalate To | Response Time |
|----------------|-------------|---------------|
| Lint bypass | Angel | Immediate |
| Test bypass | Angel | Immediate |
| QA failure | Angel + Team | < 4 hours |
| Performance regression | Angel + Team | < 24 hours |
| Security gap | Angel (only) | Immediate |
| Accessibility violation | Angel + Team | < 24 hours |
| Documentation gap | Angel | < 48 hours |

---

## Version Log

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-01 | Initial rulebook established (10 rules) |
| 1.1 | 2026-04-01 | Added Rule 3: Dependency Whitelisting. Renumbered rules 4-11. Added immutability clause to VAELRIX_LAW.md Law 8 |

---

*This rulebook is enforced by VAELRIX_LAW.md Laws 6, 7, and 9. Violations are escalations. No exceptions.*
