"use client"

import { useState, useEffect } from 'react'
import { useBlocks } from '../../hooks/useBlocks'
import { useMap } from '../../hooks/useMap'
import { Block } from '../../types/block'
import Spinner from '../ui/Spinner'
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'

interface BlockListProps {
  farmId: string
  onCreateClick?: () => void
  onBlockSelect?: (block: Block) => void
}

export default function BlockList({ farmId, onCreateClick, onBlockSelect }: BlockListProps) {
  const { blocks, blocksGeoJSON, loading, error, deleteBlock } = useBlocks(farmId)
  const { addGeoJSONSource, addLayer, fitBounds } = useMap()
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Visualize blocks on map when loaded
  useEffect(() => {
    if (!blocksGeoJSON || !blocksGeoJSON.features || blocksGeoJSON.features.length === 0) return

    const sourceId = 'blocks-source'
    const layerId = 'blocks-layer'

    // Add source and layer
    addGeoJSONSource(sourceId, blocksGeoJSON)
    addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'id'], selectedBlockId || ''],
          '#3b82f6', // Selected color (blue)
          '#10b981', // Default color (green)
        ],
        'fill-opacity': 0.3,
      },
    })

    // Add outline
    addLayer({
      id: `${layerId}-outline`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#ffffff',
        'line-width': 2,
      },
    })

    // Fit map to blocks
    fitBounds(blocksGeoJSON)
  }, [blocksGeoJSON, selectedBlockId, addGeoJSONSource, addLayer, fitBounds])

  const handleBlockClick = (block: Block) => {
    setSelectedBlockId(block.id)
    if (onBlockSelect) {
      onBlockSelect(block)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await deleteBlock(blockId)
      setDeleteConfirm(null)
      setSelectedBlockId(null)
    } catch (error) {
      console.error('Failed to delete block:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Blocks ({blocks.length})
          </h3>
          <p className="text-sm text-gray-600">
            Total area: {(blocks.reduce((sum, b) => sum + (b.area || 0), 0) / 10000).toFixed(2)} ha
          </p>
        </div>
        {onCreateClick && (
          <button
            onClick={onCreateClick}
            className="btn btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Block
          </button>
        )}
      </div>

      {/* Block list */}
      {blocks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No blocks yet</p>
          {onCreateClick && (
            <Button
              onClick={onCreateClick}
            >
              Create your first block
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.map((block) => {
            const isSelected = selectedBlockId === block.id

            return (
              <Card
                key={block.id}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                }`}
                onClick={() => handleBlockClick(block)}
              >
                <CardContent className="flex items-start justify-between pt-6">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{block.name}</h4>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      {block.variety && (
                        <p>Variety: {block.variety}</p>
                      )}
                      {block.plantingYear && (
                        <p>Planted: {block.plantingYear}</p>
                      )}
                      <p>Area: {(block.area / 10000).toFixed(2)} ha</p>
                      {block.rowSpacing && block.vineSpacing && (
                        <p>
                          Spacing: {block.rowSpacing}m × {block.vineSpacing}m
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isSelected && (
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          // TODO: Open edit modal
                        }}
                        variant="ghost"
                        size="icon"
                        className="p-2 text-blue-600 hover:bg-blue-50"
                        title="Edit block"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm(block.id)
                        }}
                        variant="ghost"
                        size="icon"
                        className="p-2 text-red-600 hover:bg-red-50"
                        title="Delete block"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Block?
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this block? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <Button
                onClick={() => setDeleteConfirm(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDeleteBlock(deleteConfirm)}
                variant="destructive"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
