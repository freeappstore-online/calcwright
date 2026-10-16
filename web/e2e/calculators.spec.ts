import { expect, expectNotice, test } from './fixtures'

test('TVM: solve for PMT, then for I/Y', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Time value of money' })).toBeVisible()

  const output = page.locator('output')
  // Defaults: N 360, I/Y 6, PV 200,000, FV 0 → PMT.
  await expect(output).toHaveText('-1,199.1')

  await page.getByLabel('PV: Present value').fill('150000')
  await page.getByLabel('I/Y: Nominal annual rate, %').fill('4.5')
  await expect(output).toHaveText('-760.03')

  // Solve for the rate from the cent-rounded payment: just over 4.5%.
  await page.getByRole('radio', { name: 'Solve for I/Y' }).check()
  await page.getByLabel('PMT: Payment each period').fill('-760.03')
  await expect(output).toHaveText('4.500023')

  // Begin mode changes the answer.
  await page.getByRole('radio', { name: 'Solve for PMT' }).check()
  await page.getByLabel('Payments at').selectOption('begin')
  await expect(output).toHaveText('-757.19')

  await expectNotice(page)
})

test('TVM: inputs are saved on the device', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('N: Number of payments').fill('180')
  await expect(page.locator('output')).toHaveText('-1,687.71')
  await page.reload()
  await expect(page.getByLabel('N: Number of payments')).toHaveValue('180')
  await expect(page.locator('output')).toHaveText('-1,687.71')
})

test('Loans: payment, totals, schedule and extra payments', async ({ page }) => {
  await page.goto('/loans')
  await page.getByLabel('Loan amount').fill('200000')
  await page.getByLabel('Annual interest rate, %').fill('6')
  await page.getByLabel('Term', { exact: true }).fill('30')

  const stat = (name: string) => page.locator('dl > div').filter({ has: page.getByText(name, { exact: true }) }).locator('dd')
  await expect(stat('Monthly payment')).toHaveText('1,199.1')
  await expect(stat('Payments')).toHaveText('360')

  const rows = page.getByRole('table', { name: 'Amortisation schedule' }).locator('tbody tr')
  await expect(rows).toHaveCount(360)
  await expect(rows.first()).toContainText('1,000')
  await expect(rows.last().locator('td').last()).toHaveText('0')

  await page.getByLabel('Extra payment each month').fill('100')
  await expect(stat('Payments')).not.toHaveText('360')
  await expect(stat('Interest saved')).not.toHaveText('0')
  await expect(stat('Payments saved')).not.toHaveText('0')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download CSV' }).click()
  expect((await download).suggestedFilename()).toBe('amortisation-schedule.csv')

  await expectNotice(page)
})

test('Cash flows: NPV, IRR, MIRR and the multiple-root warning', async ({ page }) => {
  await page.goto('/cashflows')
  const result = (name: string) => page.locator('dl > div').filter({ has: page.getByText(name, { exact: true }) })

  // Defaults: −70,000, 12,000, 15,000, 18,000, 21,000, 26,000 (Excel's IRR example) at 8%.
  await expect(result('NPV').locator('dd').first()).toHaveText('1,390.96')
  await expect(result('IRR').locator('dd').first()).toHaveText('8.663095%')
  await expect(result('MIRR').locator('dd').first()).toHaveText(/%$/)

  // Replace with −100, 230, −132: two IRRs, 10% and 20%.
  const remove = page.getByRole('button', { name: /^Remove CF/ })
  while ((await remove.count()) > 3) await remove.last().click()
  await page.getByLabel('CF0', { exact: true }).fill('-100')
  await page.getByLabel('CF1', { exact: true }).fill('230')
  await page.getByLabel('CF2', { exact: true }).fill('-132')
  await expect(result('IRR').getByRole('note')).toContainText('2 IRRs')
  await expect(result('IRR').getByRole('note')).toContainText('10%, 20%')

  await page.getByRole('button', { name: 'Add cash flow' }).click()
  await expect(page.getByLabel('CF3', { exact: true })).toBeVisible()

  await expectNotice(page)
})

test('Conduit: offset, stub and saddles in inches and millimetres', async ({ page }) => {
  await page.goto('/conduit')
  const line = (name: string) => page.locator('dl > div').filter({ has: page.getByText(name, { exact: true }) }).locator('dd')

  // Offset defaults: 6″ at 30°, 40″ to the obstacle.
  await expect(line('Distance between bends')).toHaveText('12″')
  await expect(line('Shrink')).toHaveText('1 1/2″')

  await page.getByRole('button', { name: '90° stub' }).click()
  await page.getByLabel('Conduit', { exact: true }).selectOption('3/4')
  await page.getByLabel('Stub height, in').fill('12')
  await expect(line('Arrow mark')).toHaveText('6″')

  await page.getByLabel('Units').selectOption('mm')
  await page.getByLabel('Conduit', { exact: true }).selectOption('1/2')
  await page.getByLabel('Stub height, mm').fill('300')
  await expect(line('Arrow mark')).toHaveText('173 mm')

  await page.getByLabel('Units').selectOption('in')
  await page.getByRole('button', { name: '3-point saddle' }).click()
  await page.getByLabel('Obstacle height, in').fill('2')
  await page.getByLabel('Distance to obstacle centre, in').fill('30')
  await expect(line('Centre mark (45°)')).toHaveText('30 3/8″')
  await expect(line('First mark (22.5°)')).toHaveText('25 3/8″')

  await page.getByRole('button', { name: '4-point saddle' }).click()
  await expect(line('Mark 1')).toBeVisible()

  await expectNotice(page)
})
