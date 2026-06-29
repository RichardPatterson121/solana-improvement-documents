/**
 * Entry point for SIMD TypeScript validation suite.
 * Runs all validators and exits non-zero on any errors.
 */
import * as path from "path"
const core = require("@actions/core")

import { runValidations } from "./runner"
import { printReport } from "./reporter"

async function main(): Promise<void> {
  const proposalDir = path.join(__dirname, "../../proposals")

  const report = runValidations(proposalDir)
  printReport(report)

  if (!report.passed) {
    const summary = `${report.totalErrors} validation error(s) across ${report.totalFiles} file(s). See annotations above.`
    core.setFailed(summary)
    process.exit(1)
  }

  console.log("Finished Successfully")
  process.exit(0)
}

main().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
