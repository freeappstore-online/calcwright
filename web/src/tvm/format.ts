import { Dec } from './tvm'

const parts = new Intl.NumberFormat().formatToParts(-12345.6)
const group = parts.find((p) => p.type === 'group')?.value ?? ','
const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.'

/** Parse a number typed in the user's locale ("1,234.5", "1.234,5", "−3"). Returns null if it isn't one. */
export function parseLocaleNumber(text: string): Dec | null {
  let s = text.trim().replace(/[\s  ]/g, '').replace(/−/g, '-')
  if (s === '') return null
  if (group !== ' ' && group !== ' ' && group !== ' ') s = s.split(group).join('')
  if (decimal !== '.') s = s.replace(decimal, '.')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null
  return new Dec(s)
}

/** Format a decimal in the user's locale, rounded to `places` decimal places. */
export function formatLocale(d: Dec, places: number): string {
  const fixed = d.toDecimalPlaces(places).toFixed(places) as Intl.StringNumericLiteral
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: places }).format(fixed)
}
