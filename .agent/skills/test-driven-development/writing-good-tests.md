# Writing Good Tests

Load this reference when writing or modifying tests, adding test helpers, or introducing mocks.

## Core Principles

```
1. Every test names the break it catches
2. Every test exercises the real thing
```

Strict TDD produces both naturally: a test written first and watched failing against real code has already proven it can fail, and only earns a mock when the real dependency is slow or external.

## Principle 1: Name the Break

Before writing the test body, answer: **what production bug would make this test fail?**

- **Derive expectations independently.** Use hand-calculated literal expectations rather than computing expected outputs with the same helper under test:
  - WRONG: `expect(evaluateWaterfall(input)).toEqual(calculateWaterfall(input))` where both share the broken helper.
  - GOOD: `expect(res.actualDailyOperational).toBe(1_416_659)` derived directly from `5,904,000 - 4,187,341 - 300,000`.
- **No brittle change detectors.** Test observable contracts and outcomes, not internal private names or constant declarations.
- **Test boundaries.** Verify outputs, side effects, state transitions, zero/empty/negative/boundary values, and error paths.

## Principle 2: Exercise the Real Thing

- **Never assert only on mocks.** Assert real state, real outputs, or real HTTP/service responses.
- **Mock at the narrowest boundary.** Keep domain math, validators, and Prisma/selector mapping real; only fake external network LLM/SMTP calls or slow system clocks via explicit `referenceDate` arguments.
- **Complete fixtures.** Avoid partial fake objects that omit fields read downstream.
- **Keep test helpers out of production classes.** Never add test-only methods onto production services.

## Mutation Check Before Finishing

Mentally mutate the production code and verify a test fails for each:
- Swapped comparison operator (`<=` vs `<`, `>` vs `>=`)
- Wrong constant or clamped floor/ceiling (`Math.max(..., 1)` instead of `0`)
- Skipped side effect or missing role guard
- Zero, negative, empty, or locked-period inputs
