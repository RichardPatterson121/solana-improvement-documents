/**
 * Human-readable and GitHub Actions annotated reporter for validation results.
 */
import { ValidationReport, ValidationError } from "./types"

const RESET = "\x1b[0m"
const RED = "\x1b[31m"
const YELLOW = "\x1b[33m"
const GREEN = "\x1b[32m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const CYAN = "\x1b[36m"

function formatError(e: ValidationError, level: "error" | "warning"): string {
  const color = level === "error" ? RED : YELLOW
  const label = level === "error" ? "ERROR" : "WARN "
  return `  ${color}${BOLD}[${label}]${RESET} ${DIM}line ${e.line}${RESET} ${CYAN}[${e.rule}]${RESET} ${e.detail}`
}

export function printReport(report: ValidationReport): void {
  const fileLabel = report.totalFiles === 1 ? "file" : "files"
  console.log(`\n${BOLD}SIMD Validation Report${RESET}`)
  console.log(`${DIM}${"-".repeat(60)}${RESET}`)
  console.log(`Scanned ${BOLD}${report.totalFiles}${RESET} ${fileLabel} in ${report.durationMs}ms\n`)

  for (const result of report.results) {
    const hasIssues = result.errors.length > 0 || result.warnings.length > 0
    if (!hasIssues) {
      console.log(`${GREEN}✓${RESET} ${result.file}`)
      continue
    }

    const statusIcon = result.errors.length > 0 ? `${RED}✗${RESET}` : `${YELLOW}⚠${RESET}`
    console.log(`${statusIcon} ${BOLD}${result.file}${RESET}`)

    for (const e of result.errors) {
      console.log(formatError(e, "error"))
      console.log(`::error file=${e.file},line=${e.line}::${e.rule}: ${e.detail}`)
    }
    for (const w of result.warnings) {
      console.log(formatError(w, "warning"))
      console.log(`::warning file=${w.file},line=${w.line}::${w.rule}: ${w.detail}`)
    }
    console.log("")
  }

  console.log(`${DIM}${"-".repeat(60)}${RESET}`)

  if (report.passed) {
    console.log(`${GREEN}${BOLD}✓ All validations passed${RESET} (${report.totalWarnings} warning(s))\n`)
  } else {
    console.log(
      `${RED}${BOLD}✗ ${report.totalErrors} error(s)${RESET}, ${YELLOW}${report.totalWarnings} warning(s)${RESET}\n`
    )
  }
}
