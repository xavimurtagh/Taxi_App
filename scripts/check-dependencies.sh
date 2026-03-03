#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OpenRide Dependency Check Script
#
# Performs comprehensive dependency analysis:
#   - Checks for outdated packages (backend and mobile)
#   - Lists packages with known vulnerabilities
#   - Verifies license compatibility with AGPL-3.0 project license
#
# Usage:
#   ./scripts/check-dependencies.sh
#   ./scripts/check-dependencies.sh --backend-only
#   ./scripts/check-dependencies.sh --mobile-only
#
# Exit codes:
#   0 — No issues found
#   1 — Critical issues (vulnerabilities or license conflicts)
#   2 — Warnings (outdated packages, minor issues)
# ---------------------------------------------------------------------------

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
MOBILE_DIR="${PROJECT_ROOT}/mobile"

# AGPL-3.0 compatible licenses
# These licenses are known to be compatible with AGPL-3.0.
# See: https://www.gnu.org/licenses/license-list.html
COMPATIBLE_LICENSES=(
  "MIT"
  "ISC"
  "BSD-2-Clause"
  "BSD-3-Clause"
  "Apache-2.0"
  "0BSD"
  "CC0-1.0"
  "CC-BY-3.0"
  "CC-BY-4.0"
  "Unlicense"
  "WTFPL"
  "Zlib"
  "BlueOak-1.0.0"
  "AGPL-3.0"
  "AGPL-3.0-only"
  "AGPL-3.0-or-later"
  "GPL-2.0"
  "GPL-2.0-only"
  "GPL-2.0-or-later"
  "GPL-3.0"
  "GPL-3.0-only"
  "GPL-3.0-or-later"
  "LGPL-2.1"
  "LGPL-2.1-only"
  "LGPL-2.1-or-later"
  "LGPL-3.0"
  "LGPL-3.0-only"
  "LGPL-3.0-or-later"
  "MPL-2.0"
  "Python-2.0"
  "Artistic-2.0"
)

# Potentially problematic licenses for AGPL projects
PROBLEMATIC_LICENSES=(
  "SSPL"
  "BSL-1.0"
  "BUSL-1.1"
  "Elastic-2.0"
  "CPAL-1.0"
  "EUPL-1.1"
  "EUPL-1.2"
  "OSL-3.0"
  "AGPL-1.0"
)

# Counters
ISSUES=0
WARNINGS=0

# What to check
CHECK_BACKEND=true
CHECK_MOBILE=true

case "${1:-all}" in
  --backend-only) CHECK_MOBILE=false ;;
  --mobile-only)  CHECK_BACKEND=false ;;
esac

# Colors
if [ -t 1 ]; then
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  GREEN='\033[0;32m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  NC='\033[0m'
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
  echo -e "${BOLD}  OpenRide Dependency Check${NC}"
  echo -e "${BOLD}  Date: $(date -Iseconds)${NC}"
  echo -e "${BOLD}  Project License: AGPL-3.0${NC}"
  echo -e "${BOLD}=================================================================${NC}"
  echo ""
}

print_section() {
  echo ""
  echo -e "${CYAN}--- $1 ---${NC}"
  echo ""
}

# ---------------------------------------------------------------------------
# Check 1: Outdated packages
# ---------------------------------------------------------------------------

check_outdated() {
  local dir="$1"
  local name="$2"

  print_section "Outdated Packages: ${name}"

  if [ ! -f "${dir}/package.json" ]; then
    echo -e "  ${BLUE}[INFO]${NC} No package.json found in ${name}"
    return
  fi

  cd "${dir}"

  # npm outdated returns non-zero when there are outdated packages
  local outdated_output
  outdated_output=$(npm outdated --json 2>/dev/null || true)

  if [ -z "${outdated_output}" ] || [ "${outdated_output}" = "{}" ]; then
    echo -e "  ${GREEN}[PASS]${NC} All packages are up to date"
    cd "${PROJECT_ROOT}"
    return
  fi

  # Count outdated packages by type
  local major_count=0
  local minor_count=0
  local patch_count=0

  # Parse the JSON output to categorize updates
  # npm outdated --json format: { "pkg": { "current": "x", "wanted": "y", "latest": "z" } }
  while IFS= read -r pkg; do
    [ -z "${pkg}" ] && continue

    local current wanted latest
    current=$(echo "${outdated_output}" | grep -A5 "\"${pkg}\"" | grep '"current"' | grep -o '"[0-9][^"]*"' | tr -d '"' | head -1 || true)
    wanted=$(echo "${outdated_output}" | grep -A5 "\"${pkg}\"" | grep '"wanted"' | grep -o '"[0-9][^"]*"' | tr -d '"' | head -1 || true)
    latest=$(echo "${outdated_output}" | grep -A5 "\"${pkg}\"" | grep '"latest"' | grep -o '"[0-9][^"]*"' | tr -d '"' | head -1 || true)

    if [ -z "${current}" ] || [ -z "${latest}" ]; then
      continue
    fi

    # Determine update type by comparing major versions
    local current_major latest_major
    current_major=$(echo "${current}" | cut -d. -f1)
    latest_major=$(echo "${latest}" | cut -d. -f1)

    if [ "${current_major}" != "${latest_major}" ] 2>/dev/null; then
      ((major_count++))
      echo -e "  ${RED}[MAJOR]${NC}  ${pkg}: ${current} -> ${latest}"
    else
      local current_minor latest_minor
      current_minor=$(echo "${current}" | cut -d. -f2)
      latest_minor=$(echo "${latest}" | cut -d. -f2)

      if [ "${current_minor}" != "${latest_minor}" ] 2>/dev/null; then
        ((minor_count++))
        echo -e "  ${YELLOW}[MINOR]${NC}  ${pkg}: ${current} -> ${latest}"
      else
        ((patch_count++))
        echo -e "  ${BLUE}[PATCH]${NC}  ${pkg}: ${current} -> ${latest}"
      fi
    fi
  done < <(echo "${outdated_output}" | grep -o '"[a-zA-Z@][^"]*"\s*:' | sed 's/"\s*://' | tr -d '"')

  echo ""
  echo -e "  Summary: ${RED}${major_count} major${NC}, ${YELLOW}${minor_count} minor${NC}, ${BLUE}${patch_count} patch${NC} update(s) available"

  if [ "${major_count}" -gt 0 ]; then
    ((WARNINGS++))
    echo -e "  ${YELLOW}[WARNING]${NC} Major version updates may contain breaking changes"
  fi

  cd "${PROJECT_ROOT}"
}

# ---------------------------------------------------------------------------
# Check 2: Known vulnerabilities
# ---------------------------------------------------------------------------

check_vulnerabilities() {
  local dir="$1"
  local name="$2"

  print_section "Known Vulnerabilities: ${name}"

  if [ ! -f "${dir}/package.json" ]; then
    echo -e "  ${BLUE}[INFO]${NC} No package.json found in ${name}"
    return
  fi

  cd "${dir}"

  local audit_output
  audit_output=$(npm audit --json 2>/dev/null || true)

  if [ -z "${audit_output}" ]; then
    echo -e "  ${GREEN}[PASS]${NC} npm audit completed — no issues"
    cd "${PROJECT_ROOT}"
    return
  fi

  # Extract vulnerability counts
  local total critical high moderate low
  total=$(echo "${audit_output}" | grep -o '"total":[0-9]*' | tail -1 | grep -o '[0-9]*' || echo "0")
  critical=$(echo "${audit_output}" | grep -o '"critical":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
  high=$(echo "${audit_output}" | grep -o '"high":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
  moderate=$(echo "${audit_output}" | grep -o '"moderate":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
  low=$(echo "${audit_output}" | grep -o '"low":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")

  if [ "${total}" -eq 0 ] 2>/dev/null; then
    echo -e "  ${GREEN}[PASS]${NC} No known vulnerabilities"
  else
    echo -e "  Vulnerabilities found: ${total}"
    echo -e "    ${RED}Critical:${NC} ${critical}"
    echo -e "    ${RED}High:${NC}     ${high}"
    echo -e "    ${YELLOW}Moderate:${NC} ${moderate}"
    echo -e "    ${BLUE}Low:${NC}      ${low}"
    echo ""

    if [ "${critical}" -gt 0 ] 2>/dev/null || [ "${high}" -gt 0 ] 2>/dev/null; then
      ((ISSUES++))
      echo -e "  ${RED}[ACTION REQUIRED]${NC} Run 'npm audit fix' or 'npm audit fix --force'"
    else
      ((WARNINGS++))
    fi

    # List advisories
    echo ""
    echo "  Vulnerable packages:"
    npm audit 2>/dev/null | grep -E '^\s+(Severity|Package|Dependency|More info)' | head -20 || true
  fi

  cd "${PROJECT_ROOT}"
}

# ---------------------------------------------------------------------------
# Check 3: License compatibility
# ---------------------------------------------------------------------------

check_licenses() {
  local dir="$1"
  local name="$2"

  print_section "License Compatibility: ${name} (vs AGPL-3.0)"

  if [ ! -f "${dir}/package.json" ]; then
    echo -e "  ${BLUE}[INFO]${NC} No package.json found in ${name}"
    return
  fi

  cd "${dir}"

  # Check if npm ls is available and node_modules exists
  if [ ! -d "node_modules" ]; then
    echo -e "  ${YELLOW}[WARNING]${NC} node_modules not found — run 'npm install' first"
    ((WARNINGS++))
    cd "${PROJECT_ROOT}"
    return
  fi

  # Try to get license info from package.json files in node_modules
  local unknown_count=0
  local compatible_count=0
  local problematic_count=0
  local problematic_list=""

  # Read direct dependencies from package.json
  local deps
  deps=$(node -e "
    const pkg = require('./package.json');
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    console.log(Object.keys(all).join('\n'));
  " 2>/dev/null || true)

  if [ -z "${deps}" ]; then
    echo -e "  ${BLUE}[INFO]${NC} Could not parse dependencies"
    cd "${PROJECT_ROOT}"
    return
  fi

  while IFS= read -r dep; do
    [ -z "${dep}" ] && continue

    local pkg_json="${dir}/node_modules/${dep}/package.json"
    if [ ! -f "${pkg_json}" ]; then
      continue
    fi

    local license
    license=$(node -e "
      try {
        const pkg = require('${pkg_json}');
        const lic = pkg.license || (pkg.licenses && pkg.licenses[0] && pkg.licenses[0].type) || 'UNKNOWN';
        console.log(lic);
      } catch { console.log('UNKNOWN'); }
    " 2>/dev/null || echo "UNKNOWN")

    # Check if license is in the compatible list
    local is_compatible=false
    for compat in "${COMPATIBLE_LICENSES[@]}"; do
      if [ "${license}" = "${compat}" ]; then
        is_compatible=true
        break
      fi
    done

    if [ "${is_compatible}" = true ]; then
      ((compatible_count++))
    else
      # Check if problematic
      local is_problematic=false
      for prob in "${PROBLEMATIC_LICENSES[@]}"; do
        if [ "${license}" = "${prob}" ]; then
          is_problematic=true
          break
        fi
      done

      if [ "${is_problematic}" = true ]; then
        ((problematic_count++))
        problematic_list="${problematic_list}\n    ${RED}${dep}${NC}: ${license}"
      elif [ "${license}" = "UNKNOWN" ]; then
        ((unknown_count++))
      else
        # License not in our lists — flag for manual review
        ((unknown_count++))
        problematic_list="${problematic_list}\n    ${YELLOW}${dep}${NC}: ${license} (needs review)"
      fi
    fi
  done <<< "${deps}"

  echo -e "  ${GREEN}Compatible:${NC}   ${compatible_count} package(s)"
  echo -e "  ${YELLOW}Unknown:${NC}      ${unknown_count} package(s)"
  echo -e "  ${RED}Problematic:${NC}  ${problematic_count} package(s)"

  if [ "${problematic_count}" -gt 0 ]; then
    echo -e "\n  Packages requiring attention:${problematic_list}"
    ((ISSUES++))
  fi

  if [ "${unknown_count}" -gt 0 ]; then
    echo -e "\n  ${YELLOW}[NOTE]${NC} ${unknown_count} package(s) have unknown or uncommon licenses"
    echo -e "        Manual review recommended for AGPL-3.0 compatibility"
  fi

  if [ "${problematic_count}" -eq 0 ] && [ "${unknown_count}" -eq 0 ]; then
    echo -e "\n  ${GREEN}[PASS]${NC} All direct dependencies have AGPL-3.0 compatible licenses"
  fi

  cd "${PROJECT_ROOT}"
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

print_summary() {
  echo ""
  echo -e "${BOLD}=================================================================${NC}"
  echo -e "${BOLD}  DEPENDENCY CHECK SUMMARY${NC}"
  echo -e "${BOLD}=================================================================${NC}"
  echo ""

  if [ "${ISSUES}" -gt 0 ]; then
    echo -e "  ${RED}${BOLD}RESULT: ${ISSUES} critical issue(s) found${NC}"
    echo -e "  Action required before deployment."
  elif [ "${WARNINGS}" -gt 0 ]; then
    echo -e "  ${YELLOW}RESULT: ${WARNINGS} warning(s) found${NC}"
    echo -e "  Review recommended."
  else
    echo -e "  ${GREEN}${BOLD}RESULT: All dependency checks passed${NC}"
  fi

  echo ""
  echo "  Recommendations:"
  echo "    1. Run 'npm audit fix' to auto-fix vulnerabilities"
  echo "    2. Review major version updates for breaking changes"
  echo "    3. Manually verify any unknown/uncommon licenses"
  echo "    4. Set up automated dependency monitoring (e.g. Dependabot, Snyk)"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

print_banner

if [ "${CHECK_BACKEND}" = true ]; then
  check_outdated "${BACKEND_DIR}" "Backend"
  check_vulnerabilities "${BACKEND_DIR}" "Backend"
  check_licenses "${BACKEND_DIR}" "Backend"
fi

if [ "${CHECK_MOBILE}" = true ]; then
  check_outdated "${MOBILE_DIR}" "Mobile"
  check_vulnerabilities "${MOBILE_DIR}" "Mobile"
  check_licenses "${MOBILE_DIR}" "Mobile"
fi

print_summary

# Exit code
if [ "${ISSUES}" -gt 0 ]; then
  exit 1
elif [ "${WARNINGS}" -gt 0 ]; then
  exit 2
else
  exit 0
fi
