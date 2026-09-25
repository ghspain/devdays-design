import { getEventTheme, MAX_SPEAKERS } from '../constants'
import type { BannerState, ExportScale, FormatOption } from '../types'
import { wrapText, wrapTextWithBreaks, roundedRectPath, type TruncatedFlag } from './canvasText'
import type { RenderInfo } from './validate'
import { getInitials } from './format'
import { getBackgroundImage, loadImage } from './image'

// A render becomes stale when a newer render starts on the same canvas while it
// is still awaiting async images; stale continuations must not draw over it.
const renderGenerations = new WeakMap<HTMLCanvasElement, number>()

export async function renderBanner(
  canvas: HTMLCanvasElement,
  state: BannerState,
  format: FormatOption,
  backgroundFailed: boolean,
  scale: ExportScale,
  renderInfo?: RenderInfo,
) {
  const width = format.width
  const height = format.height
  canvas.width = width * scale
  canvas.height = height * scale

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Resolves the active theme once; every fixed brand color/label below reads
  // from it instead of a hardcoded module-level constant.
  const theme = getEventTheme(state.theme)

  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const generation = (renderGenerations.get(canvas) ?? 0) + 1
  renderGenerations.set(canvas, generation)
  const isStale = () => renderGenerations.get(canvas) !== generation

  // Runs a wrapText call and records the field name when the text had to be
  // cut, so the validation panel can warn about it.
  const wrapTracked = (field: string, fn: (flag: TruncatedFlag) => string[]) => {
    const flag: TruncatedFlag = { value: false }
    const lines = fn(flag)
    if (flag.value && renderInfo && !renderInfo.truncatedFields.includes(field)) {
      renderInfo.truncatedFields.push(field)
    }
    return lines
  }

  // Records where a user-content text block was drawn (logical canvas units,
  // converted to physical pixels) so pixel checks can sample contrast and
  // safe area afterwards. First region per field wins.
  const trackRegion = (field: string, color: string, x: number, yTop: number, w: number, h: number) => {
    if (!renderInfo || renderInfo.textRegions.some((r) => r.field === field)) return
    renderInfo.textRegions.push({
      field,
      color,
      x: x * scale,
      y: yTop * scale,
      w: w * scale,
      h: h * scale,
    })
  }

  const selectedBackgroundImage = getBackgroundImage(state.format)

  if (!backgroundFailed && selectedBackgroundImage) {
    try {
      const bg = await loadImage(selectedBackgroundImage)
      if (isStale()) return
      ctx.drawImage(bg, 0, 0, width, height)
    } catch {
      if (isStale()) return
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, state.colors.background)
      gradient.addColorStop(1, '#1f2937')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
  } else if (!selectedBackgroundImage) {
    const isSpeakerFormat = state.format === 'speaker_square' || state.format === 'speaker_banner' || state.format === 'social_promo'
    ctx.fillStyle = isSpeakerFormat ? '#121613' : '#000000'
    ctx.fillRect(0, 0, width, height)
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, state.colors.background)
    gradient.addColorStop(1, state.colors.accent)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  const padding = Math.round(width * 0.06)
  const isLumaCover = state.format === 'luma_cover'
  const isSpeakerBanner = state.format === 'speaker_banner'
  const isSocialPromo = state.format === 'social_promo'
  const socialPromoScale = isSocialPromo ? 1.28 : 1
  const isMinimalCover = isLumaCover
  const isSpeakerProfile = state.format === 'speaker_square'
  const isSpeakerFormat = isSpeakerProfile || state.format === 'speaker_banner' || isSocialPromo
  const hasSpeakers = !isMinimalCover && !isSocialPromo && state.speakers.length > 0
  let socialPromoLocationBottomY = 0
  let speakerBannerProfileBottomY = 0

  if (renderInfo) {
    // Formats that draw a partner strip show at most 3 logos (covers/banners)
    // or 8 (square footer). Formats without a speaker row report no cap.
    renderInfo.logoCap = isLumaCover || isSpeakerBanner || isSocialPromo ? 3 : 8
    // Luma/social show no speakers. Square and banner outputs are split into
    // cards before rendering, with at most two profiles per card.
    const drawsSpeakerRow = !isLumaCover && !isSocialPromo
    renderInfo.speakerCap = drawsSpeakerRow ? MAX_SPEAKERS : Number.POSITIVE_INFINITY
  }

  const titleSize = Math.max(36, Math.round(width * 0.04))
  const metaSize = Math.max(20, Math.round(width * 0.018))
  if (isMinimalCover) {
    const leftX = Math.round(padding * 0.75)
    // Text container: all side texts are constrained to this width so they
    // never overflow onto the image.
    const containerWidth = Math.round(width * 0.46) - 30
    const textMaxWidth = containerWidth
    const bottomInset = leftX

    // Fixed green label - shares theme.fixedGreenLabel/lumaCityColor with the
    // Speaker Banner (see EventTheme doc comment). Previously hardcoded to
    // devdays' own copy/color here, which meant switching the Design theme
    // never affected the Luma Cover label - bug found and fixed in Phase 4
    // (#52) while verifying the online_github theme renders with no forced
    // Dev Days wordmark.
    const labelText = theme.fixedGreenLabel
    const labelSize = 36
    const labelColor = theme.lumaCityColor

    // Event edition distinguishes events in the same city without overloading
    // the location field (for example, PROFESSIONAL or STUDENTS).
    const editionSize = 30
    const editionColor = '#57606a'

    // City name (black) — Mona Sans VF, display optical size at 135px
    const citySize = 72
    const cityColor = '#000000'
    const cityLineStep = citySize * 1.02

    // Footer text
    const footerSize = 36
    const footerColor = '#77827A'
    const footerLineStep = footerSize * 1.3

    ctx.textBaseline = 'alphabetic'

    ctx.font = `500 ${citySize}px "Mona Sans", sans-serif`
    const cityLines = wrapTracked('city', (f) => wrapText(ctx, (state.event.city || 'City').toUpperCase(), textMaxWidth, 3, f))

    ctx.font = `600 ${editionSize}px "Mona Sans Mono", monospace`
    ctx.letterSpacing = '2px'
    const editionLine = wrapTracked('edition', (f) => wrapText(ctx, (state.event.edition || 'Professional').toUpperCase(), textMaxWidth, 1, f))[0]
    ctx.letterSpacing = '0px'

    const footerSource = (state.event.dateTime.trim() || 'Date/Time').toUpperCase()
    ctx.font = `500 ${footerSize}px "Mona Sans Mono", monospace`
    ctx.letterSpacing = '3px'
    const footerLines = wrapTracked('date & time', (f) => wrapTextWithBreaks(ctx, footerSource, textMaxWidth, 2, f))
    ctx.letterSpacing = '0px'

    // Extra vertical spacing between the text blocks
    const textGap = 28
    const labelY = Math.round(height * 0.26) + 30
    const editionY = labelY + labelSize + textGap
    const cityTopY = editionY + Math.round(citySize * 0.9) + textGap
    const footerLastY = height - bottomInset - textGap
    const footerTopY = footerLastY - (footerLines.length - 1) * footerLineStep

    // Green fixed label: #0CA334, 36px, weight 500
    ctx.fillStyle = labelColor
    ctx.font = `500 ${labelSize}px "Mona Sans Mono", monospace`
    ctx.letterSpacing = '3px'
    ctx.fillText(labelText, leftX, labelY)
    ctx.letterSpacing = '0px'

    // Event edition: a separate semantic line between the Dev Days label and city.
    ctx.fillStyle = editionColor
    ctx.font = `600 ${editionSize}px "Mona Sans Mono", monospace`
    ctx.letterSpacing = '2px'
    ctx.fillText(editionLine, leftX, editionY)
    ctx.letterSpacing = '0px'
    trackRegion('edition', editionColor, leftX, editionY - editionSize, textMaxWidth, editionSize)

    // Black city name: weight 500, 72px
    ctx.fillStyle = cityColor
    ctx.font = `500 ${citySize}px "Mona Sans", sans-serif`
    cityLines.forEach((line, index) => {
      ctx.fillText(line, leftX, cityTopY + index * cityLineStep)
    })
    trackRegion('city', cityColor, leftX, cityTopY - citySize, textMaxWidth, cityLines.length * cityLineStep)

    // Up to three sponsor logos are contained in equal slots above the date.
    const sponsorLogos = state.event.includeSupportedBy ? state.partners.slice(0, 3) : []
    if (sponsorLogos.length > 0) {
      const sponsorHeadingY = footerTopY - 150
      const logosTopY = sponsorHeadingY + 18
      const logosAreaH = 76
      const logoGap = 12
      const slotWidth = (textMaxWidth - logoGap * (sponsorLogos.length - 1)) / sponsorLogos.length

      ctx.fillStyle = footerColor
      ctx.font = `600 18px "Mona Sans Mono", monospace`
      ctx.letterSpacing = '2px'
      ctx.fillText('SUPPORTED BY', leftX, sponsorHeadingY)
      ctx.letterSpacing = '0px'

      for (let index = 0; index < sponsorLogos.length; index += 1) {
        try {
          const logo = await loadImage(sponsorLogos[index].imageDataUrl)
          if (isStale()) return
          const ratio = logo.width / logo.height
          let targetW = Math.min(slotWidth, logosAreaH * ratio)
          let targetH = targetW / ratio
          if (targetH > logosAreaH) {
            targetH = logosAreaH
            targetW = targetH * ratio
          }
          const slotX = leftX + index * (slotWidth + logoGap)
          const x = slotX + (slotWidth - targetW) / 2
          const y = logosTopY + (logosAreaH - targetH) / 2
          ctx.drawImage(logo, x, y, targetW, targetH)
        } catch {
          // Keep rendering the remaining logos and event information.
        }
      }
    }

    // Footer text: weight 500, 48px, #77827A
    ctx.fillStyle = footerColor
    ctx.font = `500 ${footerSize}px "Mona Sans Mono", monospace`
    ctx.letterSpacing = '3px'
    footerLines.forEach((line, index) => {
      ctx.fillText(line, leftX, footerTopY + index * footerLineStep)
    })
    ctx.letterSpacing = '0px'
    trackRegion('date & time', footerColor, leftX, footerTopY - footerSize, textMaxWidth, footerLines.length * footerLineStep)
  } else {
    if (isSpeakerFormat) {
      // Speaker Banner green label (fixed "DEV DAYS 2026"): font size in px.
      const citySize = isSpeakerBanner || isSocialPromo ? 45 : Math.max(18, Math.round(width * 0.026 * socialPromoScale))
      // Speaker Banner green label: top position in px from the top of the banner.
      const speakerBannerGreenLabelTop = 150
      // Speaker Banner main title (city name): extra px to move it DOWN (increase = lower).
      const speakerBannerTitleDownOffset = 300
      const dateSize = Math.round(metaSize * 1.2 * socialPromoScale)
      // Speaker Banner: Date/time font size in px (change to resize the date).
      const speakerBannerDateSize = 34
      const effectiveDateSize = isSpeakerBanner || isSocialPromo ? speakerBannerDateSize : dateSize
      const dateColor = '#ffffff'
      const textX = padding
      const textMaxWidth = width - padding * 2
      let eventTitleSize = Math.round(84 * socialPromoScale)

      while (eventTitleSize > Math.round(56 * socialPromoScale)) {
        ctx.font = `600 ${eventTitleSize}px "Mona Sans", sans-serif`
        if (ctx.measureText(theme.brandTitleLine1).width <= textMaxWidth) break
        eventTitleSize -= 2
      }

      ctx.font = `500 ${citySize}px "Mona Sans Mono", monospace`
      ctx.letterSpacing = '3px'
      // Green label source: Speaker Banner and Social Promo use the fixed Luma label, other formats use the city.
      const greenLabelText = (isSpeakerBanner || isSocialPromo ? theme.fixedGreenLabel : state.event.city || 'City').toUpperCase()
      const cityLines = wrapTracked('city', (f) => wrapText(ctx, greenLabelText, textMaxWidth, 2, f))
      const cityLineStep = citySize * 1.1
      const eventLineStep = eventTitleSize * 1.08

      ctx.font = `500 ${effectiveDateSize}px "Mona Sans Mono", monospace`
      const dateLines = wrapTracked('date & time', (f) => wrapText(ctx, (state.event.dateTime || 'Date/Time').toUpperCase(), textMaxWidth, 2, f))
      const dateLineStep = effectiveDateSize * 1.25
      ctx.letterSpacing = '0px'

      const topCityY = padding * 1
      const useBannerPositioning = isSpeakerBanner || isSocialPromo
      const cityY = useBannerPositioning
        ? speakerBannerGreenLabelTop + Math.round(citySize * 0.72)
        : topCityY
      const cityToEventGap = useBannerPositioning ? 52 : 58
      const eventTitleY =
        cityY +
        cityLines.length * cityLineStep +
        cityToEventGap +
        (useBannerPositioning ? speakerBannerTitleDownOffset : 0) +
        (isSocialPromo ? 25 : 0)
      // Speaker Banner / Social Promo: fixed distance (px) from the green label down to the Date/time.
      const speakerBannerDateFromLabel = 20
      const dateY = useBannerPositioning
        ? Math.round(cityY + speakerBannerDateFromLabel)
        : eventTitleY + eventLineStep + (eventLineStep + 2)

      ctx.fillStyle = theme.lumaCityColor
      ctx.font = `500 ${citySize}px "Mona Sans Mono", monospace`
      ctx.letterSpacing = '3px'
      // Green fixed label vertical nudge (px). Negative = move the label UP without moving date/title.
      const greenLabelRaise = -30
      cityLines.forEach((line, index) => {
        ctx.fillText(line, textX, cityY + greenLabelRaise + index * cityLineStep)
      })
      ctx.letterSpacing = '0px'
      if (!useBannerPositioning) {
        // speaker_square green label carries the user-entered city.
        // Box top uses ~0.8em ascent above the baseline (not the full em) so the
        // designed label near the top edge isn't falsely flagged as cropped.
        trackRegion('city', theme.lumaCityColor, textX, cityY + greenLabelRaise - citySize * 0.8, textMaxWidth, cityLines.length * cityLineStep)
      }

      if (isSpeakerBanner || isSocialPromo) {
        // Main title is the user-entered city name — same size/formatting as the Luma cover (Mona Sans, 72px).
        const titleCitySize = 72
        const titleCityLineStep = titleCitySize * 1.02
        ctx.font = `500 ${titleCitySize}px "Mona Sans", sans-serif`
        ctx.fillStyle = theme.lightAreaTitleColor
        const titleCityLines = wrapTracked('city', (f) => wrapText(ctx, state.event.city || 'City', textMaxWidth, 2, f))
        titleCityLines.forEach((line, index) => {
          ctx.fillText(line, textX, eventTitleY + index * titleCityLineStep)
        })
        trackRegion('city', theme.lightAreaTitleColor, textX, eventTitleY - titleCitySize, textMaxWidth, titleCityLines.length * titleCityLineStep)

        // Social Promo: location name right after the city, styled like the speaker role.
        const cityBottomY = eventTitleY + (titleCityLines.length - 1) * titleCityLineStep
        if (isSocialPromo && state.event.location.trim()) {
          const locationRoleSize = Math.max(Math.round(metaSize * 1.6), 41)
          const locationTopY = cityBottomY + Math.round(locationRoleSize * 1.4) + 25
          ctx.fillStyle = theme.lightAreaMutedColor
          ctx.font = `500 ${locationRoleSize}px "Mona Sans", sans-serif`
          const locationLines = wrapTracked('location', (f) => wrapTextWithBreaks(ctx, state.event.location.trim(), textMaxWidth, 2, f))
          locationLines.forEach((line, index) => {
            ctx.fillText(line, textX, locationTopY + index * locationRoleSize * 1.16)
          })
          trackRegion('location', theme.lightAreaMutedColor, textX, locationTopY - locationRoleSize, textMaxWidth, locationLines.length * locationRoleSize * 1.16)
          socialPromoLocationBottomY =
            locationTopY + (locationLines.length - 1) * locationRoleSize * 1.16 + Math.round(locationRoleSize * 0.35)
        } else if (isSocialPromo) {
          socialPromoLocationBottomY = cityBottomY + Math.round(titleCitySize * 0.35)
        }
      } else {
        ctx.font = `600 ${eventTitleSize}px "Mona Sans", sans-serif`
        ctx.fillStyle = dateColor
        ctx.fillText(theme.brandTitleLine1, textX, eventTitleY)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(theme.brandTitleLine2, textX, eventTitleY + eventLineStep)
      }

      ctx.font = `500 ${effectiveDateSize}px "Mona Sans Mono", monospace`
      ctx.letterSpacing = '3px'
      if (isSpeakerBanner || isSocialPromo) {
        // Date/time as plain white text (no background).
        const dateText = dateLines[0] || ''
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(dateText, textX, dateY)
        ctx.textBaseline = 'alphabetic'
        trackRegion('date & time', '#ffffff', textX, dateY - effectiveDateSize / 2, textMaxWidth, effectiveDateSize)
      } else {
        ctx.fillStyle = dateColor
        dateLines.forEach((line, index) => {
          ctx.fillText(line, textX, dateY + index * dateLineStep)
        })
        trackRegion('date & time', dateColor, textX, dateY - effectiveDateSize, textMaxWidth, dateLines.length * dateLineStep)
      }
      ctx.letterSpacing = '0px'
    } else {
      ctx.fillStyle = state.colors.primary
      ctx.font = `700 ${titleSize}px "Mona Sans", sans-serif`

      let titleTop = padding * 1.4
      if (!hasSpeakers) {
        titleTop = height * 0.42
      }

      const titleLines = wrapTracked('event title', (f) => wrapText(ctx, state.event.title || 'Event Title', width - padding * 2, 3, f))
      titleLines.forEach((line, index) => {
        ctx.fillText(line, padding, titleTop + index * titleSize * 1.15)
      })
      trackRegion('event title', state.colors.primary, padding, titleTop - titleSize, width - padding * 2, titleLines.length * titleSize * 1.15)

      ctx.fillStyle = state.colors.secondary
      ctx.font = `500 ${metaSize}px "Mona Sans", sans-serif`
      const metaY = titleTop + titleLines.length * titleSize * 1.15 + metaSize * 1.3
      const metaText = [state.event.city, state.event.dateTime, state.event.location].filter(Boolean).join(' • ') || 'City • Date/Time • Location'
      const metaLines = wrapTracked('event details', (f) => wrapText(ctx, metaText, width - padding * 2, 2, f))
      metaLines.forEach((line, index) => {
        ctx.fillText(line, padding, metaY + index * metaSize * 1.25)
      })
      trackRegion('event details', state.colors.secondary, padding, metaY - metaSize, width - padding * 2, metaLines.length * metaSize * 1.25)
    }
  }

  const drawOrganizationPanel = async (infoY: number, infoH: number, textScale = 1) => {
    const infoX = padding
    const infoW = width - padding * 2
    const blockGap = Math.round(28 * textScale)
    const leftW = Math.round((infoW - blockGap) / 2)
    const rightX = infoX + leftW + blockGap
    const rightW = infoW - leftW - blockGap

    const innerPadX = Math.round(16 * textScale)
    const horizontalInset = isSocialPromo || isSpeakerBanner ? 0 : innerPadX
    const titleYOffset = Math.round(30 * textScale)
    const contentOffset = Math.round(40 * textScale)
    const bottomInset = Math.round(10 * textScale)
    const logoGap = Math.round(15 * textScale)

    const headingSize = Math.round(metaSize * 1.2 * textScale)
    const showOrganizerLogo = Boolean(state.event.organizerLogoDataUrl)
    const titleY = infoY + titleYOffset
    const contentTopY = titleY + contentOffset
    const organizationHidden = isSpeakerBanner || isSocialPromo
    const organizationTitleX = infoX + horizontalInset
    const supportedByTitleX = organizationHidden ? organizationTitleX : rightX + horizontalInset

    ctx.fillStyle = '#8b949e'
    ctx.font = `600 ${headingSize}px "Mona Sans", sans-serif`

    // Speaker Banner / Social Promo draw the organizer logo at the top-right instead of here.
    if (!isSpeakerBanner && !isSocialPromo) {
      ctx.fillText('Organization', organizationTitleX, titleY)

      if (showOrganizerLogo && state.event.organizerLogoDataUrl) {
        try {
          const organizerLogo = await loadImage(state.event.organizerLogoDataUrl)
          if (isStale()) return
          const logoMaxH = infoH - (contentTopY - infoY) - bottomInset
          const logoMaxW = leftW - horizontalInset * 2
          const ratio = organizerLogo.width / organizerLogo.height
          const targetW = Math.min(logoMaxW, logoMaxH * ratio)
          const targetH = targetW / ratio
          const logoX = organizationTitleX
          const logoY = contentTopY
          ctx.drawImage(organizerLogo, logoX, logoY, targetW, targetH)
        } catch {
          // Keep rendering supported-by section even if organizer logo fails to load.
        }
      }
    }

    const showSupportedBy = state.event.includeSupportedBy && state.partners.length > 0
    if (showSupportedBy) {
      ctx.fillStyle = '#8b949e'
      ctx.font = `500 ${headingSize}px "Mona Sans Mono", monospace`
      ctx.letterSpacing = '3px'
      ctx.fillText('SUPPORTED BY', supportedByTitleX, titleY)
      ctx.letterSpacing = '0px'

      const logos = state.partners.slice(0, 3)
      const logosY = contentTopY
      const logosAreaW = (organizationHidden ? infoW : rightW) - horizontalInset * 2
      const logosAreaH = infoH - (contentTopY - infoY) - bottomInset
      const columns = logos.length
      const rows = 1
      const totalLogoGap = logoGap * Math.max(columns - 1, 0)
      const logoSlotW = (logosAreaW - totalLogoGap) / Math.max(columns, 1)
      const logoSlotH = logosAreaH / rows

      for (let i = 0; i < logos.length; i += 1) {
        try {
          const logo = await loadImage(logos[i].imageDataUrl)
          if (isStale()) return
          const ratio = logo.width / logo.height
          const col = i
          const row = 0
          const slotX = supportedByTitleX + (logoSlotW + logoGap) * col
          const slotY = logosY + logoSlotH * row
          let targetW = Math.min(logoSlotW * 0.92, logoSlotH * ratio)
          let targetH = targetW / ratio
          if (targetH > logoSlotH) {
            targetH = logoSlotH
            targetW = targetH * ratio
          }
          const x = col === 0 ? slotX : slotX + (logoSlotW - targetW) / 2
          const y = slotY + (logoSlotH - targetH) / 2
          ctx.drawImage(logo, x, y, targetW, targetH)
        } catch {
          continue
        }
      }
    }
  }

  // Only speaker_square reaches this branch (luma_cover/social_promo skip speakers,
  // speaker_banner has its own layout). Keep the row inside the canvas, above the
  // partners footer, which starts at ~height * 0.87.
  const speakerBaseY = Math.round(height * 0.46)
  const speakerGap = width * 0.04
  const speakerSize = isSpeakerProfile ? width * 0.19 : width * 0.1

  if (hasSpeakers) {
    if (isSpeakerBanner) {
      if (state.speakers.length > 1) {
        const speakers = state.speakers.slice(0, 2)
        const profileGap = Math.round(width * 0.04)
        const profileWidth = (width - padding * 2 - profileGap) / 2
        const avatarSize = Math.round(width * 0.17)
        const rowY = Math.round(height * 0.5)
        let profileBottomY = rowY + avatarSize

        for (let index = 0; index < speakers.length; index += 1) {
          const speaker = speakers[index]
          const profileX = padding + index * (profileWidth + profileGap)
          const avatarX = profileX + (profileWidth - avatarSize) / 2
          const avatarRadius = Math.round(avatarSize * 0.08)

          ctx.save()
          roundedRectPath(ctx, avatarX, rowY, avatarSize, avatarSize, avatarRadius)
          ctx.clip()

          if (speaker.photoDataUrl) {
            try {
              const photo = await loadImage(speaker.photoDataUrl)
              if (isStale()) return
              const sx = photo.width > photo.height ? (photo.width - photo.height) / 2 : 0
              const sy = photo.height > photo.width ? (photo.height - photo.width) / 2 : 0
              const side = Math.min(photo.width, photo.height)
              ctx.drawImage(photo, sx, sy, side, side, avatarX, rowY, avatarSize, avatarSize)
            } catch {
              if (isStale()) return
              ctx.fillStyle = state.colors.accent
              ctx.fillRect(avatarX, rowY, avatarSize, avatarSize)
            }
          } else {
            ctx.fillStyle = state.colors.accent
            ctx.fillRect(avatarX, rowY, avatarSize, avatarSize)
          }
          ctx.restore()

          ctx.save()
          roundedRectPath(ctx, avatarX, rowY, avatarSize, avatarSize, Math.round(avatarSize * 0.08))
          ctx.lineWidth = Math.max(4, Math.round(avatarSize * 0.02))
          ctx.strokeStyle = '#0abf40'
          ctx.stroke()
          ctx.restore()

          if (!speaker.photoDataUrl) {
            ctx.fillStyle = '#ffffff'
            ctx.textAlign = 'center'
            ctx.font = `700 ${Math.round(avatarSize * 0.27)}px "Mona Sans", sans-serif`
            ctx.fillText(getInitials(speaker.name), avatarX + avatarSize / 2, rowY + avatarSize * 0.58)
          }

          const nameSize = 40
          const roleSize = 22
          const textX = profileX + profileWidth / 2
          const nameTopY = rowY + avatarSize + 22
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = theme.lightAreaTitleColor
          ctx.font = `500 ${nameSize}px "Mona Sans Mono", monospace`
          ctx.letterSpacing = '2px'
          const nameLines = wrapTracked('speaker name', (f) => wrapText(ctx, speaker.name || 'Speaker', profileWidth, 2, f))
          nameLines.forEach((line, lineIndex) => {
            ctx.fillText(line, textX, nameTopY + lineIndex * nameSize * 1.08)
          })
          ctx.letterSpacing = '0px'
          trackRegion('speaker name', theme.lightAreaTitleColor, profileX, nameTopY, profileWidth, nameLines.length * nameSize * 1.08)

          const speakerMeta = [speaker.role, speaker.talkTitle, speaker.talkTime].filter(Boolean).join(' · ')
          if (speakerMeta) {
            const roleTopY = nameTopY + nameLines.length * nameSize * 1.08 + 12
            ctx.fillStyle = theme.lightAreaMutedColor
            ctx.font = `500 ${roleSize}px "Mona Sans", sans-serif`
            const roleLines = wrapTracked('speaker role', (f) => wrapText(ctx, speakerMeta, profileWidth, 3, f))
            roleLines.forEach((line, lineIndex) => {
              ctx.fillText(line, textX, roleTopY + lineIndex * roleSize * 1.12)
            })
            trackRegion('speaker role', theme.lightAreaMutedColor, profileX, roleTopY, profileWidth, roleLines.length * roleSize * 1.12)
            profileBottomY = Math.max(profileBottomY, roleTopY + roleLines.length * roleSize * 1.12)
          } else {
            profileBottomY = Math.max(profileBottomY, nameTopY + nameLines.length * nameSize * 1.08)
          }
          ctx.textAlign = 'left'
          ctx.textBaseline = 'alphabetic'
        }

        speakerBannerProfileBottomY = profileBottomY
      } else {
      const speaker = state.speakers[0]
      const avatarSize = Math.round(width * 0.34)
      const avatarRadius = Math.round(avatarSize * 0.08)
      const avatarBorderWidth = Math.max(4, Math.round(avatarSize * 0.02))
      const sideInset = padding
      const rowX = sideInset
      // Speaker block vertical position: increase the offset to move it DOWN.
      const rowY = Math.round(height * 0.53)
      // Horizontal gap between the speaker photo and the name/role text (increase for more spacing).
      const photoToNameGap = Math.round(speakerGap) + 20
      const textX = rowX + avatarSize + photoToNameGap
      const textMaxWidth = Math.max(140, width - sideInset - textX)

      ctx.save()
      roundedRectPath(ctx, rowX, rowY, avatarSize, avatarSize, avatarRadius)
      ctx.clip()

      if (speaker.photoDataUrl) {
        try {
          const photo = await loadImage(speaker.photoDataUrl)
          if (isStale()) return
          const sx = photo.width > photo.height ? (photo.width - photo.height) / 2 : 0
          const sy = photo.height > photo.width ? (photo.height - photo.width) / 2 : 0
          const side = Math.min(photo.width, photo.height)
          ctx.drawImage(photo, sx, sy, side, side, rowX, rowY, avatarSize, avatarSize)
        } catch {
          if (isStale()) return
          ctx.fillStyle = state.colors.accent
          ctx.fillRect(rowX, rowY, avatarSize, avatarSize)
        }
      } else {
        ctx.fillStyle = state.colors.accent
        ctx.fillRect(rowX, rowY, avatarSize, avatarSize)
      }

      ctx.restore()

      ctx.save()
      roundedRectPath(ctx, rowX, rowY, avatarSize, avatarSize, avatarRadius)
      ctx.lineWidth = avatarBorderWidth
      ctx.strokeStyle = '#0abf40'
      ctx.stroke()
      ctx.restore()

      if (!speaker.photoDataUrl) {
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.font = `700 ${Math.round(avatarSize * 0.27)}px "Mona Sans", sans-serif`
        ctx.fillText(getInitials(speaker.name), rowX + avatarSize / 2, rowY + avatarSize * 0.58)
        ctx.textAlign = 'left'
      }

      const nameSize = 68
      const roleSize = Math.max(Math.round(nameSize * 0.6), Math.round(metaSize * 1.6))

      const nameLineStep = nameSize * 1.03
      const roleLineStep = roleSize * 1.15
      const nameToRoleGap = Math.round(roleSize * 0.6)

      ctx.font = `500 ${nameSize}px "Mona Sans Mono", monospace`
      ctx.letterSpacing = '3px'
      const nameLines = wrapTracked('speaker name', (f) => wrapText(ctx, speaker.name || 'Speaker', textMaxWidth, 3, f))
      ctx.letterSpacing = '0px'
      ctx.font = `500 ${roleSize}px "Mona Sans", sans-serif`
      const speakerMeta = [speaker.role, speaker.talkTitle, speaker.talkTime].filter(Boolean).join(' · ')
      const roleLines = speakerMeta ? wrapTracked('speaker role', (f) => wrapText(ctx, speakerMeta, textMaxWidth, 3, f)) : []

      const nameBlockHeight = nameLines.length * nameLineStep
      const roleBlockHeight = roleLines.length > 0 ? nameToRoleGap + roleLines.length * roleLineStep : 0
      const textBlockHeight = nameBlockHeight + roleBlockHeight
      const textBlockTop = rowY + Math.max(0, (avatarSize - textBlockHeight) / 2)

      ctx.textBaseline = 'top'

      ctx.fillStyle = '#0CA334'
      ctx.font = `500 ${nameSize}px "Mona Sans Mono", monospace`
      ctx.letterSpacing = '3px'
      nameLines.forEach((line, idx) => {
        ctx.fillText(line, textX, textBlockTop + idx * nameLineStep)
      })
      ctx.letterSpacing = '0px'
      trackRegion('speaker name', '#0CA334', textX, textBlockTop, textMaxWidth, nameBlockHeight)

      if (roleLines.length > 0) {
        ctx.fillStyle = theme.lightAreaMutedColor
        ctx.font = `500 ${roleSize}px "Mona Sans", sans-serif`
        const roleStartY = textBlockTop + nameBlockHeight + nameToRoleGap
        roleLines.forEach((line, idx) => {
          ctx.fillText(line, textX, roleStartY + idx * roleLineStep)
        })
        trackRegion('speaker role', theme.lightAreaMutedColor, textX, roleStartY, textMaxWidth, roleLines.length * roleLineStep)
      }

      ctx.textBaseline = 'alphabetic'

      speakerBannerProfileBottomY = rowY + avatarSize
      }
    } else {
      const visibleSpeakers = state.speakers.slice(0, MAX_SPEAKERS)
      const totalWidth = visibleSpeakers.reduce((sum, _, index) => {
        const size = isSpeakerProfile && index === 0 ? speakerSize * 1.25 : speakerSize
        return sum + size
      }, 0) + speakerGap * Math.max(visibleSpeakers.length - 1, 0)
      // Shrink the row so many speakers still fit inside the canvas.
      const maxRowWidth = width - padding * 2
      const rowScale = totalWidth > maxRowWidth ? maxRowWidth / totalWidth : 1
      const avatarUnit = speakerSize * rowScale
      const rowGap = speakerGap * rowScale

      let cursorX = (width - Math.min(totalWidth, maxRowWidth)) / 2
      for (let i = 0; i < visibleSpeakers.length; i += 1) {
        const speaker = visibleSpeakers[i]
        const isFeatured = isSpeakerProfile && i === 0
        const avatarSize = isFeatured ? avatarUnit * 1.25 : avatarUnit
        const avatarY = speakerBaseY

        ctx.save()
        ctx.beginPath()
        ctx.arc(cursorX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
        ctx.clip()

        if (speaker.photoDataUrl) {
          try {
            const photo = await loadImage(speaker.photoDataUrl)
            if (isStale()) return
            const sx = photo.width > photo.height ? (photo.width - photo.height) / 2 : 0
            const sy = photo.height > photo.width ? (photo.height - photo.width) / 2 : 0
            const side = Math.min(photo.width, photo.height)
            ctx.drawImage(photo, sx, sy, side, side, cursorX, avatarY, avatarSize, avatarSize)
          } catch {
            if (isStale()) return
            ctx.fillStyle = state.colors.accent
            ctx.fillRect(cursorX, avatarY, avatarSize, avatarSize)
          }
        } else {
          ctx.fillStyle = state.colors.accent
          ctx.fillRect(cursorX, avatarY, avatarSize, avatarSize)
        }

        ctx.restore()

        if (!speaker.photoDataUrl) {
          ctx.fillStyle = '#ffffff'
          ctx.textAlign = 'center'
          ctx.font = `700 ${Math.round(avatarSize * 0.27)}px "Mona Sans", sans-serif`
          ctx.fillText(getInitials(speaker.name), cursorX + avatarSize / 2, avatarY + avatarSize * 0.58)
          ctx.textAlign = 'left'
        }

        const textY = avatarY + avatarSize + metaSize * 1.3
        ctx.fillStyle = state.colors.primary
        ctx.font = `700 ${Math.round(metaSize * (isFeatured ? 1.2 : 1))}px "Mona Sans", sans-serif`
        const nameLines = wrapTracked('speaker name', (f) => wrapText(ctx, speaker.name || 'Speaker', avatarSize * 1.4, 2, f))
        nameLines.forEach((line, idx) => {
          ctx.fillText(line, cursorX, textY + idx * metaSize * 1.05)
        })
        trackRegion('speaker name', state.colors.primary, cursorX, textY - Math.round(metaSize * (isFeatured ? 1.2 : 1)), avatarSize * 1.4, nameLines.length * metaSize * 1.05)

        const speakerMeta = [speaker.role, speaker.talkTitle, speaker.talkTime].filter(Boolean).join(' · ')
        if (speakerMeta) {
          ctx.fillStyle = state.colors.secondary
          ctx.font = `500 ${Math.round(metaSize * 0.85)}px "Mona Sans", sans-serif`
          const roleLines = wrapTracked('speaker role', (f) => wrapText(ctx, speakerMeta, avatarSize * 1.4, 2, f))
          const roleStart = textY + nameLines.length * metaSize * 1.05 + metaSize * 0.9
          roleLines.forEach((line, idx) => {
            ctx.fillText(line, cursorX, roleStart + idx * metaSize * 0.92)
          })
          trackRegion('speaker role', state.colors.secondary, cursorX, roleStart - Math.round(metaSize * 0.85), avatarSize * 1.4, roleLines.length * metaSize * 0.92)
        }

        cursorX += avatarSize + rowGap
      }
    }
  }

    // Speaker Banner / Social Promo: organizer logo at the top-right corner.
  if ((isSpeakerBanner || isSocialPromo) && state.event.organizerLogoDataUrl) {
    try {
      const orgLogo = await loadImage(state.event.organizerLogoDataUrl)
      if (isStale()) return
      // Top edge of the logo, measured from the top of the banner.
      const orgLogoTopY = 385
      // Max size box for the logo.
      const orgLogoMaxH = 105
      const orgLogoMaxW = Math.round(width * 0.34)
      const ratio = orgLogo.width / orgLogo.height
      let logoH = orgLogoMaxH
      let logoW = logoH * ratio
      if (logoW > orgLogoMaxW) {
        logoW = orgLogoMaxW
        logoH = logoW / ratio
      }
      // Right-aligned.
      const logoX = width - padding - logoW
      ctx.drawImage(orgLogo, logoX, orgLogoTopY, logoW, logoH)
    } catch {
      // Ignore organizer logo load failures.
    }
  }

  if (isSpeakerBanner || isSocialPromo) {
    const infoH = Math.round(height * 0.16)
    const registerTopGap = 40
    const registerBottomGap = 40
    let nextSectionStartY = Math.round(
      Math.max(height * 0.78, speakerBannerProfileBottomY + registerTopGap),
    )

    if (state.event.registrationEnabled && state.event.registrationUrl.trim()) {
      const registrationScale = 1
      const barHeight = Math.round(height * 0.082 * registrationScale)
      const barW = width - padding * 2
      const textInset = Math.round(barHeight * 0.3)
      const organizationLabelSize = Math.round(metaSize * 1.2 * registrationScale)
      // Registration font size (+3 px bump).
      const labelSize = Math.max(18, organizationLabelSize) * 1.5
      const urlSize = labelSize

      const urlText = state.event.registrationUrl.trim()
      const ctaText = state.event.registrationStyle === 'url_only' ? '' : state.event.registrationText.trim() || 'Register'
      const lineSize = Math.max(urlSize, labelSize)
      // Speaker Banner: CTA sits at the banner footer. Social Promo: CTA right after the location block.
      const speakerBannerCtaFooterY = Math.round(height * 0.9)
      const lineY = isSpeakerBanner
        ? speakerBannerCtaFooterY
        : Math.round(socialPromoLocationBottomY + registerTopGap + lineSize * 0.8)
      const labelX = padding
      const urlRightX = width - padding
      const maxUrlW = Math.max(120, barW - textInset * 2)
      const registerUrlColor = theme.lumaCityColor
      const registerGap = Math.round(metaSize * 0.45)

      ctx.textBaseline = 'middle'

      if (ctaText) {
        // CTA style: label + short link inside a green pill with white text.
        const registrationPillColor = '#000000'
        ctx.font = `500 ${labelSize}px "Mona Sans", sans-serif`
        const label = wrapTracked('registration label', (f) => wrapText(ctx, `${ctaText}:`, maxUrlW * 0.5, 1, f))[0] || `${ctaText}:`
        const labelWidth = ctx.measureText(label).width

        // Horizontal / vertical padding inside the green pill.
        const padH = Math.round(labelSize * 0.7)
        const padV = Math.round(labelSize * 0.55)
        const availableUrlW = Math.max(80, maxUrlW - labelWidth - registerGap - padH * 2)
        ctx.font = `600 ${urlSize}px "Mona Sans", sans-serif`
        const shortUrl = wrapTracked('registration URL', (f) => wrapText(ctx, urlText, availableUrlW, 1, f))[0] || urlText
        const urlWidth = ctx.measureText(shortUrl).width

        const contentW = labelWidth + registerGap + urlWidth
        const pillH = lineSize + padV * 2
        const pillX = labelX
        const pillY = Math.round(lineY - pillH / 2)
        const pillW = contentW + padH * 2
        const pillRadius = Math.round(pillH * 0.35)

        roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillRadius)
        ctx.fillStyle = registrationPillColor
        ctx.fill()

        const textStartX = pillX + padH
        ctx.fillStyle = '#ffffff'
        ctx.font = `500 ${labelSize}px "Mona Sans", sans-serif`
        ctx.fillText(label, textStartX, lineY)
        ctx.font = `600 ${urlSize}px "Mona Sans", sans-serif`
        ctx.fillText(shortUrl, textStartX + labelWidth + registerGap, lineY)
        trackRegion('registration CTA', '#ffffff', textStartX, lineY - lineSize / 2, contentW, lineSize)
      } else {
        ctx.fillStyle = registerUrlColor
        ctx.font = `500 ${Math.max(urlSize, labelSize)}px "Mona Sans", sans-serif`
        const shortUrl = wrapTracked('registration URL', (f) => wrapText(ctx, urlText, Math.max(100, urlRightX - labelX), 1, f))[0] || urlText
        ctx.fillText(shortUrl, labelX, lineY)
        trackRegion('registration URL', registerUrlColor, labelX, lineY - lineSize / 2, urlRightX - labelX, lineSize)
      }
      ctx.textBaseline = 'alphabetic'

      const lineBottomY = lineY + Math.round(lineSize * 0.35)
      // Speaker Banner / Social Promo keep the partners panel at the bottom (registration is at the top now).
      if (!isSpeakerBanner && !isSocialPromo) {
        nextSectionStartY = Math.round(lineBottomY + registerBottomGap)
      }
    }

    const maxInfoY = height - infoH - Math.round(padding * 0.35)
    // Speaker Banner has no partners panel; Social Promo dedicates the footer to Supported-by (raised 40px).
    const infoY = isSocialPromo ? maxInfoY - 40 : Math.min(nextSectionStartY, maxInfoY)
    if (isSocialPromo) {
      await drawOrganizationPanel(infoY, infoH, 1)
      if (isStale()) return
    }

    if (isSpeakerBanner && state.event.includeSupportedBy && state.partners.length > 0) {
      const logos = state.partners.slice(0, 3)
      const areaRight = width - padding
      const areaWidth = Math.round(width * 0.34)
      const logoGap = 12
      const logoMaxH = 52
      const headingY = height - 118
      const logosTopY = headingY + 14
      const slotWidth = (areaWidth - logoGap * (logos.length - 1)) / logos.length

      ctx.fillStyle = theme.lightAreaMutedColor
      ctx.font = `600 18px "Mona Sans Mono", monospace`
      ctx.letterSpacing = '2px'
      ctx.textAlign = 'right'
      ctx.fillText('SUPPORTED BY', areaRight, headingY)
      ctx.textAlign = 'left'
      ctx.letterSpacing = '0px'

      for (let index = 0; index < logos.length; index += 1) {
        try {
          const logo = await loadImage(logos[index].imageDataUrl)
          if (isStale()) return
          const ratio = logo.width / logo.height
          let targetW = Math.min(slotWidth, logoMaxH * ratio)
          let targetH = targetW / ratio
          if (targetH > logoMaxH) {
            targetH = logoMaxH
            targetW = targetH * ratio
          }
          const slotX = areaRight - areaWidth + index * (slotWidth + logoGap)
          const x = slotX + (slotWidth - targetW) / 2
          ctx.drawImage(logo, x, logosTopY, targetW, targetH)
        } catch {
          continue
        }
      }
    }
  }

  if (!isMinimalCover && !isSpeakerBanner && !isSocialPromo && state.event.includeSupportedBy && state.partners.length > 0) {
    const logos = state.partners.slice(0, 8)
    const footerHeight = Math.round(height * 0.13)
    const footerY = height - footerHeight - padding * 0.25

    const logoAreaX = padding
    const logoAreaWidth = width - padding * 2
    const logoGap = 15
    const totalLogoGap = logoGap * Math.max(logos.length - 1, 0)
    const slotWidth = (logoAreaWidth - totalLogoGap) / logos.length
    const logoMaxH = footerHeight * 0.56

    for (let i = 0; i < logos.length; i += 1) {
      try {
        const logo = await loadImage(logos[i].imageDataUrl)
        if (isStale()) return
        const ratio = logo.width / logo.height
        const targetH = Math.min(logoMaxH, slotWidth * 0.5)
        const targetW = targetH * ratio
        const x = logoAreaX + (slotWidth + logoGap) * i + (slotWidth - targetW) / 2
        const y = footerY + (footerHeight - targetH) / 2
        ctx.drawImage(logo, x, y, targetW, targetH)
      } catch {
        continue
      }
    }
  }
}
