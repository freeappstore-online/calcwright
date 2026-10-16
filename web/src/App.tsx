import { useEffect, useState } from 'react'
import { initApp } from '@freeappstore/sdk'
import { BuildInfo, type NavItem, PageHeader, Shell } from '@freeappstore/sdk/ui'

const fas = initApp({ appId: 'calcwright' })

// The app's screens. Shell renders them as its navbar (<nav aria-label="Main">,
// current screen highlighted, a menu on phones). `title` becomes the browser
// tab title on that route.
const NAV: NavItem[] = [
  { label: 'Calculators', href: '/', title: 'Calcwright' },
  { label: 'About', href: '/about', title: 'About — Calcwright' },
]

// The features planned for v1 (freeappstore-online/platform#248).
const FEATURES = [
  { name: 'Time value of money', what: 'Solve for N, I/Y, PV, PMT or FV, with begin/end mode and compounding.' },
  { name: 'Loans', what: 'An amortisation schedule, extra payments, interest saved and CSV export.' },
  { name: 'NPV, IRR and MIRR', what: 'Enter a cash-flow list and get NPV at a rate, IRR and MIRR.' },
  { name: 'Conduit bending', what: 'EMT offsets, 90° stubs, back-to-backs and 3- and 4-point saddles.' },
  { name: 'Exact money maths', what: 'Decimal arithmetic for money, formatted for your locale.' },
  { name: 'Private', what: 'Pure maths on your device. Works offline; your inputs never leave it.' },
]

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname)

  // Keep the screen in step with the browser's back and forward buttons.
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  // Nav clicks switch screens without a page load. Shell scrolls to the top
  // and moves focus to the new screen's PageHeader.
  const navigate = (href: string) => {
    window.history.pushState(null, '', href)
    setPath(href)
  }

  return (
    <Shell app={fas} appName="Calcwright" nav={NAV} onNavigate={navigate}>
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-8">{path === '/about' ? <About /> : <Calculators />}</div>
      <BuildInfo />
    </Shell>
  )
}

function Calculators() {
  return (
    <>
      <PageHeader
        title="Calcwright"
        description="Coming soon — pro calculators for money and the trade: time value of money, loans, NPV/IRR and conduit bending. Offline and private."
      />
      <ComingSoon />
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <li key={feature.name} className="rounded-[var(--radius)] border border-[var(--line)] p-4">
            <p className="font-semibold text-[var(--ink)]">{feature.name}</p>
            <p className="text-sm text-[var(--muted)]">{feature.what}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

function About() {
  return (
    <>
      <PageHeader title="About" />
      <ComingSoon />
      <p className="mt-4 text-[var(--muted)]">
        Calcwright will bring pro calculators to your browser: time value of money, loans, NPV and
        IRR for money, and conduit bending for the trade. It's pure maths on your device, so it will
        work offline and your inputs never leave it. Results will be estimates, not financial or
        electrical-code advice. No account, no ads, no subscription.
      </p>
      <p className="mt-4 text-[var(--muted)]">
        Calcwright is a free, MIT-licensed app on{' '}
        <a href="https://freeappstore.online" className="underline">
          FreeAppStore
        </a>
        .
      </p>
    </>
  )
}

// Placeholder until the features are built. None of them work yet, so it says so plainly.
function ComingSoon() {
  return (
    <p className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 text-[var(--muted)]">
      Coming soon. Calcwright is in development; the features below aren't available yet.
    </p>
  )
}
