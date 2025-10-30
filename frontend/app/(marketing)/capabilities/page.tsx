import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Budbase · Spatial Data Workflow',
  description:
    'Learn how Budbase streamlines vineyard data collection, cleanup, interpolation, and translation into actionable insights.',
}

const sections = [
  {
    title: 'Import Spatial Data',
    content: [
      'Hit the vineyard with your favorite soil or NDVI sensor and GPS receiver to collect high-density data sets. Budbase keeps it simple by importing any spatial data with a latitude and longitude coordinate. Raster images can also be converted to point data using the Raster conversion plug-in.',
      'No sensor…no problem. Use the customizable Budbase Data Collector and your smartphone to map your own vineyard observations.',
    ],
  },
  {
    title: 'Easily Clean and Trim Data',
    content: [
      'Avoid the “garbage in garbage out” scenario of data analysis by easily cleaning up spatial data. Budbase allows you to view data cleanup with simple slide filters so you keep the data you want and send the rest to the trash. Then clip your cleaned data to the vineyard block boundaries you created when you built your farm.',
    ],
  },
  {
    title: 'Interpolate Data to a Common Grid',
    content: [
      'The power of using multiple vineyard layers to make a better management decision starts here. Data collected in the vineyard comes from different sources, densities, and geo-locations, making it difficult to compare information between layers. The Budbase Interpolator plug-in solves that challenge by processing all your data to a common vineyard grid.',
      'Use the Data Joiner plug-in to link all of your interpolated datasets. Then just click on any grid point to display all of the information associated with that vineyard location.',
    ],
  },
  {
    title: 'Translate Data to Viticulture Information',
    content: [
      'Make sense of your sensor data by translating it with viticulture field measurements. Save time and effort by letting Budbase analyze the spatial data pattern and tell you where to go for field validation. Then send the measurement locations to your smartphone and share with your field team to make quick work of field scouting. Finally, compare your high-density data set with the directed field measurements for easy translation.',
    ],
  },
]

export default function CapabilitiesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16 text-gray-800">
      <header className="space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary-500">Spatial Data Workflow</p>
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
          From Raw Sensor Data to Vineyard Intelligence
        </h1>
        <p className="mx-auto max-w-2xl text-base text-gray-600">
          Budbase brings together sensors, mapping, and field observations into a single platform so farm teams can
          analyze, compare, and act on spatial information with confidence.
        </p>
      </header>

      <div className="space-y-16">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-gray-100 bg-white/80 p-8 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-10">
              <h2 className="md:min-w-[220px] md:max-w-[220px] text-2xl font-semibold text-primary-600">
                {section.title}
              </h2>
              <div className="space-y-4 text-base leading-relaxed text-gray-700">
                {section.content.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

