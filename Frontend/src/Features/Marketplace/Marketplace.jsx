import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../Auth/useAuth.jsx'
import { foodItems } from '../Inventory/inventoryData.js'
import MarketplaceCart from './components/MarketplaceCart.jsx'
import MarketplaceDragLayer from './components/MarketplaceDragLayer.jsx'
import MarketplacePostCard from './components/MarketplacePostCard.jsx'
import SharePostModal from './components/SharePostModal.jsx'
import {
  formatDistanceMiles,
  getDistanceMiles,
  getLocationErrorMessage,
  getPostPoint,
  requestBrowserLocation,
} from './marketplaceLocation.js'
import './marketplaceMapLab.css'

const feedFilters = ['all', 'available', 'pending', 'claimed']

const marketplaceBackgroundStickers = [
  { label: 'Fresh', color: 'fresh', shape: 'oval', top: '15rem', left: '6%', rotate: '-10deg' },
  { label: 'Local', color: 'local', shape: 'circle', top: '22rem', left: '74%', rotate: '12deg' },
  { label: 'Ripe', color: 'ripe', shape: 'squircle', top: '33rem', left: '86%', rotate: '8deg' },
  { label: 'Share', color: 'share', shape: 'oval', top: '42rem', left: '4%', rotate: '-7deg' },
  { label: 'Apple', color: 'apple', shape: 'circle', top: '54rem', left: '64%', rotate: '15deg' },
  { label: 'Citrus', color: 'fresh', shape: 'squircle', top: '66rem', left: '88%', rotate: '-13deg' },
  { label: 'Basil', color: 'basil', shape: 'oval', top: '78rem', left: '10%', rotate: '9deg' },
  { label: 'Tomato', color: 'share', shape: 'circle', top: '91rem', left: '72%', rotate: '-11deg' },
  { label: 'Carrot', color: 'local', shape: 'squircle', top: '103rem', left: '3%', rotate: '11deg' },
  { label: 'Pantry', color: 'paper', shape: 'oval', top: '116rem', left: '84%', rotate: '-6deg' },
  { label: 'Picked', color: 'ripe', shape: 'circle', top: '129rem', left: '18%', rotate: '14deg' },
  { label: 'Dinner', color: 'fresh', shape: 'oval', top: '142rem', left: '68%', rotate: '-12deg' },
  { label: 'Soup', color: 'local', shape: 'circle', top: '155rem', left: '42%', rotate: '10deg' },
  { label: 'Snack', color: 'apple', shape: 'squircle', top: '168rem', left: '80%', rotate: '-9deg' },
  { label: 'Pesto', color: 'basil', shape: 'oval', top: '181rem', left: '7%', rotate: '13deg' },
  { label: 'Pickup', color: 'paper', shape: 'squircle', top: '194rem', left: '58%', rotate: '-8deg' },
]

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
  item_name: '',
  quantity_label: '',
  description: '',
  expiration_date: getDefaultExpirationDate(),
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
  const [verificationFile, setVerificationFile] = useState(null)
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
  const [isSubmittingPost, setIsSubmittingPost] = useState(false)
  const [isClaimingCart, setIsClaimingCart] = useState(false)
  const basketDockRef = useRef(null)
  const basketDragRef = useRef(null)

  const selectedInventoryItem = useMemo(
    () =>
      foodItems.find((item) => item.name === form.foodItemName) || foodItems[0],
    [form.foodItemName],
  )

  const reverifiedFoodItem = useMemo(
    () => ({
      image: verificationImage || '/favicon.svg',
    }),
    [verificationImage],
  )

  const selectedPickupPoint = useMemo(() => {
    if (!form.pickup_latitude || !form.pickup_longitude) {
      return null
    }

    return [Number(form.pickup_latitude), Number(form.pickup_longitude)]
  }, [form.pickup_latitude, form.pickup_longitude])

  const loadShareFeed = useCallback(
    async (referenceLocation = userLocation) => {
      if (!isAuthed) {
        return
      }

      setFeedState('loading')
      setFeedError('')

      try {
        const params = {}
        if (referenceLocation) {
          params.lat = referenceLocation[0]
          params.lng = referenceLocation[1]
        }

        const response = await fetchShareFeed(params)
        const posts = (response.posts || []).map((post) => normalizePost(post, referenceLocation))

        setSharePosts(posts)
        setSelectedPostId((currentSelectedPostId) =>
          posts.some((post) => post.id === currentSelectedPostId)
            ? currentSelectedPostId
            : posts[0]?.id ?? null,
        )
        setCartPostIds((currentIds) =>
          currentIds.filter((postId) =>
            posts.some((post) => post.id === postId && post.status === 'available' && !post.is_owner),
          ),
        )
        setFeedState('ready')
      } catch (error) {
        setFeedState('error')
        setFeedError(getApiErrorMessage(error, 'Could not load the marketplace feed.'))
      }
    },
    [isAuthed, userLocation],
  )

  const loadRequestQueues = useCallback(
    async (referenceLocation = userLocation) => {
      if (!isAuthed) {
        return
      }

      setRequestsState('loading')
      setRequestsError('')

      try {
        const params = {}
        if (referenceLocation) {
          params.lat = referenceLocation[0]
          params.lng = referenceLocation[1]
        }

        const [incomingResponse, outgoingResponse] = await Promise.all([
          fetchIncomingShareRequests(params),
          fetchOutgoingShareRequests(params),
        ])

        setIncomingRequests(
          (incomingResponse.requests || []).map((request) => normalizeRequest(request, referenceLocation)),
        )
        setOutgoingRequests(
          (outgoingResponse.requests || []).map((request) => normalizeRequest(request, referenceLocation)),
        )
        setRequestsState('ready')
      } catch (error) {
        setRequestsState('error')
        setRequestsError(getApiErrorMessage(error, 'Could not load marketplace requests.'))
      }
    },
    [isAuthed, userLocation],
  )

  const loadSelectedPostDetail = useCallback(
    async (postId, referenceLocation = userLocation) => {
      if (!isAuthed || !postId) {
        setSelectedPostDetail(null)
        setSelectedPostDetailError('')
        setSelectedPostDetailState('idle')
        return
      }

      setSelectedPostDetailState('loading')
      setSelectedPostDetailError('')

      try {
        const post = normalizePost(await fetchSharePost(postId), referenceLocation)
        setSelectedPostDetail(post)
        setSelectedPostDetailState('ready')
      } catch (error) {
        setSelectedPostDetail(null)
        setSelectedPostDetailState('error')
        setSelectedPostDetailError(
          getApiErrorMessage(error, 'Could not load the selected listing details.'),
        )
      }
    },
    [isAuthed, userLocation],
  )

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    if (!isAuthed) {
      setFeedState('idle')
      setFeedError('')
      setRequestsState('idle')
      setRequestsError('')
      setSharePosts([])
      setIncomingRequests([])
      setOutgoingRequests([])
      setSelectedPostId(null)
      setSelectedPostDetail(null)
      setSelectedPostDetailState('idle')
      setSelectedPostDetailError('')
      return
    }

    void loadShareFeed(userLocation)
    void loadRequestQueues(userLocation)
  }, [isAuthed, loadRequestQueues, loadShareFeed, status, userLocation])

  useEffect(() => {
    if (!selectedPostId || !isAuthed) {
      setSelectedPostDetail(null)
      setSelectedPostDetailState('idle')
      setSelectedPostDetailError('')
      return
    }

    void loadSelectedPostDetail(selectedPostId, userLocation)
  }, [isAuthed, loadSelectedPostDetail, selectedPostId, userLocation])

  useEffect(() => {
    return () => {
      if (verificationImage.startsWith('blob:')) {
        URL.revokeObjectURL(verificationImage)
      }
    }
  }, [verificationImage])

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

      if (
        firstPost.distance_miles != null &&
        secondPost.distance_miles != null &&
        firstPost.distance_miles !== secondPost.distance_miles
      ) {
        return firstPost.distance_miles - secondPost.distance_miles
      }

      return new Date(secondPost.created_at) - new Date(firstPost.created_at)
    })
  }, [activeFilter, normalizedSearch, sharePosts])

  const selectedFeedPost = useMemo(
    () => sharePosts.find((post) => post.id === selectedPostId) || filteredPosts[0] || null,
    [filteredPosts, selectedPostId, sharePosts],
  )

  const selectedPost = useMemo(() => {
    if (selectedPostDetail?.id === selectedFeedPost?.id) {
      return selectedPostDetail
    }
    return selectedFeedPost
  }, [selectedFeedPost, selectedPostDetail])

  useEffect(() => {
    if (!selectedFeedPost && filteredPosts[0]) {
      setSelectedPostId(filteredPosts[0].id)
    }
  }, [filteredPosts, selectedFeedPost])

  const availableCount = sharePosts.filter((post) => post.status === 'available').length
  const pendingCount = sharePosts.filter((post) => post.status === 'pending').length
  const claimedCount = sharePosts.filter((post) => post.status === 'claimed').length
  const cartPosts = cartPostIds
    .map((postId) => sharePosts.find((post) => post.id === postId))
    .filter(Boolean)
  const nearbyPosts = filteredPosts.filter((post) => post.distance_miles != null).slice(0, 3)
  const pendingIncomingRequests = incomingRequests.filter((request) => request.status === 'pending')

  useEffect(() => {
    let isActive = true

    async function loadSharePosts() {
      setPostsLoading(true)

      try {
        const response = await fetchShareFeed()
        if (!isActive) return
        setSharePosts(response?.posts || [])
      } catch (error) {
        if (!isActive) return
        setSharePosts([])
        toast.error(getErrorMessage(error, 'Failed to load marketplace posts.'))
      } finally {
        if (isActive) {
          setPostsLoading(false)
        }
      }
    }

    void loadSharePosts()

    return () => {
      isActive = false
    }
  }, [])

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

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  function resetShareForm() {
    if (verificationImage.startsWith('blob:')) {
      URL.revokeObjectURL(verificationImage)
    }

    setForm(blankForm)
    setVerificationImage('')
    setVerificationFile(null)
    setLocationResolutionError('')
    setIsResolvingLocation(false)
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0]

    if (!file) {
      setVerificationFile(null)
      setVerificationImage('')
      setVerificationFile(null)
      return
    }

    if (verificationImage.startsWith('blob:')) {
      URL.revokeObjectURL(verificationImage)
    }

    setVerificationFile(file)
    setVerificationImage(URL.createObjectURL(file))
    setVerificationFile(file)
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

    if (!post || post.status !== 'available' || post.is_owner) {
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
      <main className="marketplace-page min-h-screen overflow-hidden text-ink">
        <MarketplaceBackground />
        <MarketplaceDragLayer />

        <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
          <div className="plant-trail" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((leaf) => (
              <svg className="plant-trail__leaf" fill="none" key={leaf} viewBox="0 0 64 64">
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
                Browse live posts from nearby neighbors, request an item, and unlock the exact
                pickup point only after the owner approves the match.
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
              <h2 className="text-4xl font-black uppercase leading-none">Sign in to browse live posts</h2>
              <p className="text-base font-bold leading-8 text-ink/70">
                Your teammates wired the marketplace API behind authentication, so you need to log
                in before loading the feed or posting an item.
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
                isLoadingFeed={feedState === 'loading'}
                locationError={locationError}
                locationMeta={locationMeta}
                locationState={locationState}
                onRequestCurrentLocation={requestCurrentLocation}
                onSelectPost={setSelectedPostId}
                selectedPost={selectedPost}
                selectedPostId={selectedPostId}
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
                      <span
                        className={`rounded-full border border-ink/15 px-3 py-1.5 text-xs font-black uppercase shadow-sticker ${getSelectedPostStatusClass(selectedPost.status)}`}
                      >
                        {selectedPost.status === 'claimed'
                          ? 'matched'
                          : selectedPost.status === 'pending'
                            ? 'pending'
                            : selectedPost.status}
                      </span>
                    </div>

                    <div className="market-map-selected">
                      <img
                        alt={`${selectedPost.food_item.name} listing`}
                        className="market-map-selected__image"
                        src={selectedPost.food_item.image}
                      />

                      <dl className="receipt-lines">
                        <div>
                          <dt>food</dt>
                          <dd>{selectedPost.food_item.name}</dd>
                        </div>
                        <div>
                          <dt>owner</dt>
                          <dd>
                            {selectedPost.owner?.full_name ||
                              selectedPost.food_item.owner_name ||
                              'Neighbor'}
                          </dd>
                        </div>
                        <div>
                          <dt>distance</dt>
                          <dd>{formatDistanceMiles(selectedPost.distance_miles)}</dd>
                        </div>
                        <div>
                          <dt>pickup area</dt>
                          <dd>{selectedPost.public_pickup_location || selectedPost.pickup_location}</dd>
                        </div>
                        <div>
                          <dt>request</dt>
                          <dd>{getRequestValue(selectedPost)}</dd>
                        </div>
                      </dl>
                    </div>

                    <p className="mt-4 text-sm font-bold leading-7 text-ink/75">
                      {selectedPost.description}
                    </p>

                    <div
                      className={`market-map-address-card ${
                        selectedPost.exact_location_visible
                          ? 'market-map-address-card--revealed'
                          : 'market-map-address-card--locked'
                      }`}
                    >
                      <p className="pantry-label">Pickup details</p>
                      <strong>
                        {selectedPost.exact_location_visible
                          ? selectedPost.pickup_location
                          : selectedPost.public_pickup_location || selectedPost.pickup_location}
                      </strong>
                      <p>
                        {selectedPost.exact_location_visible
                          ? selectedPost.is_owner
                            ? 'Exact pickup details are visible because this is your listing.'
                            : 'The owner approved your request, so the exact pickup location is now unlocked.'
                          : selectedPost.viewer_request_status === 'pending'
                            ? 'Your request is pending. The exact street address stays hidden until the owner approves it.'
                            : 'Only the neighborhood-level pickup area is public. The exact location unlocks after owner approval.'}
                      </p>
                      <span className="market-map-address-card__meta">
                        Request status: {selectedPost.viewer_request_status || selectedPost.status}
                      </span>
                    </div>

                    {selectedPostDetailState === 'loading' && (
                      <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-ink/55">
                        Refreshing private listing details...
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-3">
                      {selectedPost.is_owner ? (
                        <button
                          className="pantry-button pantry-button--light"
                          onClick={() => {
                            const ownerInbox = document.getElementById('marketplace-owner-inbox')
                            ownerInbox?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                          type="button"
                        >
                          Review owner inbox
                        </button>
                      ) : (
                        <>
                          <button
                            className="pantry-button"
                            disabled={
                              selectedPost.status !== 'available' || cartPostIds.includes(selectedPost.id)
                            }
                            onClick={() => addPostToCart(selectedPost.id)}
                            type="button"
                          >
                            {cartPostIds.includes(selectedPost.id) ? 'Already in basket' : 'Add to basket'}
                          </button>
                          <button
                            className="pantry-button pantry-button--light"
                            disabled={selectedPost.status !== 'available'}
                            onClick={() => claimPost(selectedPost.id)}
                            type="button"
                          >
                            {selectedPost.viewer_request_status === 'pending'
                              ? 'Request pending'
                              : selectedPost.status === 'claimed'
                                ? 'Matched'
                                : selectedPost.status === 'pending'
                                  ? 'Awaiting owner'
                                  : 'Request now'}
                          </button>
                        </>
                      )}
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

                <article className="pantry-card" id="marketplace-owner-inbox">
                  <p className="pantry-label">Owner inbox</p>
                  <h2 className="mt-2 text-3xl font-black uppercase leading-none">Approve requests</h2>
                  <p className="mt-3 text-sm font-bold leading-7 text-ink/75">
                    Pending requests for your listings land here. Approving a request reveals the
                    exact pickup address to that requester.
                  </p>

                  {pendingIncomingRequests.length === 0 ? (
                    <div className="market-map-queue__empty">
                      No pending requests yet. Ask a second account to request one of your posts to
                      test the owner approval flow.
                    </div>
                  ) : (
                    <div className="market-map-queue">
                      {pendingIncomingRequests.map((request) => {
                        const isSelectedRequest = request.post?.id === selectedPost?.id
                        const isBusyApprove = requestActionId === `approve:${request.id}`
                        const isBusyDecline = requestActionId === `decline:${request.id}`

                        return (
                          <div className="market-map-request" key={request.id}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="pantry-label">Pending request</p>
                                <h3 className="mt-2 text-2xl font-black uppercase leading-none">
                                  {request.post?.title || 'Marketplace post'}
                                </h3>
                              </div>
                              <span
                                className={`rounded-full border border-ink/15 px-3 py-1.5 text-xs font-black uppercase shadow-sticker ${
                                  isSelectedRequest ? 'bg-phthalo text-white' : 'bg-white text-ink'
                                }`}
                              >
                                {isSelectedRequest ? 'selected' : getRequestStatusLabel(request.status)}
                              </span>
                            </div>

                            <dl className="receipt-lines">
                              <div>
                                <dt>requester</dt>
                                <dd>{request.requester?.full_name || request.requester?.username || 'Neighbor'}</dd>
                              </div>
                              <div>
                                <dt>pickup</dt>
                                <dd>{request.post?.pickup_location || request.post?.public_pickup_location}</dd>
                              </div>
                              <div>
                                <dt>submitted</dt>
                                <dd>{new Date(request.created_at).toLocaleString()}</dd>
                              </div>
                              <div>
                                <dt>status</dt>
                                <dd>{getRequestStatusLabel(request.status)}</dd>
                              </div>
                            </dl>

                            <div className="flex flex-wrap gap-3">
                              <button
                                className="pantry-button pantry-button--light"
                                onClick={() => setSelectedPostId(request.post?.id ?? null)}
                                type="button"
                              >
                                View listing
                              </button>
                              <button
                                className="pantry-button"
                                disabled={Boolean(requestActionId)}
                                onClick={() => handleRequestAction(request.id, 'approve')}
                                type="button"
                              >
                                {isBusyApprove ? 'Approving...' : 'Approve reveal'}
                              </button>
                              <button
                                className="pantry-filter-button"
                                disabled={Boolean(requestActionId)}
                                onClick={() => handleRequestAction(request.id, 'decline')}
                                type="button"
                              >
                                {isBusyDecline ? 'Declining...' : 'Decline'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </article>

                <article className="pantry-card">
                  <p className="pantry-label">My requests</p>
                  <h2 className="mt-2 text-3xl font-black uppercase leading-none">Track approvals</h2>
                  <p className="mt-3 text-sm font-bold leading-7 text-ink/75">
                    This queue shows every request you sent and whether the owner has approved,
                    declined, or is still reviewing it.
                  </p>

                  {outgoingRequests.length === 0 ? (
                    <div className="market-map-queue__empty">
                      You have not requested any marketplace posts yet.
                    </div>
                  ) : (
                    <div className="market-map-queue">
                      {outgoingRequests.map((request) => (
                        <div className="market-map-request" key={request.id}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="pantry-label">Outgoing request</p>
                              <h3 className="mt-2 text-2xl font-black uppercase leading-none">
                                {request.post?.title || 'Marketplace post'}
                              </h3>
                            </div>
                            <span
                              className={`rounded-full border border-ink/15 px-3 py-1.5 text-xs font-black uppercase shadow-sticker ${
                                request.status === 'approved'
                                  ? 'bg-phthalo text-white'
                                  : request.status === 'declined'
                                    ? 'bg-white text-ink'
                                    : 'bg-mustard text-white'
                              }`}
                            >
                              {getRequestStatusLabel(request.status)}
                            </span>
                          </div>

                          <dl className="receipt-lines">
                            <div>
                              <dt>food</dt>
                              <dd>{request.post?.food_item?.name || request.post?.title || 'Food item'}</dd>
                            </div>
                            <div>
                              <dt>pickup</dt>
                              <dd>
                                {request.post?.exact_location_visible
                                  ? request.post?.pickup_location
                                  : request.post?.public_pickup_location || request.post?.pickup_location}
                              </dd>
                            </div>
                            <div>
                              <dt>owner</dt>
                              <dd>
                                {request.post?.owner?.full_name ||
                                  request.post?.food_item?.owner_name ||
                                  'Neighbor'}
                              </dd>
                            </div>
                            <div>
                              <dt>detail access</dt>
                              <dd>
                                {request.post?.exact_location_visible ? 'exact location unlocked' : 'area only'}
                              </dd>
                            </div>
                          </dl>

                          <div className="flex flex-wrap gap-3">
                            <button
                              className="pantry-button pantry-button--light"
                              onClick={() => setSelectedPostId(request.post?.id ?? null)}
                              type="button"
                            >
                              {request.status === 'approved' ? 'View exact pickup' : 'View listing'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                {feedError && (
                  <article className="pantry-card">
                    <p className="pantry-label">Feed error</p>
                    <p className="mt-3 text-sm font-bold leading-7 text-danger">{feedError}</p>
                    <button
                      className="pantry-button mt-4"
                      onClick={() => loadShareFeed(userLocation)}
                      type="button"
                    >
                      Retry feed
                    </button>
                  </article>
                )}

                {requestsError && (
                  <article className="pantry-card">
                    <p className="pantry-label">Request error</p>
                    <p className="mt-3 text-sm font-bold leading-7 text-danger">{requestsError}</p>
                    <button
                      className="pantry-button mt-4"
                      onClick={() => loadRequestQueues(userLocation)}
                      type="button"
                    >
                      Retry requests
                    </button>
                  </article>
                )}

                {selectedPostDetailError && (
                  <article className="pantry-card">
                    <p className="pantry-label">Detail error</p>
                    <p className="mt-3 text-sm font-bold leading-7 text-danger">
                      {selectedPostDetailError}
                    </p>
                    <button
                      className="pantry-button mt-4"
                      onClick={() => selectedPostId && loadSelectedPostDetail(selectedPostId, userLocation)}
                      type="button"
                    >
                      Retry selected listing
                    </button>
                  </article>
                )}
              </div>
            </section>

            {nearbyPosts.length > 0 && (
              <section className="mx-auto max-w-7xl px-5 pb-2 md:px-10">
                <div className="market-map-nearby-strip">
                  <div>
                    <p className="pantry-label">Nearby suggestions</p>
                    <h2 className="mt-2 text-4xl font-black uppercase leading-none">
                      Closest live posts
                    </h2>
                  </div>

                  <div className="market-map-nearby-strip__cards">
                    {nearbyPosts.map((post) => (
                      <button
                        className="market-map-nearby-strip__card"
                        key={post.id}
                        onClick={() => setSelectedPostId(post.id)}
                        type="button"
                      >
                        <strong>{post.title}</strong>
                        <span>{post.food_item.name}</span>
                        <em>{formatDistanceMiles(post.distance_miles)}</em>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-4 md:px-10">
              <div className="pantry-card grid gap-4 xl:mr-96 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
                <label className="block">
                  <span className="pantry-field-label">Search marketplace</span>
                  <input
                    className="pantry-input"
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search items, locations, pending matches, descriptions..."
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
                  {requestsState === 'loading' ? ' • refreshing request queues...' : ''}
                </p>
              </div>
            </section>

            <section className="mx-auto max-w-7xl px-5 py-8 md:px-10 xl:pr-96">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPosts.map((post, index) => (
                  <MarketplacePostCard
                    index={index}
                    isInCart={cartPostIds.includes(post.id)}
                    isSelected={post.id === selectedPostId}
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
              className={`market-cart-dock ${basketPosition ? 'market-cart-dock--moved' : ''}`}
              ref={basketDockRef}
              style={
                basketPosition
                  ? { transform: `translate3d(${basketPosition.x}px, ${basketPosition.y}px, 0)` }
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
              {isClaimingCart && (
                <p className="mt-2 text-center text-xs font-black uppercase tracking-[0.12em] text-ink/65">
                  Sending meetup requests...
                </p>
              )}
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
