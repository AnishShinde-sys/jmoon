export interface PluginDefinition {
  id: string
  name: string
  description: string
  url: string
  category?: string
  icon?: string
  appendFarmId?: boolean
  authRequired?: boolean
}

export const pluginsDirectory: PluginDefinition[] = [
  {
    id: 'raster-analysis',
    name: 'Raster Analysis',
    description: 'Extract data from raster datasets and visualize the results.',
    url: 'https://rasters.efficientvineyard.com',
    category: 'Analysis',
    icon: 'ChartBarIcon',
    appendFarmId: true,
  },
  {
    id: 'interpolator',
    name: 'Interpolator',
    description: 'Smooth your data using weighted interpolation.',
    url: 'https://interpolator.efficientvineyard.com',
    category: 'Analysis',
    icon: 'ArrowsPointingInIcon',
    appendFarmId: true,
  },
  {
    id: 'grid-generator',
    name: 'Grid Generator',
    description: 'Create grids and random points to support scouting workflows.',
    url: 'https://grids.efficientvineyard.com',
    category: 'Planning',
    icon: 'CubeIcon',
    appendFarmId: true,
  },
  {
    id: 'translator',
    name: 'Translator',
    description: 'Translate a dataset to match a new sampling grid.',
    url: 'https://translator.efficientvineyard.com',
    category: 'Utilities',
    icon: 'Squares2X2Icon',
    appendFarmId: true,
  },
  {
    id: 'data-joiner',
    name: 'Data Joiner',
    description: 'Join several datasets by location to build richer composites.',
    url: 'https://joiner.efficientvineyard.com',
    category: 'Utilities',
    icon: 'FolderIcon',
    appendFarmId: true,
  },
  {
    id: 'multivariate-zoning',
    name: 'Multivariate Zoning',
    description: 'Create multi-variable management zones for precision farming.',
    url: 'https://multivariate.efficientvineyard.com',
    category: 'Analysis',
    icon: 'SquaresPlusIcon',
    appendFarmId: true,
  },
]

export function findPluginById(pluginId: string): PluginDefinition | undefined {
  return pluginsDirectory.find((plugin) => plugin.id === pluginId)
}

