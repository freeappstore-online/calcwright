import Decimal from 'decimal.js'
import { Dec, TvmError, solveTvm } from '../tvm/tvm'

// A fixed-rate loan with monthly payments and monthly compounding, amortised
// the way a lender does it: the payment is rounded to the cent, each month's
// interest is rounded to the cent, and the final payment is whatever clears
// the balance. An optional extra amount goes straight to principal each month.

export interface LoanInputs {
  amount: Decimal.Value
  /** Nominal annual rate, %. */
  rate: Decimal.Value
  /** Term in months. */
  months: number
  /** Extra principal paid each month (default 0). */
  extra?: Decimal.Value
}

export interface LoanRow {
  period: number
  /** Scheduled payment (principal + interest), excluding the extra. */
  payment: Dec
  principal: Dec
  interest: Dec
  extra: Dec
  balance: Dec
}

export interface LoanSchedule {
  /** The regular monthly payment. */
  payment: Dec
  rows: LoanRow[]
  totalInterest: Dec
  /** Everything paid: principal, interest and extras. */
  totalPaid: Dec
}

export interface LoanResult extends LoanSchedule {
  /** The same loan with no extra payments. */
  baseline: LoanSchedule
  interestSaved: Dec
  paymentsSaved: number
}

const cents = (d: Dec) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

export function monthlyPayment(amount: Decimal.Value, rate: Decimal.Value, months: number): Dec {
  return cents(solveTvm('pmt', { n: months, iy: rate, pv: amount, pmt: 0, fv: 0, py: 12, cy: 12, mode: 'end' }).neg())
}

export function schedule(inputs: LoanInputs): LoanSchedule {
  const amount = new Dec(inputs.amount)
  const rate = new Dec(inputs.rate)
  const extraEach = new Dec(inputs.extra ?? 0)
  if (!amount.isFinite() || amount.lte(0)) throw new TvmError('Loan amount must be greater than 0.')
  if (!rate.isFinite() || rate.lt(0)) throw new TvmError('Interest rate can’t be negative.')
  if (!Number.isInteger(inputs.months) || inputs.months <= 0) throw new TvmError('Term must be a whole number of months.')
  if (inputs.months > 1200) throw new TvmError('Term can be at most 100 years.')
  if (!extraEach.isFinite() || extraEach.lt(0)) throw new TvmError('Extra payment can’t be negative.')

  const i = rate.div(1200)
  const payment = monthlyPayment(amount, rate, inputs.months)
  const rows: LoanRow[] = []
  let balance = amount
  let totalInterest = new Dec(0)
  let totalPaid = new Dec(0)

  // Rounding the payment to the cent leaves a few cents over or under by the
  // end of the term, so the last payment is adjusted to clear the balance.
  while (balance.gt(0)) {
    const interest = cents(balance.times(i))
    let principal = payment.minus(interest)
    let extra = extraEach
    if (principal.gte(balance) || rows.length + 1 >= inputs.months) {
      principal = balance
      extra = new Dec(0)
    } else if (principal.plus(extra).gt(balance)) {
      extra = balance.minus(principal)
    }
    balance = balance.minus(principal).minus(extra)
    totalInterest = totalInterest.plus(interest)
    totalPaid = totalPaid.plus(principal).plus(interest).plus(extra)
    rows.push({ period: rows.length + 1, payment: principal.plus(interest), principal, interest, extra, balance })
  }
  return { payment, rows, totalInterest, totalPaid }
}

/** The schedule with extras, compared against the same loan without them. */
export function amortise(inputs: LoanInputs): LoanResult {
  const withExtra = schedule(inputs)
  const baseline = new Dec(inputs.extra ?? 0).isZero() ? withExtra : schedule({ ...inputs, extra: 0 })
  return {
    ...withExtra,
    baseline,
    interestSaved: baseline.totalInterest.minus(withExtra.totalInterest),
    paymentsSaved: baseline.rows.length - withExtra.rows.length,
  }
}

/** The schedule as CSV, with plain (unlocalised) numbers so spreadsheets read it. */
export function toCsv(rows: LoanRow[]): string {
  const lines = ['Payment,Payment amount,Principal,Interest,Extra,Balance']
  for (const r of rows) {
    lines.push([r.period, r.payment.toFixed(2), r.principal.toFixed(2), r.interest.toFixed(2), r.extra.toFixed(2), r.balance.toFixed(2)].join(','))
  }
  return lines.join('\r\n') + '\r\n'
}
