import FoodItem from './component/FoodItem'

const foodItems = [
  {
    name: 'Honeycrisp apples',
    quantity: '8 apples',
    expiration_date: '2026-05-02',
    estimated_price: 6.75,
    status: 'fresh',
    owner_name: 'Anthony',
    created_at: '2026-04-25',
    image:
      'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Rainbow carrots',
    quantity: '1 bunch',
    expiration_date: '2026-04-29',
    estimated_price: 4.25,
    status: 'use soon',
    owner_name: 'Maya',
    created_at: '2026-04-24',
    image:
      'https://images.unsplash.com/photo-1447175008436-054170c2e979?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Basil bouquet',
    quantity: '2 cups',
    expiration_date: '2026-04-27',
    estimated_price: 3.5,
    status: 'use soon',
    owner_name: 'Shared Shelf',
    created_at: '2026-04-23',
    image:
      'https://images.unsplash.com/photo-1618375569909-3c8616cf7733?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Greek yogurt',
    quantity: '32 oz tub',
    expiration_date: '2026-05-06',
    estimated_price: 5.99,
    status: 'fresh',
    owner_name: 'Leo',
    created_at: '2026-04-22',
    image:
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Sourdough starter',
    quantity: '1 jar',
    expiration_date: '2026-04-26',
    estimated_price: 2.0,
    status: 'feed today',
    owner_name: 'Anthony',
    created_at: '2026-04-20',
    image:
      'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Cherry tomatoes',
    quantity: '1 pint',
    expiration_date: '2026-04-25',
    estimated_price: 4.75,
    status: 'critical',
    owner_name: 'Shared Shelf',
    created_at: '2026-04-21',
    image:
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
  },
]

function App() {
  const totalValue = foodItems.reduce(
    (sum, item) => sum + item.estimated_price,
    0,
  )
  const soonCount = foodItems.filter((item) => item.status !== 'fresh').length

  return (
    <main className="min-h-screen overflow-hidden bg-cream text-ink">
      <section className="relative border-b-4 border-ink bg-petal px-5 py-8 md:px-10">
        <div className="sticker sticker-star left-[6%] top-7 bg-moonstone" />
        <div className="sticker sticker-circle right-[9%] top-12 bg-tomato" />
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="mb-4 w-fit rounded-full border-2 border-ink bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sticker">
              shared kitchen inventory
            </p>
            <h1 className="max-w-3xl text-6xl font-black uppercase leading-[0.85] md:text-8xl">
              Pantry pop
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-ink/75">
              A bright ingredient board for tracking what is fresh, what needs
              attention, and who claimed the last heroic jar of basil.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="metric-card bg-phthalo text-white">
              <span>Items</span>
              <strong>{foodItems.length}</strong>
            </div>
            <div className="metric-card bg-mustard text-white">
              <span>Watch list</span>
              <strong>{soonCount}</strong>
            </div>
            <div className="metric-card bg-white text-ink">
              <span>Value</span>
              <strong>${totalValue.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-8 md:grid-cols-2 md:px-10 xl:grid-cols-3">
        {foodItems.map((item, index) => (
          <FoodItem
            index={index}
            item={item}
            key={`${item.name}-${item.created_at}`}
          />
        ))}
      </section>
    </main>
  )
}

export default App
