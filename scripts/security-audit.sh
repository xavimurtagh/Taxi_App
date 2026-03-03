#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OpenRide Security Audit Script
#
# Performs automated security checks across the codebase:
#   - npm audit (backend and mobile)
#   - .env files in git history
#   - Hardcoded secrets in source code
#   - Debug/console.log in production code
#   - Helmet configuration verification
#   - Rate limiting verification
#   - SQL injection vulnerability patterns
#   - CORS configuration check
#
# Usage:
#   ./scripts/security-audit.sh
#   ./scripts/security-audit.sh --json    # Output as JSON
#
# Exit codes:
#   0 — All checks passed
#   1 — Critical findings detected
#   2 — Warnings detected (no critical)
# ---------------------------------------------------------------------------

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
MOBILE_DIR="${PROJECT_ROOT}/mobile"

# Counters
CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
INFO=0
PASS=0

# Output format
OUTPUT_FORMAT="${1:-text}"

# Colors (disabled for non-TTY or JSON output)
if [ -t 1 ] && [ "${OUTPUT_FORMAT}" != "--json" ]; then
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  GREEN='\033[0;32m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  NC='\033[0m' # No Color
  BOLD='\033[1m'
else
  RED=''
  YELLOW=''
  GREEN=''
  BLUE=''
  CYAN=''
  NC=''
  BOLD=''
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

print_banner() {
  echo ""
  echo -e "${BOLD}=================================================================${NC}"
  echo -e "${BOLD}  OpenRide Security Audit Report${NC}"
  echo -e "${BOLD}  Date: $(date -Iseconds)${NC}"
  echo -e "${BOLD}  Project: ${PROJECT_ROOT}${NC}"
  echo -e "${BOLD}=================================================================${NC}"
  echo ""
}

print_section() {
  echo ""
  echo -e "${CYAN}--- $1 ---${NC}"
  echo ""
}

finding() {
  local severity="$1"
  local message="$2"
  local details="${3:-}"

  case "${severity}" in
    CRITICAL) ((CRITICAL++)); echo -e "  ${RED}[CRITICAL]${NC} ${message}" ;;
    HIGH)     ((HIGH++));     echo -e "  ${RED}[HIGH]${NC}     ${message}" ;;
    MEDIUM)   ((MEDIUM++));   echo -e "  ${YELLOW}[MEDIUM]${NC}   ${message}" ;;
    LOW)      ((LOW++));      echo -e "  ${YELLOW}[LOW]${NC}      ${message}" ;;
    INFO)     ((INFO++));     echo -e "  ${BLUE}[INFO]${NC}     ${message}" ;;
    PASS)     ((PASS++));     echo -e "  ${GREEN}[PASS]${NC}     ${message}" ;;
  esac

  if [ -n "${details}" ]; then
    echo -e "             ${details}"
  fi
}

# ---------------------------------------------------------------------------
# Check 1: npm audit — Backend
# ---------------------------------------------------------------------------

check_npm_audit_backend() {
  print_section "1. npm audit — Backend"

  if [ ! -d "${BACKEND_DIR}" ]; then
    finding "INFO" "Backend directory not found at ${BACKEND_DIR}"
    return
  fi

  if [ ! -f "${BACKEND_DIR}/package-lock.json" ] && [ ! -f "${BACKEND_DIR}/package.json" ]; then
    finding "INFO" "No package.json found in backend"
    return
  fi

  cd "${BACKEND_DIR}"

  # Run npm audit and capture output
  local audit_output
  audit_output=$(npm audit --json 2>/dev/null || true)

  if echo "${audit_output}" | grep -q '"vulnerabilities"'; then
    local critical_count high_count moderate_count low_count
    critical_count=$(echo "${audit_output}" | grep -o '"critical":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
    high_count=$(echo "${audit_output}" | grep -o '"high":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
    moderate_count=$(echo "${audit_output}" | grep -o '"moderate":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
    low_count=$(echo "${audit_output}" | grep -o '"low":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")

    if [ "${critical_count}" -gt 0 ] 2>/dev/null; then
      finding "CRITICAL" "Backend has ${critical_count} critical vulnerability(ies)" "Run: cd backend && npm audit"
    fi
    if [ "${high_count}" -gt 0 ] 2>/dev/null; then
      finding "HIGH" "Backend has ${high_count} high severity vulnerability(ies)" "Run: cd backend && npm audit"
    fi
    if [ "${moderate_count}" -gt 0 ] 2>/dev/null; then
      finding "MEDIUM" "Backend has ${moderate_count} moderate vulnerability(ies)"
    fi
    if [ "${low_count}" -gt 0 ] 2>/dev/null; then
      finding "LOW" "Backend has ${low_count} low severity vulnerability(ies)"
    fi
    if [ "${critical_count:-0}" -eq 0 ] && [ "${high_count:-0}" -eq 0 ] && [ "${moderate_count:-0}" -eq 0 ] && [ "${low_count:-0}" -eq 0 ]; then
      finding "PASS" "Backend npm audit: no known vulnerabilities"
    fi
  else
    finding "PASS" "Backend npm audit: no known vulnerabilities"
  fi

  cd "${PROJECT_ROOT}"
}

# ---------------------------------------------------------------------------
# Check 2: npm audit — Mobile
# ---------------------------------------------------------------------------

check_npm_audit_mobile() {
  print_section "2. npm audit — Mobile"

  if [ ! -d "${MOBILE_DIR}" ]; then
    finding "INFO" "Mobile directory not found at ${MOBILE_DIR}"
    return
  fi

  if [ ! -f "${MOBILE_DIR}/package.json" ]; then
    finding "INFO" "No package.json found in mobile"
    return
  fi

  cd "${MOBILE_DIR}"

  local audit_output
  audit_output=$(npm audit --json 2>/dev/null || true)

  if echo "${audit_output}" | grep -q '"vulnerabilities"'; then
    local critical_count high_count
    critical_count=$(echo "${audit_output}" | grep -o '"critical":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
    high_count=$(echo "${audit_output}" | grep -o '"high":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")

    if [ "${critical_count}" -gt 0 ] 2>/dev/null; then
      finding "CRITICAL" "Mobile has ${critical_count} critical vulnerability(ies)"
    fi
    if [ "${high_count}" -gt 0 ] 2>/dev/null; then
      finding "HIGH" "Mobile has ${high_count} high severity vulnerability(ies)"
    fi
    if [ "${critical_count:-0}" -eq 0 ] && [ "${high_count:-0}" -eq 0 ]; then
      finding "PASS" "Mobile npm audit: no critical/high vulnerabilities"
    fi
  else
    finding "PASS" "Mobile npm audit: no known vulnerabilities"
  fi

  cd "${PROJECT_ROOT}"
}

# ---------------------------------------------------------------------------
# Check 3: .env files in git history
# ---------------------------------------------------------------------------

check_env_in_git() {
  print_section "3. .env files in git history"

  cd "${PROJECT_ROOT}"

  if [ ! -d ".git" ]; then
    finding "INFO" "Not a git repository — skipping git history checks"
    return
  fi

  # Check for .env files currently tracked
  local tracked_env
  tracked_env=$(git ls-files | grep -E '\.env$|\.env\.' | grep -v '.env.example' | grep -v '.env.sample' || true)

  if [ -n "${tracked_env}" ]; then
    finding "CRITICAL" ".env files are tracked in git:" "${tracked_env}"
  else
    finding "PASS" "No .env files currently tracked in git"
  fi

  # Check git history for .env files that were previously committed
  local history_env
  history_env=$(git log --all --diff-filter=A --name-only --pretty=format: -- '*.env' '.env.*' 2>/dev/null | grep -v '^$' | grep -v '.env.example' | grep -v '.env.sample' | sort -u || true)

  if [ -n "${history_env}" ]; then
    finding "HIGH" ".env files found in git history (may contain leaked secrets):" "${history_env}"
    finding "INFO" "Consider using: git filter-branch or BFG Repo-Cleaner to remove sensitive history"
  else
    finding "PASS" "No .env files found in git history"
  fi

  # Check .gitignore for .env
  if [ -f ".gitignore" ]; then
    if grep -q '\.env' .gitignore; then
      finding "PASS" ".gitignore includes .env pattern"
    else
      finding "MEDIUM" ".gitignore does not include .env pattern" "Add '.env' and '.env.*' to .gitignore"
    fi
  else
    finding "MEDIUM" "No .gitignore file found"
  fi
}

# ---------------------------------------------------------------------------
# Check 4: Hardcoded secrets in source code
# ---------------------------------------------------------------------------

check_hardcoded_secrets() {
  print_section "4. Hardcoded secrets in source code"

  cd "${PROJECT_ROOT}"

  # Patterns to look for (excluding test files, node_modules, and config templates)
  local secret_patterns=(
    'AKIA[0-9A-Z]{16}'                    # AWS Access Key
    'sk_live_[a-zA-Z0-9]{24,}'            # Stripe live key
    'sk-[a-zA-Z0-9]{48,}'                 # OpenAI key
    'ghp_[a-zA-Z0-9]{36}'                 # GitHub PAT
    'password\s*[:=]\s*["\x27][^"\x27]{6,}'   # Hardcoded passwords
    'secret\s*[:=]\s*["\x27][a-zA-Z0-9+/]{20,}'  # Generic secrets
    'token\s*[:=]\s*["\x27][a-zA-Z0-9._-]{20,}'  # Hardcoded tokens
    'api[_-]?key\s*[:=]\s*["\x27][a-zA-Z0-9]{16,}' # API keys
  )

  local found_secrets=0

  for pattern in "${secret_patterns[@]}"; do
    local matches
    matches=$(grep -rn --include='*.js' --include='*.ts' --include='*.json' \
      -E "${pattern}" \
      "${BACKEND_DIR}/src" "${MOBILE_DIR}/src" 2>/dev/null \
      | grep -v 'node_modules' \
      | grep -v '.test.' \
      | grep -v '.spec.' \
      | grep -v 'package-lock.json' \
      | grep -v 'change-me' \
      | grep -v 'example' \
      | grep -v 'placeholder' \
      | grep -v 'TODO' \
      | head -5 || true)

    if [ -n "${matches}" ]; then
      finding "CRITICAL" "Potential hardcoded secret found (pattern: ${pattern}):" "${matches}"
      found_secrets=1
    fi
  done

  if [ "${found_secrets}" -eq 0 ]; then
    finding "PASS" "No hardcoded secrets detected in source code"
  fi
}

# ---------------------------------------------------------------------------
# Check 5: Debug/console.log in production code
# ---------------------------------------------------------------------------

check_debug_statements() {
  print_section "5. Debug statements in production code"

  cd "${PROJECT_ROOT}"

  # Count console.log statements in backend src (excluding test files)
  local console_count
  console_count=$(grep -rn 'console\.log\|console\.debug' \
    --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" 2>/dev/null \
    | grep -v '.test.' \
    | grep -v '.spec.' \
    | grep -v 'node_modules' \
    | wc -l || echo "0")

  console_count=$(echo "${console_count}" | tr -d ' ')

  if [ "${console_count}" -gt 20 ]; then
    finding "MEDIUM" "Found ${console_count} console.log/debug statements in backend code" \
      "Consider using a proper logger (winston, pino) with log levels"
  elif [ "${console_count}" -gt 0 ]; then
    finding "LOW" "Found ${console_count} console.log/debug statements in backend code"
  else
    finding "PASS" "No console.log/debug statements found in backend code"
  fi

  # Check for debugger statements
  local debugger_count
  debugger_count=$(grep -rn 'debugger;' \
    --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" "${MOBILE_DIR}/src" 2>/dev/null \
    | grep -v 'node_modules' \
    | wc -l || echo "0")

  debugger_count=$(echo "${debugger_count}" | tr -d ' ')

  if [ "${debugger_count}" -gt 0 ]; then
    finding "HIGH" "Found ${debugger_count} 'debugger;' statement(s) in source code" \
      "These must be removed before production deployment"
  else
    finding "PASS" "No debugger statements found"
  fi
}

# ---------------------------------------------------------------------------
# Check 6: Helmet configuration
# ---------------------------------------------------------------------------

check_helmet() {
  print_section "6. Helmet configuration"

  cd "${PROJECT_ROOT}"

  # Check if helmet is a dependency
  if grep -q '"helmet"' "${BACKEND_DIR}/package.json" 2>/dev/null; then
    finding "PASS" "Helmet is listed as a dependency"
  else
    finding "HIGH" "Helmet is NOT listed as a dependency" \
      "Install: npm install helmet"
    return
  fi

  # Check if helmet is imported and used
  local helmet_usage
  helmet_usage=$(grep -rn "helmet\|import.*helmet\|require.*helmet" \
    --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" 2>/dev/null \
    | grep -v 'node_modules' || true)

  if [ -n "${helmet_usage}" ]; then
    finding "PASS" "Helmet is imported and used in backend code"
  else
    finding "HIGH" "Helmet is installed but not imported/used in code"
  fi

  # Check for app.use(helmet()) call
  if grep -rq 'app\.use(helmet\(\))' --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" 2>/dev/null; then
    finding "PASS" "helmet() is applied as middleware"
  else
    finding "MEDIUM" "Could not find explicit app.use(helmet()) call" \
      "Ensure helmet is applied to all routes"
  fi
}

# ---------------------------------------------------------------------------
# Check 7: Rate limiting configuration
# ---------------------------------------------------------------------------

check_rate_limiting() {
  print_section "7. Rate limiting configuration"

  cd "${PROJECT_ROOT}"

  # Check if express-rate-limit is a dependency
  if grep -q '"express-rate-limit"' "${BACKEND_DIR}/package.json" 2>/dev/null; then
    finding "PASS" "express-rate-limit is listed as a dependency"
  else
    finding "HIGH" "express-rate-limit is NOT listed as a dependency" \
      "Install: npm install express-rate-limit"
    return
  fi

  # Check for rate limiter usage
  local rate_limit_files
  rate_limit_files=$(grep -rln "rateLimit\|rate-limit\|rateLimiter" \
    --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" 2>/dev/null \
    | grep -v 'node_modules' || true)

  if [ -n "${rate_limit_files}" ]; then
    finding "PASS" "Rate limiting is configured in: $(echo "${rate_limit_files}" | tr '\n' ', ')"
  else
    finding "HIGH" "Rate limiting code not found in backend"
  fi

  # Check for auth-specific rate limiting
  if grep -rq "authLimiter\|auth.*Limiter\|auth.*rate" \
    --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" 2>/dev/null; then
    finding "PASS" "Auth-specific rate limiting detected"
  else
    finding "MEDIUM" "No auth-specific rate limiting detected" \
      "Auth endpoints should have stricter rate limits"
  fi
}

# ---------------------------------------------------------------------------
# Check 8: SQL injection vulnerabilities
# ---------------------------------------------------------------------------

check_sql_injection() {
  print_section "8. SQL injection vulnerability check"

  cd "${PROJECT_ROOT}"

  # Look for string concatenation in SQL queries (dangerous pattern)
  local concat_sql
  concat_sql=$(grep -rn --include='*.js' --include='*.ts' \
    -E '(query|exec|execute)\s*\(\s*[`"'"'"'].*\$\{|query\s*\(\s*[`"'"'"'].*\+\s*(req\.|params\.|body\.|query\.)' \
    "${BACKEND_DIR}/src" 2>/dev/null \
    | grep -v 'node_modules' \
    | grep -v '.test.' \
    | grep -v '.spec.' || true)

  if [ -n "${concat_sql}" ]; then
    finding "CRITICAL" "Potential SQL injection: string concatenation in queries:" "${concat_sql}"
  else
    finding "PASS" "No obvious SQL injection via string concatenation detected"
  fi

  # Check for parameterized queries (positive signal)
  local param_queries
  param_queries=$(grep -rc '\$[0-9]\|$[0-9]' \
    --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" 2>/dev/null \
    | grep -v ':0$' \
    | grep -v 'node_modules' \
    | wc -l || echo "0")

  param_queries=$(echo "${param_queries}" | tr -d ' ')

  if [ "${param_queries}" -gt 0 ]; then
    finding "PASS" "Found parameterized queries (\$1, \$2, ...) in ${param_queries} file(s)"
  else
    finding "MEDIUM" "No parameterized query patterns detected" \
      "Ensure all database queries use parameterized values"
  fi
}

# ---------------------------------------------------------------------------
# Check 9: CORS configuration
# ---------------------------------------------------------------------------

check_cors() {
  print_section "9. CORS configuration"

  cd "${PROJECT_ROOT}"

  # Check if CORS is configured
  if grep -rq "cors\|CORS" --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" 2>/dev/null; then
    finding "PASS" "CORS configuration found in backend code"
  else
    finding "HIGH" "No CORS configuration found"
    return
  fi

  # Check for wildcard origin in production
  local wildcard_cors
  wildcard_cors=$(grep -rn "origin.*['\"]\\*['\"]" \
    --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" 2>/dev/null \
    | grep -v 'node_modules' \
    | grep -v 'development' \
    | grep -v 'test' || true)

  if [ -n "${wildcard_cors}" ]; then
    # Check if it's guarded by environment check
    if echo "${wildcard_cors}" | grep -q "production\|NODE_ENV"; then
      finding "PASS" "Wildcard CORS origin is environment-guarded"
    else
      finding "HIGH" "Wildcard CORS origin ('*') detected without environment guard:" "${wildcard_cors}"
    fi
  else
    finding "PASS" "No unguarded wildcard CORS origin found"
  fi

  # Check for credentials with CORS
  if grep -rq "credentials.*true" --include='*.js' --include='*.ts' \
    "${BACKEND_DIR}/src" 2>/dev/null | grep -q "cors"; then
    finding "INFO" "CORS credentials are enabled — ensure origin is not wildcard in production"
  fi
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

print_summary() {
  echo ""
  echo -e "${BOLD}=================================================================${NC}"
  echo -e "${BOLD}  AUDIT SUMMARY${NC}"
  echo -e "${BOLD}=================================================================${NC}"
  echo ""
  echo -e "  ${RED}CRITICAL:${NC}  ${CRITICAL}"
  echo -e "  ${RED}HIGH:${NC}      ${HIGH}"
  echo -e "  ${YELLOW}MEDIUM:${NC}    ${MEDIUM}"
  echo -e "  ${YELLOW}LOW:${NC}       ${LOW}"
  echo -e "  ${BLUE}INFO:${NC}      ${INFO}"
  echo -e "  ${GREEN}PASS:${NC}      ${PASS}"
  echo ""

  local total_findings=$((CRITICAL + HIGH + MEDIUM + LOW))
  if [ "${CRITICAL}" -gt 0 ]; then
    echo -e "  ${RED}${BOLD}RESULT: CRITICAL issues found — immediate action required${NC}"
  elif [ "${HIGH}" -gt 0 ]; then
    echo -e "  ${RED}RESULT: HIGH severity issues found — action recommended${NC}"
  elif [ "${MEDIUM}" -gt 0 ] || [ "${LOW}" -gt 0 ]; then
    echo -e "  ${YELLOW}RESULT: Warnings detected — review recommended${NC}"
  else
    echo -e "  ${GREEN}${BOLD}RESULT: All checks passed${NC}"
  fi

  echo ""
  echo -e "  Total checks passed: ${PASS}"
  echo -e "  Total findings:      ${total_findings}"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

print_banner

check_npm_audit_backend
check_npm_audit_mobile
check_env_in_git
check_hardcoded_secrets
check_debug_statements
check_helmet
check_rate_limiting
check_sql_injection
check_cors

print_summary

# Exit code based on severity
if [ "${CRITICAL}" -gt 0 ]; then
  exit 1
elif [ "${HIGH}" -gt 0 ]; then
  exit 1
elif [ "${MEDIUM}" -gt 0 ] || [ "${LOW}" -gt 0 ]; then
  exit 2
else
  exit 0
fi
