import { useEffect, useState } from 'react'
import { initApp } from '@freeappstore/sdk'
import { BuildInfo, type NavItem, PageHeader, Shell } from '@freeappstore/sdk/ui'
import { CashFlowCalculator } from './cashflow/CashFlowCalculator'
import { ConduitCalculator } from './conduit/ConduitCalculator'
import { LoanCalculator } from './loan/LoanCalculator'
import { TvmCalculator } from './tvm/TvmCalculator'

const fas = initApp({ appId: 'calcwright' })

// The app's screens. Shell renders them as its navbar (<nav aria-label="Main">,
// current screen highlighted, a menu on phones). `title` becomes the browser
// tab title on that route.
const NAV: NavItem[] = [
  { label: 'Calculators', href: '/', title: 'Calcwright' },
  { label: 'Loans', href: '/loans', title: 'Loans — Calcwright' },
  { label: 'Cash flows', href: '/cashflows', title: 'Cash flows — Calcwright' },
  { label: 'Conduit', href: '/conduit', title: 'Conduit bending — Calcwright' },
  { label: 'About', href: '/about', title: 'About — Calcwright' },
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
    // Screens scroll inside <main> (see index.css), so start each one at the top.
    document.getElementById('main')?.scrollTo(0, 0)
  }

  return (
    <Shell app={fas} appName="Calcwright" nav={NAV} onNavigate={navigate}>
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-8">
        {path === '/about' ? <About /> : path === '/loans' ? <Loans /> : path === '/cashflows' ? <CashFlows /> : path === '/conduit' ? <Conduit /> : <Calculators />}
        <Notice />
      </div>
      <BuildInfo />
    </Shell>
  )
}

function Calculators() {
  return (
    <>
      <PageHeader
        title="Calcwright"
        description="Pro calculators for money and the trade: time value of money, loans, NPV/IRR and conduit bending. Offline and private."
      />
      <TvmCalculator />
    </>
  )
}

function Loans() {
  return (
    <>
      <PageHeader title="Loans" description="An amortisation schedule with extra payments, the interest they save, and CSV export." />
      <LoanCalculator />
    </>
  )
}

function CashFlows() {
  return (
    <>
      <PageHeader title="Cash flows" description="NPV at a rate, IRR with a warning when there may be more than one, and MIRR." />
      <CashFlowCalculator />
    </>
  )
}

function Conduit() {
  return (
    <>
      <PageHeader title="Conduit bending" description="EMT offsets, 90° stubs, back-to-backs and 3- and 4-point saddles, in inches or millimetres." />
      <ConduitCalculator />
    </>
  )
}

function About() {
  return (
    <>
      <PageHeader title="About" />
      <p className="mt-4 text-[var(--muted)]">
        Calcwright brings pro calculators to your browser: time value of money, loans, NPV, IRR and
        MIRR for money, and conduit bending for the trade. It's pure maths on your device, so it
        works offline and your inputs never leave it. Results are estimates, not financial or
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

// Shown under every screen.
function Notice() {
  return (
    <aside aria-labelledby="notice-title" className="mt-8 rounded-[var(--radius)] border border-[var(--line)] p-4 text-sm text-[var(--muted)]">
      <h2 id="notice-title" className="font-semibold text-[var(--ink)]">
        Privacy and disclaimer
      </h2>
      <p className="mt-1">All calculations run locally in your browser; no data is sent to any server.</p>
      <p className="mt-1">Results are estimates only and are not financial, electrical-code or other professional advice.</p>
    </aside>
  )
}
