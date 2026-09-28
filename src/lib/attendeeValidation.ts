import { formatOptions } from '../constants'
import type { AttendeeBadgeInput } from '../domain/attendee'
import { wrapText, type TruncatedFlag } from './canvasText'
import { SPEAKER_BADGE_TEXT_LAYOUT } from './renderers/speakerBadge'

// ponytail: cap text measurement at 1000 code units; stream or worker-measure before raising this ceiling.
const MAX_PREFLIGHT_TEXT_LENGTH = 1000

export interface AttendeeRowFinding {
  code: 'missing-name' | 'invalid-github-profile' | 'text-truncated'
  field: string
  severity: 'error' | 'warning'
  message: string
}

export interface ValidatedAttendeeRow {
  sourceRowNumber: number
  attendee: AttendeeBadgeInput
  status: 'valid' | 'warning' | 'error'
  findings: AttendeeRowFinding[]
}

function isValidGitHubProfile(value: string) {
  const candidate = value.trim()
  if (/^@?[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(candidate)) return true

  try {
    const url = new URL(candidate)
    const username = url.pathname.split('/').filter(Boolean)
    return url.protocol === 'https:' && ['github.com', 'www.github.com'].includes(url.hostname) && !url.username && !url.password &&
      username.length === 1 && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username[0]) && !url.search && !url.hash
  } catch {
    return false
  }
}

export function validateAttendeeRows(rows: AttendeeBadgeInput[], context: CanvasRenderingContext2D): ValidatedAttendeeRow[] {
  const badge = formatOptions.find(({ id }) => id === 'speaker_badge')
  if (!badge) throw new Error('Speaker Badge template is not configured')
  const inset = Math.round(badge.width * 0.08)
  const textWidth = badge.width - inset * 2
  const textFields = [
    { key: 'name', label: 'Name', layout: SPEAKER_BADGE_TEXT_LAYOUT.name },
    { key: 'role', label: 'Role/title', layout: SPEAKER_BADGE_TEXT_LAYOUT.role },
    { key: 'githubHandle', label: 'GitHub profile', layout: SPEAKER_BADGE_TEXT_LAYOUT.githubHandle },
  ] as const

  return rows.map((attendee, index) => {
    const findings: AttendeeRowFinding[] = []
    if (!attendee.name.trim()) {
      findings.push({ code: 'missing-name', field: 'Name', severity: 'error', message: 'Add a name or exclude this row.' })
    }
    if (attendee.githubHandle && !isValidGitHubProfile(attendee.githubHandle)) {
      findings.push({
        code: 'invalid-github-profile',
        field: 'GitHub profile',
        severity: 'warning',
        message: 'Use a GitHub username or an https://github.com/<username> URL, or clear this optional field.',
      })
    }

    for (const { key, label, layout } of textFields) {
      const value = attendee[key]?.trim()
      if (!value) continue
      if (value.length > MAX_PREFLIGHT_TEXT_LENGTH) {
        findings.push({
          code: 'text-truncated',
          field: label,
          severity: 'warning',
          message: `${label} exceeds the preflight limit of ${MAX_PREFLIGHT_TEXT_LENGTH} characters. Shorten it before generating badges.`,
        })
        continue
      }
      context.font = `600 ${layout.fontSize}px "Mona Sans", sans-serif`
      const truncated: TruncatedFlag = { value: false }
      wrapText(context, value, textWidth, layout.maxLines, truncated)
      if (truncated.value) {
        findings.push({
          code: 'text-truncated',
          field: label,
          severity: 'warning',
          message: `${label} is likely to be shortened by the Speaker Badge template. Shorten it before generating badges.`,
        })
      }
    }

    const status = findings.some(({ severity }) => severity === 'error')
      ? 'error'
      : findings.length > 0 ? 'warning' : 'valid'
    return { sourceRowNumber: index + 2, attendee, status, findings }
  })
}
