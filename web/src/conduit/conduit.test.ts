import { describe, expect, it } from 'vitest'
import { BendError, backToBack90, formatInches, formatMm, offsetBend, saddle3Point, saddle4Point, stubBend90 } from './conduit'
import { ANGLES, OFFSET_TABLE, SIZES, TAKE_UP } from './tables'

// Tolerance: 1/32″ for imperial lengths, 0.5% for ratios and metric.
const IN = 1 / 32
const near = (actual: number, expected: number, tol = IN) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol)
const within = (actual: number, expected: number, pct = 0.5) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(pct / 100)

const rad = (deg: number) => (deg * Math.PI) / 180

describe('reference tables (Ugly’s / bender manufacturers)', () => {
  it('offset multipliers are the cosecant of the angle', () => {
    for (const a of ANGLES) within(OFFSET_TABLE[a].multiplier, 1 / Math.sin(rad(a)))
  })
  it('published multipliers and shrink per inch', () => {
    const published = { 10: [5.76, 1 / 16], 22.5: [2.613, 3 / 16], 30: [2, 1 / 4], 45: [1.414, 3 / 8], 60: [1.155, 1 / 2] } as const
    for (const a of ANGLES) {
      expect(OFFSET_TABLE[a].multiplier).toBe(published[a][0])
      expect(OFFSET_TABLE[a].shrink).toBe(published[a][1])
    }
  })
  it('metric take-up matches the inch take-up to 0.5%', () => {
    for (const s of SIZES) within(TAKE_UP[s].mm, TAKE_UP[s].in * 25.4)
  })
  it('EMT take-up by trade size', () => {
    expect(SIZES.map((s) => TAKE_UP[s].in)).toEqual([5, 6, 8, 11, 14, 17])
  })
})

describe('offset', () => {
  it('6″ at 30°: bends 12″ apart, 1 1/2″ shrink', () => {
    const r = offsetBend(6, 30)
    near(r.spacing, 12)
    near(r.shrink, 1.5)
  })
  it('10″ at 45°: bends 14 1/8″ apart, 3 3/4″ shrink', () => {
    const r = offsetBend(10, 45)
    near(r.spacing, 14.14)
    near(r.shrink, 3.75)
    expect(formatInches(r.spacing)).toBe('14 1/8″')
  })
  it('4″ at 22.5°: bends 10 7/16″ apart, 3/4″ shrink', () => {
    const r = offsetBend(4, 22.5)
    near(r.spacing, 10.452)
    near(r.shrink, 0.75)
  })
  it('3″ at 10° and 60°', () => {
    near(offsetBend(3, 10).spacing, 17.28)
    near(offsetBend(3, 10).shrink, 3 / 16)
    near(offsetBend(3, 60).spacing, 3.465)
    near(offsetBend(3, 60).shrink, 1.5)
  })
  it('marks: the bend nearest the obstacle is distance + shrink', () => {
    const r = offsetBend(6, 30, 40)
    near(r.secondMark!, 41.5)
    near(r.firstMark!, 29.5)
  })
  it('works the same in millimetres', () => {
    const mm = offsetBend(150, 30, 1000)
    within(mm.spacing, 300)
    within(mm.shrink, 37.5)
    within(mm.secondMark!, 1037.5)
  })
  it('gives no marks without a distance', () => {
    expect(offsetBend(6, 30).firstMark).toBeUndefined()
  })
  it('rejects an obstacle too close to the end', () => {
    expect(() => offsetBend(6, 30, 5)).toThrow(BendError)
  })
})

describe('90° stub', () => {
  it('1/2″ EMT, 10″ stub: arrow at 5″', () => near(stubBend90(10, TAKE_UP['1/2'].in).mark, 5))
  it('3/4″ EMT, 12″ stub: arrow at 6″', () => near(stubBend90(12, TAKE_UP['3/4'].in).mark, 6))
  it('1″ EMT, 14″ stub: arrow at 6″', () => near(stubBend90(14, TAKE_UP['1'].in).mark, 6))
  it('1/2″ EMT, 300 mm stub: arrow at 173 mm', () => near(stubBend90(300, TAKE_UP['1/2'].mm).mark, 173, 0.5))
  it('rejects a stub shorter than the take-up', () => {
    expect(() => stubBend90(4, 5)).toThrow(BendError)
  })
})

describe('back-to-back', () => {
  it('first stub uses take-up; the second mark is the back-to-back distance', () => {
    const r = backToBack90(10, 36, TAKE_UP['1/2'].in)
    near(r.mark, 5)
    near(r.secondMark, 36)
  })
})

describe('3-point saddle', () => {
  it('2″ obstacle: outer marks 5″ either side, 3/8″ shrink', () => {
    const r = saddle3Point(2, 30)
    near(r.spacing, 5)
    near(r.shrink, 0.375)
    near(r.centreMark, 30.375)
    near(r.firstMark, 25.375)
    near(r.thirdMark, 35.375)
    expect([r.centreAngle, r.outerAngle]).toEqual([45, 22.5])
  })
  it('4″ obstacle: 10″ spacing, 3/4″ shrink', () => {
    const r = saddle3Point(4, 24)
    near(r.spacing, 10)
    near(r.shrink, 0.75)
  })
})

describe('4-point saddle', () => {
  it('4″ high, 10″ wide at 30°: two offsets, 2″ total shrink', () => {
    const r = saddle4Point(4, 10, 30, 20)
    near(r.spacing, 8)
    near(r.shrinkEach, 1)
    near(r.totalShrink, 2)
    r.marks.forEach((m, k) => near(m, [13, 21, 31, 39][k]))
  })
  it('inner marks are the obstacle width apart; outer pairs the offset spacing', () => {
    const r = saddle4Point(3, 12, 45, 30)
    near(r.marks[2] - r.marks[1], 12)
    near(r.marks[1] - r.marks[0], 3 * 1.414)
    near(r.marks[3] - r.marks[2], 3 * 1.414)
    near(r.totalShrink, 2.25)
  })
})

describe('formatting', () => {
  it('inches to the nearest 1/16″', () => {
    expect(formatInches(12.3125)).toBe('12 5/16″')
    expect(formatInches(0.5)).toBe('1/2″')
    expect(formatInches(5)).toBe('5″')
    expect(formatInches(0)).toBe('0″')
    expect(formatInches(7.99)).toBe('8″')
  })
  it('millimetres to the whole mm', () => {
    expect(formatMm(172.6)).toMatch(/^173 mm$/)
  })
})
