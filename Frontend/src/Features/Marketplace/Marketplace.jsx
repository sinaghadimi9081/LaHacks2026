import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../Auth/useAuth.jsx'
import { foodItems } from '../Inventory/inventoryData.js'
import MarketplaceCart from './components/MarketplaceCart.jsx'
import MarketplaceDragLayer from './components/MarketplaceDragLayer.jsx'
import MarketplacePostCard from './components/MarketplacePostCard.jsx'
import SharePostModal from './components/SharePostModal.jsx'
import MarketplaceFeedMap from './components/MarketplaceFeedMap.jsx'
import {
  getDistanceMiles,
  getLocationErrorMessage,
  requestBrowserLocation,
} from './marketplaceLocation.js'
import './marketplaceMapLab.css'

const feedFilters = ['all', 'available', 'pending', 'claimed']

function getTodayStamp() {
  return new Date().toISOString().slice(0, 10)
}

const blankForm = {
  foodItemName: foodItems[0]?.name || '',
  title: '',
  description: '',
  quantity: 1,
  pickup_location: '',
  pickup_latitude: '',
  pickup_longitude: '',
}

const initialSharePosts = [
  {
    id: 1,
    food_item: foodItems[1],
    title: 'Soup night carrots',
    description: 'Still crisp and sweet. Great for roasting, soup, or a quick slaw.',
    pickup_location: 'Maple Court community fridge',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-25',
  },
  {
    id: 2,
    food_item: foodItems[2],
    title: 'Extra basil bouquet',
    description: 'Washed, bundled, and ready for pesto. Please pick up this evening.',
    pickup_location: 'Oak Street porch cooler',
    status: 'available',
    claimed_by: '',
    created_at: '2026-04-24',
  },
  {
    id: 3,
    food_item: foodItems[5],
    title: 'Cherry tomatoes for tonight',
    description: 'Best used today. Perfect for pasta sauce, salsa, or a sheet pan.',
    pickup_location: 'Cedar Ave lobby shelf',
    status: 'claimed',
    claimed_by: 'Maya Chen',
    created_at: '2026-04-23',
  },
]

function MarketplaceBackground() {
  return <div className="marketplace-background" aria-hidden="true" />
}

export default function Marketplace() {
  const { user } = useAuth()

  const isAuthed = Boolean(user)

  const [sharePosts, setSharePosts] = useState(initialSharePosts)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [form, setForm] = useState(blankForm)

  const [verificationImage, setVerificationImage] = useState('')

  const [cartPostIds, setCartPostIds] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  const [isBasketMoving, setIsBasketMoving] = useState(false)
  const [basketPosition, setBasketPosition] = useState(null)

  const [selectedPostId, setSelectedPostId] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationState, setLocationState] = useState('idle')
  const [locationError, setLocationError] = useState('')
  const [locationMeta, setLocationMeta] = useState({
    accuracy: null,
    latitude: null,
    longitude: null,
    timestamp: null,
  })

  const [isResolvingLocation, setIsResolvingLocation] = useState(false)
  const [locationResolutionError, setLocationResolutionError] = useState('')

  const basketDockRef = useRef(null)
  const basketDragRef = useRef(null)

  const selectedInventoryItem = useMemo(() => {
    return foodItems.find((item) => item.name === form.foodItemName) || foodItems[0]
  }, [form.foodItemName])

  const reverifiedFoodItem = useMemo(() => {
    return {
      ...selectedInventoryItem,
      quantity: form.quantity ? String(form.quantity) : selectedInventoryItem?.quantity,
      image: verificationImage || selectedInventoryItem?.image || '/favicon.svg',
    }
  }, [selectedInventoryItem, verificationImage, form.quantity])

  const selectedPickupPoint = useMemo(() => {
    if (!form.pickup_latitude || !form.pickup_longitude) {
      return null
    }

    return [Number(form.pickup_latitude), Number(form.pickup_longitude)]
  }, [form.pickup_latitude, form.pickup_longitude])

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredPosts = useMemo(() => {
    const matchingPosts = sharePosts.filter((post) => {
      const searchableText = [
        post.title,
        post.description,
        post.pickup_location,
        post.status,
        post.claimed_by,
        post.food_item?.name,
        post.food_item?.quantity,
        ...(post.food_item?.recipe_uses || []),
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        normalizedSearch.length === 0 || searchableText.includes(normalizedSearch)

      const matchesFilter = activeFilter === 'all' || post.status === activeFilter

      return matchesSearch && matchesFilter
    })

    return [...matchingPosts].sort((firstPost, secondPost) => {
      const statusPriority = {
        available: 0,
        pending: 1,
        claimed: 2,
      }

      if (firstPost.status !== secondPost.status) {
        return statusPriority[firstPost.status] - statusPriority[secondPost.status]
      }

      return new Date(secondPost.created_at) - new Date(firstPost.created_at)
    })
  }, [activeFilter, normalizedSearch, sharePosts])

  const selectedPost = useMemo(() => {
    return sharePosts.find((post) => post.id === selectedPostId) || filteredPosts[0] || null
  }, [filteredPosts, selectedPostId, sharePosts])
  const effectiveSelectedPostId = selectedPost?.id ?? null

  useEffect(() => {
    return () => {
      if (verificationImage.startsWith('blob:')) {
        URL.revokeObjectURL(verificationImage)
      }
    }
  }, [verificationImage])

  const availableCount = sharePosts.filter((post) => post.status === 'available').length
  const pendingCount = sharePosts.filter((post) => post.status === 'pending').length
  const claimedCount = sharePosts.filter((post) => post.status === 'claimed').length

  const cartPosts = cartPostIds
    .map((postId) => sharePosts.find((post) => post.id === postId))
    .filter(Boolean)

  function updateForm(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function resetShareForm() {
    if (verificationImage.startsWith('blob:')) {
      URL.revokeObjectURL(verificationImage)
    }

    setForm(blankForm)
    setVerificationImage('')
    setLocationResolutionError('')
    setIsResolvingLocation(false)
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0]

    if (!file) {
      setVerificationImage('')
      return
    }

    if (verificationImage.startsWith('blob:')) {
      URL.revokeObjectURL(verificationImage)
    }

    setVerificationImage(URL.createObjectURL(file))
  }

  function handleSelectMapPoint(point) {
    const [lat, lng] = point

    updateForm('pickup_latitude', lat)
    updateForm('pickup_longitude', lng)
    setLocationResolutionError('')
  }

  async function handleUseCurrentLocationForPost() {
    setIsResolvingLocation(true)
    setLocationResolutionError('')

    try {
      const location = await requestBrowserLocation()

      const latitude = location.latitude
      const longitude = location.longitude

      setUserLocation([latitude, longitude])
      setLocationState('ready')
      setLocationMeta({
        accuracy: location.accuracy ?? null,
        latitude,
        longitude,
        timestamp: Date.now(),
      })

      updateForm('pickup_latitude', latitude)
      updateForm('pickup_longitude', longitude)

      if (!form.pickup_location) {
        updateForm('pickup_location', 'Current location pickup point')
      }
    } catch (error) {
      const message = getLocationErrorMessage(error)
      setLocationError(message)
      setLocationResolutionError(message)
      setLocationState('error')
    } finally {
      setIsResolvingLocation(false)
    }
  }

  function handleResolveTypedAddress() {
    setLocationResolutionError(
      'Address lookup is not connected yet. You can still type the pickup address or click the map.',
    )
  }

  async function requestCurrentLocation() {
    setLocationState('loading')
    setLocationError('')

    try {
      const location = await requestBrowserLocation()

      setUserLocation([location.latitude, location.longitude])
      setLocationMeta({
        accuracy: location.accuracy ?? null,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now(),
      })
      setLocationState('ready')
    } catch (error) {
      setLocationError(getLocationErrorMessage(error))
      setLocationState('error')
    }
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!isAuthed) {
      return
    }

    const newPost = {
      id: Date.now(),
      food_item: reverifiedFoodItem,
      title: form.title.trim(),
      description: form.description.trim(),
      quantity: form.quantity,
      pickup_location: form.pickup_location.trim(),
      pickup_latitude: form.pickup_latitude,
      pickup_longitude: form.pickup_longitude,
      status: 'available',
      claimed_by: '',
      created_at: getTodayStamp(),
      distance_miles:
        userLocation && form.pickup_latitude && form.pickup_longitude
          ? getDistanceMiles(userLocation, [
              Number(form.pickup_latitude),
              Number(form.pickup_longitude),
            ])
          : null,
    }

    setSharePosts((currentPosts) => [newPost, ...currentPosts])
    setSelectedPostId(newPost.id)
    setIsShareModalOpen(false)
    resetShareForm()
    event.currentTarget.reset()
  }

  function addPostToCart(postId, insertIndex = cartPostIds.length) {
    const post = sharePosts.find((currentPost) => currentPost.id === postId)

    if (!post || post.status !== 'available') {
      return
    }

    setCartPostIds((currentIds) => {
      const currentIndex = currentIds.indexOf(postId)
      const nextIds = currentIds.filter((currentId) => currentId !== postId)

      const adjustedIndex =
        currentIndex !== -1 && currentIndex < insertIndex ? insertIndex - 1 : insertIndex

      const boundedIndex = Math.max(0, Math.min(adjustedIndex, nextIds.length))

      nextIds.splice(boundedIndex, 0, postId)
      return nextIds
    })
  }

  function removePostFromCart(postId) {
    setCartPostIds((currentIds) => currentIds.filter((currentId) => currentId !== postId))
  }

  function claimCart() {
    const claimedBy = user?.display_name || user?.username || user?.email || 'You'
    const cartIdSet = new Set(cartPostIds)

    setSharePosts((currentPosts) =>
      currentPosts.map((post) =>
        cartIdSet.has(post.id)
          ? {
              ...post,
              status: 'claimed',
              claimed_by: claimedBy,
            }
          : post,
      ),
    )

    setCartPostIds([])
  }

  function claimPost(postId) {
    const claimedBy = user?.display_name || user?.username || user?.email || 'You'

    setSharePosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              status: 'claimed',
              claimed_by: claimedBy,
            }
          : post,
      ),
    )

    removePostFromCart(postId)
  }

  const moveBasketToPointer = useCallback((clientX, clientY) => {
    const dock = basketDockRef.current
    const dragState = basketDragRef.current

    if (!dock || !dragState) {
      return
    }

    const maxX = Math.max(12, window.innerWidth - dragState.width - 12)
    const maxY = Math.max(12, window.innerHeight - dragState.height - 12)

    const nextX = Math.min(Math.max(12, clientX - dragState.offsetX), maxX)
    const nextY = Math.min(Math.max(12, clientY - dragState.offsetY), maxY)

    setBasketPosition({ x: nextX, y: nextY })
  }, [])

  useEffect(() => {
    if (!isBasketMoving) {
      return undefined
    }

    function handlePointerMove(event) {
      event.preventDefault()
      moveBasketToPointer(event.clientX, event.clientY)
    }

    function handlePointerUp() {
      basketDragRef.current = null
      setIsBasketMoving(false)
      document.body.classList.remove('is-moving-market-basket')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    window.addEventListener('pointercancel', handlePointerUp, { once: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      document.body.classList.remove('is-moving-market-basket')
    }
  }, [isBasketMoving, moveBasketToPointer])

  function startBasketMove(event) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    const dock = basketDockRef.current

    if (!dock) {
      return
    }

    const rect = dock.getBoundingClientRect()

    basketDragRef.current = {
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
    }

    document.body.classList.add('is-moving-market-basket')
    setIsBasketMoving(true)
    moveBasketToPointer(event.clientX, event.clientY)
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <main className="marketplace-page min-h-screen overflow-hidden text-ink">
        <MarketplaceBackground />
        <MarketplaceDragLayer />

        <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="mb-4 w-fit rounded-full border border-ink/15 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sticker backdrop-blur">
                neighborhood feed
              </p>

              <h1 className="max-w-3xl text-6xl font-black uppercase leading-[0.85] md:text-8xl">
                Share shelf
              </h1>

              <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-ink/75">
                Browse live posts from nearby neighbors, request an item, and share food
                before it goes to waste.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
              <div className="metric-card bg-phthalo text-white">
                <span>Posts</span>
                <strong>{sharePosts.length}</strong>
              </div>

              <div className="metric-card bg-citrus text-ink">
                <span>Open</span>
                <strong>{availableCount}</strong>
              </div>

              <div className="metric-card bg-mustard text-white">
                <span>Pending</span>
                <strong>{pendingCount}</strong>
              </div>

              <div className="metric-card bg-white text-ink">
                <span>Matched</span>
                <strong>{claimedCount}</strong>
              </div>
            </div>
          </div>
        </section>

        {!isAuthed ? (
          <section className="mx-auto max-w-5xl px-5 py-10 md:px-10">
            <div className="pantry-card grid gap-4 text-center">
              <p className="pantry-label">Marketplace login required</p>

              <h2 className="text-4xl font-black uppercase leading-none">
                Sign in to browse live posts
              </h2>

              <p className="text-base font-bold leading-8 text-ink/70">
                You need to log in before loading the feed or posting an item.
              </p>

              <div className="flex justify-center gap-3">
                <Link className="pantry-button" to="/login">
                  Login
                </Link>

                <Link className="pantry-button pantry-button--light" to="/signup">
                  Sign up
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:px-10 xl:grid-cols-[1.35fr_0.95fr]">
              <MarketplaceFeedMap
                filteredPosts={filteredPosts}
                isLoadingFeed={false}
                locationError={locationError}
                locationMeta={locationMeta}
                locationState={locationState}
                onRequestCurrentLocation={requestCurrentLocation}
                onSelectPost={setSelectedPostId}
                selectedPost={selectedPost}
                selectedPostId={effectiveSelectedPostId}
                userLocation={userLocation}
              />

              <div className="grid gap-6">
                {selectedPost ? (
                  <article className="pantry-card">
                    <div className="flex items-start justify-between gap-4 border-b border-dashed border-ink/20 pb-4">
                      <div>
                        <p className="pantry-label">Selected listing</p>

                        <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                          {selectedPost.title}
                        </h2>
                      </div>

                      <span className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-black uppercase shadow-sticker">
                        {selectedPost.status}
                      </span>
                    </div>

                    <div className="market-map-selected">
                      <img
                        alt={`${selectedPost.food_item?.name || 'Food'} listing`}
                        className="market-map-selected__image"
                        src={selectedPost.food_item?.image || '/favicon.svg'}
                      />

                      <dl className="receipt-lines">
                        <div>
                          <dt>food</dt>
                          <dd>{selectedPost.food_item?.name || 'Food item'}</dd>
                        </div>

                        <div>
                          <dt>quantity</dt>
                          <dd>{selectedPost.quantity || selectedPost.food_item?.quantity || '1'}</dd>
                        </div>

                        <div>
                          <dt>pickup</dt>
                          <dd>{selectedPost.pickup_location}</dd>
                        </div>

                        <div>
                          <dt>claimed by</dt>
                          <dd>{selectedPost.claimed_by || 'open'}</dd>
                        </div>
                      </dl>
                    </div>

                    <p className="mt-4 text-sm font-bold leading-7 text-ink/75">
                      {selectedPost.description}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        className="pantry-button"
                        disabled={
                          selectedPost.status !== 'available' ||
                          cartPostIds.includes(selectedPost.id)
                        }
                        onClick={() => addPostToCart(selectedPost.id)}
                        type="button"
                      >
                        {cartPostIds.includes(selectedPost.id)
                          ? 'Already in basket'
                          : 'Add to basket'}
                      </button>

                      <button
                        className="pantry-button pantry-button--light"
                        disabled={selectedPost.status !== 'available'}
                        onClick={() => claimPost(selectedPost.id)}
                        type="button"
                      >
                        {selectedPost.status === 'claimed' ? 'Matched' : 'Request now'}
                      </button>
                    </div>
                  </article>
                ) : (
                  <article className="pantry-card">
                    <p className="pantry-label">Selected listing</p>

                    <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                      No live posts yet
                    </h2>

                    <p className="mt-4 text-sm font-bold leading-7 text-ink/75">
                      Create the first marketplace post to populate the map and feed.
                    </p>
                  </article>
                )}
              </div>
            </section>

            <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-4 md:px-10">
              <div className="pantry-card grid gap-4 xl:mr-96 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
                <label className="block">
                  <span className="pantry-field-label">Search marketplace</span>

                  <input
                    className="pantry-input"
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search items, locations, matches, descriptions..."
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
                    isSelected={post.id === effectiveSelectedPostId}
                    key={post.id}
                    onAddToCart={addPostToCart}
                    onClaimPost={claimPost}
                    onSelectPost={setSelectedPostId}
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

            <div
              className={`market-cart-dock ${
                basketPosition ? 'market-cart-dock--moved' : ''
              }`}
              ref={basketDockRef}
              style={
                basketPosition
                  ? {
                      transform: `translate3d(${basketPosition.x}px, ${basketPosition.y}px, 0)`,
                    }
                  : undefined
              }
            >
              <MarketplaceCart
                cartPosts={cartPosts}
                isOpen={isCartOpen}
                onAddPost={addPostToCart}
                onClaimCart={claimCart}
                onMoveStart={startBasketMove}
                onRemovePost={removePostFromCart}
                onToggleOpen={() => setIsCartOpen((currentValue) => !currentValue)}
              />
            </div>

            {isShareModalOpen && (
              <SharePostModal
                currentLocation={userLocation}
                foodItems={foodItems}
                form={form}
                isResolvingLocation={isResolvingLocation}
                isSubmitting={false}
                locationResolutionError={locationResolutionError}
                onClose={() => {
                  setIsShareModalOpen(false)
                  resetShareForm()
                }}
                onImageUpload={handleImageUpload}
                onResolveTypedAddress={handleResolveTypedAddress}
                onSelectMapPoint={handleSelectMapPoint}
                onSubmit={handleSubmit}
                onUpdateForm={updateForm}
                onUseCurrentLocationForPost={handleUseCurrentLocationForPost}
                reverifiedFoodItem={reverifiedFoodItem}
                selectedInventoryItem={selectedInventoryItem}
                selectedPickupPoint={selectedPickupPoint}
              />
            )}
          </>
        )}
      </main>
    </DndProvider>
  )
}
