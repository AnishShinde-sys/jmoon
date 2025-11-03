"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  ChartBarIcon,
  CubeIcon,
  ArrowsPointingInIcon,
  FolderIcon,
  Squares2X2Icon,
  SquaresPlusIcon,
} from '@heroicons/react/24/outline'

import { useUI } from '@/context/UIContext'
import { useAuth } from '@/context/AuthContext'
import Drawer from '../ui/Drawer'
import apiClient from '@/lib/apiClient'
import PluginModal from './PluginModal'
import PluginLibraryModal from './PluginLibraryModal'
import type { PluginDefinition } from '@/types/plugin'

const DRAWER_NAME = 'plugins'
const DRAWER_NAME_BLOCKS = 'blockPlugins'

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  ChartBarIcon,
  CubeIcon,
  ArrowsPointingInIcon,
  FolderIcon,
  Squares2X2Icon,
  SquaresPlusIcon,
}

interface PluginsDrawerProps {
  farmId: string
  farmOwnerId?: string
  initialEnabled?: string[]
  onPluginsChange?: (pluginIds: string[]) => void
}

export default function PluginsDrawer({ farmId, farmOwnerId, initialEnabled, onPluginsChange }: PluginsDrawerProps) {
  const { drawers, closeDrawer, showAlert } = useUI()
  const { user } = useAuth()

  const [plugins, setPlugins] = useState<PluginDefinition[]>([])
  const [enabledPluginIds, setEnabledPluginIds] = useState<string[]>(initialEnabled ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<PluginDefinition | null>(null)
  const [pluginUrl, setPluginUrl] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const hasLoadedOnceRef = useRef(false)
  const onPluginsChangeRef = useRef(onPluginsChange)

  const isDrawerOpen = Boolean(drawers[DRAWER_NAME] || drawers[DRAWER_NAME_BLOCKS])
  const canManage = Boolean(user && farmOwnerId && user.id === farmOwnerId)

  useEffect(() => {
    if (initialEnabled) {
      setEnabledPluginIds(initialEnabled)
    }
  }, [initialEnabled])

  useEffect(() => {
    onPluginsChangeRef.current = onPluginsChange
  }, [onPluginsChange])

  const fetchPlugins = useCallback(async () => {
    if (!farmId) return
    setLoading(true)
    setError(null)

    try {
      const [directoryRes, stateRes] = await Promise.all([
        apiClient.get<PluginDefinition[]>('/api/plugins'),
        apiClient.get<{ enabled: string[] }>(`/api/farms/${farmId}/plugins`),
      ])

      const directory = directoryRes.data || []
      const enabled = stateRes.data?.enabled || []

      setPlugins(directory)
      setEnabledPluginIds(enabled)
      hasLoadedOnceRef.current = true
      onPluginsChangeRef.current?.(enabled)
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to load plugins'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [farmId])

  useEffect(() => {
    if (isDrawerOpen) {
      fetchPlugins()
    }
  }, [isDrawerOpen, fetchPlugins])

  const enabledSet = useMemo(() => new Set(enabledPluginIds), [enabledPluginIds])
  const sortedPlugins = useMemo(
    () => [...plugins].sort((a, b) => a.name.localeCompare(b.name)),
    [plugins]
  )

  const buildPluginUrl = useCallback(
    (plugin: PluginDefinition) => {
      let base = plugin.url
      if (plugin.appendFarmId) {
        base = `${base.replace(/\/$/, '')}/${farmId}`
      }

      const params = new URLSearchParams()
      if (plugin.authRequired && user?.email) {
        params.set('email', user.email)
      }

      const query = params.toString()
      if (query.length > 0) {
        base += base.includes('?') ? `&${query}` : `?${query}`
      }

      return base
    },
    [farmId, user?.email]
  )

  const handleLaunchPlugin = useCallback(
    (plugin: PluginDefinition) => {
      const url = buildPluginUrl(plugin)
      setSelectedPlugin(plugin)
      setPluginUrl(url)
    },
    [buildPluginUrl]
  )

  const handleToggle = useCallback(
    async (plugin: PluginDefinition, shouldEnable: boolean) => {
      if (!farmId) return

      setTogglingId(plugin.id)
      try {
        const response = await apiClient.post<{ enabled: string[] }>(
          `/api/farms/${farmId}/plugins/${plugin.id}`,
          {
            enabled: shouldEnable,
          }
        )

        const nextEnabled = response.data?.enabled || []
        setEnabledPluginIds(nextEnabled)
        onPluginsChangeRef.current?.(nextEnabled)
        showAlert(
          shouldEnable
            ? `${plugin.name} activated for this farm.`
            : `${plugin.name} deactivated.`,
          'success'
        )
      } catch (err: any) {
        const message = err?.response?.data?.message || 'Failed to update plugin state'
        showAlert(message, 'error')
      } finally {
        setTogglingId(null)
      }
    },
    [farmId, showAlert]
  )

  const handleCloseDrawer = useCallback(() => {
    if (drawers[DRAWER_NAME]) closeDrawer(DRAWER_NAME)
    if (drawers[DRAWER_NAME_BLOCKS]) closeDrawer(DRAWER_NAME_BLOCKS)
    setLibraryOpen(false)
    setSelectedPlugin(null)
    setPluginUrl(null)
  }, [closeDrawer, drawers])

  return (
    <>
      <Drawer
        isOpen={isDrawerOpen}
        title="Plugins"
        onClose={handleCloseDrawer}
        position="left"
        showBackdrop={false}
      >
        <div className="space-y-4">
          {canManage && (
            <div className="flex items-center justify-between rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-gray-700">Manage farm plugins</p>
                <p className="text-xs text-gray-500">Activate partner integrations from the plugin library.</p>
              </div>
              <button
                onClick={() => setLibraryOpen(true)}
                className="btn btn-secondary btn-sm whitespace-nowrap"
              >
                Open Library
              </button>
            </div>
          )}

          {!hasLoadedOnceRef.current && loading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-gray-500">
              <div className="spinner" />
              Loading plugins…
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="relative space-y-3">
              {loading && hasLoadedOnceRef.current && (
                <div className="absolute inset-0 z-[1] flex items-center justify-center rounded-md bg-white/70">
                  <div className="spinner" />
                </div>
              )}
              {sortedPlugins.map((plugin) => {
                const IconComponent = plugin.icon && iconMap[plugin.icon] ? iconMap[plugin.icon] : ChartBarIcon
                const isEnabled = enabledSet.has(plugin.id)

                return (
                  <div
                    key={plugin.id}
                    className="rounded-md border border-gray-200 p-3 transition hover:border-primary-200 hover:bg-primary-50/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-1 items-start gap-3">
                        <IconComponent className="mt-0.5 h-5 w-5 text-primary-600" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{plugin.name}</p>
                            {isEnabled && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{plugin.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleLaunchPlugin(plugin)}
                        className="btn btn-primary btn-sm"
                      >
                        Launch
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Drawer>

      {libraryOpen && canManage && (
        <PluginLibraryModal
          plugins={sortedPlugins}
          enabled={enabledSet}
          onClose={() => setLibraryOpen(false)}
          onToggle={handleToggle}
          togglingId={togglingId}
        />
      )}

      {selectedPlugin && pluginUrl && (
        <PluginModal
          plugin={selectedPlugin}
          url={pluginUrl}
          onClose={() => {
            setSelectedPlugin(null)
            setPluginUrl(null)
          }}
        />
      )}
    </>
  )
}

