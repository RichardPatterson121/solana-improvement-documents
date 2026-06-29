/**
 * Front matter (YAML metadata) validators for SIMD proposals.
 */
import * as yaml from "js-yaml"
import { SIMDFrontMatter, ValidationError } from "../types"

const REQUIRED_FIELDS: (keyof SIMDFrontMatter)[] = [
  "simd",
  "title",
  "authors",
  "category",
  "type",
  "status",
  "created",
]

const OPTIONAL_FIELDS: string[] = [
  "feature",
  "supersedes",
  "superseded-by",
  "extends",
  "development",
]

const VALID_CATEGORIES: string[] = ["Meta", "Standard", "Advisory"]
const VALID_TYPES: string[] = ["Core", "Networking", "Interface", "Meta", "Advisory"]
const VALID_STATUSES: string[] = [
  "Idea", "Draft", "Review", "Accepted",
  "Stagnant", "Withdrawn", "Implemented", "Activated", "Living",
]

const CREATED_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const SIMD_NUMBER_REGEX = /^\d{4}$/

export function parseFrontMatter(frontMatterLines: string[]): SIMDFrontMatter | null {
  const raw = frontMatterLines.join("\n").trim().replace(/^-*$/gm, "")
  try {
    return yaml.load(raw) as SIMDFrontMatter | null
  } catch {
    return null
  }
}

export function validateFrontMatter(
  file: string,
  frontMatterLines: string[]
): ValidationError[] {
  const errors: ValidationError[] = []

  const raw = frontMatterLines.join("\n").trim().replace(/^-*$/gm, "")
  let fm: SIMDFrontMatter | null = null

  try {
    fm = yaml.load(raw) as SIMDFrontMatter | null
  } catch (e: any) {
    errors.push({
      file,
      rule: "front-matter-parse",
      line: 1,
      detail: `Failed to parse front matter YAML: ${e.message}`,
    })
    return errors
  }

  if (!fm || typeof fm !== "object") {
    errors.push({
      file,
      rule: "front-matter-missing",
      line: 1,
      detail: "Missing front matter metadata formatted as YAML",
    })
    return errors
  }

  // Required field presence
  for (const field of REQUIRED_FIELDS) {
    if (fm[field] === undefined || fm[field] === null || fm[field] === "") {
      errors.push({
        file,
        rule: "front-matter-required-field",
        line: 1,
        detail: `Required field \`${field}\` is missing or empty`,
      })
    }
  }

  // Unknown fields
  for (const key of Object.keys(fm)) {
    if (!REQUIRED_FIELDS.includes(key as keyof SIMDFrontMatter) && !OPTIONAL_FIELDS.includes(key)) {
      errors.push({
        file,
        rule: "front-matter-unknown-field",
        line: 1,
        detail: `Unknown front matter field \`${key}\`. Allowed: ${[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].join(", ")}`,
      })
    }
  }

  // SIMD number: must be 4-digit numeric string
  if (fm.simd !== undefined) {
    const simd = String(fm.simd)
    if (!SIMD_NUMBER_REGEX.test(simd)) {
      errors.push({
        file,
        rule: "front-matter-simd-format",
        line: 1,
        detail: `\`simd\` must be a 4-digit numeric string (e.g. "0042"), got \`${simd}\``,
      })
    }
  }

  // Title: max 45 characters
  if (fm.title !== undefined) {
    if (typeof fm.title !== "string") {
      errors.push({ file, rule: "front-matter-title-type", line: 1, detail: "`title` must be a string" })
    } else if (fm.title.length === 0) {
      errors.push({ file, rule: "front-matter-title-empty", line: 1, detail: "`title` cannot be empty" })
    } else if (fm.title.length > 45) {
      errors.push({
        file,
        rule: "front-matter-title-length",
        line: 1,
        detail: `\`title\` must be ≤ 45 characters, got ${fm.title.length}`,
      })
    }
  }

  // Authors: non-empty
  if (fm.authors !== undefined) {
    const authors = Array.isArray(fm.authors) ? fm.authors : [fm.authors]
    if (authors.length === 0 || authors.every((a) => !a || String(a).trim() === "")) {
      errors.push({ file, rule: "front-matter-authors-empty", line: 1, detail: "`authors` must contain at least one entry" })
    }
  }

  // Category
  if (fm.category !== undefined && !VALID_CATEGORIES.includes(fm.category)) {
    errors.push({
      file,
      rule: "front-matter-category-invalid",
      line: 1,
      detail: `\`${fm.category}\` is not a valid category. Valid: ${VALID_CATEGORIES.join(", ")}`,
    })
  }

  // Type
  if (fm.type !== undefined && !VALID_TYPES.some((t) => String(fm.type).includes(t))) {
    errors.push({
      file,
      rule: "front-matter-type-invalid",
      line: 1,
      detail: `\`${fm.type}\` is not a valid type. Valid: ${VALID_TYPES.join(", ")}`,
    })
  }

  // Status
  if (fm.status !== undefined && !VALID_STATUSES.includes(fm.status)) {
    errors.push({
      file,
      rule: "front-matter-status-invalid",
      line: 1,
      detail: `\`${fm.status}\` is not a valid status. Valid: ${VALID_STATUSES.join(", ")}`,
    })
  }

  // Created date format: YYYY-MM-DD
  if (fm.created !== undefined) {
    const created = String(fm.created)
    if (!CREATED_DATE_REGEX.test(created)) {
      errors.push({
        file,
        rule: "front-matter-created-format",
        line: 1,
        detail: `\`created\` must be ISO 8601 date format YYYY-MM-DD, got \`${created}\``,
      })
    } else {
      const d = new Date(created)
      if (isNaN(d.getTime())) {
        errors.push({
          file,
          rule: "front-matter-created-invalid-date",
          line: 1,
          detail: `\`created\` value \`${created}\` is not a valid calendar date`,
        })
      }
    }
  }

  return errors
}
