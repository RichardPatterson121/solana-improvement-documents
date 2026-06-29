/**
 * Shared TypeScript types for the SIMD validation suite.
 */

export type SIMDStatus =
  | "Idea"
  | "Draft"
  | "Review"
  | "Accepted"
  | "Stagnant"
  | "Withdrawn"
  | "Implemented"
  | "Activated"
  | "Living"

export type SIMDCategory = "Meta" | "Standard" | "Advisory"

export type SIMDType =
  | "Core"
  | "Networking"
  | "Interface"
  | "Meta"
  | "Advisory"

export interface SIMDFrontMatter {
  simd: string
  title: string
  authors: string | string[]
  category: SIMDCategory
  type: SIMDType
  status: SIMDStatus
  created: string
  feature?: string
  supersedes?: string
  "superseded-by"?: string
  extends?: string
  development?: string
}

export interface ValidationError {
  file: string
  rule: string
  line: number
  detail: string
}

export interface ValidationResult {
  file: string
  errors: ValidationError[]
  warnings: ValidationError[]
}

export interface ValidationReport {
  passed: boolean
  totalFiles: number
  totalErrors: number
  totalWarnings: number
  results: ValidationResult[]
  durationMs: number
}
