import FoodItem from './components/FoodItem.jsx'
import FoodItemNoImage from './components/FoodItemNoImage.jsx'

const foodItems = [
  {
    name: 'Honeycrisp apples',
    quantity: '8 apples',
    expiration_date: '2026-05-02',
    estimated_price: 6.75,
    status: 'fresh',
    owner_name: 'Anthony',
    created_at: '2026-04-25',
    recipe_uses: ['snack plates', 'salads', 'crumble'],
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
    recipe_uses: ['roast trays', 'slaw', 'stock'],
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
    recipe_uses: ['pesto', 'pasta', 'grain bowls'],
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
    recipe_uses: ['marinades', 'breakfast bowls', 'sauces'],
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
    recipe_uses: ['bread', 'pancakes', 'pizza dough'],
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
    recipe_uses: ['salsa', 'pasta', 'sheet pans'],
    image:
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
  },
]

const pantryNotes = [
  {
    name: 'Rolled oats',
    quantity: '3 cups',
    expiration_date: '2026-06-15',
    status: 'fresh',
    owner_name: 'Shared Shelf',
    notes: ['bulk bin refill', 'breakfast jars', 'cookie backup'],
  },
  {
    name: 'Red lentils',
    quantity: '1.5 cups',
    expiration_date: '2026-05-10',
    status: 'use soon',
    owner_name: 'Maya',
    notes: ['soup night', 'pairs with carrots', 'quick protein'],
  },
  {
    name: 'Pizza dough',
    quantity: '2 balls',
    expiration_date: '2026-04-26',
    status: 'feed today',
    owner_name: 'Anthony',
    notes: ['defrost tonight', 'use basil', 'sheet pan dinner'],
  },
  {
    name: 'Lime wedges',
    quantity: '6 wedges',
    expiration_date: '2026-04-25',
    status: 'critical',
    owner_name: 'Leo',
    notes: ['taco topping', 'make dressing', 'juice before bed'],
  },
]

export default function Inventory() {
  const totalValue = foodItems.reduce(
    (sum, item) => sum + item.estimated_price,
    0,
  )
  const soonCount = foodItems.filter((item) => item.status !== 'fresh').length

  return (
    <main className="min-h-screen overflow-hidden bg-cream text-ink">
      <section className="relative border-b-4 border-ink bg-petal px-5 py-8 md:px-10">
        <div className="sticker sticker-circle right-[9%] top-12 bg-tomato" />
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="mb-4 w-fit rounded-full border-2 border-ink bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sticker">
              your inventory
            </p>
            <h1 className="max-w-3xl text-6xl font-black uppercase leading-[0.85] md:text-8xl">
              Pantry pop
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-ink/75">
              A bright ingredient board for tracking what is fresh, what needs
              attention, and what can become dinner later.
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

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:grid-cols-2 md:px-10 lg:grid-cols-3 xl:grid-cols-4">
        {foodItems.map((item, index) => (
          <FoodItem
            index={index}
            item={item}
            key={`${item.name}-${item.created_at}`}
          />
        ))}
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-10 md:px-10">
        <div className="flex items-end justify-between gap-4 border-b-4 border-ink pb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tomato">
              no image cards
            </p>
            <h2 className="text-4xl font-black uppercase leading-none">
              Pantry notes
            </h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pantryNotes.map((item, index) => (
            <FoodItemNoImage
              index={index}
              item={item}
              key={`${item.name}-${item.expiration_date}`}
            />
          ))}
        </div>
      </section>
    </main>
  )
}
