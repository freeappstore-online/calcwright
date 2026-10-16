import { type Page, expect, test as base } from '@playwright/test'

// Every test starts from a clean device, and every screen must show the
// privacy note and disclaimer.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-cleared')) {
        localStorage.clear()
        sessionStorage.setItem('e2e-cleared', '1')
      }
    })
    await use(page)
  },
})

export async function expectNotice(page: Page) {
  const notice = page.getByRole('complementary', { name: 'Privacy and disclaimer' })
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('no data is sent to any server')
  await expect(notice).toContainText('not financial, electrical-code or other professional advice')
}

export { expect }
