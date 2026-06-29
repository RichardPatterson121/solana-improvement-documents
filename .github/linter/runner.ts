/**
 * Core validation runner: orchestrates all validators across all proposal files.
 */
import * as fs from "fs"
import * as path from "path"
import { ValidationReport, ValidationResult, ValidationError } from "./types"
import { validateFrontMatter } from "./validators/frontMatterValidator"
import {
  validateFileName,
  validateHeadings,
  validateFileSIMDNumberConsistency,
} from "./validators/structureValidator"
import {
  validateLineLength,
  validateNoBareUrls,
  validateNoTrailingWhitespace,
  validateCodeBlockLanguage,
} from "./validators/contentValidator"

function extractFrontMatterLines(content: string): string[] {
  const lines = content.split("\n")
  if (!lines[0]?.trim().startsWith("---")) return []
  const result: string[] = []
  let i = 1
  while (i < lines.length && !lines[i]?.trim().startsWith("---")) {
    result.push(lines[i])
    i++
  }
  return result
}

export function runValidations(proposalDir: string): ValidationReport {
  const start = Date.now()

  const files = fs
    .readdirSync(proposalDir)
    .filter((f) => f.endsWith(".md") && f !== "0001-simd-process.md")
    .map((f) => path.join(proposalDir, f))

  const results: ValidationResult[] = []

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8")
    const frontMatterLines = extractFrontMatterLines(content)
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    errors.push(...validateFrontMatter(file, frontMatterLines))
    errors.push(...validateFileName(file))
    errors.push(...validateFileSIMDNumberConsistency(file, frontMatterLines))
    errors.push(...validateHeadings(file, content, frontMatterLines))

    warnings.push(...validateNoTrailingWhitespace(file, content))
    warnings.push(...validateLineLength(file, content))
    warnings.push(...validateNoBareUrls(file, content))
    warnings.push(...validateCodeBlockLanguage(file, content))

    results.push({ file, errors, warnings })
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0)

  return {
    passed: totalErrors === 0,
    totalFiles: files.length,
    totalErrors,
    totalWarnings,
    results,
    durationMs: Date.now() - start,
  }
}
