/**
 * Content-level validators: link integrity, code block hygiene, line length.
 */
import { ValidationError } from "../types"

const MAX_LINE_LENGTH = 120
const BARE_URL_REGEX = /(?<![\[(])https?:\/\/[^\s)\]>]+/g
const FRONT_MATTER_FENCE_REGEX = /^---/

function stripFrontMatter(content: string): { body: string; startLine: number } {
  const lines = content.split("\n")
  if (!FRONT_MATTER_FENCE_REGEX.test(lines[0])) {
    return { body: content, startLine: 1 }
  }
  let end = 1
  while (end < lines.length && !FRONT_MATTER_FENCE_REGEX.test(lines[end])) {
    end++
  }
  return { body: lines.slice(end + 1).join("\n"), startLine: end + 2 }
}

export function validateLineLength(
  file: string,
  content: string
): ValidationError[] {
  const errors: ValidationError[] = []
  const { body, startLine } = stripFrontMatter(content)
  const lines = body.split("\n")
  let inCodeBlock = false

  lines.forEach((line, idx) => {
    if (line.trim().startsWith("```")) inCodeBlock = !inCodeBlock
    if (!inCodeBlock && line.length > MAX_LINE_LENGTH) {
      errors.push({
        file,
        rule: "line-length",
        line: startLine + idx,
        detail: `Line ${startLine + idx} exceeds ${MAX_LINE_LENGTH} characters (length: ${line.length})`,
      })
    }
  })

  return errors
}

export function validateNoBareUrls(
  file: string,
  content: string
): ValidationError[] {
  const errors: ValidationError[] = []
  const { body, startLine } = stripFrontMatter(content)
  const lines = body.split("\n")
  let inCodeBlock = false

  lines.forEach((line, idx) => {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock
      return
    }
    if (inCodeBlock) return

    const matches = [...line.matchAll(BARE_URL_REGEX)]
    for (const match of matches) {
      errors.push({
        file,
        rule: "no-bare-urls",
        line: startLine + idx,
        detail: `Bare URL \`${match[0]}\` should be wrapped in a markdown link [text](url)`,
      })
    }
  })

  return errors
}

export function validateNoTrailingWhitespace(
  file: string,
  content: string
): ValidationError[] {
  const errors: ValidationError[] = []
  const lines = content.split("\n")

  lines.forEach((line, idx) => {
    if (/[\t ]+$/.test(line)) {
      errors.push({
        file,
        rule: "no-trailing-whitespace",
        line: idx + 1,
        detail: `Line ${idx + 1} has trailing whitespace`,
      })
    }
  })

  return errors
}

export function validateCodeBlockLanguage(
  file: string,
  content: string
): ValidationError[] {
  const errors: ValidationError[] = []
  const { body, startLine } = stripFrontMatter(content)
  const lines = body.split("\n")

  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (trimmed === "```") {
      errors.push({
        file,
        rule: "code-block-language",
        line: startLine + idx,
        detail: `Code block at line ${startLine + idx} is missing a language specifier (e.g. \`\`\`rust)`,
      })
    }
  })

  return errors
}
