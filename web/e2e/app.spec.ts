import AxeBuilder from '@axe-core/playwright'
import { expect, expectNotice, test } from './fixtures'

const SCREENS = ['/', '/loans', '/cashflows', '/conduit', '/about']

test('every screen shows the privacy note and disclaimer', async ({ page }) => {
  for (const path of SCREENS) {
    await page.goto(path)
    await expectNotice(page)
  }
})

test('the nav reaches every calculator', async ({ page, isMobile }) => {
  await page.goto('/')
  for (const [label, heading] of [
    ['Loans', 'Loan and amortisation'],
    ['Cash flows', 'NPV, IRR and MIRR'],
    ['Conduit', 'EMT conduit bending'],
  ]) {
    if (isMobile) await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label }).click()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }
})

for (const scheme of ['light', 'dark'] as const) {
  test(`no WCAG 2.1 AA violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    for (const path of SCREENS) {
      await page.goto(path)
      await expectNotice(page)
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(violations.map((v) => `${path}: ${v.id} (${v.nodes.length})`)).toEqual([])
    }
  })
}

test('theme follows the system, and the toggle choice is saved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // The Shell's toggle cycles system → light → dark.
  await page.getByRole('button', { name: 'Theme: system' }).click()
  await expect(page.getByRole('button', { name: 'Theme: light' })).toBeVisible()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: 'Theme: light' })).toBeVisible()
})

test('keyboard: Tab reaches the calculator inputs and they are operable', async ({ page }) => {
  await page.goto('/')
  const n = page.getByLabel('N: Number of payments')
  for (let i = 0; i < 30 && !(await n.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(n).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('120')
  await expect(page.locator('output')).not.toHaveText('-1,199.1')
})

test('works offline once loaded', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)

  await context.setOffline(true)
  for (const [path, heading] of [
    ['/', 'Time value of money'],
    ['/loans', 'Loan and amortisation'],
    ['/cashflows', 'NPV, IRR and MIRR'],
    ['/conduit', 'EMT conduit bending'],
    ['/about', 'About'],
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  await page.goto('/')
  await expect(page.locator('output')).toHaveText('-1,199.1')
  await context.setOffline(false)
})
