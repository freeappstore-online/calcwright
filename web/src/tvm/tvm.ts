import Decimal from 'decimal.js'

// Time value of money, in the BA II Plus / HP 12C convention: money in is
// negative, money out is positive, and the five variables satisfy
//
//   PV·(1+i)^N + PMT·(1+i·k)·((1+i)^N − 1)/i + FV = 0
//
// where i is the rate per payment period and k is 1 in begin mode, 0 in end
// mode. With P/Y payments and C/Y compounding periods a year, the nominal
// annual rate I/Y (in %) maps to i = (1 + I/Y/100/C/Y)^(C/Y/P/Y) − 1.
//
// All arithmetic is decimal at 50 significant digits, so inputs like 0.1 are
// exact and money results don't pick up binary floating-point error.

export const Dec = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN })
export type Dec = InstanceType<typeof Dec>

export type TvmKey = 'n' | 'iy' | 'pv' | 'pmt' | 'fv'
export type TvmMode = 'end' | 'begin'

export interface TvmInputs {
  n: Decimal.Value
  iy: Decimal.Value
  pv: Decimal.Value
  pmt: Decimal.Value
  fv: Decimal.Value
  /** Payments per year. */
  py: Decimal.Value
  /** Compounding periods per year. */
  cy: Decimal.Value
  mode: TvmMode
}

export class TvmError extends Error {}

const ONE = new Dec(1)
const HUNDRED = new Dec(100)

/** Rate per payment period from the nominal annual rate I/Y (%). */
export function periodicRate(iy: Decimal.Value, py: Decimal.Value, cy: Decimal.Value): Dec {
  const perCompounding = new Dec(iy).div(HUNDRED).div(cy)
  if (perCompounding.lte(-1)) throw new TvmError('I/Y must be greater than −100% × C/Y.')
  return perCompounding.plus(1).pow(new Dec(cy).div(py)).minus(1)
}

/** Nominal annual rate I/Y (%) from the rate per payment period. */
export function nominalRate(i: Decimal.Value, py: Decimal.Value, cy: Decimal.Value): Dec {
  return new Dec(i).plus(1).pow(new Dec(py).div(cy)).minus(1).times(cy).times(HUNDRED)
}

/** The left-hand side of the TVM equation; zero when the inputs balance. */
export function residual(i: Dec, n: Dec, pv: Dec, pmt: Dec, fv: Dec, mode: TvmMode): Dec {
  if (i.isZero()) return pv.plus(pmt.times(n)).plus(fv)
  const growth = i.plus(1).pow(n)
  const k = mode === 'begin' ? i.plus(1) : ONE
  return pv.times(growth).plus(pmt.times(k).times(growth.minus(1)).div(i)).plus(fv)
}

/** Solve for one of the five variables, given the other four. */
export function solveTvm(solveFor: TvmKey, inputs: TvmInputs): Dec {
  const py = new Dec(inputs.py)
  const cy = new Dec(inputs.cy)
  if (!py.isFinite() || py.lte(0)) throw new TvmError('P/Y must be greater than 0.')
  if (!cy.isFinite() || cy.lte(0)) throw new TvmError('C/Y must be greater than 0.')
  const mode = inputs.mode
  const value = (key: TvmKey) => {
    const d = new Dec(inputs[key])
    if (!d.isFinite()) throw new TvmError(`${LABELS[key]} must be a number.`)
    return d
  }

  if (solveFor === 'iy') {
    const n = value('n')
    const i = solveRate(n, value('pv'), value('pmt'), value('fv'), mode)
    return nominalRate(i, py, cy)
  }

  const i = periodicRate(value('iy'), py, cy)
  const k = mode === 'begin' ? i.plus(1) : ONE

  if (solveFor === 'n') {
    const pv = value('pv')
    const pmt = value('pmt')
    const fv = value('fv')
    if (i.isZero()) {
      if (pmt.isZero()) throw new TvmError('No solution: PMT is 0 at 0% interest.')
      return pv.plus(fv).div(pmt).neg()
    }
    const a = pmt.times(k).div(i)
    const num = a.minus(fv)
    const den = a.plus(pv)
    if (den.isZero() || num.div(den).lte(0)) throw new TvmError('No solution for N: check the signs of PV, PMT and FV.')
    return num.div(den).ln().div(i.plus(1).ln())
  }

  const n = value('n')
  if (n.lte(0)) throw new TvmError('N must be greater than 0.')
  const growth = i.plus(1).pow(n)
  // annuity: the multiplier on PMT that gives its value at the end of period N.
  const annuity = i.isZero() ? n : k.times(growth.minus(1)).div(i)

  switch (solveFor) {
    case 'pv': {
      const pmt = value('pmt')
      const fv = value('fv')
      return pmt.times(annuity).plus(fv).neg().div(growth)
    }
    case 'fv': {
      const pv = value('pv')
      const pmt = value('pmt')
      return pv.times(growth).plus(pmt.times(annuity)).neg()
    }
    case 'pmt': {
      const pv = value('pv')
      const fv = value('fv')
      return pv.times(growth).plus(fv).neg().div(annuity)
    }
  }
}

/**
 * Rate per period that balances the equation. Newton's method from a few
 * starting points, with a numerical derivative (exact enough at 50 digits),
 * falling back to bisection on a bracket found by scanning.
 */
function solveRate(n: Dec, pv: Dec, pmt: Dec, fv: Dec, mode: TvmMode): Dec {
  if (n.lte(0)) throw new TvmError('N must be greater than 0.')
  const signs = [pv, pmt, fv].filter((d) => !d.isZero()).map((d) => d.s)
  if (!signs.includes(1) || !signs.includes(-1)) {
    throw new TvmError('No solution for I/Y: PV, PMT and FV need at least one inflow and one outflow.')
  }
  const f = (i: Dec) => residual(i, n, pv, pmt, fv, mode)
  const scale = Dec.max(pv.abs(), pmt.abs().times(n), fv.abs(), 1)
  const tolerance = scale.times('1e-40')
  const lowest = new Dec('-0.999999')

  for (const start of ['0.01', '0.1', '-0.01', '1']) {
    let i = new Dec(start)
    for (let step = 0; step < 200; step++) {
      const y = f(i)
      if (y.abs().lte(tolerance)) return i
      const h = Dec.max(i.abs(), 1).times('1e-22')
      const slope = f(i.plus(h)).minus(f(i.minus(h))).div(h.times(2))
      if (slope.isZero()) break
      const next = i.minus(y.div(slope))
      if (!next.isFinite() || next.lte(lowest)) break
      if (next.minus(i).abs().lte('1e-45')) return next
      i = next
    }
  }

  // Bisection: scan for a sign change, then halve it down.
  const grid = [lowest, ...['-0.9', '-0.5', '-0.1', '0', '0.001', '0.01', '0.05', '0.1', '0.25', '0.5', '1', '2', '5', '10', '100'].map((s) => new Dec(s))]
  for (let g = 0; g + 1 < grid.length; g++) {
    let lo = grid[g]
    let hi = grid[g + 1]
    let flo = f(lo)
    if (flo.s === f(hi).s) continue
    for (let step = 0; step < 300; step++) {
      const mid = lo.plus(hi).div(2)
      const fm = f(mid)
      if (fm.s === flo.s) {
        lo = mid
        flo = fm
      } else hi = mid
    }
    return lo.plus(hi).div(2)
  }
  throw new TvmError('No solution for I/Y with these values.')
}

export const LABELS: Record<TvmKey, string> = {
  n: 'N',
  iy: 'I/Y',
  pv: 'PV',
  pmt: 'PMT',
  fv: 'FV',
}
