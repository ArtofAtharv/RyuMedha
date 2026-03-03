/**
 * Generates a CSS gradient style object from a hex color.
 * Creates a 3-stop gradient by shifting the hue slightly in both directions
 * while adjusting lightness for depth.
 * Falls back to the theme gradient CSS class if no hex is provided.
 */

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '')
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return { h: h * 360, s, l }
}

export function hexToGradient(hex: string, angle: number = 135): React.CSSProperties {
  const { h, s, l } = hexToHSL(hex)

  // Shift hue ±15° and adjust lightness for a rich gradient
  const from = `hsl(${(h - 15 + 360) % 360}, ${Math.round(s * 100)}%, ${Math.round(Math.min(l * 100 + 8, 90))}%)`
  const via  = `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
  const to   = `hsl(${(h + 15) % 360}, ${Math.round(Math.min(s * 100 + 5, 100))}%, ${Math.round(Math.max(l * 100 - 8, 15))}%)`

  return {
    background: `linear-gradient(${angle}deg, ${from}, ${via}, ${to})`
  }
}

/**
 * Returns either inline gradient style (if hex exists) or the CSS class name for theme gradient.
 * Use: const { style, className } = getAccentGradient(hex)
 *      <div className={className} style={style} />
 */
export function getAccentGradient(
  hex: string | null | undefined, 
  angle: number = 135,
  fallbackClass: string = 'gradient-accent'
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
  return getAccentGradient(hex, 90, 'gradient-accent-bar')
}
