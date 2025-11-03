import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type { MeasurementSystem } from '@/types/user'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SQUARE_METERS_PER_ACRE = 4046.8564224

interface FormatAreaOptions {
  maximumFractionDigits?: number
  fallback?: string
}

export function formatArea(
  squareMeters: number | null | undefined,
  measurementSystem?: MeasurementSystem,
  options?: FormatAreaOptions
): string {
  if (squareMeters == null || Number.isNaN(squareMeters)) {
    return options?.fallback ?? 'N/A'
  }

  const digits = options?.maximumFractionDigits ?? 2
  const system = measurementSystem ?? 'Metric'

  if (system === 'Imperial') {
    const acres = squareMeters / SQUARE_METERS_PER_ACRE
    return `${acres.toFixed(digits)} ac`
  }

  const hectares = squareMeters / 10000
  return `${hectares.toFixed(digits)} ha`
}

