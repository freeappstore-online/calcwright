# calcwright

Calcwright: pro calculators on FreeAppStore — TVM (N, I/Y, PV, PMT, FV; begin/end, P/Y, C/Y),
loan amortisation (extra payments, CSV), NPV/IRR/MIRR and EMT conduit bending (offsets, stubs,
back-to-backs, saddles). Pure maths, offline and private; exact decimal maths for money. The TVM
solver (`web/src/tvm/`) and loans (`web/src/loan/`) are built, tested via `pnpm test`; the rest is "Coming soon" — see
freeappstore-online/platform#248.

- Live: https://calcwright.freeappstore.online
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Check: `fas check`
- Deploy: `git push origin main` (auto-deploys to R2 via GitHub Actions)

## Notes

- Fonts are self-hosted (`@fontsource-variable/*`); the app makes no third-party requests
  beyond the platform API and analytics loader. Keep it that way.
- Inputs never leave the device. Results are estimates, not financial or electrical-code advice.

Platform conventions: https://raw.githubusercontent.com/freeappstore-online/freeappstore/main/SKILLS.md
