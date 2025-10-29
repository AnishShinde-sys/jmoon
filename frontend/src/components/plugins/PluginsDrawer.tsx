import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useUI } from '@/context/UIContext'
import Drawer from '../ui/Drawer'
import { 
  ChartBarIcon, 
  CubeIcon, 
  ArrowsPointingInIcon,
  FolderIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline'

const DRAWER_NAME = 'plugins'
const DRAWER_NAME_BLOCKS = 'blockPlugins'

interface Plugin {
  id: string
  name: string
  description: string
  url: string
  icon: any
}

export default function PluginsDrawer() {
  const { farmId } = useParams<{ farmId: string }>()
  const { drawers, closeDrawer } = useUI()
  const [isPluginModalOpen, setIsPluginModalOpen] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)

  const plugins: Plugin[] = [
    {
      id: 'raster-analysis',
      name: 'Raster Analysis',
      description: 'Extract data from raster datasets',
      url: 'https://rasters.efficientvineyard.com',
      icon: ChartBarIcon
    },
    {
      id: 'interpolator',
      name: 'Interpolator',
      description: 'Smooth your data using interpolation',
      url: 'https://interpolator.efficientvineyard.com',
      icon: ArrowsPointingInIcon
    },
    {
      id: 'grid-generator',
      name: 'Grid Generator',
      description: 'Create grids and random points',
      url: 'https://grids.efficientvineyard.com',
      icon: CubeIcon
    },
    {
      id: 'translator',
      name: 'Translator',
      description: 'Translate a dataset with sample points',
      url: 'https://translator.efficientvineyard.com',
      icon: CubeIcon
    },
    {
      id: 'data-joiner',
      name: 'Data Joiner',
      description: 'Join several datasets together',
      url: 'https://joiner.efficientvineyard.com',
      icon: FolderIcon
    },
    {
      id: 'multivariate',
      name: 'Multivariate Zoning',
      description: 'Create zones with many variables',
      url: 'https://multivariate.efficientvineyard.com',
      icon: Squares2X2Icon
    }
  ]

  const handleLaunchPlugin = (plugin: Plugin) => {
    setSelectedPlugin(plugin)
    setIsPluginModalOpen(true)
  }

  const drawerName = drawers[ drawers[DRAWER_NAME] ? DRAWER_NAME : DRAWER_NAME_BLOCKS] 
    ? DRAWER_NAME 
    : DRAWER_NAME_BLOCKS

  return (
    <>
      <Drawer 
        isOpen={(drawers[DRAWER_NAME] || drawers[DRAWER_NAME_BLOCKS]) || false} 
        title="Plugins" 
        onClose={() => {
          if (drawers[DRAWER_NAME]) closeDrawer(DRAWER_NAME)
          if (drawers[DRAWER_NAME_BLOCKS]) closeDrawer(DRAWER_NAME_BLOCKS)
        }} 
        position="left"
        showBackdrop={false}
      >
        <div className="space-y-2">
          {plugins.map((plugin) => {
            const Icon = plugin.icon
            return (
              <div
                key={plugin.id}
                onClick={() => handleLaunchPlugin(plugin)}
                className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-gray-900">{plugin.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{plugin.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Drawer>

      {/* Plugin Modal */}
      {isPluginModalOpen && selectedPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">{selectedPlugin.name}</h3>
              <iframe
                src={selectedPlugin.url}
                className="w-full h-[600px] border border-gray-200 rounded"
                title={selectedPlugin.name}
              />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setIsPluginModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

