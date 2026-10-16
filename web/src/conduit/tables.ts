// Reference data for EMT hand benders (Ugly's Electrical References; Klein and
// Ideal bender tables). Multipliers and shrink are ratios, so they work in any
// unit; take-up is given in both inches and millimetres as the tables print it.

export const ANGLES = [10, 22.5, 30, 45, 60] as const
export type BendAngle = (typeof ANGLES)[number]

export interface AngleData {
  /** Distance between bends per unit of offset height (≈ cosecant of the angle). */
  multiplier: number
  /** Conduit lost per unit of offset height. */
  shrink: number
}

export const OFFSET_TABLE: Record<BendAngle, AngleData> = {
  10: { multiplier: 5.76, shrink: 1 / 16 },
  22.5: { multiplier: 2.613, shrink: 3 / 16 },
  30: { multiplier: 2, shrink: 1 / 4 },
  45: { multiplier: 1.414, shrink: 3 / 8 },
  60: { multiplier: 1.155, shrink: 1 / 2 },
}

export const SIZES = ['1/2', '3/4', '1', '1-1/4', '1-1/2', '2'] as const
export type ConduitSize = (typeof SIZES)[number]

/** Take-up for a 90° stub, measured back from the arrow mark. */
export const TAKE_UP: Record<ConduitSize, { in: number; mm: number }> = {
  '1/2': { in: 5, mm: 127 },
  '3/4': { in: 6, mm: 152 },
  '1': { in: 8, mm: 203 },
  '1-1/4': { in: 11, mm: 279 },
  '1-1/2': { in: 14, mm: 356 },
  '2': { in: 17, mm: 432 },
}

/** Trade size in metric designation (mm), for display. */
export const METRIC_SIZE: Record<ConduitSize, number> = {
  '1/2': 16,
  '3/4': 21,
  '1': 27,
  '1-1/4': 35,
  '1-1/2': 41,
  '2': 53,
}

/** 3-point saddle with a 45° centre and two 22.5° outer bends. */
export const SADDLE_3 = {
  centreAngle: 45,
  outerAngle: 22.5,
  /** Distance from the centre mark to each outer mark, per unit of saddle height. */
  spacing: 2.5,
  /** Shrink per unit of saddle height. */
  shrink: 3 / 16,
} as const
