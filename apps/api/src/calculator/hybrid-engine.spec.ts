import { GoBridgeService } from './go-bridge.service';
import { resolveStudioConfig } from '../config/studio.defaults';
import {
  buildExecutiveHorizonTs,
  computeLifeEnergyTs,
  computeLosslessSlices,
  computeNetWorthTs,
  computePaycycleHorizonTs,
  evaluateAnomaliesTs,
  evaluateConfiguredWaterfallTs,
  evaluateEnvelopesTs,
  evaluateFormulaSuiteTs,
  evaluateWalletGuardTs,
  optimizeAllocationFrontierTs,
  optimizeDebtPayoffTs,
  parseStatementBatchTs,
  routeTransactionToPaycycleTs,
  runForecastTs,
  runIntelligenceBatchTs,
  runMonteCarloTs,
  simulateCutoffTs,
  simulateTimelineTs,
  buildCashRadarTs,
} from './hybrid-engine';

describe('Hybrid Engine (Go <-> TypeScript Parity & Financial Precision)', () => {
  it('distributes lossless Rp remainder on 92,000 / 3 into 30,667 / 30,667 / 30,666', () => {
    const { slices, totalPrincipal } = computeLosslessSlices(92000, 0, 3, 'PRINCIPAL_SPLIT');
    expect(totalPrincipal).toBe(92000);
    expect(slices).toEqual([30667, 30667, 30666]);
    expect(slices.reduce((a, b) => a + b, 0)).toBe(92000);
  });

  it('routes SPayLater dynamic H-15 formula (DAYS_IN_MONTH - 15, >= cutoff) and Bank Permata Credit Card 25th cutoff identically to domain rules', () => {
    // 1. SPayLater in 30-day Nov (30 - 15 = 15th cutoff): Nov 14 (<15) -> 11/2026; Nov 15 & Nov 23 (>=15) -> 12/2026
    const spNov14 = simulateCutoffTs({
      instrument: 'SPAYLATER',
      principalAmount: 75000,
      tenorMonths: 1,
      purchaseDate: '2026-11-14',
    });
    expect(spNov14.crossedCutoff).toBe(false);
    expect(spNov14.cutoffDay).toBe(15);
    expect(spNov14.startPeriodMonth).toBe(11);
    expect(spNov14.firstDueDateIso).toBe('2026-11-25');

    const spNov23 = simulateCutoffTs({
      instrument: 'SPAYLATER',
      principalAmount: 52000,
      tenorMonths: 1,
      purchaseDate: '2026-11-23',
    });
    expect(spNov23.crossedCutoff).toBe(true);
    expect(spNov23.cutoffDay).toBe(15);
    expect(spNov23.startPeriodMonth).toBe(12);
    expect(spNov23.startPeriodYear).toBe(2026);
    expect(spNov23.firstDueDateIso).toBe('2026-12-25');

    // 2. SPayLater in 31-day Dec (31 - 15 = 16th cutoff): Dec 15 (<16) -> 12/2026; Dec 16 (>=16) -> 01/2027
    const spDec15 = simulateCutoffTs({
      instrument: 'SPAYLATER',
      principalAmount: 100000,
      tenorMonths: 1,
      purchaseDate: '2026-12-15',
    });
    expect(spDec15.crossedCutoff).toBe(false);
    expect(spDec15.cutoffDay).toBe(16);
    expect(spDec15.startPeriodMonth).toBe(12);
    expect(spDec15.firstDueDateIso).toBe('2026-12-25');

    const spDec16 = simulateCutoffTs({
      instrument: 'SPAYLATER',
      principalAmount: 100000,
      tenorMonths: 1,
      purchaseDate: '2026-12-16',
    });
    expect(spDec16.crossedCutoff).toBe(true);
    expect(spDec16.cutoffDay).toBe(16);
    expect(spDec16.startPeriodMonth).toBe(1);
    expect(spDec16.startPeriodYear).toBe(2027);
    expect(spDec16.firstDueDateIso).toBe('2027-01-25');

    // 2b. February non-leap (2027 -> 28 - 15 = 13th) & leap (2028 -> 29 - 15 = 14th) + custom cutoffFormula
    const spFeb27 = simulateCutoffTs({
      instrument: 'SPAYLATER',
      principalAmount: 100000,
      tenorMonths: 1,
      purchaseDate: '2027-02-13',
    });
    expect(spFeb27.crossedCutoff).toBe(true);
    expect(spFeb27.cutoffDay).toBe(13);
    expect(spFeb27.startPeriodMonth).toBe(3);

    const customFeb = simulateCutoffTs({
      instrument: 'SPAYLATER',
      principalAmount: 150000,
      tenorMonths: 1,
      purchaseDate: '2027-02-15',
      cutoffFormula: 'MIN(20, DAYS_IN_MONTH - 8)',
      cutoffBoundaryInclusive: false,
      preCutoffOffsetMonths: 0,
      postCutoffOffsetMonths: 1,
      dueDayOverride: 31,
    } as any);
    expect(customFeb.cutoffDay).toBe(20);
    expect(customFeb.crossedCutoff).toBe(false);
    expect(customFeb.firstDueDateIso).toBe('2027-02-28');

    // 3. Bank Permata CC (25th cutoff -> 11th due): Nov 25 -> 12/2026 (due 2026-12-11); Nov 26 -> 01/2027 (due 2027-01-11)
    const ccNov25 = simulateCutoffTs({
      instrument: 'CREDIT_CARD',
      principalAmount: 77000,
      tenorMonths: 1,
      purchaseDate: '2026-11-25',
    });
    expect(ccNov25.crossedCutoff).toBe(false);
    expect(ccNov25.cutoffDay).toBe(25);
    expect(ccNov25.dueDay).toBe(11);
    expect(ccNov25.startPeriodMonth).toBe(12);
    expect(ccNov25.firstDueDateIso).toBe('2026-12-11');

    const ccNov26 = simulateCutoffTs({
      instrument: 'CREDIT_CARD',
      principalAmount: 350000,
      tenorMonths: 1,
      purchaseDate: '2026-11-26',
    });
    expect(ccNov26.crossedCutoff).toBe(true);
    expect(ccNov26.cutoffDay).toBe(25);
    expect(ccNov26.startPeriodMonth).toBe(1);
    expect(ccNov26.startPeriodYear).toBe(2027);
    expect(ccNov26.firstDueDateIso).toBe('2027-01-11');

    // 4. Weekend 11th due date triggers H-1 working-day early-payment advisory (2027-04-11 Sunday -> 2027-04-09 Friday)
    const ccWeekendDue = simulateCutoffTs({
      instrument: 'CREDIT_CARD',
      principalAmount: 250000,
      tenorMonths: 1,
      purchaseDate: '2027-03-10',
    });
    expect(ccWeekendDue.firstDueDateIso).toBe('2027-04-11');
    expect(ccWeekendDue.advice).toContain('2027-04-09');
  });

  it('executes Go binary parity check for core simulation commands when binary exists', async () => {
    const bridge = new GoBridgeService();
    const cutoffReq = {
      instrument: 'SPAYLATER' as const,
      amountMode: 'PRINCIPAL_SPLIT' as const,
      principalAmount: 92000,
      tenorMonths: 3,
      purchaseDate: '2026-11-16',
      periodNetIncome: 5904000,
      currentPeriodObligations: 4017341,
      nextPeriodObligations: 3171115,
      nextPeriodNetIncome: 9840917,
      safeHeadroom: 86659,
    };
    const { engineSource: _src, ...bridgeClean } = await bridge.simulateCutoff(cutoffReq);
    expect(bridgeClean).toEqual(simulateCutoffTs(cutoffReq));

    const timelineReq = {
      periodMonth: 11,
      periodYear: 2026,
      paycheckDateIso: '2026-11-27',
      paycheckAmount: 5904000,
      thrDateIso: '2026-12-18',
      thrAmount: 3500000,
      nextPaycheckDateIso: '2026-12-28',
      nextPaycheckAmount: 5904000,
      totalPaylaterDue: 2613115,
      paylaterDueDateIso: '2026-12-25',
      totalCreditCardDue: 734256,
      creditCardDueDateIso: '2026-12-11',
      totalPersonalDebtDue: 669970,
      personalDebtDueDateIso: '2026-12-08',
      dailyLivingPool: 1500000,
      routineBillsPool: 300000,
      coreSavingsTarget: 86659,
      spaylaterEarlyPayAmount: 1500000,
    };
    const { engineSource: _tsrc, ...tClean } = await bridge.simulateTimeline(timelineReq);
    expect(tClean).toEqual(simulateTimelineTs(timelineReq));

    const guardReq = {
      remainingLivingCash: 1000000,
      actualWalletBalance: 1200000,
      reservedBillsTotal: 600000,
      daysRemaining: 10,
      remainingWeekdays: 8,
      remainingWeekendDays: 2,
      weekendMultiplier: 1.5,
      isWeekendToday: false,
    };
    const { engineSource: _gsrc, ...gClean } = await bridge.evaluateWalletGuard(guardReq);
    expect(gClean).toEqual(evaluateWalletGuardTs(guardReq));

    const horizonReq = {
      selectedMonth: 11,
      selectedYear: 2026,
      periods: [
        {
          month: 11,
          year: 2026,
          periodLabel: "NOV '26",
          finalTotalIncome: 5904000,
          totalDebt: 4017341,
          fixedEssentials: 300000,
          actualDailyOperational: 1500000,
          bufferPocket: 0,
          actualSavings: 86659,
          selfReward: 0,
          deficitUncovered: 0,
          daysInCycle: 31,
        },
      ],
      contracts: [
        {
          id: 'c1',
          title: 'SPinjam Oct 23',
          category: 'PERSONAL_DEBT',
          merchantOrPlatform: 'SPinjam',
          monthlyInstallment: 73387,
          principalAmount: 220161,
          remainingPrincipal: 146774,
          remainingSlices: 2,
          totalTenor: 3,
          payoffMonth: 12,
          payoffYear: 2026,
          payoffDateLabel: "DEC '26",
        },
      ],
    };
    const { engineSource: _hsrc, ...hClean } = await bridge.buildExecutiveHorizon(horizonReq);
    expect(hClean).toEqual(buildExecutiveHorizonTs(horizonReq));
  });

  it('maintains 100% Go <-> TS parity across all 8 new institutional ERP engines', async () => {
    const bridge = new GoBridgeService();

    // 1. paycycle
    const pcReq = {
      month: 11,
      year: 2026,
      anchorDay: 27,
      shiftWeekendToFriday: true,
      explicitStartIso: '2026-11-27',
      explicitNextPaydayIso: '2026-12-28',
      weekendMultiplier: 1.5,
      remainingBudgetRp: 1500000,
      referenceDateIso: '2026-11-27',
    };
    const { engineSource: pcSrc, ...pcGo } = await bridge.computePaycycleHorizon(pcReq);
    expect(pcSrc).toBe('GO_BINARY');
    expect(pcGo).toEqual(computePaycycleHorizonTs(pcReq));

    const wfReq = {
      finalTotalIncomeRp: 5904000,
      totalDebtObligationsRp: 4017341,
      routineQuotasTotalRp: 300000,
      dailyLivingTargetRp: 1500000,
      bufferTargetRp: 0,
      coreSavingsP1TargetRp: 1000000,
      selfRewardP2TargetRp: 0,
    };
    const { engineSource: _wsrc, ...wfGo } = await bridge.evaluateConfiguredWaterfall(wfReq);
    expect(wfGo).toEqual(evaluateConfiguredWaterfallTs(wfReq));

    const rtReq = {
      txDateIso: '2026-11-15',
      instrumentType: 'PAYLATER',
      anchorDay: 27,
    };
    const { engineSource: _rsrc, ...rtGo } = await bridge.routeTransactionToPaycycle(rtReq);
    expect(rtGo).toEqual(routeTransactionToPaycycleTs(rtReq));

    // 2. networth
    const nwReq = {
      accounts: [
        { id: 'bca', name: 'BCA Payroll', institution: 'BCA', accountType: 'OPERATIONAL_BANK', balanceRp: 1886659, annualYieldPct: 0.1, includeInRunway: true },
        { id: 'rdpu', name: 'blu Batavia RDPU', institution: 'blu', accountType: 'MONEY_MARKET_RDPU', balanceRp: 2651561, annualYieldPct: 4.75, includeInRunway: true },
        { id: 'cash', name: 'Daily Cash', institution: 'Wallet', accountType: 'CASH_WALLET', balanceRp: 300000, annualYieldPct: 0, includeInRunway: true },
        { id: 'p1', name: 'Core P1 Vault', institution: 'P1', accountType: 'SAVINGS_VAULT', balanceRp: 1921345, annualYieldPct: 4.75, includeInRunway: true },
      ],
      upcomingPeriods: [
        { month: 11, year: 2026, label: "NOV '26", projectedSavingsP1Rp: 86659, projectedSurplusP2Rp: 0, totalDebtDueRp: 4017341, payLaterDueRp: 2613115, creditCardDueRp: 734256, personalDebtDueRp: 669970 },
        { month: 12, year: 2026, label: "DEC '26", projectedSavingsP1Rp: 1000000, projectedSurplusP2Rp: 2284802, totalDebtDueRp: 3171115, payLaterDueRp: 1622889, creditCardDueRp: 628256, personalDebtDueRp: 919970 },
        { month: 1, year: 2027, label: "JAN '27", projectedSavingsP1Rp: 538841, projectedSurplusP2Rp: 0, totalDebtDueRp: 1967159, payLaterDueRp: 816893, creditCardDueRp: 628256, personalDebtDueRp: 522010 },
        { month: 2, year: 2027, label: "FEB '27", projectedSavingsP1Rp: 1000000, projectedSurplusP2Rp: 670004, totalDebtDueRp: 835996, payLaterDueRp: 207740, creditCardDueRp: 628256, personalDebtDueRp: 0 },
      ],
    };
    const { engineSource: _nwsrc, ...nwGo } = await bridge.computeNetWorth(nwReq);
    expect(nwGo).toEqual(computeNetWorthTs(nwReq));

    // 3. forecaster
    const fcReq = {
      startingLiquidAssetsRp: 4838220,
      startingP1VaultRp: 1921345,
      emergencyFundTargetRp: 10000000,
      baselineDailyBurnRp: 50000,
      rdpuAnnualYieldPct: 4.75,
      variableShockPercent: 15,
      periods: [
        { month: 11, year: 2026, label: "NOV '26", totalIncomeRp: 5904000, totalDebtDueRp: 4017341, personalDebtDueRp: 669970, dailyLivingRp: 1500000, routineBillsRp: 300000, coreSavingsP1Rp: 86659, selfRewardP2Rp: 0 },
        { month: 12, year: 2026, label: "DEC '26", totalIncomeRp: 9840917, totalDebtDueRp: 3171115, personalDebtDueRp: 919970, dailyLivingRp: 2850000, routineBillsRp: 535000, coreSavingsP1Rp: 1000000, selfRewardP2Rp: 2284802 },
        { month: 1, year: 2027, label: "JAN '27", totalIncomeRp: 5891000, totalDebtDueRp: 1967159, personalDebtDueRp: 522010, dailyLivingRp: 2850000, routineBillsRp: 535000, coreSavingsP1Rp: 538841, selfRewardP2Rp: 0 },
        { month: 2, year: 2027, label: "FEB '27", totalIncomeRp: 5891000, totalDebtDueRp: 835996, personalDebtDueRp: 0, dailyLivingRp: 2850000, routineBillsRp: 535000, coreSavingsP1Rp: 1000000, selfRewardP2Rp: 670004 },
      ],
    };
    const { engineSource: _fcsrc, ...fcGo } = await bridge.runForecast(fcReq);
    expect(fcGo).toEqual(runForecastTs(fcReq));

    // 4. anomaly
    const anReq = {
      periodLabel: "NOV '26",
      totalCycleDays: 30,
      elapsedDays: 10,
      dailyLivingBudgetRp: 1500000,
      dailyLivingSpentRp: 750000,
      baselineDailyRateRp: 50000,
      cashTransactions: [{ id: 1, label: 'Kopi Bulk', category: 'FOOD', amountRp: 140000, dateIso: '2026-11-28' }],
      postCutoffItems: [{ title: 'Vape', instrument: 'SPAYLATER', purchaseDay: 15, amountRp: 141000 }],
      recurringCharges: [
        { label: 'Gemini AI Pro', category: 'ai', amountRp: 85470 },
        { label: 'Gemini AI Pro 2', category: 'ai', amountRp: 85470 },
      ],
    };
    const { engineSource: _ansrc, ...anGo } = await bridge.evaluateAnomalies(anReq);
    expect(anGo).toEqual(evaluateAnomaliesTs(anReq));

    // 5. envelopes
    const envReq = {
      liquidCashTotalRp: 4838220,
      dailyAverageBurnRp: 65000,
      cycleElapsedDays: 12,
      cycleTotalDays: 30,
      envelopes: [
        { id: 'transport', name: 'KRL Commuter', allocatedRp: 300000, spentRp: 220000, rolloverPolicy: 'SWEEP_TO_P1' },
        { id: 'vape', name: 'Vape Supplies', allocatedRp: 150000, spentRp: 100000, rolloverPolicy: 'ROLLOVER_NEXT_MONTH' },
      ],
      sinkingFunds: [
        { id: 'laptop', name: 'Laptop Service', targetAmountRp: 1200000, currentSavedRp: 300000, monthsRemaining: 6 },
      ],
    };
    const { engineSource: _envsrc, ...envGo } = await bridge.evaluateEnvelopes(envReq);
    expect(envGo).toEqual(evaluateEnvelopesTs(envReq));

    // 6. debtopt
    const doReq = {
      extraLumpSumRp: 1000000,
      contracts: [
        { id: 'sp1', name: 'SPinjam Oct 23', instrument: 'SPINJAM', monthlyInstallmentRp: 73387, remainingMonths: 2, remainingBalanceRp: 146774, monthlyInterestPct: 3.95, payoffMonth: 1, payoffYear: 2027, payoffLabel: 'Jan 2027' },
        { id: 'sp2', name: 'SPinjam Oct 24', instrument: 'SPINJAM', monthlyInstallmentRp: 74573, remainingMonths: 2, remainingBalanceRp: 149146, monthlyInterestPct: 3.95, payoffMonth: 1, payoffYear: 2027, payoffLabel: 'Jan 2027' },
        { id: 'sp3', name: 'SPinjam Nov 08', instrument: 'SPINJAM', monthlyInstallmentRp: 335578, remainingMonths: 3, remainingBalanceRp: 1006734, monthlyInterestPct: 3.95, payoffMonth: 2, payoffYear: 2027, payoffLabel: 'Feb 2027' },
        { id: 'sp4', name: 'SPinjam Nov 17', instrument: 'SPINJAM', monthlyInstallmentRp: 186432, remainingMonths: 3, remainingBalanceRp: 559296, monthlyInterestPct: 3.95, payoffMonth: 2, payoffYear: 2027, payoffLabel: 'Feb 2027' },
      ],
    };
    const { engineSource: _dosrc, ...doGo } = await bridge.optimizeDebtPayoff(doReq);
    expect(doGo).toEqual(optimizeDebtPayoffTs(doReq));

    // 7. lifeenergy
    const leReq = {
      netMonthlyIncomeRp: 5904000,
      workdaysPerMonth: 20,
      workHoursPerDay: 8,
      dailyCommuteHours: 2,
      monthlyWorkExpenseRp: 300000,
      sampleAmountsRp: [280200, 1000000],
    };
    const { engineSource: _lesrc, ...leGo } = await bridge.computeLifeEnergy(leReq);
    expect(leGo).toEqual(computeLifeEnergyTs(leReq));

    // 8. reconciler
    const rcReq = {
      defaultMethod: 'PAYLATER',
      anchorDay: 27,
      defaultYear: 2026,
      rawText: 'Date,Description,Amount\n2026-11-16,Kopi Kenangan QRIS SPayLater,Rp 34.200\n2026-11-14,Haircut Barbershop SPayLater,75000\n2026-11-21,Claude API Permata Credit Card,185000',
      existingItems: [{ id: 29, label: 'Kopi Kenangan QRIS', amountRp: 34200, dateIso: '2026-11-16', instrument: 'PAYLATER' }],
    };
    const { engineSource: _rcsrc, ...rcGo } = await bridge.parseStatementBatch(rcReq);
    expect(rcGo).toEqual(parseStatementBatchTs(rcReq));

    // 9. formula-eval & two-stage paycycle & lock-safe reconciler & P1 exclusion parity
    const fmReq = {
      variables: {
        BASE_SALARY: 5300000,
        TENURE_MONTHS: 8.83,
        NET_INCOME: 5904000,
        LIVING_BUDGET: 1500000,
        ROUTINE_BILLS: 300000,
        SPINJAM_DEBT: 669970,
        OTHER_DEBT: 0,
      },
      formulas: {
        thr: 'ROUND(({TENURE_MONTHS} / 12) * {BASE_SALARY})',
        safeCeiling: 'MAX(0, {NET_INCOME} - {LIVING_BUDGET} - {ROUTINE_BILLS} - {SPINJAM_DEBT} - {OTHER_DEBT})',
        condCheck: 'IF({SPINJAM_DEBT} > 0, PCT(1000000, 70), 0)',
      },
    };
    const { engineSource: fmSrc, ...fmGo } = await bridge.evaluateFormulaSuite(fmReq);
    expect(fmSrc).toBe('GO_BINARY');
    expect(fmGo).toEqual(evaluateFormulaSuiteTs(fmReq));
    expect(fmGo.results.thr.valueRp).toBe(3899917);
    expect(fmGo.results.safeCeiling.valueRp).toBe(3434030);
    expect(fmGo.results.condCheck.valueRp).toBe(700000);

    const twoStageReq = {
      month: 12,
      year: 2026,
      anchorDay: 27,
      payslipAnchorDay: 25,
      payslipShiftRule: 'SHIFT_PREVIOUS_FRIDAY' as const,
      reviewLagWorkingDays: 2,
      holidaysIso: ['2026-12-25'],
      shiftWeekendToFriday: true,
      weekendMultiplier: 1.5,
      remainingBudgetRp: 1500000,
      referenceDateIso: '2026-11-28',
    };
    const { engineSource: tsSrc, ...tsGo } = await bridge.computePaycycleHorizon(twoStageReq);
    expect(tsSrc).toBe('GO_BINARY');
    expect(tsGo).toEqual(computePaycycleHorizonTs(twoStageReq));
    expect(tsGo.payslipDropIso).toBe('2026-11-25');
    expect(tsGo.paydayIso).toBe('2026-11-27');

    const lockRcReq = {
      defaultMethod: 'CASH',
      anchorDay: 27,
      defaultYear: 2026,
      lockedPeriodCodes: ['10/2026'],
      earliestOpenMonth: 11,
      earliestOpenYear: 2026,
      rawText: '2026-09-12 | Kopi Fore | 38000 | SPayLater\n2026-10-18 | Warung Nasi | 45000 | Cash',
    };
    const { engineSource: lrcSrc, ...lrcGo } = await bridge.parseStatementBatch(lockRcReq);
    expect(lrcSrc).toBe('GO_BINARY');
    expect(lrcGo).toEqual(parseStatementBatchTs(lockRcReq));
    expect(lrcGo.rows[0].targetPeriodCode).toBe('11/2026');
    expect(lrcGo.rows[0].advancedFromLocked).toBe(true);
    expect(lrcGo.rows[1].targetPeriodCode).toBe('11/2026');
    expect(lrcGo.rows[1].advancedFromLocked).toBe(true);

    // Same-month banking clamp on Feb 2027 corporate payroll (Feb 25 Thu + 2 wd clamps inside Feb -> Fri Feb 26, not Mar 01)
    const febClampReq = {
      month: 2,
      year: 2027,
      anchorDay: 27,
      payslipAnchorDay: 25,
      payslipShiftRule: 'SHIFT_PREVIOUS_FRIDAY' as const,
      reviewLagWorkingDays: 2,
      holidaysIso: ['2026-12-25', '2027-01-01'],
      shiftWeekendToFriday: true,
      weekendMultiplier: 1.5,
      remainingBudgetRp: 1500000,
      referenceDateIso: '2027-02-01',
    };
    const { engineSource: febSrc, ...febGo } = await bridge.computePaycycleHorizon(febClampReq);
    expect(febSrc).toBe('GO_BINARY');
    expect(febGo).toEqual(computePaycycleHorizonTs(febClampReq));
    expect(febGo.paydayIso).toBe('2027-01-27');
    expect(febGo.nextPaydayIso).toBe('2027-02-26');
    expect(febGo.livingEndIso).toBe('2027-02-25');
    expect(febGo.totalCycleDays).toBe(30);
  });

  it('keeps every 10/2026..09/2027 cycle contiguous and authentically 28-34 days under Two-Stage corporate payday shifts', () => {
    const studio = resolveStudioConfig(1, null, { payrollPayoutDay: 27 });
    const pcCfg = studio.paycycleFormulaConfig;
    const months: Array<[number, number]> = [
      [10, 2026],
      [11, 2026],
      [12, 2026],
      [1, 2027],
      [2, 2027],
      [3, 2027],
      [4, 2027],
      [5, 2027],
      [6, 2027],
      [7, 2027],
      [8, 2027],
      [9, 2027],
    ];
    let prevEndIso: string | null = null;
    for (const [m, y] of months) {
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const curKey = `${String(m).padStart(2, '0')}/${y}`;
      const nextKey = `${String(nextM).padStart(2, '0')}/${nextY}`;
      const h = computePaycycleHorizonTs({
        month: m,
        year: y,
        anchorDay: pcCfg.paydayAnchorDay,
        payslipAnchorDay: pcCfg.payslipAnchorDay,
        payslipShiftRule: pcCfg.payslipShiftRule,
        reviewLagWorkingDays: pcCfg.reviewLagWorkingDays,
        holidaysIso: pcCfg.holidayDatesIso,
        explicitPayslipIso: pcCfg.periodOverrides?.[curKey]?.payslipDateIso,
        explicitStartIso: pcCfg.periodOverrides?.[curKey]?.paydayDateIso,
        explicitNextPaydayIso: pcCfg.periodOverrides?.[nextKey]?.paydayDateIso,
        shiftWeekendToFriday: pcCfg.shiftWeekendToFriday,
        weekendMultiplier: pcCfg.weekendWeightMultiplier,
        remainingBudgetRp: 1500000,
      });
      expect(h.totalCycleDays).toBeGreaterThanOrEqual(28);
      expect(h.totalCycleDays).toBeLessThanOrEqual(34);
      if (prevEndIso) {
        const expectedStart = new Date(
          Date.parse(`${prevEndIso}T00:00:00.000Z`) + 86400000,
        )
          .toISOString()
          .slice(0, 10);
        expect(h.livingStartIso).toBe(expectedStart);
      }
      prevEndIso = h.livingEndIso;
    }
  });

  it('maintains 100% Go <-> TS parity on Cash Radar Projection across cutoff rules, H-1 CC shifts, and troughs', async () => {
    const bridge = new GoBridgeService();
    const radarReq = {
      periodMonth: 4,
      periodYear: 2027,
      paydayDateIso: '2027-03-29',
      livingEndDateIso: '2027-04-26',
      nextPaydayIso: '2027-04-27',
      paycheckAmountRp: 5766000,
      thrAmountRp: 0,
      dailyLivingPoolRp: 1500000,
      routineBillsPoolRp: 535000,
      coreSavingsTargetRp: 1000000,
      paylaterDueRp: 88182,
      creditCardDueRp: 609544,
      personalDebtItems: [],
      holidaysIso: ['2026-12-25', '2027-01-01'],
      referenceDateIso: '2027-04-01',
    };
    const { engineSource, ...goRadar } = await bridge.buildCashRadar(radarReq);
    expect(engineSource).toBe('GO_BINARY');
    expect(goRadar).toEqual(buildCashRadarTs(radarReq));
    const ccEv = goRadar.events.find((e) => e.category === 'CREDIT_CARD');
    expect(ccEv?.dateIso).toBe('2027-04-09');
    expect(ccEv?.isBusinessDayShifted).toBe(true);
    expect(ccEv?.nominalDateIso).toBe('2027-04-11');

    // Verify Go <-> TS parity on Dec 2026 Natal THR (Dec 18), real transactions without double counting, & itemized breakdowns
    const decRadarReq = {
      periodMonth: 12,
      periodYear: 2026,
      paydayDateIso: '2026-11-27',
      livingEndDateIso: '2026-12-27',
      nextPaydayIso: '2026-12-28',
      paycheckAmountRp: 5904000,
      thrDateIso: '2026-12-18',
      thrAmountRp: 3833425,
      dailyLivingPoolRp: 1500000,
      routineBillsPoolRp: 300000,
      coreSavingsTargetRp: 1000000,
      paylaterDueRp: 2783115,
      creditCardDueRp: 657256,
      loggedTransactions: [
        {
          id: 101,
          dateIso: '2026-12-03',
          label: 'Lunch & Coffee',
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          amountRp: 65000,
          insideAllocatedPool: true,
        },
        {
          id: 102,
          dateIso: '2026-12-10',
          label: 'Freelance Bonus',
          type: 'INCOME',
          sourceType: 'MANUAL',
          amountRp: 250000,
          insideAllocatedPool: false,
        },
      ],
      paylaterBreakdown: [
        { title: 'SPayLater Baseline Installments', amountRp: 1942344, sliceLabel: '1/1' },
        { title: '11.11 Promo Checkout (3x 0%)', amountRp: 159904, sliceLabel: '1/3' },
      ],
      creditCardBreakdown: [
        { title: 'New Balance 740 Grey Blue', amountRp: 316500, sliceLabel: '3/6' },
      ],
      holidaysIso: ['2026-12-25', '2027-01-01'],
      referenceDateIso: '2026-12-05',
    };
    const { engineSource: decSrc, ...goDecRadar } = await bridge.buildCashRadar(decRadarReq);
    expect(decSrc).toBe('GO_BINARY');
    expect(goDecRadar).toEqual(buildCashRadarTs(decRadarReq));
    expect(goDecRadar.events.find((e) => e.id === 'bill-spaylater')?.subItems).toHaveLength(2);
    expect(goDecRadar.events.find((e) => e.id === 'bill-permata-cc')?.subItems).toHaveLength(1);
    expect(goDecRadar.events.find((e) => e.id === 'inflow-thr')?.dateIso).toBe('2026-12-18');
  });

  it('maintains 100% Go <-> TS parity on concurrent Monte Carlo stress tests, Surplus Allocation Frontier optimizer, and parallel 8-engine intelligence-batch', async () => {
    const bridge = new GoBridgeService();
    const mcReq = {
      startingLiquidAssetsRp: 500000,
      startingSavingsRp: 2000000,
      emergencyFundTargetRp: 15000000,
      incomeVolatilityPct: 12,
      expenseShockProbPct: 20,
      expenseShockMagnitudePct: 25,
      unexpectedEmergencyProbPct: 10,
      unexpectedEmergencyCostRp: 1500000,
      trials: 1000,
      seed: 20261123,
      periods: [
        { label: "DEC '26", incomeRp: 9737425, debtDueRp: 4189341, fixedBillsRp: 300000, livingTargetRp: 1500000, savingsTargetRp: 1000000 },
        { label: "JAN '27", incomeRp: 5941000, debtDueRp: 3171115, fixedBillsRp: 535000, livingTargetRp: 1500000, savingsTargetRp: 1000000 },
        { label: "FEB '27", incomeRp: 5891000, debtDueRp: 1967159, fixedBillsRp: 535000, livingTargetRp: 1500000, savingsTargetRp: 1000000 },
        { label: "MAR '27", incomeRp: 5891000, debtDueRp: 835996, fixedBillsRp: 535000, livingTargetRp: 1500000, savingsTargetRp: 1000000 },
      ],
    };
    const { engineSource: mcSrc, computeDurationUs: mcGoUs, workerGoroutines: mcGoW, ...mcGo } = await bridge.runMonteCarlo(mcReq);
    const { computeDurationUs: _mcTsUs, workerGoroutines: _mcTsW, ...mcTs } = runMonteCarloTs(mcReq);
    expect(mcSrc).toBe('GO_BINARY');
    expect(mcGoUs).toBeGreaterThan(0);
    expect(mcGoW).toBeGreaterThanOrEqual(1);
    expect(mcGo).toEqual(mcTs);

    const optReq = {
      monthlySurplusRp: 2000000,
      currentSavingsRp: 1500000,
      emergencyFundTargetRp: 15000000,
      monthlyEssentialsRp: 2000000,
      debts: [
        { title: 'Personal Loan', remainingRp: 1200000, monthlyInstallmentRp: 400000, monthlyInterestPct: 3.95, remainingMonths: 3 },
      ],
      goals: [
        { title: 'Laptop Reserve', targetRp: 12000000, allocatedRp: 2000000 },
      ],
    };
    const { engineSource: optSrc, computeDurationUs: optGoUs, workerGoroutines: _optGoW, ...optGo } = await bridge.optimizeAllocationFrontier(optReq);
    const { computeDurationUs: _optTsUs, workerGoroutines: _optTsW, ...optTs } = optimizeAllocationFrontierTs(optReq);
    expect(optSrc).toBe('GO_BINARY');
    expect(optGoUs).toBeGreaterThan(0);
    expect(optGo).toEqual(optTs);

    const batchReq = {
      paycycle: {
        month: 12,
        year: 2026,
        anchorDay: 27,
        payslipAnchorDay: 25,
        payslipShiftRule: 'SHIFT_PREVIOUS_FRIDAY' as const,
        reviewLagWorkingDays: 2,
        holidaysIso: ['2026-12-25'],
        shiftWeekendToFriday: true,
        weekendMultiplier: 1.5,
        remainingBudgetRp: 1500000,
        referenceDateIso: '2026-11-28',
      },
      networth: { accounts: [], upcomingPeriods: [] },
      forecaster: {
        startingLiquidAssetsRp: 500000,
        startingP1VaultRp: 2000000,
        emergencyFundTargetRp: 15000000,
        baselineDailyBurnRp: 50000,
        rdpuAnnualYieldPct: 4.5,
        variableShockPercent: 15,
        periods: [],
      },
      anomaly: {
        periodLabel: "DEC '26",
        totalCycleDays: 31,
        elapsedDays: 5,
        dailyLivingBudgetRp: 1500000,
        dailyLivingSpentRp: 200000,
        baselineDailyRateRp: 48000,
        cashTransactions: [],
        postCutoffItems: [],
        recurringCharges: [],
      },
      envelopes: {
        liquidCashTotalRp: 500000,
        dailyAverageBurnRp: 50000,
        monthlyInflowRp: 5900000,
        cycleElapsedDays: 5,
        cycleTotalDays: 31,
        envelopes: [],
        sinkingFunds: [],
      },
      debtopt: { contracts: [], extraLumpSumRp: 0 },
      lifeenergy: {
        netMonthlyIncomeRp: 5900000,
        workdaysPerMonth: 20,
        workHoursPerDay: 8,
        dailyCommuteHours: 2,
        monthlyWorkExpenseRp: 300000,
        sampleAmountsRp: [35000, 150000],
      },
      formula: { variables: { NET_INCOME: 5900000 }, formulas: { test: '{NET_INCOME} / 10' } },
    };
    const { engineSource: bSrc, computeDurationUs: bGoUs, workerGoroutines: bGoW, ...bGo } = await bridge.runIntelligenceBatch(batchReq);
    const { computeDurationUs: _bTsUs, workerGoroutines: _bTsW, ...bTs } = runIntelligenceBatchTs(batchReq);
    expect(bSrc).toBe('GO_BINARY');
    expect(bGoUs).toBeGreaterThan(0);
    expect(bGoW).toBe(8);
    expect(bGo).toEqual(bTs);
  });
});
