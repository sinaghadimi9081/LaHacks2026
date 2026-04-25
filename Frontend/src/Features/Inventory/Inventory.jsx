import { useCallback, useMemo, useState } from 'react'

import FoodItem from './components/FoodItem.jsx'
import FoodItemNoImage from './components/FoodItemNoImage.jsx'
import { foodItems, pantryNotes } from './inventoryData.js'

const filterOptions = ['all', 'fresh', 'use soon', 'feed today', 'critical']

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
