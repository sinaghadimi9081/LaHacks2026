import { useMemo, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import { useAuth } from '../../Auth/useAuth.jsx'
import { foodItems } from '../Inventory/inventoryData.js'
import MarketplaceCart from './components/MarketplaceCart.jsx'
import MarketplaceDragLayer from './components/MarketplaceDragLayer.jsx'
import MarketplacePostCard from './components/MarketplacePostCard.jsx'
import SharePostModal from './components/SharePostModal.jsx'

const feedFilters = ['all', 'available', 'claimed']

const initialSharePosts = [
  {
    id: 1,
    food_item: foodItems[1],
    title: 'Soup night carrots',
    description:
      'Still crisp and sweet. Great for roasting, soup, or a quick slaw.',
    pickup_location: 'Maple Court community fridge',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-25',
  },
  {
    id: 2,
    food_item: foodItems[2],
    title: 'Extra basil bouquet',
    description:
      'Washed, bundled, and ready for pesto. Please pick up this evening.',
    pickup_location: 'Oak Street porch cooler',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-24',
  },
  {
    id: 3,
    food_item: foodItems[5],
    title: 'Cherry tomatoes for tonight',
    description:
      'Best used today. Perfect for pasta sauce, salsa, or a sheet pan.',
    pickup_location: 'Cedar Ave lobby shelf',
    status: 'claimed',
    claimed_by: 'Maya Chen',
    created_at: '2026-04-23',
  },
  {
    id: 4,
    food_item: foodItems[0],
    title: 'Apple snack pack',
    description:
      'A few extra apples from a big grocery run. Firm, sweet, and easy to grab after work.',
    pickup_location: 'Pine Street front desk',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-25',
  },
  {
    id: 5,
    food_item: foodItems[3],
    title: 'Yogurt for sauces',
    description:
      'Unopened tub, kept cold. Great for marinades, breakfast bowls, or a quick dip.',
    pickup_location: 'Shared fridge B',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-24',
  },
  {
    id: 6,
    food_item: foodItems[4],
    title: 'Starter needs a baker',
    description:
      'Active sourdough starter in a clean jar. Bring your own container if you want to split it.',
    pickup_location: 'Juniper Ave porch cooler',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-22',
  },
  {
    id: 7,
    food_item: {
      ...foodItems[1],
      name: 'Baby carrots',
      quantity: '12 oz bag',
      recipe_uses: ['lunch sides', 'hummus', 'stir fry'],
      image:
        'https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?auto=format&fit=crop&w=800&q=80',
    },
    title: 'Lunchbox carrots',
    description:
      'Clean sealed bag. Easy pickup for anyone packing lunches this week.',
    pickup_location: 'Maple Court bike room',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-21',
  },
  {
    id: 8,
    food_item: {
      ...foodItems[2],
      name: 'Cilantro bunch',
      quantity: '1 bunch',
      recipe_uses: ['tacos', 'rice bowls', 'chutney'],
      image:
        'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&w=800&q=80',
    },
    title: 'Fresh cilantro bundle',
    description:
      'Still fragrant and perky. Best for dinner tonight or tomorrow morning.',
    pickup_location: 'Cedar Ave lobby shelf',
    status: 'claimed',
    claimed_by: 'Leo Park',
    created_at: '2026-04-21',
  },
  {
    id: 9,
    food_item: {
      ...foodItems[0],
      name: 'Navel oranges',
      quantity: '6 oranges',
      recipe_uses: ['snacks', 'juice', 'salads'],
      image:
        'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=800&q=80',
    },
    title: 'Citrus for sharing',
    description:
      'Bright, juicy oranges. We bought too many and would rather share than waste them.',
    pickup_location: 'Oak Street porch cooler',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-20',
  },
  {
    id: 10,
    food_item: {
      ...foodItems[3],
      name: 'Mozzarella pearls',
      quantity: '8 oz cup',
      recipe_uses: ['salads', 'pizza', 'snack plates'],
      image:
        'https://images.unsplash.com/photo-1627935722051-395636b0d8a5?auto=format&fit=crop&w=800&q=80',
    },
    title: 'Mozzarella before trip',
    description:
      'Leaving tomorrow and cannot finish this sealed cup. Kept refrigerated.',
    pickup_location: 'Shared fridge A',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-19',
  },
  {
    id: 11,
    food_item: {
      ...foodItems[5],
      name: 'Roma tomatoes',
      quantity: '5 tomatoes',
      recipe_uses: ['sauce', 'sandwiches', 'salsa'],
      image:
        'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?auto=format&fit=crop&w=800&q=80',
    },
    title: 'Roma tomatoes today',
    description:
      'Ripe and ready. Please plan to use these soon after pickup.',
    pickup_location: 'Pine Street front desk',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-18',
  },
  {
    id: 12,
    food_item: {
      ...foodItems[4],
      name: 'Pizza dough',
      quantity: '2 dough balls',
      recipe_uses: ['pizza', 'flatbread', 'garlic knots'],
      image:
        'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?auto=format&fit=crop&w=800&q=80',
    },
    title: 'Pizza dough pickup',
    description:
      'Thawed dough balls in the fridge. Great for a quick dinner tonight.',
    pickup_location: 'Juniper Ave porch cooler',
    status: 'claimed',
    claimed_by: 'Nora Ali',
    created_at: '2026-04-18',
  },
]

const blankForm = {
  foodItemName: foodItems[0].name,
  title: '',
  description: '',
  pickup_location: '',
}

function getTodayStamp() {
  return new Date().toISOString().slice(0, 10)
}

export default function Marketplace() {
  const { user } = useAuth()
  const [sharePosts, setSharePosts] = useState(initialSharePosts)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [form, setForm] = useState(blankForm)
  const [verificationImage, setVerificationImage] = useState('')
  const [cartPostIds, setCartPostIds] = useState([])
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  const selectedInventoryItem = useMemo(
    () =>
      foodItems.find((item) => item.name === form.foodItemName) || foodItems[0],
    [form.foodItemName],
  )

  const reverifiedFoodItem = useMemo(
    () => ({
      ...selectedInventoryItem,
      image: verificationImage || selectedInventoryItem.image,
    }),
    [selectedInventoryItem, verificationImage],
  )

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredPosts = useMemo(
    () => {
      const matchingPosts = sharePosts.filter((post) => {
        const searchableText = [
          post.title,
          post.description,
          post.pickup_location,
          post.status,
          post.claimed_by,
          post.food_item.name,
          post.food_item.quantity,
          post.food_item.status,
          ...(post.food_item.recipe_uses || []),
        ]
          .join(' ')
          .toLowerCase()

        const matchesSearch =
          normalizedSearch.length === 0 ||
          searchableText.includes(normalizedSearch)
        const matchesFilter =
          activeFilter === 'all' || post.status === activeFilter

        return matchesSearch && matchesFilter
      })

      return [...matchingPosts].sort((firstPost, secondPost) => {
        if (firstPost.status === secondPost.status) {
          return 0
        }

        return firstPost.status === 'claimed' ? 1 : -1
      })
    },
    [activeFilter, normalizedSearch, sharePosts],
  )

  const availableCount = sharePosts.filter(
    (post) => post.status === 'available',
  ).length
  const claimedCount = sharePosts.length - availableCount
  const cartPosts = cartPostIds
    .map((postId) => sharePosts.find((post) => post.id === postId))
    .filter(Boolean)

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0]

    if (!file) {
      setVerificationImage('')
      return
    }

    setVerificationImage(URL.createObjectURL(file))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const newPost = {
      id: Date.now(),
      food_item: reverifiedFoodItem,
      title: form.title.trim(),
      description: form.description.trim(),
      pickup_location: form.pickup_location.trim(),
      status: 'available',
      claimed_by: '',
      created_at: getTodayStamp(),
    }

    setSharePosts((currentPosts) => [newPost, ...currentPosts])
    setForm(blankForm)
    setVerificationImage('')
    setIsShareModalOpen(false)
    event.currentTarget.reset()
  }

  function addPostToCart(postId, insertIndex = cartPostIds.length) {
    const post = sharePosts.find((currentPost) => currentPost.id === postId)

    if (!post || post.status === 'claimed') {
      return
    }

    setCartPostIds((currentIds) => {
      const currentIndex = currentIds.indexOf(postId)
      const nextIds = currentIds.filter((currentId) => currentId !== postId)
      const adjustedIndex =
        currentIndex !== -1 && currentIndex < insertIndex
          ? insertIndex - 1
          : insertIndex
      const boundedIndex = Math.max(0, Math.min(adjustedIndex, nextIds.length))

      nextIds.splice(boundedIndex, 0, postId)
      return nextIds
    })
  }

  function removePostFromCart(postId) {
    setCartPostIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== postId),
    )
  }

  function claimCart() {
    const claimedBy =
      user?.display_name || user?.username || user?.email || 'You'
    const cartIdSet = new Set(cartPostIds)

    setSharePosts((currentPosts) =>
      currentPosts.map((post) =>
        cartIdSet.has(post.id)
          ? { ...post, status: 'claimed', claimed_by: claimedBy }
          : post,
      ),
    )
    setCartPostIds([])
  }

  function claimPost(postId) {
    const claimedBy =
      user?.display_name || user?.username || user?.email || 'You'

    setSharePosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? { ...post, status: 'claimed', claimed_by: claimedBy }
          : post,
      ),
    )
    removePostFromCart(postId)
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <main className="min-h-screen overflow-hidden text-ink">
        <MarketplaceDragLayer />
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
              neighborhood feed
            </p>
            <h1 className="max-w-3xl text-6xl font-black uppercase leading-[0.85] md:text-8xl">
              Share shelf
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-ink/75">
              Post extra food from your pantry, reverify it with a fresh photo,
              and let nearby neighbors request a meetup for what they can use.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="metric-card bg-phthalo text-white">
              <span>Posts</span>
              <strong>{sharePosts.length}</strong>
            </div>
            <div className="metric-card bg-citrus text-ink">
              <span>Open</span>
              <strong>{availableCount}</strong>
            </div>
            <div className="metric-card bg-white text-ink">
              <span>Requested</span>
              <strong>{claimedCount}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-8 md:px-10">
        <div className="pantry-card grid gap-4 xl:mr-96 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
          <label className="block">
            <span className="pantry-field-label">Search marketplace</span>
            <input
              className="pantry-input"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search items, locations, claims, descriptions..."
              type="search"
              value={searchTerm}
            />
          </label>

          <div>
            <p className="pantry-field-label">Filter posts</p>
            <div className="flex flex-wrap gap-2">
              {feedFilters.map((filter) => (
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

          <button
            className="pantry-button h-fit"
            onClick={() => setIsShareModalOpen(true)}
            type="button"
          >
            Share item
          </button>

          <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/55 lg:col-span-3">
            Showing {filteredPosts.length} of {sharePosts.length}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 md:px-10 xl:pr-96">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post, index) => (
            <MarketplacePostCard
              index={index}
              isInCart={cartPostIds.includes(post.id)}
              key={post.id}
              onAddToCart={addPostToCart}
              onClaimPost={claimPost}
              post={post}
            />
          ))}

          {filteredPosts.length === 0 && (
            <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-3">
              No share posts match this search.
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pb-8 md:px-10 xl:fixed xl:right-6 xl:top-24 xl:z-30 xl:w-80 xl:p-0">
        <MarketplaceCart
          cartPosts={cartPosts}
          onAddPost={addPostToCart}
          onClaimCart={claimCart}
          onRemovePost={removePostFromCart}
        />
      </div>

      {isShareModalOpen && (
        <SharePostModal
          foodItems={foodItems}
          form={form}
          onClose={() => setIsShareModalOpen(false)}
          onImageUpload={handleImageUpload}
          onSubmit={handleSubmit}
          onUpdateForm={updateForm}
          reverifiedFoodItem={reverifiedFoodItem}
          selectedInventoryItem={selectedInventoryItem}
        />
      )}
      </main>
    </DndProvider>
  )
}
