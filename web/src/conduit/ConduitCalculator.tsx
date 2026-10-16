import { useEffect, useMemo, useState } from 'react'
import { Tabs } from '@freeappstore/sdk/ui'
import { parseLocaleNumber } from '../tvm/format'
import { BendError, backToBack90, formatInches, formatMm, offsetBend, saddle3Point, saddle4Point, stubBend90 } from './conduit'
import { ANGLES, type BendAngle, type ConduitSize, METRIC_SIZE, SIZES, TAKE_UP } from './tables'

type Bend = 'offset' | 'stub' | 'b2b' | 'saddle3' | 'saddle4'
type Units = 'in' | 'mm'
type FieldKey = 'height' | 'distance' | 'stub' | 'b2b' | 'width'

const TABS: { key: Bend; label: string }[] = [
  { key: 'offset', label: 'Offset' },
  { key: 'stub', label: '90° stub' },
  { key: 'b2b', label: 'Back-to-back' },
  { key: 'saddle3', label: '3-point saddle' },
  { key: 'saddle4', label: '4-point saddle' },
]

// Which inputs each bend needs, and what they're called there.
const FIELDS: Record<Bend, { key: FieldKey; label: string; optional?: boolean }[]> = {
  offset: [
    { key: 'height', label: 'Offset height' },
    { key: 'distance', label: 'Distance to obstacle (optional)', optional: true },
  ],
  stub: [{ key: 'stub', label: 'Stub height' }],
  b2b: [
    { key: 'stub', label: 'First stub height' },
    { key: 'b2b', label: 'Back-to-back distance' },
  ],
  saddle3: [
    { key: 'height', label: 'Obstacle height' },
    { key: 'distance', label: 'Distance to obstacle centre' },
  ],
  saddle4: [
    { key: 'height', label: 'Obstacle height' },
    { key: 'width', label: 'Obstacle width' },
    { key: 'distance', label: 'Distance to obstacle' },
  ],
}

interface Saved {
  bend: Bend
  units: Units
  size: ConduitSize
  angle: BendAngle
  values: Record<FieldKey, string>
}

const STORAGE_KEY = 'calcwright.conduit'
const DEFAULTS: Saved = {
  bend: 'offset',
  units: 'in',
  size: '1/2',
  angle: 30,
  values: { height: '6', distance: '40', stub: '10', b2b: '36', width: '10' },
}

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Saved> | null
    if (saved && typeof saved === 'object') return { ...DEFAULTS, ...saved, values: { ...DEFAULTS.values, ...saved.values } }
  } catch {
    // Unreadable saved inputs: start from the defaults.
  }
  return DEFAULTS
}

type Line = [label: string, value: string]

export function ConduitCalculator() {
  const [state, setState] = useState(load)
  const { bend, units, size, angle, values } = state

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const result = useMemo((): { lines: Line[] } | { error: string } => {
    const len = units === 'in' ? formatInches : formatMm
    const num: Partial<Record<FieldKey, number>> = {}
    for (const f of FIELDS[bend]) {
      const text = values[f.key]
      if (f.optional && text.trim() === '') continue
      const d = parseLocaleNumber(text)
      if (!d) return { error: `Enter a number for ${f.label.replace(' (optional)', '').toLowerCase()}.` }
      num[f.key] = d.toNumber()
    }
    const takeUp = TAKE_UP[size][units]
    try {
      switch (bend) {
        case 'offset': {
          const r = offsetBend(num.height!, angle, num.distance)
          const lines: Line[] = [
            ['Multiplier', String(r.multiplier)],
            ['Distance between bends', len(r.spacing)],
            ['Shrink', len(r.shrink)],
          ]
          if (r.firstMark !== undefined) lines.push(['First mark (away from obstacle)', len(r.firstMark)], ['Second mark (at obstacle + shrink)', len(r.secondMark!)])
          return { lines }
        }
        case 'stub': {
          const r = stubBend90(num.stub!, takeUp)
          return { lines: [['Take-up', len(r.takeUp)], ['Arrow mark', len(r.mark)]] }
        }
        case 'b2b': {
          const r = backToBack90(num.stub!, num.b2b!, takeUp)
          return {
            lines: [
              ['Take-up', len(r.takeUp)],
              ['First 90°: arrow mark', len(r.mark)],
              ['Second 90°: star mark, from the back of the first', len(r.secondMark)],
            ],
          }
        }
        case 'saddle3': {
          const r = saddle3Point(num.height!, num.distance!)
          return {
            lines: [
              ['Bends', `${r.outerAngle}° · ${r.centreAngle}° · ${r.outerAngle}°`],
              ['Shrink', len(r.shrink)],
              ['First mark (22.5°)', len(r.firstMark)],
              ['Centre mark (45°)', len(r.centreMark)],
              ['Third mark (22.5°)', len(r.thirdMark)],
            ],
          }
        }
        case 'saddle4': {
          const r = saddle4Point(num.height!, num.width!, angle, num.distance!)
          return {
            lines: [
              ['Multiplier', String(r.multiplier)],
              ['Distance between bends of each offset', len(r.spacing)],
              ['Total shrink', len(r.totalShrink)],
              ...r.marks.map((m, k): Line => [`Mark ${k + 1}`, len(m)]),
            ],
          }
        }
      }
    } catch (e) {
      return { error: e instanceof BendError ? e.message : 'No layout for these values.' }
    }
  }, [bend, units, size, angle, values])

  const set = (key: FieldKey, text: string) => setState((s) => ({ ...s, values: { ...s.values, [key]: text } }))
  const usesAngle = bend === 'offset' || bend === 'saddle4'
  const usesSize = bend === 'stub' || bend === 'b2b'

  const field = 'w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2 text-right tabular-nums text-[var(--ink)]'
  const select = 'rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--paper)] px-2 py-2 text-[var(--ink)]'

  return (
    <section aria-labelledby="conduit-title" className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-6">
      <h2 id="conduit-title" className="text-lg font-semibold text-[var(--ink)]">
        EMT conduit bending
      </h2>
      <p className="text-sm text-[var(--muted)]">Hand-bender layouts from the standard trade tables. Marks are measured from the end of the conduit.</p>

      <div className="mt-4 overflow-x-auto">
        <Tabs tabs={TABS} active={bend} onChange={(key) => setState((s) => ({ ...s, bend: key as Bend }))} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--ink)]">
        <label className="flex items-center gap-2">
          Units
          <select value={units} onChange={(e) => setState((s) => ({ ...s, units: e.target.value as Units }))} className={select}>
            <option value="in">Inches</option>
            <option value="mm">Millimetres</option>
          </select>
        </label>
        {usesSize && (
          <label className="flex items-center gap-2">
            Conduit
            <select value={size} onChange={(e) => setState((s) => ({ ...s, size: e.target.value as ConduitSize }))} className={select}>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}″ (EMT {METRIC_SIZE[s]})
                </option>
              ))}
            </select>
          </label>
        )}
        {usesAngle && (
          <label className="flex items-center gap-2">
            Angle
            <select value={angle} onChange={(e) => setState((s) => ({ ...s, angle: Number(e.target.value) as BendAngle }))} className={select}>
              {ANGLES.map((a) => (
                <option key={a} value={a}>
                  {a}°
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS[bend].map((f) => (
          <label key={f.key} className="grid gap-1 text-sm text-[var(--ink)]">
            {f.label}, {units === 'in' ? 'in' : 'mm'}
            <input inputMode="decimal" value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} className={field} />
          </label>
        ))}
      </div>

      {'error' in result ? (
        <p role="alert" className="mt-4 text-sm text-[var(--accent-deep)]">
          {result.error}
        </p>
      ) : (
        <dl aria-live="polite" className="mt-4 grid gap-2">
          {result.lines.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-1">
              <dt className="text-sm text-[var(--muted)]">{label}</dt>
              <dd className="font-semibold tabular-nums text-[var(--ink)]">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4">
        <button type="button" onClick={() => setState(DEFAULTS)} className="rounded-[var(--radius)] border border-[var(--line-strong)] px-4 py-2 text-[var(--ink)]">
          Reset
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Take-up varies by bender make; check yours. Your inputs are saved on this device only. Results are estimates, not electrical-code advice.
      </p>
    </section>
  )
}
