/**
 * Structural validators: heading presence, ordering, and file naming.
 */
import * as path from "path"
import { ValidationError } from "../types"
import { parseFrontMatter } from "./frontMatterValidator"

const REQUIRED_HEADINGS = [
  "## Summary",
  "## Motivation",
  "## Alternatives Considered",
  "## New Terminology",
  "## Detailed Design",
  "## Impact",
  "## Security Considerations",
]

const FILE_NAME_REGEX = /^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/

export function validateFileName(file: string): ValidationError[] {
  const errors: ValidationError[] = []
  const basename = path.basename(file)
  if (!FILE_NAME_REGEX.test(basename)) {
    errors.push({
      file,
      rule: "file-naming-convention",
      line: 0,
      detail: `File name \`${basename}\` does not match required pattern \`NNNN-kebab-title.md\` (e.g. 0042-my-proposal.md)`,
    })
  }
  return errors
}

export function validateHeadings(
  file: string,
  content: string,
  frontMatterLines: string[]
): ValidationError[] {
  const errors: ValidationError[] = []

  const fm = parseFrontMatter(frontMatterLines)
  if (fm?.category === "Meta") return errors

  const lines = content.split("\n")
  const presentHeadings = new Set<string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("##") && !trimmed.startsWith("###")) {
      const normalized = trimmed.replace(/\s+/, " ")
      presentHeadings.add(normalized)
    }
  }

  for (const required of REQUIRED_HEADINGS) {
    if (!presentHeadings.has(required)) {
      errors.push({
        file,
        rule: "heading-structure-missing",
        line: 1,
        detail: `Required heading \`${required}\` is missing. Please follow the SIMD proposal template.`,
      })
    }
  }

  return errors
}

export function validateFileSIMDNumberConsistency(
  file: string,
  frontMatterLines: string[]
): ValidationError[] {
  const errors: ValidationError[] = []
  const fm = parseFrontMatter(frontMatterLines)
  if (!fm?.simd) return errors

  const basename = path.basename(file, ".md")
  const fileNumber = basename.split("-")[0]

  if (fileNumber !== String(fm.simd).padStart(4, "0") && fileNumber !== String(fm.simd)) {
    errors.push({
      file,
      rule: "simd-number-filename-mismatch",
      line: 1,
      detail: `SIMD number in front matter \`${fm.simd}\` does not match file name prefix \`${fileNumber}\``,
    })
  }

  return errors
}
