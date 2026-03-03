#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OpenRide — k6 Load Test Runner
#
# Usage:
#   ./run.sh smoke          # Quick smoke test (1 VU, 1 min)
#   ./run.sh average        # Average load test (50 VUs, 10 min)
#   ./run.sh stress         # Stress test (up to 200 VUs, 20 min)
#   ./run.sh spike          # Spike test (sudden surge to 200 VUs)
#   ./run.sh soak           # Soak/endurance test (30 VUs, 30 min)
#   ./run.sh all            # Run all scenarios sequentially
#   ./run.sh security       # Run security-specific tests (OWASP headers + rate limits)
#
# Environment variables:
#   BASE_URL              — API base URL (default: http://localhost:3000)
#   TEST_USER_EMAIL       — Pre-seeded passenger email
#   TEST_USER_PASSWORD    — Pre-seeded passenger password
#   TEST_DRIVER_EMAIL     — Pre-seeded driver email
#   TEST_DRIVER_PASSWORD  — Pre-seeded driver password
#   K6_OUT                — k6 output plugin (e.g. "influxdb=http://localhost:8086/k6")
#   RESULTS_DIR           — Directory for JSON results (default: ./results)
# ---------------------------------------------------------------------------

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${RESULTS_DIR:-${SCRIPT_DIR}/results}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# Colour output (if terminal supports it)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No colour

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
}

check_k6() {
  if ! command -v k6 &>/dev/null; then
    log_error "k6 is not installed. Install it from https://k6.io/docs/getting-started/installation/"
    echo ""
    echo "  Quick install:"
    echo "    macOS:  brew install k6"
    echo "    Linux:  sudo snap install k6"
    echo "    Docker: docker run --rm -i grafana/k6 run -"
    echo ""
    exit 1
  fi
  log_info "k6 version: $(k6 version)"
}

check_api() {
  log_info "Checking API health at ${BASE_URL}/health ..."
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" 2>/dev/null || echo "000")

  if [ "$http_code" = "200" ]; then
    log_success "API is healthy (HTTP ${http_code})"
  else
    log_warn "API health check returned HTTP ${http_code} — tests may fail"
    echo -e "  Make sure the backend is running: ${YELLOW}cd backend && npm start${NC}"
  fi
}

ensure_results_dir() {
  mkdir -p "${RESULTS_DIR}"
  log_info "Results will be saved to: ${RESULTS_DIR}"
}

# Build k6 run command with common flags
run_k6() {
  local scenario_name="$1"
  local script_path="$2"
  local result_file="${RESULTS_DIR}/${scenario_name}_${TIMESTAMP}.json"

  log_info "=========================================="
  log_info "Running: ${scenario_name}"
  log_info "Script:  ${script_path}"
  log_info "Results: ${result_file}"
  log_info "=========================================="

  local k6_cmd=(
    k6 run
    --out "json=${result_file}"
    -e "BASE_URL=${BASE_URL}"
  )

  # Pass through optional env vars if set
  [ -n "${TEST_USER_EMAIL:-}" ]      && k6_cmd+=(-e "TEST_USER_EMAIL=${TEST_USER_EMAIL}")
  [ -n "${TEST_USER_PASSWORD:-}" ]   && k6_cmd+=(-e "TEST_USER_PASSWORD=${TEST_USER_PASSWORD}")
  [ -n "${TEST_DRIVER_EMAIL:-}" ]    && k6_cmd+=(-e "TEST_DRIVER_EMAIL=${TEST_DRIVER_EMAIL}")
  [ -n "${TEST_DRIVER_PASSWORD:-}" ] && k6_cmd+=(-e "TEST_DRIVER_PASSWORD=${TEST_DRIVER_PASSWORD}")

  # Add external output if configured (e.g. InfluxDB)
  [ -n "${K6_OUT:-}" ] && k6_cmd+=(--out "${K6_OUT}")

  k6_cmd+=("${script_path}")

  local start_time
  start_time=$(date +%s)

  if "${k6_cmd[@]}"; then
    local end_time
    end_time=$(date +%s)
    local duration=$(( end_time - start_time ))
    log_success "${scenario_name} completed in ${duration}s"
  else
    local end_time
    end_time=$(date +%s)
    local duration=$(( end_time - start_time ))
    log_error "${scenario_name} FAILED after ${duration}s"
    return 1
  fi

  echo ""
}

# ---------------------------------------------------------------------------
# Scenario runners
# ---------------------------------------------------------------------------

run_smoke() {
  run_k6 "smoke" "${SCRIPT_DIR}/scenarios/smoke.js"
}

run_average() {
  run_k6 "average-load" "${SCRIPT_DIR}/scenarios/average-load.js"
}

run_stress() {
  run_k6 "stress" "${SCRIPT_DIR}/scenarios/stress.js"
}

run_spike() {
  run_k6 "spike" "${SCRIPT_DIR}/scenarios/spike.js"
}

run_soak() {
  run_k6 "soak" "${SCRIPT_DIR}/scenarios/soak.js"
}

run_owasp_headers() {
  run_k6 "owasp-headers" "${SCRIPT_DIR}/../security/owasp-headers.js"
}

run_rate_limit() {
  run_k6 "rate-limit" "${SCRIPT_DIR}/../security/rate-limit-test.js"
}

run_security() {
  log_info "Running security test suite..."
  run_owasp_headers
  run_rate_limit
  log_success "Security test suite complete."
}

run_all() {
  log_info "Running ALL load test scenarios sequentially..."
  echo ""

  local failed=0

  run_smoke   || (( failed++ )) || true
  run_average || (( failed++ )) || true
  run_stress  || (( failed++ )) || true
  run_spike   || (( failed++ )) || true
  run_soak    || (( failed++ )) || true

  echo ""
  if [ "$failed" -eq 0 ]; then
    log_success "All scenarios completed successfully!"
  else
    log_error "${failed} scenario(s) failed."
    exit 1
  fi
}

usage() {
  echo ""
  echo "Usage: $0 <scenario>"
  echo ""
  echo "Available scenarios:"
  echo "  smoke       — Quick sanity check (1 VU, 1 minute)"
  echo "  average     — Normal traffic simulation (50 VUs, 10 minutes)"
  echo "  stress      — Stress test (ramp to 200 VUs, 20 minutes)"
  echo "  spike       — Sudden traffic spike (10 -> 200 -> 10 VUs)"
  echo "  soak        — Endurance test (30 VUs, 30 minutes)"
  echo "  security    — Security tests (OWASP headers + rate limits)"
  echo "  all         — Run all load test scenarios sequentially"
  echo ""
  echo "Environment variables:"
  echo "  BASE_URL=http://localhost:3000   — API base URL"
  echo "  RESULTS_DIR=./results            — Directory for JSON output"
  echo "  K6_OUT=influxdb=http://...       — External metrics output"
  echo ""
  echo "Examples:"
  echo "  $0 smoke"
  echo "  BASE_URL=https://staging.openride.community $0 average"
  echo "  K6_OUT='influxdb=http://localhost:8086/k6' $0 stress"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  if [ $# -eq 0 ]; then
    usage
    exit 1
  fi

  check_k6
  check_api
  ensure_results_dir

  case "$1" in
    smoke)    run_smoke ;;
    average)  run_average ;;
    stress)   run_stress ;;
    spike)    run_spike ;;
    soak)     run_soak ;;
    security) run_security ;;
    all)      run_all ;;
    *)
      log_error "Unknown scenario: $1"
      usage
      exit 1
      ;;
  esac
}

main "$@"
