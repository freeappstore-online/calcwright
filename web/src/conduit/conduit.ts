import { type BendAngle, OFFSET_TABLE, SADDLE_3 } from './tables'

// EMT bend layouts. Every function is unitless: pass lengths in one unit
// (inches or millimetres) and the results come back in that unit. Marks are
// measured from the end of the conduit you're measuring from.

export class BendError extends Error {}

function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new BendError(`${name} must be greater than 0.`)
}
function nonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new BendError(`${name} can't be negative.`)
}

export interface OffsetResult {
  multiplier: number
  shrinkPerUnit: number
  /** Distance between the two bend marks. */
  spacing: number
  /** Conduit lost to the offset. */
  shrink: number
  /** Mark for the bend nearest the obstacle: distance to obstacle + shrink. Only with a distance. */
  secondMark?: number
  /** Mark for the bend farther from the obstacle. Only with a distance. */
  firstMark?: number
}

/** A two-bend offset of `height` at `angle`; with `distance` to the obstacle, also where to mark. */
export function offsetBend(height: number, angle: BendAngle, distance?: number): OffsetResult {
  positive(height, 'Offset height')
  const { multiplier, shrink: shrinkPerUnit } = OFFSET_TABLE[angle]
  const spacing = height * multiplier
  const shrink = height * shrinkPerUnit
  if (distance === undefined) return { multiplier, shrinkPerUnit, spacing, shrink }
  nonNegative(distance, 'Distance to the obstacle')
  const secondMark = distance + shrink
  const firstMark = secondMark - spacing
  if (firstMark < 0) throw new BendError('The obstacle is too close to the end for this offset; use a steeper angle or a longer piece.')
  return { multiplier, shrinkPerUnit, spacing, shrink, secondMark, firstMark }
}

export interface StubResult {
  takeUp: number
  /** Where to put the bender's arrow: stub height − take-up. */
  mark: number
}

/** A 90° stub of `stub` (to the back of the bend) with the bender's take-up. */
export function stubBend90(stub: number, takeUp: number): StubResult {
  positive(stub, 'Stub height')
  positive(takeUp, 'Take-up')
  const mark = stub - takeUp
  if (mark < 0) throw new BendError('The stub is shorter than the bender’s take-up.')
  return { takeUp, mark }
}

export interface BackToBackResult extends StubResult {
  /**
   * Mark for the second 90°, measured from the back of the first stub. Line
   * the bender's star (back-of-90) mark up with it, so no take-up applies.
   */
  secondMark: number
}

/** Two 90°s, `backToBack` apart measured outside to outside. */
export function backToBack90(stub: number, backToBack: number, takeUp: number): BackToBackResult {
  const first = stubBend90(stub, takeUp)
  positive(backToBack, 'Back-to-back distance')
  return { ...first, secondMark: backToBack }
}

export interface Saddle3Result {
  centreAngle: number
  outerAngle: number
  shrink: number
  /** Centre bend: centre of the obstacle + shrink. */
  centreMark: number
  /** Distance from the centre mark to each outer mark. */
  spacing: number
  firstMark: number
  thirdMark: number
}

/** A 3-point saddle over an obstacle `height` tall whose centre is `distance` from the end. */
export function saddle3Point(height: number, distance: number): Saddle3Result {
  positive(height, 'Saddle height')
  nonNegative(distance, 'Distance to the obstacle')
  const shrink = height * SADDLE_3.shrink
  const spacing = height * SADDLE_3.spacing
  const centreMark = distance + shrink
  const firstMark = centreMark - spacing
  if (firstMark < 0) throw new BendError('The obstacle is too close to the end for this saddle.')
  return {
    centreAngle: SADDLE_3.centreAngle,
    outerAngle: SADDLE_3.outerAngle,
    shrink,
    centreMark,
    spacing,
    firstMark,
    thirdMark: centreMark + spacing,
  }
}

export interface Saddle4Result {
  multiplier: number
  /** Distance between the two bends of each offset. */
  spacing: number
  /** Shrink of each offset. */
  shrinkEach: number
  totalShrink: number
  /** Marks for the four bends, in order along the conduit. */
  marks: [number, number, number, number]
}

/**
 * A 4-point saddle: two equal offsets of `height` at `angle` over an obstacle
 * `width` wide whose near edge is `distance` from the end.
 */
export function saddle4Point(height: number, width: number, angle: BendAngle, distance: number): Saddle4Result {
  positive(width, 'Obstacle width')
  const first = offsetBend(height, angle, distance) as Required<OffsetResult>
  // The second offset sits after the first has already shrunk the run, so its
  // marks are just the first offset's top bend + the width, then + the spacing.
  const third = first.secondMark + width
  return {
    multiplier: first.multiplier,
    spacing: first.spacing,
    shrinkEach: first.shrink,
    totalShrink: first.shrink * 2,
    marks: [first.firstMark, first.secondMark, third, third + first.spacing],
  }
}

/** Inches rounded to the nearest 1/16″, as a mixed fraction: 12 5/16″. */
export function formatInches(value: number): string {
  const sixteenths = Math.round(Math.abs(value) * 16)
  const whole = Math.floor(sixteenths / 16)
  let num = sixteenths % 16
  let den = 16
  while (num > 0 && num % 2 === 0) {
    num /= 2
    den /= 2
  }
  const sign = value < 0 && sixteenths > 0 ? '−' : ''
  const frac = num ? `${num}/${den}` : ''
  return `${sign}${whole || !frac ? whole : ''}${whole && frac ? ' ' : ''}${frac}″`
}

/** Millimetres to the nearest whole mm. */
export function formatMm(value: number): string {
  return `${Math.round(value).toLocaleString()} mm`
}
