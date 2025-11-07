declare module '@turf/bbox' {
  import type { Feature, FeatureCollection, Geometry } from 'geojson'

  export default function bbox(
    geojson: Feature<Geometry> | FeatureCollection<Geometry> | Geometry
  ): [number, number, number, number]
}

declare module '@turf/area' {
  import type { Feature, FeatureCollection, Geometry } from 'geojson'

  export default function area(
    geojson: Feature<Geometry> | FeatureCollection<Geometry> | Geometry
  ): number
}

