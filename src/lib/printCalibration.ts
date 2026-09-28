/**
 * Synthetic, non-personal PDF used to calibrate a printer before trusting a
 * badge-sheet profile. The physical check is deliberately kept separate from
 * attendee exports: a generated PDF can prove geometry, not printer behavior.
 */
export const PRINT_CALIBRATION = {
  fileName: 'devdays-print-calibration-a4.pdf',
  pageWidthMm: 210,
  pageHeightMm: 297,
  trimWidthMm: 80,
  trimHeightMm: 120,
  safeInsetMm: 5,
  rulerLengthMm: 100,
  toleranceMm: 1,
} as const

export interface PrintCalibrationPdfResult {
  readonly blob: Blob
  readonly fileName: string
}

function addRuler(pdf: {
  line: (x1: number, y1: number, x2: number, y2: number) => unknown
  text: (text: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }) => unknown
  setLineWidth: (width: number) => unknown
}, x: number, y: number) {
  pdf.setLineWidth(0.25)
  pdf.line(x, y, x + PRINT_CALIBRATION.rulerLengthMm, y)
  for (let millimetres = 0; millimetres <= PRINT_CALIBRATION.rulerLengthMm; millimetres += 10) {
    const tickHeight = millimetres % 50 === 0 ? 4 : 2.5
    pdf.line(x + millimetres, y, x + millimetres, y + tickHeight)
    if (millimetres % 50 === 0) pdf.text(`${millimetres}`, x + millimetres, y + 8, { align: 'center' })
  }
  pdf.text('100 mm ruler reference — measure after printing', x + PRINT_CALIBRATION.rulerLengthMm / 2, y + 15, { align: 'center' })
}

function addCalibrationPage(pdf: {
  rect: (x: number, y: number, width: number, height: number, style?: 'S' | 'F' | 'DF') => unknown
  line: (x1: number, y1: number, x2: number, y2: number) => unknown
  text: (text: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }) => unknown
  setDrawColor: (r: number, g: number, b: number) => unknown
  setLineWidth: (width: number) => unknown
  setFontSize: (size: number) => unknown
}, side: 'FRONT' | 'BACK', pageNumber: number) {
  const trimLeft = (PRINT_CALIBRATION.pageWidthMm - PRINT_CALIBRATION.trimWidthMm) / 2
  const trimTop = 62
  const safeLeft = trimLeft + PRINT_CALIBRATION.safeInsetMm
  const safeTop = trimTop + PRINT_CALIBRATION.safeInsetMm
  const safeWidth = PRINT_CALIBRATION.trimWidthMm - PRINT_CALIBRATION.safeInsetMm * 2
  const safeHeight = PRINT_CALIBRATION.trimHeightMm - PRINT_CALIBRATION.safeInsetMm * 2

  pdf.setFontSize(14)
  pdf.text('DEV DAYS PRINT CALIBRATION FIXTURE', PRINT_CALIBRATION.pageWidthMm / 2, 18, { align: 'center' })
  pdf.setFontSize(10)
  pdf.text('SYNTHETIC — NO ATTENDEE DATA', PRINT_CALIBRATION.pageWidthMm / 2, 26, { align: 'center' })
  pdf.text(`${side} · PAGE ${pageNumber}`, PRINT_CALIBRATION.pageWidthMm / 2, 36, { align: 'center' })
  pdf.text('Print at 100% / Actual size. Never use Fit to page or automatic scaling.', PRINT_CALIBRATION.pageWidthMm / 2, 46, { align: 'center' })

  pdf.setDrawColor(20, 20, 20)
  pdf.setLineWidth(0.4)
  pdf.rect(trimLeft, trimTop, PRINT_CALIBRATION.trimWidthMm, PRINT_CALIBRATION.trimHeightMm)
  pdf.setDrawColor(100, 100, 100)
  pdf.setLineWidth(0.2)
  pdf.rect(safeLeft, safeTop, safeWidth, safeHeight)
  pdf.setFontSize(8)
  pdf.text('TRIM 80 × 120 mm', trimLeft, trimTop - 3)
  pdf.text('SAFE AREA · 5 mm inset', safeLeft, safeTop + safeHeight + 5)
  pdf.text(`${side} 1`, trimLeft + 3, trimTop + 6)
  pdf.text(`${side} 2`, trimLeft + PRINT_CALIBRATION.trimWidthMm - 3, trimTop + 6, { align: 'right' })
  pdf.text(`${side} 3`, trimLeft + 3, trimTop + PRINT_CALIBRATION.trimHeightMm - 3)
  pdf.text(`${side} 4`, trimLeft + PRINT_CALIBRATION.trimWidthMm - 3, trimTop + PRINT_CALIBRATION.trimHeightMm - 3, { align: 'right' })
  pdf.setDrawColor(30, 30, 30)
  addRuler(pdf, (PRINT_CALIBRATION.pageWidthMm - PRINT_CALIBRATION.rulerLengthMm) / 2, 205)
  pdf.setFontSize(8)
  pdf.text(`Accept measurements within ±${PRINT_CALIBRATION.toleranceMm} mm. Compare FRONT/BACK markers after duplex printing.`, PRINT_CALIBRATION.pageWidthMm / 2, 232, { align: 'center' })
  pdf.text('Physical printer calibration is required; this PDF geometry check is not print-readiness evidence.', PRINT_CALIBRATION.pageWidthMm / 2, 240, { align: 'center' })
}

export async function buildPrintCalibrationPdf(): Promise<PrintCalibrationPdfResult> {
  const { jsPDF } = await import('jspdf')
  // Keep the tiny fixture uncompressed so geometry/text checks can inspect it
  // without adding a PDF parser dependency.
  const pdf = new jsPDF({ unit: 'mm', format: [PRINT_CALIBRATION.pageWidthMm, PRINT_CALIBRATION.pageHeightMm], orientation: 'portrait', compress: false })
  pdf.setProperties({
    title: 'Dev Days print calibration fixture',
    subject: 'Synthetic front/back geometry proof; calibration pending',
  })
  addCalibrationPage(pdf, 'FRONT', 1)
  pdf.addPage([PRINT_CALIBRATION.pageWidthMm, PRINT_CALIBRATION.pageHeightMm], 'portrait')
  addCalibrationPage(pdf, 'BACK', 2)
  const bytes = pdf.output('arraybuffer')
  return { blob: new Blob([bytes], { type: 'application/pdf' }), fileName: PRINT_CALIBRATION.fileName }
}
