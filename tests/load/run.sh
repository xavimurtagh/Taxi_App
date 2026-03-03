#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OpenRide k6 Load Test Runner
#
# Usage:
#   ./run.sh smoke          # Quick smoke test (1 VU, 1 min)
#   ./run.sh average        # Average load test (50 VUs, 10 min)
#   ./run.sh stress         # Stress test (ramp to 200 VUs, 20 min)
#   ./run.sh spike          # Spike test (surge to 200 VUs, ~8 min)
#   ./run.sh soak           # Soak/endurance test (30 VUs, 30 min)
#   ./run.sh all            # Run all scenarios sequentially
#
# Environment variables:
#   BASE_URL             — API base URL (default: http://localhost:3000)
#   TEST_USER_EMAIL      — Pre-seeded test passenger email
#   TEST_USER_PASSWORD   — Pre-seeded test passenger password
#   TEST_DRIVER_EMAIL    — Pre-seeded test driver email
#   TEST_DRIVER_PASSWORD — Pre-seeded test driver password
#   K6_OUT               — k6 output backend (e.g. "influxdb=http://localhost:8086/k6")
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="${SCRIPT_DIR}/scenarios"
RESULTS_DIR="${SCRIPT_DIR}/results"

# Default base URL
export BASE_URL="${BASE_URL:-http://localhost:3000}"

# Timestamp for output files
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# Create results directory
mkdir -p "${RESULTS_DIR}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

print_header() {
  echo ""
  echo "=================================================================="
  echo "  OpenRide Load Test: $1"
  echo "  Base URL: ${BASE_URL}"
  echo "  Started:  $(date -Iseconds)"
  echo "=================================================================="
  echo ""
}

print_footer() {
  echo ""
  echo "=================================================================="
  echo "  Completed: $1"
  echo "  Finished:  $(date -Iseconds)"
  echo "  Results:   ${RESULTS_DIR}/$2"
  echo "=================================================================="
  echo ""
}

check_k6() {
  if ! command -v k6 &> /dev/null; then
    echo "ERROR: k6 is not installed or not in PATH."
    echo ""
    echo "Install k6:"
    echo "  macOS:    brew install k6"
    echo "  Linux:    sudo snap install k6"
    echo "  Docker:   docker run --rm -i grafana/k6 run -"
    echo "  Manual:   https://k6.io/docs/getting-started/installation/"
    echo ""
    exit 1
  fi
}

check_server() {
  echo "Checking server availability at ${BASE_URL}/health ..."
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" 2>/dev/null || echo "000")

  if [ "${status}" = "000" ]; then
    echo "WARNING: Server at ${BASE_URL} is not reachable."
    echo "         Make sure the OpenRide API is running before load testing."
    echo ""
    read -rp "Continue anyway? [y/N] " answer
    if [[ ! "${answer}" =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 1
    fi
  elif [ "${status}" != "200" ]; then
    echo "WARNING: Server responded with HTTP ${status} (expected 200)."
    read -rp "Continue anyway? [y/N] " answer
    if [[ ! "${answer}" =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 1
    fi
  else
    echo "Server is reachable (HTTP 200)."
  fi
  echo ""
}

# Build k6 command with optional output backend
build_k6_cmd() {
  local script="$1"
  local summary_file="$2"
  local cmd="k6 run"

  # Export results as JSON summary
  cmd="${cmd} --summary-export=${summary_file}"

  # Optional output backend (e.g. InfluxDB, Prometheus, Cloud)
  if [ -n "${K6_OUT:-}" ]; then
    cmd="${cmd} --out ${K6_OUT}"
  fi

  cmd="${cmd} ${script}"
  echo "${cmd}"
}

# ---------------------------------------------------------------------------
# Scenario runners
# ---------------------------------------------------------------------------

run_smoke() {
  print_header "Smoke Test"
  local summary="${RESULTS_DIR}/smoke_${TIMESTAMP}.json"
  local cmd
  cmd=$(build_k6_cmd "${SCENARIOS_DIR}/smoke.js" "${summary}")
  echo "Running: ${cmd}"
  echo ""
  eval "${cmd}"
  print_footer "Smoke Test" "smoke_${TIMESTAMP}.json"
}

run_average() {
  print_header "Average Load Test"
  local summary="${RESULTS_DIR}/average_${TIMESTAMP}.json"
  local cmd
  cmd=$(build_k6_cmd "${SCENARIOS_DIR}/average-load.js" "${summary}")
  echo "Running: ${cmd}"
  echo ""
  eval "${cmd}"
  print_footer "Average Load Test" "average_${TIMESTAMP}.json"
}

run_stress() {
  print_header "Stress Test"
  local summary="${RESULTS_DIR}/stress_${TIMESTAMP}.json"
  local cmd
  cmd=$(build_k6_cmd "${SCENARIOS_DIR}/stress.js" "${summary}")
  echo "Running: ${cmd}"
  echo ""
  eval "${cmd}"
  print_footer "Stress Test" "stress_${TIMESTAMP}.json"
}

run_spike() {
  print_header "Spike Test"
  local summary="${RESULTS_DIR}/spike_${TIMESTAMP}.json"
  local cmd
  cmd=$(build_k6_cmd "${SCENARIOS_DIR}/spike.js" "${summary}")
  echo "Running: ${cmd}"
  echo ""
  eval "${cmd}"
  print_footer "Spike Test" "spike_${TIMESTAMP}.json"
}

run_soak() {
  print_header "Soak / Endurance Test"
  local summary="${RESULTS_DIR}/soak_${TIMESTAMP}.json"
  local cmd
  cmd=$(build_k6_cmd "${SCENARIOS_DIR}/soak.js" "${summary}")
  echo "Running: ${cmd}"
  echo ""
  eval "${cmd}"
  print_footer "Soak / Endurance Test" "soak_${TIMESTAMP}.json"
}

run_all() {
  echo ""
  echo "=================================================================="
  echo "  Running ALL load test scenarios sequentially"
  echo "  This will take approximately 60 minutes."
  echo "=================================================================="
  echo ""

  run_smoke
  echo "Cooldown: waiting 10 seconds before next scenario..."
  sleep 10

  run_average
  echo "Cooldown: waiting 15 seconds before next scenario..."
  sleep 15

  run_stress
  echo "Cooldown: waiting 15 seconds before next scenario..."
  sleep 15

  run_spike
  echo "Cooldown: waiting 15 seconds before next scenario..."
  sleep 15

  run_soak

  echo ""
  echo "=================================================================="
  echo "  ALL SCENARIOS COMPLETE"
  echo "  Results directory: ${RESULTS_DIR}"
  echo "=================================================================="
  echo ""
  ls -la "${RESULTS_DIR}"/*"${TIMESTAMP}"* 2>/dev/null || echo "  (no result files found)"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

check_k6

SCENARIO="${1:-help}"

case "${SCENARIO}" in
  smoke)
    check_server
    run_smoke
    ;;
  average)
    check_server
    run_average
    ;;
  stress)
    check_server
    run_stress
    ;;
  spike)
    check_server
    run_spike
    ;;
  soak)
    check_server
    run_soak
    ;;
  all)
    check_server
    run_all
    ;;
  help|--help|-h|*)
    echo ""
    echo "OpenRide Load Test Runner"
    echo ""
    echo "Usage: $0 <scenario>"
    echo ""
    echo "Scenarios:"
    echo "  smoke     Quick sanity check (1 VU, 1 min)"
    echo "  average   Normal traffic simulation (50 VUs, 10 min)"
    echo "  stress    Find breaking point (ramp to 200 VUs, 20 min)"
    echo "  spike     Sudden traffic surge (10 -> 200 -> 10 VUs, ~8 min)"
    echo "  soak      Endurance test for leaks (30 VUs, 30 min)"
    echo "  all       Run all scenarios sequentially (~60 min)"
    echo ""
    echo "Environment variables:"
    echo "  BASE_URL              API base URL (default: http://localhost:3000)"
    echo "  TEST_USER_EMAIL       Pre-seeded test passenger email"
    echo "  TEST_USER_PASSWORD    Pre-seeded test passenger password"
    echo "  TEST_DRIVER_EMAIL     Pre-seeded test driver email"
    echo "  TEST_DRIVER_PASSWORD  Pre-seeded test driver password"
    echo "  K6_OUT                k6 output backend (e.g. influxdb=http://...)"
    echo ""
    echo "Examples:"
    echo "  $0 smoke"
    echo "  BASE_URL=https://staging.openride.community $0 average"
    echo "  K6_OUT='influxdb=http://localhost:8086/k6' $0 stress"
    echo ""
    if [ "${SCENARIO}" != "help" ] && [ "${SCENARIO}" != "--help" ] && [ "${SCENARIO}" != "-h" ]; then
      echo "ERROR: Unknown scenario '${SCENARIO}'"
      exit 1
    fi
    ;;
esac
