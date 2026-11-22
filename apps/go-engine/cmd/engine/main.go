package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"

	"sundayfunday.erp/go-engine/internal/anomaly"
	"sundayfunday.erp/go-engine/internal/cutoff"
	"sundayfunday.erp/go-engine/internal/debtopt"
	"sundayfunday.erp/go-engine/internal/doctor"
	"sundayfunday.erp/go-engine/internal/envelopes"
	"sundayfunday.erp/go-engine/internal/forecaster"
	"sundayfunday.erp/go-engine/internal/formula"
	"sundayfunday.erp/go-engine/internal/lifeenergy"
	"sundayfunday.erp/go-engine/internal/networth"
	"sundayfunday.erp/go-engine/internal/paycycle"
	"sundayfunday.erp/go-engine/internal/reconciler"
	"sundayfunday.erp/go-engine/internal/report"
	"sundayfunday.erp/go-engine/internal/timeline"
)

func main() {
	cmdFlag := flag.String("cmd", "", "Engine subcommand")
	flag.Parse()

	cmd := *cmdFlag
	if cmd == "" && flag.NArg() > 0 {
		cmd = flag.Arg(0)
	}

	if cmd == "version" {
		_ = json.NewEncoder(os.Stdout).Encode(map[string]string{"engine": "sundayfunday-go-engine", "version": "2.0.0"})
		return
	}

	raw, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed reading stdin: %v\n", err)
		os.Exit(1)
	}

	var out any
	switch cmd {
	case "cutoff-simulate":
		var req cutoff.CutoffRequest
		mustUnmarshal(raw, &req, cmd)
		out = cutoff.SimulateCutoff(req)
	case "timeline-simulate":
		var req timeline.TimelineSimulateRequest
		mustUnmarshal(raw, &req, cmd)
		out = timeline.SimulateTimeline(req)
	case "cash-radar":
		var req timeline.CashRadarRequest
		mustUnmarshal(raw, &req, cmd)
		out = timeline.BuildCashRadar(req)
	case "wallet-guard":
		var req timeline.WalletGuardRequest
		mustUnmarshal(raw, &req, cmd)
		out = timeline.EvaluateWalletGuard(req)
	case "executive-horizon":
		var req report.HorizonRequest
		mustUnmarshal(raw, &req, cmd)
		out = report.BuildExecutiveHorizon(req)
	case "doctor-audit":
		var req doctor.AuditRequest
		mustUnmarshal(raw, &req, cmd)
		out = doctor.RunAudit(req)
	case "paycycle", "paycycle-horizon":
		var req paycycle.HorizonRequest
		mustUnmarshal(raw, &req, cmd)
		out = paycycle.ComputePaycycleHorizon(req)
	case "paycycle-waterfall":
		var req paycycle.WaterfallConfigRequest
		mustUnmarshal(raw, &req, cmd)
		out = paycycle.EvaluateConfiguredWaterfall(req)
	case "paycycle-route":
		var req paycycle.RouteTxRequest
		mustUnmarshal(raw, &req, cmd)
		out = paycycle.RouteTransactionToPaycycle(req)
	case "networth":
		var req networth.NetWorthRequest
		mustUnmarshal(raw, &req, cmd)
		out = networth.ComputeNetWorth(req)
	case "forecaster":
		var req forecaster.ForecasterRequest
		mustUnmarshal(raw, &req, cmd)
		out = forecaster.RunForecast(req)
	case "anomaly":
		var req anomaly.AnomalyRequest
		mustUnmarshal(raw, &req, cmd)
		out = anomaly.EvaluateAnomalies(req)
	case "envelopes":
		var req envelopes.EnvelopesRequest
		mustUnmarshal(raw, &req, cmd)
		out = envelopes.EvaluateEnvelopes(req)
	case "debtopt":
		var req debtopt.DebtOptRequest
		mustUnmarshal(raw, &req, cmd)
		out = debtopt.OptimizeDebtPayoff(req)
	case "lifeenergy":
		var req lifeenergy.LifeEnergyRequest
		mustUnmarshal(raw, &req, cmd)
		out = lifeenergy.ComputeLifeEnergy(req)
	case "reconciler":
		var req reconciler.ParseRequest
		mustUnmarshal(raw, &req, cmd)
		out = reconciler.ParseStatementBatch(req)
	case "formula-eval":
		var req formula.FormulaSuiteRequest
		mustUnmarshal(raw, &req, cmd)
		out = formula.EvaluateFormulaSuite(req)
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n", cmd)
		os.Exit(2)
	}

	if err := json.NewEncoder(os.Stdout).Encode(out); err != nil {
		fmt.Fprintf(os.Stderr, "failed writing stdout: %v\n", err)
		os.Exit(1)
	}
}

func mustUnmarshal(raw []byte, dst any, cmd string) {
	if err := json.Unmarshal(raw, dst); err != nil {
		fmt.Fprintf(os.Stderr, "invalid %s payload: %v\n", cmd, err)
		os.Exit(1)
	}
}
