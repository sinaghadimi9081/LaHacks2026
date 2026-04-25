import { useCallback, useMemo, useState } from 'react'

import FoodItem from './components/FoodItem.jsx'
import FoodItemNoImage from './components/FoodItemNoImage.jsx'

const filterOptions = ['all', 'fresh', 'use soon', 'feed today', 'critical']

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
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const totalValue = foodItems.reduce(
    (sum, item) => sum + item.estimated_price,
    0,
  )
  const soonCount = foodItems.filter((item) => item.status !== 'fresh').length
  const normalizedSearch = searchTerm.trim().toLowerCase()

  const matchesSearchAndFilter = useCallback(
    (item) => {
      const searchableText = [
        item.name,
        item.quantity,
        item.status,
        item.owner_name,
        ...(item.recipe_uses || []),
        ...(item.notes || []),
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableText.includes(normalizedSearch)
      const matchesFilter =
        activeFilter === 'all' || item.status === activeFilter

      return matchesSearch && matchesFilter
    },
    [activeFilter, normalizedSearch],
  )

  const filteredFoodItems = useMemo(
    () => foodItems.filter(matchesSearchAndFilter),
    [matchesSearchAndFilter],
  )
  const filteredPantryNotes = useMemo(
    () => pantryNotes.filter(matchesSearchAndFilter),
    [matchesSearchAndFilter],
  )
  const visibleCount = filteredFoodItems.length + filteredPantryNotes.length

  return (
    <main className="min-h-screen overflow-hidden text-ink">
      <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
        <div className="plant-trail" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((leaf) => (
            <svg
              className="plant-trail__leaf"
              fill="none"
              key={leaf}
              viewBox="0 0 64 64"
            >
              <path
                d="M32 55C25 42 19 27 33 10c16 9 18 27 5 41"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
              <path
                d="M32 55c1-14 2-25 9-36"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="4"
              />
            </svg>
          ))}
        </div>

        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="mb-4 w-fit rounded-full border border-ink/15 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sticker backdrop-blur">
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

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-8 md:px-10">
        <div className="pantry-card grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="pantry-field-label">Search inventory</span>
            <input
              className="pantry-input"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search names, owners, quantities, ideas..."
              type="search"
              value={searchTerm}
            />
          </label>

          <div>
            <p className="pantry-field-label">Filter status</p>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((filter) => (
                <button
                  className={`pantry-filter-button ${
                    activeFilter === filter ? 'pantry-filter-button--active' : ''
                  }`}
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/55 lg:col-span-2">
            Showing {visibleCount} of {foodItems.length + pantryNotes.length}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:grid-cols-2 md:px-10 lg:grid-cols-3 xl:grid-cols-4">
        {filteredFoodItems.map((item, index) => (
          <FoodItem
            index={index}
            item={item}
            key={`${item.name}-${item.created_at}`}
          />
        ))}
        {filteredFoodItems.length === 0 && (
          <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            No image cards match this search.
          </p>
        )}
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
          {filteredPantryNotes.map((item, index) => (
            <FoodItemNoImage
              index={index}
              item={item}
              key={`${item.name}-${item.expiration_date}`}
            />
          ))}
          {filteredPantryNotes.length === 0 && (
            <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-4">
              No pantry notes match this search.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
