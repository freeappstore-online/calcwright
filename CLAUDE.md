# calcwright

Calcwright: pro calculators on FreeAppStore — TVM (N, I/Y, PV, PMT, FV; begin/end, P/Y, C/Y),
loan amortisation (extra payments, CSV), NPV/IRR/MIRR and EMT conduit bending (offsets, stubs,
back-to-backs, saddles). Pure maths, offline and private; exact decimal maths for money. Each
calculator lives in `web/src/<name>/` (`tvm`, `loan`, `cashflow`, `conduit`) with its tests; run
`pnpm test`. See freeappstore-online/platform#248.

- Live: https://calcwright.freeappstore.online
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Unit tests: `pnpm test` (Vitest, `web/src/**/*.test.ts`)
- E2e: `pnpm test:e2e` (Playwright, `web/e2e/`, builds and serves the app; run
  `pnpm --filter @calcwright/web exec playwright install chromium` once). Keep the two runners separate.
- Check: `fas check` and `fas screencheck --skip-build` (after `pnpm build`; on Windows it can't spawn pnpm itself)
- Deploy: `git push origin main` (auto-deploys to R2 via GitHub Actions)

## Notes

- Fonts are self-hosted (`@fontsource-variable/*`); the app makes no third-party requests
  beyond the platform API and analytics loader. Keep it that way.
- Inputs never leave the device. Results are estimates, not financial or electrical-code advice;
  the `Notice` in `App.tsx` says so under every screen.
- Screens scroll inside the Shell's `<main>` (see `index.css`) so the app fits every viewport
  for screencheck. Themes come from the SDK Shell's toggle.

Platform conventions: https://raw.githubusercontent.com/freeappstore-online/freeappstore/main/SKILLS.md
