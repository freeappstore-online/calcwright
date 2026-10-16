import { describe, expect, it } from 'vitest'
import { Dec, TvmError, solveTvm } from '../tvm/tvm'
import { amortise, monthlyPayment, schedule, toCsv } from './loan'

const sum = (values: Dec[]) => values.reduce((a, b) => a.plus(b), new Dec(0))

describe('monthly payment', () => {
  it('200,000 over 30 years at 6% is 1,199.10', () => {
    expect(monthlyPayment(200000, 6, 360).toString()).toBe('1199.1')
  })
  it('75,000 over 15 years at 5.5% is 612.81 (BA II Plus guidebook)', () => {
    expect(monthlyPayment(75000, 5.5, 180).toString()).toBe('612.81')
  })
  it('0% splits the loan evenly', () => {
    expect(monthlyPayment(1200, 0, 12).toString()).toBe('100')
  })
})

describe('schedule totals', () => {
  const cases = [
    { amount: 200000, rate: 6, months: 360 },
    { amount: 75000, rate: 5.5, months: 180 },
    { amount: 32000, rate: 7.25, months: 60 },
    { amount: '12345.67', rate: '19.99', months: 24 },
    { amount: 1000, rate: 0, months: 7 },
  ]
  for (const c of cases) {
    describe(`${c.amount} at ${c.rate}% for ${c.months} months`, () => {
      const s = schedule(c)
      it('runs the full term and ends at exactly 0', () => {
        expect(s.rows).toHaveLength(c.months)
        expect(s.rows.at(-1)!.balance.isZero()).toBe(true)
        expect(s.rows.every((r) => r.balance.gte(0))).toBe(true)
      })
      it('principal paid sums to the loan amount exactly', () => {
        expect(sum(s.rows.map((r) => r.principal)).eq(c.amount)).toBe(true)
      })
      it('interest paid sums to the total interest, and total paid = amount + interest', () => {
        expect(sum(s.rows.map((r) => r.interest)).eq(s.totalInterest)).toBe(true)
        expect(s.totalPaid.eq(s.totalInterest.plus(c.amount))).toBe(true)
      })
      it('every amount is in whole cents and each row balances', () => {
        let balance = new Dec(c.amount)
        for (const r of s.rows) {
          for (const d of [r.payment, r.principal, r.interest, r.extra, r.balance]) expect(d.decimalPlaces()).toBeLessThanOrEqual(2)
          expect(r.payment.eq(r.principal.plus(r.interest))).toBe(true)
          balance = balance.minus(r.principal).minus(r.extra)
          expect(r.balance.eq(balance)).toBe(true)
        }
      })
      it('only the last payment differs, by at most the compounded half-cent rounding', () => {
        expect(s.rows.slice(0, -1).every((r) => r.payment.eq(s.payment))).toBe(true)
        // Rounding the payment moves it by ≤ 0.005 a month (plus ≤ 0.005 a month
        // of interest rounding); the last payment absorbs that, with interest.
        const i = new Dec(c.rate).div(1200)
        const growth = i.plus(1).pow(c.months)
        const drift = i.isZero() ? new Dec(c.months) : growth.minus(1).div(i)
        expect(s.rows.at(-1)!.payment.minus(s.payment).abs().lte(drift.times(0.01))).toBe(true)
      })
    })
  }

  it('interest each month is the balance × monthly rate, rounded to the cent', () => {
    const s = schedule({ amount: 200000, rate: 6, months: 360 })
    expect(s.rows[0].interest.toString()).toBe('1000')
    expect(s.rows[0].principal.toString()).toBe('199.1')
    expect(s.rows[0].balance.toString()).toBe('199800.9')
    expect(s.rows[1].interest.toString()).toBe('999')
  })
})

describe('extra payments', () => {
  const loan = { amount: 200000, rate: 6, months: 360 }

  it('pays off sooner, in the period the TVM solver predicts', () => {
    const r = amortise({ ...loan, extra: 100 })
    const n = solveTvm('n', { n: 0, iy: 6, pv: 200000, pmt: '-1299.10', fv: 0, py: 12, cy: 12, mode: 'end' })
    expect(r.rows.length).toBe(n.ceil().toNumber())
    expect(r.rows.length).toBeLessThan(360)
    expect(r.paymentsSaved).toBe(360 - r.rows.length)
    expect(r.rows.at(-1)!.balance.isZero()).toBe(true)
  })

  it('interest saved is the difference between the two schedules', () => {
    const r = amortise({ ...loan, extra: 100 })
    expect(r.interestSaved.eq(r.baseline.totalInterest.minus(r.totalInterest))).toBe(true)
    expect(r.interestSaved.gt(0)).toBe(true)
    // Principal is still repaid exactly once, between regular and extra payments.
    expect(sum(r.rows.map((x) => x.principal.plus(x.extra))).eq(200000)).toBe(true)
    expect(r.totalPaid.eq(r.totalInterest.plus(200000))).toBe(true)
  })

  it('more extra saves more interest', () => {
    const small = amortise({ ...loan, extra: 100 })
    const big = amortise({ ...loan, extra: 500 })
    expect(big.interestSaved.gt(small.interestSaved)).toBe(true)
    expect(big.paymentsSaved).toBeGreaterThan(small.paymentsSaved)
  })

  it('an extra larger than the balance just pays it off', () => {
    const r = amortise({ amount: 1000, rate: 12, months: 12, extra: 5000 })
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].extra.plus(r.rows[0].principal).eq(1000)).toBe(true)
    expect(r.totalInterest.toString()).toBe('10')
    expect(r.paymentsSaved).toBe(11)
  })

  it('no extra saves nothing', () => {
    const r = amortise(loan)
    expect(r.interestSaved.isZero()).toBe(true)
    expect(r.paymentsSaved).toBe(0)
  })
})

describe('CSV', () => {
  it('has a header and one line per payment, with plain numbers', () => {
    const r = amortise({ amount: 1000, rate: 12, months: 3, extra: 10 })
    const lines = toCsv(r.rows).trimEnd().split('\r\n')
    expect(lines[0]).toBe('Payment,Payment amount,Principal,Interest,Extra,Balance')
    expect(lines).toHaveLength(r.rows.length + 1)
    expect(lines[1]).toBe(`1,${r.payment.toFixed(2)},${r.rows[0].principal.toFixed(2)},10.00,10.00,${r.rows[0].balance.toFixed(2)}`)
    expect(lines.at(-1)!.endsWith(',0.00')).toBe(true)
  })
})

describe('errors', () => {
  it('rejects bad inputs', () => {
    expect(() => schedule({ amount: 0, rate: 5, months: 12 })).toThrow(TvmError)
    expect(() => schedule({ amount: 1000, rate: -1, months: 12 })).toThrow(TvmError)
    expect(() => schedule({ amount: 1000, rate: 5, months: 1.5 })).toThrow(TvmError)
    expect(() => schedule({ amount: 1000, rate: 5, months: 12, extra: -1 })).toThrow(TvmError)
  })
})
