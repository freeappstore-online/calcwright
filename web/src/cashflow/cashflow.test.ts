import { describe, expect, it } from 'vitest'
import { TvmError } from '../tvm/tvm'
import { irr, mirr, npv } from './cashflow'

const TOL = 1e-6
const close = (actual: { toNumber(): number }, expected: number, tol = TOL) =>
  expect(Math.abs(actual.toNumber() - expected)).toBeLessThan(tol)

// Reference values are the published examples for Excel's NPV, IRR and MIRR
// (which agree with the BA II Plus and HP 12C). Excel's NPV discounts its
// first value by one period, so those examples put 0 or the initial outlay at CF0.
describe('NPV', () => {
  it('Excel example 1: 10%, flows at the end of years 1–4', () => {
    close(npv(10, [0, -10000, 3000, 4200, 6800]), 1188.4434123352)
  })
  it('Excel example 2: 8%, initial outlay at time 0', () => {
    close(npv(8, [-40000, 8000, 9200, 10000, 12000, 14500]), 1922.0615549)
  })
  it('Excel example 2 with a year-6 loss', () => {
    close(npv(8, [-40000, 8000, 9200, 10000, 12000, 14500, -9000]), -3749.4650870)
  })
  it('at 0% is the plain sum', () => {
    expect(npv(0, ['-0.1', '0.2', '-0.3']).toString()).toBe('-0.2')
  })
  it('discounts exactly: 110 in one period at 10% is worth 100', () => {
    expect(npv(10, [0, 110]).toString()).toBe('100')
  })
})

describe('IRR', () => {
  const flows = [-70000, 12000, 15000, 18000, 21000, 26000]
  it('Excel example: 5 years of income', () => {
    const r = irr(flows)
    close(r.irr, 8.663094803653162)
    expect(r.warning).toBeUndefined()
    expect(r.signChanges).toBe(1)
  })
  it('Excel example: 4 years of income', () => {
    close(irr(flows.slice(0, 5)).irr, -2.1244848273, 1e-8)
  })
  it('Excel example: 2 years of income, guess −10%', () => {
    close(irr(flows.slice(0, 3), -10).irr, -44.350694133, 1e-6)
  })
  it('NPV at the IRR is zero', () => {
    const r = irr([-1000, 300, 400, 500, 100])
    expect(npv(r.irr, [-1000, 300, 400, 500, 100]).abs().lt('1e-30')).toBe(true)
  })
  it('a one-period loan has the obvious IRR', () => {
    expect(irr([-100, 110]).irr.minus(10).abs().lt('1e-30')).toBe(true)
  })

  it('finds both roots of −100, 230, −132 (10% and 20%) and warns', () => {
    const r = irr([-100, 230, -132])
    expect(r.signChanges).toBe(2)
    expect(r.roots).toHaveLength(2)
    close(r.roots[0], 10, 1e-12)
    close(r.roots[1], 20, 1e-12)
    expect(r.warning).toMatch(/2 IRRs/)
    close(r.irr, 10, 1e-12) // Newton from the default 10% guess.
  })
  it('the guess picks which of several roots is the IRR', () => {
    close(irr([-100, 230, -132], 25).irr, 20, 1e-12)
  })
  it('warns on several sign changes even with one root', () => {
    // NPV crosses zero once in range (about 15.98%) despite three sign changes.
    const r = irr([-1000, 800, -100, 600])
    expect(r.signChanges).toBe(3)
    expect(r.roots).toHaveLength(1)
    close(r.irr, 15.981756875)
    expect(r.warning).toMatch(/may be more than one IRR/)
  })
  it('falls back to bisection when Newton leaves the range', () => {
    // From a guess of 900% Newton leaves the range; the bracketed root is used.
    const r = irr([-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.5], 900)
    close(r.irr, (Math.pow(1.5, 1 / 10) - 1) * 100)
  })
  it('rejects all-positive flows', () => {
    expect(() => irr([100, 200])).toThrow(TvmError)
  })
})

describe('MIRR', () => {
  const flows = [-120000, 39000, 30000, 21000, 37000, 46000]
  it('Excel example: after five years', () => close(mirr(flows, 10, 12), 12.609413036, 1e-8))
  it('Excel example: after three years', () => close(mirr(flows.slice(0, 4), 10, 12), -4.804465524, 1e-8))
  it('Excel example: five years at a 14% reinvestment rate', () => close(mirr(flows, 10, 14), 13.475911082, 1e-8))
  it('equals the IRR when both rates are the IRR', () => {
    const r = irr([-1000, 500, 400, 300]).irr
    expect(mirr([-1000, 500, 400, 300], r, r).minus(r).abs().lt('1e-30')).toBe(true)
  })
  it('rejects one-signed flows', () => {
    expect(() => mirr([-100, -200], 10, 10)).toThrow(TvmError)
  })
})
