import { getEventTheme } from '../../constants'
import type { BannerState, ExportScale, FormatOption } from '../../types'
import { roundedRectPath, wrapText, type TruncatedFlag } from '../canvasText'
import { getCatalogPublicHandle, getCatalogPublicProfile } from '../catalog'
import { getInitials } from '../format'
import { loadImage } from '../image'
import { resolveCatalogQRDestination } from '../qrDestinationResolver'
import { renderQRCode } from './qrCode'
import type { RenderInfo } from '../validate'
import { constrainSpeakerNameOffset } from '../../domain/templateManipulation'
import { speakerBadgeSubject, type BadgeSubject } from '../../domain/badgeSubject'

const generations = new WeakMap<HTMLCanvasElement, number>()

/** Text limits shared by badge preflight validation. Keep renderer and import checks in sync. */
export const SPEAKER_BADGE_TEXT_LAYOUT = {
  name: { fontSize: 57, maxLines: 2 },
  role: { fontSize: 29, maxLines: 2 },
  githubHandle: { fontSize: 25, maxLines: 1 },
} as const

export async function renderSpeakerBadge(
  canvas: HTMLCanvasElement,
  state: BannerState,
  format: FormatOption,
  _backgroundFailed: boolean,
  scale: ExportScale,
  renderInfo?: RenderInfo,
  subjectOverride?: BadgeSubject,
) {
  canvas.width = format.width * scale
  canvas.height = format.height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const generation = (generations.get(canvas) ?? 0) + 1
  generations.set(canvas, generation)
  const isStale = () => generations.get(canvas) !== generation
  const theme = getEventTheme(state.theme)
  const speaker = state.speakers[0]
  const profile = speaker?.personId ? getCatalogPublicProfile(speaker.personId) : undefined
  const publicHandle = getCatalogPublicHandle(profile)
  const subject = subjectOverride ?? speakerBadgeSubject(speaker, publicHandle)
  const nameOffset = constrainSpeakerNameOffset(state.elementOffsets?.['speaker-name'] ?? { x: 0, y: 0 })
  const width = format.width
  const height = format.height
  const inset = Math.round(width * 0.08)

  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = state.colors.background
  ctx.fillRect(0, 0, width, height)

  roundedRectPath(ctx, inset / 2, inset / 2, width - inset, height - inset, 28)
  ctx.fillStyle = theme.id === 'online_github' ? '#ffffff' : '#0d1117'
  ctx.fill()
  ctx.strokeStyle = theme.id === 'online_github' ? '#d0d7de' : '#30363d'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = state.colors.accent
  roundedRectPath(ctx, inset / 2, inset / 2, width - inset, 12, 6)
  ctx.fill()

  const left = inset
  const contentWidth = width - inset * 2
  const primary = theme.id === 'online_github' ? '#1f2328' : '#f0f6fc'
  const muted = theme.id === 'online_github' ? '#59636e' : '#8b949e'
  const track = (field: string, color: string, x: number, y: number, w: number, h: number, elementId?: string) => {
    if (renderInfo && !renderInfo.textRegions.some((region) => region.field === field)) {
      renderInfo.textRegions.push({ field, color, x: x * scale, y: y * scale, w: w * scale, h: h * scale, ...(elementId ? { elementId } : {}) })
    }
  }
  const wrapped = (field: string, text: string, x: number, y: number, maxWidth: number, maxLines: number, size: number, color: string, lineHeight: number) => {
    ctx.font = `600 ${size}px "Mona Sans", sans-serif`
    const truncated: TruncatedFlag = { value: false }
    const lines = wrapText(ctx, text, maxWidth, maxLines, truncated)
    if (truncated.value && renderInfo && !renderInfo.truncatedFields.includes(field)) renderInfo.truncatedFields.push(field)
    ctx.fillStyle = color
    track(field, color, x, y - size, maxWidth, size * maxLines)
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
    return lines.length
  }

  if (state.activeSide === 'back') {
    const primary = theme.id === 'online_github' ? '#1f2328' : '#f0f6fc'
    const muted = theme.id === 'online_github' ? '#59636e' : '#8b949e'
    ctx.fillStyle = state.colors.accent
    ctx.font = '700 25px "Mona Sans", sans-serif'
    ctx.fillText('GITHUB COPILOT', left, 116)
    track('Event identity', state.colors.accent, left, 91, contentWidth, 32)
    ctx.fillStyle = muted
    ctx.font = '500 21px "Mona Sans", sans-serif'
    ctx.fillText('DEV DAYS', left, 151)
    ctx.fillStyle = primary
    ctx.font = '700 32px "Mona Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('CONNECT WITH THE SPEAKER', width / 2, 233)
    track('QR heading', primary, left, 201, contentWidth, 40)
    ctx.textAlign = 'start'
    const resolution = state.qrDestination ? resolveCatalogQRDestination(state.qrDestination) : { status: 'none' as const }
    if (resolution.status === 'resolved') {
      const qr = renderQRCode(resolution.content, { maxSizePx: 540, errorCorrectionLevel: 'quartile' })
      ctx.fillStyle = '#ffffff'
      ctx.fillRect((width - qr.width) / 2 - 8, 274 - 8, qr.width + 16, qr.height + 16)
      ctx.drawImage(qr, (width - qr.width) / 2, 274)
      if (state.qrReadableText ?? true) {
        const readable = resolution.content
        ctx.font = '600 19px "Mona Sans", sans-serif'
        ctx.fillStyle = primary
        const truncated: TruncatedFlag = { value: false }
        const lines = wrapText(ctx, readable, contentWidth, 2, truncated)
        if (truncated.value && renderInfo && !renderInfo.truncatedFields.includes('QR destination text')) renderInfo.truncatedFields.push('QR destination text')
        track('QR destination text', primary, left, 825, contentWidth, 50)
        lines.forEach((line, index) => {
          ctx.textAlign = 'center'
          ctx.fillText(line, width / 2, 825 + index * 25)
        })
        ctx.textAlign = 'start'
      }
    } else if (resolution.status === 'invalid') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(width / 2 - 250, 330, 500, 430)
      ctx.fillStyle = '#59636e'
      ctx.font = '600 22px "Mona Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Choose a valid QR destination', width / 2, 550)
      ctx.textAlign = 'start'
    }

    const eventTitle = state.event.title.trim() || theme.fixedEventTitle
    const eventY = height - inset - 31
    ctx.fillStyle = muted
    ctx.font = '500 19px "Mona Sans", sans-serif'
    ctx.fillText('GHSPAIN · EVENT IDENTITY', left, eventY - 33)
    wrapped('Event title', eventTitle, left, eventY, contentWidth, 1, 25, primary, 31)
    if (renderInfo) {
      renderInfo.logoCap = 0
      renderInfo.speakerCap = 1
    }
    return
  }

  ctx.fillStyle = state.colors.accent
  ctx.font = '700 25px "Mona Sans", sans-serif'
  ctx.fillText('GITHUB COPILOT', left, 116)
  track('Event identity', state.colors.accent, left, 91, contentWidth, 32)
  ctx.fillStyle = muted
  ctx.font = '500 21px "Mona Sans", sans-serif'
  ctx.fillText('DEV DAYS', left, 151)

  ctx.fillStyle = state.colors.accent
  ctx.font = '800 24px "Mona Sans", sans-serif'
  ctx.fillText(subject.roleMarker, left, 224)
  track(subject.kind === 'speaker' ? 'Speaker role marker' : 'Attendee role marker', state.colors.accent, left, 199, contentWidth, 32)

  const avatarSize = Math.round(width * 0.49)
  const avatarX = (width - avatarSize) / 2
  const avatarY = 258
  let avatarDrawn = false
  ctx.save()
  ctx.beginPath()
  ctx.arc(width / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = theme.id === 'online_github' ? '#f6f8fa' : '#21262d'
  ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize)

  if (subject.photoDataUrl) {
    try {
      const avatar = await loadImage(subject.photoDataUrl)
      if (isStale()) {
        ctx.restore()
        return
      }
      const ratio = Math.max(avatarSize / avatar.naturalWidth, avatarSize / avatar.naturalHeight)
      if (avatar.naturalWidth && avatar.naturalHeight) {
        const sourceWidth = avatarSize / ratio
        const sourceHeight = avatarSize / ratio
        ctx.drawImage(avatar, (avatar.naturalWidth - sourceWidth) / 2, (avatar.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight, avatarX, avatarY, avatarSize, avatarSize)
        avatarDrawn = true
      }
    } catch {
      // A missing/blocked public avatar is a normal fallback, not a render error.
    }
  }

  if (!avatarDrawn) {
    ctx.fillStyle = state.colors.accent
    ctx.font = `700 ${Math.round(avatarSize * 0.3)}px "Mona Sans", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(getInitials(subject.name), width / 2, avatarY + avatarSize / 2)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()

  const name = subject.name.trim() || 'Speaker name'
  const nameSize = SPEAKER_BADGE_TEXT_LAYOUT.name.fontSize
  const nameY = 800 + nameOffset.y
  const nameLines = wrapped('Speaker name', name, left + nameOffset.x, nameY, contentWidth, SPEAKER_BADGE_TEXT_LAYOUT.name.maxLines, nameSize, primary, 66)
  const nameRegion = renderInfo?.textRegions.find((region) => region.field === 'Speaker name')
  if (nameRegion) nameRegion.elementId = 'speaker-name'
  const role = subject.title?.trim()
  let nextY = nameY + nameLines * 66 + 12
  if (role) {
    const roleLines = wrapped('Speaker title', role, left, nextY, contentWidth, SPEAKER_BADGE_TEXT_LAYOUT.role.maxLines, SPEAKER_BADGE_TEXT_LAYOUT.role.fontSize, muted, 38)
    nextY += roleLines * 38 + 12
  }
  const organization = subject.organization?.trim()
  if (organization) {
    const organizationLines = wrapped('Attendee organization', organization, left, Math.min(nextY, 980), contentWidth, 1, 23, muted, 30)
    nextY += organizationLines * 30 + 10
  }
  if (subject.showNetworkingHandle && subject.networkingHandle) {
    wrapped('Networking handle', subject.networkingHandle, left, Math.min(nextY, 1010), contentWidth, SPEAKER_BADGE_TEXT_LAYOUT.githubHandle.maxLines, SPEAKER_BADGE_TEXT_LAYOUT.githubHandle.fontSize, state.colors.accent, 32)
  }

  const eventTitle = state.event.title.trim() || theme.fixedEventTitle
  ctx.fillStyle = muted
  ctx.font = '500 19px "Mona Sans", sans-serif'
  const eventY = height - inset - 31
  ctx.fillText('GHSPAIN · EVENT IDENTITY', left, eventY - 33)
  wrapped('Event title', eventTitle, left, eventY, contentWidth, 1, 25, primary, 31)

  if (renderInfo) {
    renderInfo.logoCap = 0
    renderInfo.speakerCap = 1
  }
}
