export function hexToGradient(hex: string, _angle: number = 135): React.CSSProperties {
  return {
    background: hex
  }
}

/**
 * Returns either inline solid accent style (if hex exists) or a theme accent class.
 * Use: const { style, className } = getAccentGradient(hex)
 *      <div className={className} style={style} />
 */
export function getAccentGradient(
  hex: string | null | undefined, 
  angle: number = 135,
  fallbackClass: string = 'bg-primary'
): { style?: React.CSSProperties; className: string } {
  if (hex) {
    return { style: hexToGradient(hex, angle), className: '' }
  }
  return { className: fallbackClass }
}

/**
 * Same but for horizontal bars (progress bars, etc.)
 */
export function getBarGradient(
  hex: string | null | undefined
): { style?: React.CSSProperties; className: string } {
  return getAccentGradient(hex, 90, 'bg-primary')
}
