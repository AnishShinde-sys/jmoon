"use client"

import { useCallback, useEffect, useState } from 'react'
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'

import { useUI } from '@/context/UIContext'
import { useAuth } from '@/context/AuthContext'
import apiClient from '@/lib/apiClient'
import { Collector, CollectorField, CreateCollectorInput } from '@/types/collector'

const DRAWER_NAME = 'createCollector'

interface CreateCollectorModalProps {}

const fieldTypes = [
  { value: 'Text', label: 'Text' },
  { value: 'Number', label: 'Number' },
  { value: 'Select', label: 'Select' },
  { value: 'Date and Time', label: 'Date and Time' },
  { value: 'Image', label: 'Image' },
] as const

const defaultField: Omit<CollectorField, 'machine_name'> = {
  label: '',
  type: 'Text',
  options: [],
  required: false,
}

export default function CreateCollectorModal({}: CreateCollectorModalProps) {
  const { drawers, closeDrawer, showAlert } = useUI()
  const { user } = useAuth()

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [fields, setFields] = useState<CollectorField[]>([])
  const [loading, setLoading] = useState(false)
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null)

  const drawerState = drawers[DRAWER_NAME] as any
  const isOpen = Boolean(drawerState)
  const farmId = drawerState?.farmId
  const isEditMode = Boolean(drawerState?.editMode && drawerState?.collector)

  useEffect(() => {
    if (isOpen && drawerState?.collector && drawerState?.editMode) {
      const collector = drawerState.collector as Collector
      setEditingCollector(collector)
      setFormData({
        name: collector.name,
        description: collector.description || '',
      })
      setFields([...collector.fields])
    } else {
      setEditingCollector(null)
      setFormData({ name: '', description: '' })
      setFields([])
    }
  }, [isOpen, drawerState])

  const generateMachineName = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const addField = () => {
    const newField: CollectorField = {
      ...defaultField,
      machine_name: `field_${Date.now()}`,
    }
    setFields([...fields, newField])
  }

  const updateField = (index: number, updates: Partial<CollectorField>) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], ...updates }

    // Auto-generate machine name when label changes
    if (updates.label !== undefined) {
      updated[index].machine_name = generateMachineName(updates.label) || updated[index].machine_name
    }

    setFields(updated)
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!farmId || !user) return

    if (!formData.name.trim()) {
      showAlert('Collector name is required', 'warning')
      return
    }

    if (fields.length === 0) {
      showAlert('At least one field is required', 'warning')
      return
    }

    setLoading(true)

    try {
      const input: CreateCollectorInput = {
        farmId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        fields: fields.filter((f) => f.label.trim()),
      }

      if (isEditMode && editingCollector) {
        await apiClient.put(`/api/farms/${farmId}/collectors/${editingCollector.id}`, input)
        showAlert('Collector updated successfully', 'success')
      } else {
        await apiClient.post(`/api/farms/${farmId}/collectors`, input)
        showAlert('Collector created successfully', 'success')
      }

      handleClose()
    } catch (error: any) {
      const message = error?.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} collector`
      showAlert(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = useCallback(() => {
    closeDrawer(DRAWER_NAME)
    setFormData({ name: '', description: '' })
    setFields([])
    setEditingCollector(null)
  }, [closeDrawer])

  const updateFieldOptions = (index: number, optionsText: string) => {
    const options = optionsText
      .split('\n')
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0)
    updateField(index, { options })
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditMode ? 'Edit Data Collector' : 'Create Data Collector'}
              </h3>
              <button
                onClick={handleClose}
                className="rounded-md px-3 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    What data are you collecting? (e.g., Broken Posts)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Enter collector name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Provide a description of this data type
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Fields</label>
                    <button
                      type="button"
                      onClick={addField}
                      className="btn btn-secondary btn-sm flex items-center gap-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Field
                    </button>
                  </div>

                  {fields.length === 0 ? (
                    <div className="mt-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                      <p className="text-sm text-gray-500">No fields yet. Add your first field to get started.</p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-4">
                      {fields.map((field, index) => (
                        <div
                          key={`${field.machine_name}-${index}`}
                          className="rounded-md border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600">Label</label>
                                  <input
                                    type="text"
                                    value={field.label}
                                    onChange={(e) => updateField(index, { label: e.target.value })}
                                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    placeholder="Field label"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600">Type</label>
                                  <select
                                    value={field.type}
                                    onChange={(e) =>
                                      updateField(index, { type: e.target.value as CollectorField['type'] })
                                    }
                                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  >
                                    {fieldTypes.map((type) => (
                                      <option key={type.value} value={type.value}>
                                        {type.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {field.type === 'Select' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-600">
                                    Options (one per line)
                                  </label>
                                  <textarea
                                    value={(field.options || []).join('\n')}
                                    onChange={(e) => updateFieldOptions(index, e.target.value)}
                                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    rows={4}
                                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                                  />
                                </div>
                              )}

                              <div className="text-xs text-gray-500">
                                Machine name: <code className="rounded bg-gray-200 px-1">{field.machine_name}</code>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeField(index)}
                              className="rounded-md p-2 text-red-600 transition hover:bg-red-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading
                    ? isEditMode
                      ? 'Updating...'
                      : 'Creating...'
                    : isEditMode
                      ? 'Update Collector'
                      : 'Create Collector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
