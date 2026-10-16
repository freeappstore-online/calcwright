import Decimal from 'decimal.js'
import { Dec, TvmError } from '../tvm/tvm'

// Discounted cash flows, in the BA II Plus convention: flows[0] is CF0 at
// time 0 (not discounted), flows[t] arrives at the end of period t. Rates are
// percent per period. Decimal at 50 digits throughout.

type Flows = readonly Decimal.Value[]

const toDecs = (flows: Flows) => {
  const out = flows.map((f) => new Dec(f))
  if (out.some((d) => !d.isFinite())) throw new TvmError('Every cash flow must be a number.')
  return out
}

/** NPV at a rate, as a fraction per period (0.1 = 10%). */
function npvAt(r: Dec, cf: Dec[]): Dec {
  const g = r.plus(1)
  // Horner's rule on 1/(1+r): CF0 + CF1·v + CF2·v² + …
  const v = new Dec(1).div(g)
  return cf.reduceRight((acc, c) => acc.times(v).plus(c), new Dec(0))
}

/** d NPV / d r. */
function npvSlope(r: Dec, cf: Dec[]): Dec {
  const v = new Dec(1).div(r.plus(1))
  let total = new Dec(0)
  let vt = v // v^(t+1)
  for (let t = 1; t < cf.length; t++) {
    vt = vt.times(v)
    total = total.minus(cf[t].times(t).times(vt))
  }
  return total
}

/** Net present value at `rate` % per period. */
export function npv(rate: Decimal.Value, flows: Flows): Dec {
  const r = new Dec(rate).div(100)
  if (r.lte(-1)) throw new TvmError('The rate must be greater than −100%.')
  return npvAt(r, toDecs(flows))
}

export interface IrrResult {
  /** IRR in % per period. */
  irr: Dec
  /** Every IRR found in −99% … 1000%, in %, ascending. */
  roots: Dec[]
  /** Sign changes in the cash flows; more than 1 means there may be several IRRs. */
  signChanges: number
  /** Set when more than one IRR is possible. */
  warning?: string
}

const LOW = new Dec('-0.99')
const HIGH = new Dec(10)

/** Bisection on [lo, hi], which must bracket a sign change. */
function bisect(lo: Dec, hi: Dec, cf: Dec[]): Dec {
  let flo = npvAt(lo, cf)
  for (let step = 0; step < 200; step++) {
    const mid = lo.plus(hi).div(2)
    const fm = npvAt(mid, cf)
    if (fm.isZero()) return mid
    if (fm.s === flo.s) {
      lo = mid
      flo = fm
    } else hi = mid
  }
  return lo.plus(hi).div(2)
}

/** Newton's method from `guess`; null if it diverges or leaves the range. */
function newton(guess: Dec, cf: Dec[]): Dec | null {
  let r = guess
  const scale = Dec.max(...cf.map((c) => c.abs()), 1)
  for (let step = 0; step < 100; step++) {
    const y = npvAt(r, cf)
    if (y.abs().lte(scale.times('1e-40'))) return r
    const slope = npvSlope(r, cf)
    if (slope.isZero()) return null
    const next = r.minus(y.div(slope))
    if (!next.isFinite() || next.lte(LOW) || next.gt(HIGH)) return null
    if (next.minus(r).abs().lte('1e-42')) return next
    r = next
  }
  return null
}

/**
 * Internal rate of return: Newton's method from `guess` %, falling back to
 * bisection. Also scans −99% … 1000% for every rate where NPV changes sign,
 * so a cash-flow list with several IRRs is reported, not hidden.
 */
export function irr(flows: Flows, guess: Decimal.Value = 10): IrrResult {
  const cf = toDecs(flows)
  const nonzero = cf.filter((c) => !c.isZero())
  let signChanges = 0
  for (let k = 1; k < nonzero.length; k++) if (nonzero[k].s !== nonzero[k - 1].s) signChanges++
  if (signChanges === 0) throw new TvmError('IRR needs at least one negative and one positive cash flow.')

  // Scan 1 + r on a log grid from 0.01 to 11 for sign changes.
  const roots: Dec[] = []
  const steps = 600
  const lnLo = LOW.plus(1).ln()
  const lnHi = HIGH.plus(1).ln()
  let prevR = LOW
  let prevY = npvAt(prevR, cf)
  if (prevY.isZero()) roots.push(prevR)
  for (let k = 1; k <= steps; k++) {
    const r = k === steps ? HIGH : lnLo.plus(lnHi.minus(lnLo).times(k).div(steps)).exp().minus(1)
    const y = npvAt(r, cf)
    if (y.isZero()) roots.push(r)
    else if (!prevY.isZero() && y.s !== prevY.s) {
      const rough = bisect(prevR, r, cf)
      roots.push(newton(rough, cf) ?? rough)
    }
    prevR = r
    prevY = y
  }

  const g = new Dec(guess).div(100)
  let found = newton(g, cf)
  if (!found) {
    if (roots.length === 0) throw new TvmError('No IRR found between −99% and 1000%.')
    // Fall back to the bracketed root nearest the guess.
    found = roots.reduce((best, r) => (r.minus(g).abs().lt(best.minus(g).abs()) ? r : best))
  }
  const pct = (r: Dec) => r.times(100)
  const unique = roots.length ? roots : [found]
  const result: IrrResult = { irr: pct(found), roots: unique.map(pct), signChanges }
  if (signChanges > 1) {
    result.warning =
      unique.length > 1
        ? `These cash flows have ${unique.length} IRRs; NPV or MIRR is a safer measure.`
        : `The cash flows change sign ${signChanges} times, so there may be more than one IRR; NPV or MIRR is a safer measure.`
  }
  return result
}

/**
 * Modified IRR (% per period): negative flows are discounted to time 0 at
 * `financeRate` %, positive flows compounded to the last period at
 * `reinvestRate` %.
 */
export function mirr(flows: Flows, financeRate: Decimal.Value, reinvestRate: Decimal.Value): Dec {
  const cf = toDecs(flows)
  const n = cf.length - 1
  if (n < 1) throw new TvmError('MIRR needs at least two cash flows.')
  const f = new Dec(financeRate).div(100).plus(1)
  const re = new Dec(reinvestRate).div(100).plus(1)
  if (f.lte(0) || re.lte(0)) throw new TvmError('Rates must be greater than −100%.')
  let pvNeg = new Dec(0)
  let fvPos = new Dec(0)
  cf.forEach((c, t) => {
    if (c.isNeg()) pvNeg = pvNeg.plus(c.div(f.pow(t)))
    else fvPos = fvPos.plus(c.times(re.pow(n - t)))
  })
  if (pvNeg.isZero() || fvPos.isZero()) throw new TvmError('MIRR needs at least one negative and one positive cash flow.')
  return fvPos.div(pvNeg.neg()).pow(new Dec(1).div(n)).minus(1).times(100)
}
