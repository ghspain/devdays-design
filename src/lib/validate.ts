import { MAX_SPEAKERS } from '../constants'
import type { BannerFormat, BannerState } from '../types'

export type ValidationSeverity = 'error' | 'warning' | 'info'

export type ValidationCode =
  | 'text-truncated'
  | 'logos-dropped'
  | 'speakers-dropped'
  | 'low-contrast'
  | 'safe-area'

export interface ValidationFinding {
  code: ValidationCode
  severity: ValidationSeverity
  message: string
  /** User-facing name of the affected field/element, when applicable. */
  field?: string
}

/**
 * Facts collected while a banner renders: which text fields had to be
 * truncated and how many logo/speaker slots the format actually offers.
 * The renderer fills it in; validateState turns it into findings.
 */
export interface RenderInfo {
  truncatedFields: string[]
  /** Max partner logos this format draws (Infinity when none were drawn). */
  logoCap: number
  speakerCap: number
}

export const createRenderInfo = (): RenderInfo => ({
  truncatedFields: [],
  logoCap: Number.POSITIVE_INFINITY,
  speakerCap: MAX_SPEAKERS,
})

export function validateState(
  state: BannerState,
  _format: BannerFormat,
  info: RenderInfo,
): ValidationFinding[] {
  const findings: ValidationFinding[] = []

  for (const field of info.truncatedFields) {
    findings.push({
      code: 'text-truncated',
      severity: 'warning',
      field,
      message: `"${field}" is too long for this format and was cut with "...". Shorten it or pick another format.`,
    })
  }

  if (state.event.includeSupportedBy && state.partners.length > info.logoCap) {
    const dropped = state.partners.length - info.logoCap
    findings.push({
      code: 'logos-dropped',
      severity: 'warning',
      field: 'partner logos',
      message: `${dropped} of ${state.partners.length} partner logos do not fit (this format shows ${info.logoCap}) and will not appear.`,
    })
  }

  if (state.speakers.length > info.speakerCap) {
    const dropped = state.speakers.length - info.speakerCap
    findings.push({
      code: 'speakers-dropped',
      severity: 'warning',
      field: 'speakers',
      message: `${dropped} of ${state.speakers.length} speakers exceed the ${info.speakerCap}-speaker limit of this format and will not appear.`,
    })
  }

  return findings
}
