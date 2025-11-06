"use client"

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BlockFieldDefinition, BlockFieldType } from '@/types/block'

export interface BulkUpdateModalProps {
  open: boolean
  fields: BlockFieldDefinition[]
  onClose: () => void
  onSubmit: (field: BlockFieldDefinition, value: unknown) => Promise<void> | void
  busy?: boolean
}

const PICKABLE_TYPES: BlockFieldType[] = [
  'Text',
  'Number',
  'Select',
  'Date and Time',
  'Formatted Text',
  'Boolean',
  'CV Number',
]

export function BulkUpdateModal({ open, fields, onClose, onSubmit, busy }: BulkUpdateModalProps) {
  const [fieldMachineName, setFieldMachineName] = useState<string>('')
  const [stringValue, setStringValue] = useState<string>('')
  const [selectValue, setSelectValue] = useState<string>('')
  const [booleanValue, setBooleanValue] = useState<boolean>(false)
  const [dateValue, setDateValue] = useState<string>('')

  const pickableFields = useMemo(() => {
    return fields.filter((field) => PICKABLE_TYPES.includes(field.type) && !field.hidden)
  }, [fields])

  const selectedField = useMemo(() => {
    return pickableFields.find((field) => field.machineName === fieldMachineName)
  }, [pickableFields, fieldMachineName])

  const resetForm = () => {
    setFieldMachineName('')
    setStringValue('')
    setSelectValue('')
    setBooleanValue(false)
    setDateValue('')
  }

  const handleClose = () => {
    if (busy) return
    resetForm()
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedField || busy) return

    let value: unknown = stringValue

    switch (selectedField.type) {
      case 'Number':
      case 'CV Number': {
        if (stringValue.trim() === '') {
          value = ''
        } else {
          const parsed = Number(stringValue)
          if (Number.isNaN(parsed)) {
            alert('Enter a valid numeric value.')
            return
          }
          value = parsed
        }
        break
      }
      case 'Select': {
        value = selectValue
        break
      }
      case 'Boolean': {
        value = booleanValue
        break
      }
      case 'Date and Time': {
        if (dateValue) {
          const asDate = new Date(dateValue)
          if (Number.isNaN(asDate.getTime())) {
            alert('Choose a valid date/time.')
            return
          }
          value = asDate
        } else {
          value = ''
        }
        break
      }
      default: {
        value = stringValue
      }
    }

    await onSubmit(selectedField, value)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleClose() : null)}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Bulk Update Blocks</DialogTitle>
            <DialogDescription>
              Apply a new value to a field across all selected blocks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label htmlFor="bulk-field">Field</Label>
            <select
              id="bulk-field"
              className="input"
              value={fieldMachineName}
              onChange={(event) => {
                setFieldMachineName(event.target.value)
                setStringValue('')
                setSelectValue('')
                setBooleanValue(false)
                setDateValue('')
              }}
              required
            >
              <option value="">Select a field…</option>
              {pickableFields.map((field) => (
                <option key={field.machineName} value={field.machineName}>
                  {field.label}
                </option>
              ))}
            </select>
            {selectedField?.suffix && (
              <p className="text-xs text-gray-500">Units: {selectedField.suffix}</p>
            )}
          </div>

          {selectedField && (
            <div className="space-y-3">
              <Label>New Value</Label>
              {selectedField.type === 'Select' && Array.isArray(selectedField.options) ? (
                <select
                  className="input"
                  value={selectValue}
                  onChange={(event) => setSelectValue(event.target.value)}
                  required
                >
                  <option value="">Choose an option…</option>
                  {selectedField.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : selectedField.type === 'Boolean' ? (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="bulk-boolean"
                      value="true"
                      checked={booleanValue === true}
                      onChange={() => setBooleanValue(true)}
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="bulk-boolean"
                      value="false"
                      checked={booleanValue === false}
                      onChange={() => setBooleanValue(false)}
                    />
                    No
                  </label>
                </div>
              ) : selectedField.type === 'Date and Time' ? (
                <Input
                  type={selectedField.includeTime ? 'datetime-local' : 'date'}
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                  required
                />
              ) : (
                <Input
                  type={selectedField.type === 'Number' || selectedField.type === 'CV Number' ? 'number' : 'text'}
                  value={stringValue}
                  onChange={(event) => setStringValue(event.target.value)}
                  step={selectedField.step}
                  min={selectedField.min}
                  max={selectedField.max}
                  required
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedField || busy}>
              {busy ? 'Updating…' : 'Apply Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default BulkUpdateModal


