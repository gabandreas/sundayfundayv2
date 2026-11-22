import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import {
  CashRadarRequest,
  CashRadarResult,
  CutoffSimulateRequest,
  CutoffSimulateResult,
  ExecutiveHorizonRequest,
  ExecutiveHorizonResult,
  TimelineSimulateRequest,
  TimelineSimulateResult,
  WalletGuardRequest,
  WalletGuardResult,
  buildCashRadarTs,
  buildExecutiveHorizonTs,
  evaluateWalletGuardTs,
  simulateCutoffTs,
  simulateTimelineTs,
} from './hybrid-engine';
import {
  AnomalyRequest,
  AnomalyResult,
  DebtOptRequest,
  DebtOptResult,
  EnvelopesRequest,
  EnvelopesResult,
  ForecasterRequest,
  ForecasterResult,
  FormulaSuiteRequest,
  FormulaSuiteResult,
  LifeEnergyRequest,
  LifeEnergyResult,
  NetWorthRequest,
  NetWorthResult,
  PaycycleHorizonRequest,
  PaycycleHorizonResult,
  ReconcilerParseRequest,
  ReconcilerParseResult,
  RouteTxRequest,
  RouteTxResult,
  WaterfallConfigRequest,
  WaterfallConfigResult,
  computeLifeEnergyTs,
  computeNetWorthTs,
  computePaycycleHorizonTs,
  evaluateAnomaliesTs,
  evaluateConfiguredWaterfallTs,
  evaluateEnvelopesTs,
  evaluateFormulaSuiteTs,
  optimizeDebtPayoffTs,
  parseStatementBatchTs,
  routeTransactionToPaycycleTs,
  runForecastTs,
} from './erp-engines';

const execFileAsync = promisify(execFile);

export type HybridEngineSource = 'GO_BINARY' | 'TS_MIRROR';

export type WithEngineMeta<T> = T & {
  engineSource: HybridEngineSource;
};

@Injectable()
export class GoBridgeService {
  private readonly logger = new Logger(GoBridgeService.name);
  private resolvedBinPath: string | null | undefined = undefined;

  private resolveBinaryPath(): string | null {
    if (this.resolvedBinPath !== undefined) {
      return this.resolvedBinPath;
    }

    const candidates = [
      process.env.GO_ENGINE_BIN,
      join(process.cwd(), '..', 'go-engine', 'bin', process.platform === 'win32' ? 'go-engine.exe' : 'go-engine'),
      join(process.cwd(), 'apps', 'go-engine', 'bin', process.platform === 'win32' ? 'go-engine.exe' : 'go-engine'),
      join(__dirname, '..', '..', '..', '..', 'go-engine', 'bin', process.platform === 'win32' ? 'go-engine.exe' : 'go-engine'),
      join(process.cwd(), '..', 'go-engine', 'bin', process.platform === 'win32' ? 'erp-engine.exe' : 'erp-engine'),
      join(process.cwd(), 'apps', 'go-engine', 'bin', process.platform === 'win32' ? 'erp-engine.exe' : 'erp-engine'),
    ].filter((p): p is string => Boolean(p));

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        this.resolvedBinPath = candidate;
        return candidate;
      }
    }

    this.resolvedBinPath = null;
    return null;
  }

  private async runCommand<TReq, TRes>(
    cmd: string,
    payload: TReq,
    fallback: (req: TReq) => TRes,
  ): Promise<WithEngineMeta<TRes>> {
    const binPath = this.resolveBinaryPath();
    if (!binPath) {
      return { ...fallback(payload), engineSource: 'TS_MIRROR' };
    }

    try {
      const child = execFileAsync(binPath, ['-cmd', cmd], {
        timeout: 2500,
        maxBuffer: 4 * 1024 * 1024,
      });
      const proc = (child as any).child;
      if (proc?.stdin) {
        proc.stdin.write(JSON.stringify(payload));
        proc.stdin.end();
      }
      const { stdout } = await child;
      const parsed = JSON.parse(stdout) as TRes;
      return { ...parsed, engineSource: 'GO_BINARY' };
    } catch (err: any) {
      this.logger.warn(
        `Go engine '${cmd}' unavailable or failed (${err?.message ?? 'unknown'}), falling back to TS mirror`,
      );
      return { ...fallback(payload), engineSource: 'TS_MIRROR' };
    }
  }

  simulateCutoff(req: CutoffSimulateRequest): Promise<WithEngineMeta<CutoffSimulateResult>> {
    return this.runCommand('cutoff-simulate', req, simulateCutoffTs);
  }

  simulateTimeline(req: TimelineSimulateRequest): Promise<WithEngineMeta<TimelineSimulateResult>> {
    return this.runCommand('timeline-simulate', req, simulateTimelineTs);
  }

  buildCashRadar(req: CashRadarRequest): Promise<WithEngineMeta<CashRadarResult>> {
    return this.runCommand('cash-radar', req, buildCashRadarTs);
  }

  evaluateWalletGuard(req: WalletGuardRequest): Promise<WithEngineMeta<WalletGuardResult>> {
    return this.runCommand('wallet-guard', req, evaluateWalletGuardTs);
  }

  buildExecutiveHorizon(req: ExecutiveHorizonRequest): Promise<WithEngineMeta<ExecutiveHorizonResult>> {
    return this.runCommand('executive-horizon', req, buildExecutiveHorizonTs);
  }

  computePaycycleHorizon(req: PaycycleHorizonRequest): Promise<WithEngineMeta<PaycycleHorizonResult>> {
    return this.runCommand('paycycle-horizon', req, computePaycycleHorizonTs);
  }

  evaluateConfiguredWaterfall(req: WaterfallConfigRequest): Promise<WithEngineMeta<WaterfallConfigResult>> {
    return this.runCommand('paycycle-waterfall', req, evaluateConfiguredWaterfallTs);
  }

  routeTransactionToPaycycle(req: RouteTxRequest): Promise<WithEngineMeta<RouteTxResult>> {
    return this.runCommand('paycycle-route', req, routeTransactionToPaycycleTs);
  }

  computeNetWorth(req: NetWorthRequest): Promise<WithEngineMeta<NetWorthResult>> {
    return this.runCommand('networth', req, computeNetWorthTs);
  }

  runForecast(req: ForecasterRequest): Promise<WithEngineMeta<ForecasterResult>> {
    return this.runCommand('forecaster', req, runForecastTs);
  }

  evaluateAnomalies(req: AnomalyRequest): Promise<WithEngineMeta<AnomalyResult>> {
    return this.runCommand('anomaly', req, evaluateAnomaliesTs);
  }

  evaluateEnvelopes(req: EnvelopesRequest): Promise<WithEngineMeta<EnvelopesResult>> {
    return this.runCommand('envelopes', req, evaluateEnvelopesTs);
  }

  optimizeDebtPayoff(req: DebtOptRequest): Promise<WithEngineMeta<DebtOptResult>> {
    return this.runCommand('debtopt', req, optimizeDebtPayoffTs);
  }

  computeLifeEnergy(req: LifeEnergyRequest): Promise<WithEngineMeta<LifeEnergyResult>> {
    return this.runCommand('lifeenergy', req, computeLifeEnergyTs);
  }

  parseStatementBatch(req: ReconcilerParseRequest): Promise<WithEngineMeta<ReconcilerParseResult>> {
    return this.runCommand('reconciler', req, parseStatementBatchTs);
  }

  evaluateFormulaSuite(req: FormulaSuiteRequest): Promise<WithEngineMeta<FormulaSuiteResult>> {
    return this.runCommand('formula-eval', req, evaluateFormulaSuiteTs);
  }
}
