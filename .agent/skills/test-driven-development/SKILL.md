---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code.
---

# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you did not watch the test fail, you do not know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use

**Always:**
- New features
- Bug fixes
- Refactoring
- Financial math or behavioral changes

**Exceptions (ask the user explicitly):**
- Throwaway exploration scripts (delete after learning)
- Generated schema artifacts
- Pure static configuration files

Thinking "skip TDD just this once"? Stop. That is rationalization.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Wrote implementation code before the test? Delete it. Start over.

**No exceptions:**
- Do not keep it as "reference"
- Do not "adapt" it while writing tests
- Do not look at it while writing tests
- Delete means delete

Implement fresh from tests.

## Red-Green-Refactor

1. **RED — Write Failing Test:**
   - Write one minimal test showing the exact expected behavior using real types/functions and hand-derived literal fixtures.
   - Requirements: one behavior per test, clear name, real code (mocks only when I/O is slow or external).
2. **Verify RED — Watch It Fail (Mandatory):**
   - Run the targeted test command (`cd apps/go-engine && go test ./...` or `cd apps/api && npx jest <spec> --no-cache`).
   - Confirm the test fails (not a syntax/compilation error), with an expected assertion failure proving the feature/fix is absent.
   - If the new test passes immediately, you are testing existing behavior — fix the test before touching production code.
3. **GREEN — Minimal Code:**
   - Write the simplest production code required to pass the failing test.
   - Do not add speculative options or unrequested abstractions beyond what makes the test pass.
4. **Verify GREEN — Watch All Tests Pass (Mandatory):**
   - Run the targeted test first, then run the **entire suite** (`npm run erp:go:test`, `cd apps/api && npx jest --no-cache`, and relevant integration harnesses).
   - Confirm zero errors, warnings, or regressions anywhere else in the project.
5. **REFACTOR — Clean Up (Only After Green):**
   - Extract shared helpers, tighten naming, remove duplication, keep all tests green.
6. **Repeat** for the next requirement.

## Good Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | One behavior per test | Compound "and ... and ..." assertions masking multiple causes |
| **Clear** | Name describes exact invariant or failure mode | `test('works correctly')` |
| **Honest** | Hand-derived literal expected values | Expected values computed by calling the production helper |
| **Real** | Exercises real calculator / service logic | Asserts that a mock was called |

Read `writing-good-tests.md` in this skill directory whenever writing new tests or introducing test doubles.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Writing the test takes 30 seconds. |
| "I will test after" | Tests written after pass immediately — they never prove the test can catch the bug. |
| "Already manually tested" | Manual checks are ad-hoc, cover fewer edge cases, and cannot re-run on future commits. |
| "Deleting code is wasteful" | Keeping unverified code guarantees debugging in production later. |
| "Existing code has no tests" | Write a failing characterization/regression test before modifying it. |

## Verification Checklist

Before committing or claiming work complete:

- [ ] Every new function, bug fix, or behavioral change started with a failing test (`RED`).
- [ ] Watched every new test fail for the expected reason before editing production code.
- [ ] Wrote minimal production code to pass (`GREEN`).
- [ ] Full project test suites pass (`npm run erp:go:test`, `npx jest --no-cache`, integration harnesses) with zero skipped assertions.
- [ ] For UI or production changes, Layer 5 Visual Browser QA verified rendered screenshots with zero visual/border regressions or dev-trace leakage.
- [ ] Cleaned up duplication during `REFACTOR` while staying green.
