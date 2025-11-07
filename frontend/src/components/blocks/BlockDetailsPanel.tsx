import { useMemo } from 'react'
import type { Block, BlockFieldDefinition } from '@/types/block'
import type { MeasurementSystem } from '@/types/user'

interface BlockDetailsPanelProps {
  block: Block | null
  blockFields?: BlockFieldDefinition[]
  measurementSystem?: MeasurementSystem
  onEdit?: (block: Block) => void
  onShowRevisions?: (block: Block) => void
  onFocus?: (block: Block) => void
}

function formatNumber(value: number | undefined | null, fractionDigits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })
}

function formatDate(value: string | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function BlockDetailsPanel({
  block,
  blockFields,
  measurementSystem,
  onEdit,
  onShowRevisions,
  onFocus,
}: BlockDetailsPanelProps) {
  const groupedFields = useMemo(() => {
    if (!blockFields || blockFields.length === 0) return []

    const groups = new Map<string, BlockFieldDefinition[]>()
    blockFields.forEach((field) => {
      if (field.hidden) return
      const groupName = field.group || 'Additional Information'
      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName)!.push(field)
    })

    return Array.from(groups.entries())
  }, [blockFields])

  if (!block) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        Select a block to see its details.
      </div>
    )
  }

  const areaHectares = block.area / 10_000
  const areaAcres = block.area * 0.000247105

  const getFieldValue = (definition: BlockFieldDefinition) => {
    const fromCustomFields = block.customFields?.find(
      (field) => field.key === definition.machineName || field.key === definition.label
    )

    if (fromCustomFields && fromCustomFields.value !== undefined && fromCustomFields.value !== null) {
      return fromCustomFields.value
    }

    const fromBlock = (block as Record<string, unknown>)[definition.machineName]
    if (fromBlock !== undefined && fromBlock !== null) {
      return fromBlock
    }

    const fromLabel = (block as Record<string, unknown>)[definition.label]
    if (fromLabel !== undefined && fromLabel !== null) {
      return fromLabel
    }

    return '—'
  }

  const renderFieldValue = (definition: BlockFieldDefinition) => {
    const rawValue = getFieldValue(definition)

    if (rawValue === '—') return '—'

    if (definition.type === 'Number' && typeof rawValue === 'number') {
      return formatNumber(rawValue)
    }

    if (definition.type === 'Boolean' && typeof rawValue === 'boolean') {
      return rawValue ? 'Yes' : 'No'
    }

    if (definition.type === 'Date and Time') {
      if (typeof rawValue === 'string') {
        return formatDate(rawValue)
      }

      if (rawValue && typeof rawValue === 'object' && 'seconds' in (rawValue as any)) {
        const seconds = (rawValue as any).seconds as number
        return formatDate(new Date(seconds * 1000).toISOString())
      }
    }

    if (Array.isArray(rawValue)) {
      return rawValue.join(', ')
    }

    return String(rawValue)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{block.name}</h3>
            {block.description && (
              <p className="mt-1 text-sm text-gray-600" style={{ WebkitMaskImage: 'none', maskImage: 'none' }}>
                {block.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onFocus && (
              <button
                type="button"
                onClick={() => onFocus(block)}
                className="rounded border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
              >
                Focus Map
              </button>
            )}
            {onShowRevisions && (
              <button
                type="button"
                onClick={() => onShowRevisions(block)}
                className="rounded border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
              >
                Revisions
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(block)}
                className="rounded bg-primary-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Area</dt>
            <dd className="mt-1 text-gray-900">
              {measurementSystem === 'Imperial'
                ? `${formatNumber(areaAcres)} acres`
                : `${formatNumber(areaHectares)} hectares`}
            </dd>
          </div>
          {block.variety && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Variety</dt>
              <dd className="mt-1 text-gray-900">{block.variety}</dd>
            </div>
          )}
          {block.plantingYear && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Planting Year</dt>
              <dd className="mt-1 text-gray-900">{block.plantingYear}</dd>
            </div>
          )}
          {block.rowSpacing !== undefined && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Row Spacing</dt>
              <dd className="mt-1 text-gray-900">{formatNumber(block.rowSpacing, 2)} m</dd>
            </div>
          )}
          {block.vineSpacing !== undefined && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Vine Spacing</dt>
              <dd className="mt-1 text-gray-900">{formatNumber(block.vineSpacing, 2)} m</dd>
            </div>
          )}
          {block.updatedAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Updated</dt>
              <dd className="mt-1 text-gray-900">{formatDate(block.updatedAt)}</dd>
            </div>
          )}
          {block.updatedByName && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Updated By</dt>
              <dd className="mt-1 text-gray-900">{block.updatedByName}</dd>
            </div>
          )}
          {block.createdAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Created</dt>
              <dd className="mt-1 text-gray-900">{formatDate(block.createdAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      {groupedFields.length > 0 && (
        <div className="space-y-4">
          {groupedFields.map(([groupName, fields]) => (
            <div key={groupName} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900">{groupName}</h4>
              <dl className="mt-3 space-y-2 text-sm">
                {fields.map((field) => (
                  <div key={field.machineName} className="flex flex-col gap-1">
                    <dt className="text-xs uppercase tracking-wide text-gray-400">{field.label}</dt>
                    <dd className="text-gray-900">{renderFieldValue(field)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      {block.revisionMessage && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          <p className="font-medium">Last Change</p>
          <p className="mt-1 text-sm">{block.revisionMessage}</p>
        </div>
      )}
    </div>
  )
}

