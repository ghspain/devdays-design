import type { AssetSide } from './assets'
import type { AssetSideState, BannerState } from '../types'

function pickSideState(state: BannerState): AssetSideState {
  return {
    speakers: state.speakers,
    partners: state.partners,
    qrDestination: state.qrDestination ?? null,
    qrReadableText: state.qrReadableText ?? null,
    elementOffsets: state.elementOffsets,
  }
}

/** Return the current editable view, applying side-specific values over shared state. */
export function stateForSide(state: BannerState, side: AssetSide = state.activeSide ?? 'front'): BannerState {
  const sideState = state.sideStates?.[side]
  const { qrDestination, qrReadableText, elementOffsets, ...content } = sideState ?? {}
  return {
    ...state,
    ...content,
    elementOffsets: sideState ? elementOffsets ?? {} : state.activeSide === side ? state.elementOffsets ?? {} : {},
    ...(qrDestination === null ? { qrDestination: undefined } : qrDestination ? { qrDestination } : {}),
    ...(qrReadableText === null ? { qrReadableText: undefined } : typeof qrReadableText === 'boolean' ? { qrReadableText } : {}),
    activeSide: side,
  }
}

/** Save the current face's editable values without duplicating shared event/theme data. */
export function saveActiveSide(state: BannerState): BannerState {
  const side = state.activeSide ?? 'front'
  return {
    ...state,
    activeSide: side,
    sideStates: { ...state.sideStates, [side]: pickSideState(state) },
  }
}

/** Switch faces while retaining edits on both sides; an unedited face inherits shared defaults. */
export function switchAssetSide(state: BannerState, side: AssetSide): BannerState {
  const saved = saveActiveSide(state)
  return stateForSide(saved, side)
}
