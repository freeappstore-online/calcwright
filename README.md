# Calcwright

**Pro calculators for money and the trade: time value of money, loans, NPV/IRR
and conduit bending. Offline and private.** A free app on [FreeAppStore](https://freeappstore.online), live at
https://calcwright.freeappstore.online.

Four calculators: a TVM solver (N, I/Y, PV, PMT, FV), loan amortisation with extra payments and
CSV export, NPV/IRR/MIRR for cash flows, and EMT conduit bending (offsets, stubs, back-to-backs,
saddles). Money maths is exact decimal. Tracked in
[freeappstore-online/platform#248](https://github.com/freeappstore-online/platform/issues/248).

## Develop

```bash
pnpm install
pnpm dev      # local dev server
pnpm build    # production build in web/dist
pnpm test     # unit and reference tests (Vitest)
pnpm test:e2e # end-to-end tests (Playwright, against the built app)
fas check     # FreeAppStore compliance checks
```

Pushes to `main` auto-deploy via GitHub Actions.

## License

MIT.
