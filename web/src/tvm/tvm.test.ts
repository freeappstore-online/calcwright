import { describe, expect, it } from 'vitest'
import { Dec, TvmError, type TvmInputs, type TvmKey, nominalRate, periodicRate, solveTvm } from './tvm'

const TOL = 1e-6

const base: TvmInputs = { n: 0, iy: 0, pv: 0, pmt: 0, fv: 0, py: 1, cy: 1, mode: 'end' }
const solve = (key: TvmKey, inputs: Partial<TvmInputs>) => solveTvm(key, { ...base, ...inputs }).toNumber()

// Worked examples whose answers are published to the cent (BA II Plus
// guidebook, standard textbook tables). A financial calculator shows these
// rounded to 2 dp, so they're checked to half a cent.
describe('published reference values', () => {
  it('30-year mortgage payment (BA II Plus guidebook)', () => {
    expect(solve('pmt', { n: 360, iy: 5.5, pv: 75000, py: 12, cy: 12 })).toBeCloseTo(-425.84, 2)
  })
  it('15-year mortgage payment (BA II Plus guidebook)', () => {
    expect(solve('pmt', { n: 180, iy: 5.5, pv: 75000, py: 12, cy: 12 })).toBeCloseTo(-612.81, 2)
  })
  it('Canadian mortgage: monthly payments, semi-annual compounding', () => {
    expect(solve('pmt', { n: 300, iy: 6, pv: 100000, py: 12, cy: 2 })).toBeCloseTo(-639.81, 2)
  })
  it('annuity due future value (begin mode)', () => {
    expect(solve('fv', { n: 10, iy: 5, pmt: -100, mode: 'begin' })).toBeCloseTo(1320.68, 2)
  })
  it('ordinary annuity future value (end mode)', () => {
    expect(solve('fv', { n: 10, iy: 5, pmt: -100 })).toBeCloseTo(1257.79, 2)
  })
})

// Exact decimal results: these come out exact in decimal and would not in
// binary floating point.
describe('exact decimal maths', () => {
  it('1000 at 10% for 5 years is exactly 1610.51', () => {
    expect(solveTvm('fv', { ...base, n: 5, iy: 10, pv: -1000 }).toString()).toBe('1610.51')
  })
  it('0.1 + 0.2 style sums stay exact at 0% interest', () => {
    expect(solveTvm('fv', { ...base, n: 3, iy: 0, pv: '-0.1', pmt: '-0.1' }).toString()).toBe('0.4')
  })
  it('the periodic rate for 12% nominal monthly is exactly 1%', () => {
    expect(periodicRate(12, 12, 12).toString()).toBe('0.01')
  })
})

// An independent IEEE-754 implementation of the spreadsheet / financial
// calculator functions (PV, FV, PMT, NPER, RATE), used as the reference.
const ref = {
  rate: (iy: number, py: number, cy: number) => Math.pow(1 + iy / 100 / cy, cy / py) - 1,
  fv: (r: number, n: number, pmt: number, pv: number, t: number) =>
    r === 0 ? -(pv + pmt * n) : -(pv * (1 + r) ** n + (pmt * (1 + r * t) * ((1 + r) ** n - 1)) / r),
  pv: (r: number, n: number, pmt: number, fv: number, t: number) =>
    r === 0 ? -(fv + pmt * n) : -(fv + (pmt * (1 + r * t) * ((1 + r) ** n - 1)) / r) / (1 + r) ** n,
  pmt: (r: number, n: number, pv: number, fv: number, t: number) =>
    r === 0 ? -(pv + fv) / n : (-(pv * (1 + r) ** n + fv) * r) / ((1 + r * t) * ((1 + r) ** n - 1)),
  nper: (r: number, pmt: number, pv: number, fv: number, t: number) =>
    r === 0 ? -(pv + fv) / pmt : Math.log((pmt * (1 + r * t) - fv * r) / (pmt * (1 + r * t) + pv * r)) / Math.log(1 + r),
}

interface Case {
  name: string
  n: number
  iy: number
  pv: number
  pmt: number
  fv: number
  py: number
  cy: number
  mode: 'end' | 'begin'
}

// Each case is a balanced set of all five values (FV is derived from the
// other four by the reference), so every variable can be solved for in turn.
const raw: Omit<Case, 'fv'>[] = [
  { name: 'mortgage', n: 360, iy: 6, pv: 200000, pmt: -1250, py: 12, cy: 12, mode: 'end' },
  { name: 'car loan, begin mode', n: 60, iy: 7.25, pv: 32000, pmt: -600, py: 12, cy: 12, mode: 'begin' },
  { name: 'savings, monthly into daily compounding', n: 120, iy: 4.1, pv: -5000, pmt: -250, py: 12, cy: 365, mode: 'end' },
  { name: 'bond, semi-annual', n: 20, iy: 5.4, pv: -950, pmt: 25, py: 2, cy: 2, mode: 'end' },
  { name: 'weekly into quarterly, begin', n: 156, iy: 3.3, pv: 0, pmt: -40, py: 52, cy: 4, mode: 'begin' },
  { name: 'annual lump sum', n: 25, iy: 8, pv: -10000, pmt: 0, py: 1, cy: 1, mode: 'end' },
  { name: 'high rate, short term', n: 8, iy: 48, pv: 1500, pmt: -300, py: 4, cy: 12, mode: 'end' },
  { name: 'negative rate', n: 40, iy: -0.5, pv: -1000, pmt: -10, py: 4, cy: 4, mode: 'end' },
]
const cases: Case[] = raw.map((c) => {
  const r = ref.rate(c.iy, c.py, c.cy)
  return { ...c, fv: ref.fv(r, c.n, c.pmt, c.pv, c.mode === 'begin' ? 1 : 0) }
})

describe('matches the reference calculator to 1e-6', () => {
  for (const c of cases) {
    const t = c.mode === 'begin' ? 1 : 0
    const r = ref.rate(c.iy, c.py, c.cy)
    describe(c.name, () => {
      it('FV', () => expect(Math.abs(solve('fv', c) - c.fv)).toBeLessThan(TOL))
      it('PV', () => expect(Math.abs(solve('pv', c) - ref.pv(r, c.n, c.pmt, c.fv, t))).toBeLessThan(TOL))
      it('PMT', () => expect(Math.abs(solve('pmt', c) - ref.pmt(r, c.n, c.pv, c.fv, t))).toBeLessThan(TOL))
      it('N', () => {
        if (c.pmt === 0 && c.pv === 0) return
        expect(Math.abs(solve('n', c) - ref.nper(r, c.pmt, c.pv, c.fv, t))).toBeLessThan(TOL)
        expect(Math.abs(solve('n', c) - c.n)).toBeLessThan(TOL)
      })
      it('I/Y', () => expect(Math.abs(solve('iy', c) - c.iy)).toBeLessThan(TOL))
    })
  }
})

describe('round trips', () => {
  it('nominal and periodic rates invert each other', () => {
    const i = periodicRate('7.3', 12, 365)
    expect(nominalRate(i, 12, 365).minus('7.3').abs().lt('1e-40')).toBe(true)
  })
  it('solves a known payment back to its rate', () => {
    // 200,000 over 30 years at 6% monthly is 1,199.101050304…
    const pmt = solveTvm('pmt', { ...base, n: 360, iy: 6, pv: 200000, py: 12, cy: 12 })
    expect(pmt.toNumber()).toBeCloseTo(-1199.10105030, 7)
    const iy = solveTvm('iy', { ...base, n: 360, pv: 200000, pmt, py: 12, cy: 12 })
    expect(iy.minus(6).abs().lt('1e-30')).toBe(true)
  })
  it('0% interest solves directly', () => {
    expect(solve('pmt', { n: 10, iy: 0, pv: 1000 })).toBe(-100)
    expect(solve('n', { iy: 0, pv: 1000, pmt: -100 })).toBe(10)
    expect(Math.abs(solve('iy', { n: 10, pv: 1000, pmt: -100 }))).toBeLessThan(TOL)
  })
})

describe('errors', () => {
  it('rejects I/Y when every cash flow has the same sign', () => {
    expect(() => solveTvm('iy', { ...base, n: 10, pv: 100, pmt: 10, fv: 5 })).toThrow(TvmError)
  })
  it('rejects N when the loan never pays off', () => {
    expect(() => solveTvm('n', { ...base, iy: 10, pv: 1000, pmt: -50 })).toThrow(TvmError)
  })
  it('rejects a zero P/Y', () => {
    expect(() => solveTvm('pmt', { ...base, n: 10, iy: 5, pv: 100, py: 0 })).toThrow(TvmError)
  })
  it('accepts decimal strings', () => {
    expect(solveTvm('fv', { ...base, n: '2', iy: '50', pv: new Dec('-1') }).toString()).toBe('2.25')
  })
})
