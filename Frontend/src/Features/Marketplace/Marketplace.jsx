import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'

import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../Auth/useAuth.jsx'
import {
  claimSharePost,
  createSharePost,
  fetchShareFeed,
  fetchSharePost,
  resolveShareLocation,
} from '../../Utils/shareApi.jsx'
import { foodItems } from '../Inventory/inventoryData.js'
import MarketplaceFeedMap from './components/MarketplaceFeedMap.jsx'
import MarketplaceCart from './components/MarketplaceCart.jsx'
import MarketplaceDragLayer from './components/MarketplaceDragLayer.jsx'
import MarketplaceListingPreview from './components/MarketplaceListingPreview.jsx'
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

const blankForm = {
  foodItemName: foodItems[0].name,
  title: '',
  description: '',
  pickup_location: '',
  pickup_latitude: '',
  pickup_longitude: '',
}

function buildInventoryFallbackMap() {
  return Object.fromEntries(foodItems.map((item) => [item.name.toLowerCase(), item]))
}

const inventoryFallbackMap = buildInventoryFallbackMap()

function getApiErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData
  }

  if (responseData?.detail) {
    return String(responseData.detail)
  }

  if (responseData && typeof responseData === 'object') {
    for (const value of Object.values(responseData)) {
      if (Array.isArray(value) && value.length > 0) {
        return String(value[0])
      }
      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }
  }

  return error?.message || fallbackMessage
}

function normalizePost(post, userLocation) {
  const fallbackInventoryItem = inventoryFallbackMap[
    String(post?.food_item?.name || post?.item_name || '').toLowerCase()
  ]
  const point = getPostPoint(post)
  const fallbackDistance =
    userLocation && point ? Number(getDistanceMiles(userLocation, point).toFixed(2)) : null

  return {
    ...post,
    claimed_by: post?.claimed_by || '',
    distance_miles:
      post?.distance_miles == null ? fallbackDistance : Number(post.distance_miles),
    exact_location_visible: Boolean(post?.exact_location_visible),
    public_pickup_latitude: post?.public_pickup_latitude ?? post?.pickup_latitude ?? null,
    public_pickup_location:
      post?.public_pickup_location || post?.pickup_location || 'Approximate pickup area',
    public_pickup_longitude: post?.public_pickup_longitude ?? post?.pickup_longitude ?? null,
    viewer_delivery_quote: post?.viewer_delivery_quote || post?.delivery_quote || null,
    viewer_fulfillment_method: post?.viewer_fulfillment_method || post?.fulfillment_method || null,
    viewer_request_status: post?.viewer_request_status || null,
    food_item: {
      estimated_price:
        post?.food_item?.estimated_price ??
        post?.estimated_price ??
        fallbackInventoryItem?.estimated_price ??
        0,
      expiration_date:
        post?.food_item?.expiration_date ?? fallbackInventoryItem?.expiration_date ?? null,
      image:
        post?.food_item?.image ||
        post?.image_file ||
        post?.image_url ||
        fallbackInventoryItem?.image ||
        '',
      name:
        post?.food_item?.name ||
        post?.item_name ||
        fallbackInventoryItem?.name ||
        post?.title,
      owner_name:
        post?.food_item?.owner_name ||
        post?.owner?.full_name ||
        post?.owner?.display_name ||
        post?.owner?.username ||
        '',
      quantity:
        post?.food_item?.quantity ||
        post?.quantity_label ||
        fallbackInventoryItem?.quantity ||
        '',
      recipe_uses:
        post?.food_item?.recipe_uses || post?.tags || fallbackInventoryItem?.recipe_uses || [],
      status:
        post?.food_item?.status || fallbackInventoryItem?.status || post?.status || 'fresh',
    },
    status: post?.status || 'available',
  }
}

function getFulfillmentLabel(fulfillmentMethod) {
  if (fulfillmentMethod === 'delivery') {
    return 'Simulated delivery'
  }
  return 'Pickup'
}

export default function Marketplace() {
  const { isAuthed, status } = useAuth()
  const [sharePosts, setSharePosts] = useState([])
  const [feedState, setFeedState] = useState('idle')
  const [feedError, setFeedError] = useState('')
  const [selectedPostDetail, setSelectedPostDetail] = useState(null)
  const [selectedPostDetailState, setSelectedPostDetailState] = useState('idle')
  const [selectedPostDetailError, setSelectedPostDetailError] = useState('')
  const [requestMode, setRequestMode] = useState('pickup')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [form, setForm] = useState(blankForm)
  const [verificationImage, setVerificationImage] = useState('')
  const [verificationFile, setVerificationFile] = useState(null)
  const [cartPostIds, setCartPostIds] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isListingModalOpen, setIsListingModalOpen] = useState(false)
  const [isBasketMoving, setIsBasketMoving] = useState(false)
  const [basketPosition, setBasketPosition] = useState(null)
  const [basketTopOffset, setBasketTopOffset] = useState(24)
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
    () => foodItems.find((item) => item.name === form.foodItemName) || foodItems[0],
    [form.foodItemName],
  )

  const reverifiedFoodItem = useMemo(
    () => ({
      ...selectedInventoryItem,
      image: verificationImage || selectedInventoryItem.image,
    }),
    [selectedInventoryItem, verificationImage],
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
            : null,
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
      setSharePosts([])
      setSelectedPostId(null)
      setSelectedPostDetail(null)
      setSelectedPostDetailState('idle')
      setSelectedPostDetailError('')
      return
    }

    void loadShareFeed(userLocation)
  }, [isAuthed, loadShareFeed, status, userLocation])

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

  useEffect(() => {
    function updateBasketTopOffset() {
      const navBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
      setBasketTopOffset(Math.max(24, Math.round(navBottom + 16)))
    }

    updateBasketTopOffset()
    window.addEventListener('resize', updateBasketTopOffset)
    window.addEventListener('scroll', updateBasketTopOffset, { passive: true })

    return () => {
      window.removeEventListener('resize', updateBasketTopOffset)
      window.removeEventListener('scroll', updateBasketTopOffset)
    }
  }, [])

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredPosts = useMemo(() => {
    const matchingPosts = sharePosts.filter((post) => {
      const searchableText = [
        post.title,
        post.description,
        post.pickup_location,
        post.public_pickup_location,
        post.status,
        post.claimed_by,
        post.viewer_request_status,
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
    () => sharePosts.find((post) => post.id === selectedPostId) || null,
    [selectedPostId, sharePosts],
  )

  const selectedPost = useMemo(() => {
    if (selectedPostDetail?.id === selectedFeedPost?.id) {
      return selectedPostDetail
    }
    return selectedFeedPost
  }, [selectedFeedPost, selectedPostDetail])

  const availableCount = sharePosts.filter((post) => post.status === 'available').length
  const pendingCount = sharePosts.filter((post) => post.status === 'pending').length
  const claimedCount = sharePosts.filter((post) => post.status === 'claimed').length
  const cartPosts = cartPostIds
    .map((postId) => sharePosts.find((post) => post.id === postId))
    .filter(Boolean)
  const nearbyPosts = filteredPosts.filter((post) => post.distance_miles != null).slice(0, 3)

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
      return
    }

    if (verificationImage.startsWith('blob:')) {
      URL.revokeObjectURL(verificationImage)
    }

    setVerificationFile(file)
    setVerificationImage(URL.createObjectURL(file))
  }

  async function requestCurrentLocation() {
    setLocationState('loading')
    setLocationError('')

    try {
      const location = await requestBrowserLocation()
      setUserLocation(location.point)
      setLocationMeta({
        accuracy: location.accuracy,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp,
      })
      setLocationState('granted')
      return location
    } catch (error) {
      setLocationState('error')
      setLocationError(getLocationErrorMessage(error))
      throw error
    }
  }

  async function resolveLocationPayload(payload) {
    setIsResolvingLocation(true)
    setLocationResolutionError('')

    try {
      const resolved = await resolveShareLocation(payload)
      setForm((currentForm) => ({
        ...currentForm,
        pickup_location: resolved.pickup_location,
        pickup_latitude: String(resolved.pickup_latitude),
        pickup_longitude: String(resolved.pickup_longitude),
      }))
      return resolved
    } catch (error) {
      const message = getApiErrorMessage(error, 'Could not resolve that pickup location.')
      setLocationResolutionError(message)
      throw error
    } finally {
      setIsResolvingLocation(false)
    }
  }

  async function handleUseCurrentLocationForPost() {
    try {
      const location = await requestCurrentLocation()
      await resolveLocationPayload({
        latitude: location.latitude,
        longitude: location.longitude,
      })
      toast.success('Pickup location set from your current location.')
    } catch {
      // Error state is already surfaced in the UI.
    }
  }

  async function handleResolveTypedAddress() {
    if (!form.pickup_location.trim()) {
      setLocationResolutionError('Enter an address to place it on the map.')
      return
    }

    try {
      await resolveLocationPayload({ address: form.pickup_location.trim() })
      toast.success('Address resolved on the map.')
    } catch {
      // Error state is already surfaced in the UI.
    }
  }

  async function handleSelectMapPoint(point) {
    setForm((currentForm) => ({
      ...currentForm,
      pickup_latitude: String(point[0]),
      pickup_longitude: String(point[1]),
    }))

    try {
      await resolveLocationPayload({
        latitude: point[0],
        longitude: point[1],
      })
    } catch {
      // Error state is already surfaced in the UI.
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!isAuthed) {
      toast.error('Log in before creating a marketplace post.')
      return
    }

    if (!verificationFile) {
      toast.error('Upload a verification image before sharing.')
      return
    }

    setIsSubmittingPost(true)

    try {
      const payload = new FormData()
      payload.append('item_name', selectedInventoryItem.name)
      payload.append('quantity_label', String(selectedInventoryItem.quantity))
      payload.append('estimated_price', String(selectedInventoryItem.estimated_price ?? 0))
      payload.append('title', form.title.trim())
      payload.append('description', form.description.trim())
      payload.append('pickup_location', form.pickup_location.trim())
      if (form.pickup_latitude && form.pickup_longitude) {
        payload.append('pickup_latitude', String(form.pickup_latitude))
        payload.append('pickup_longitude', String(form.pickup_longitude))
      }
      payload.append('image_file', verificationFile)
      for (const tag of selectedInventoryItem.recipe_uses || []) {
        payload.append('recipe_uses', tag)
      }

      const createdPost = normalizePost(await createSharePost(payload), userLocation)

      setSharePosts((currentPosts) => [createdPost, ...currentPosts])
      setSelectedPostId(createdPost.id)
      setSelectedPostDetail(createdPost)
      resetShareForm()
      setIsShareModalOpen(false)
      toast.success('Marketplace post created.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not create the marketplace post.'))
    } finally {
      setIsSubmittingPost(false)
    }
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

  function openListingModal(postId) {
    setSelectedPostId(postId)
    setIsListingModalOpen(true)
  }

  function closeListingModal() {
    setIsListingModalOpen(false)
  }

  async function buildClaimPayload() {
    if (requestMode !== 'delivery') {
      return { fulfillment_method: 'pickup' }
    }

    let location = userLocation
    if (!location) {
      const currentLocation = await requestCurrentLocation()
      location = currentLocation.point
    }

    if (!location) {
      throw new Error('Turn on your current location before requesting simulated delivery.')
    }

    return {
      fulfillment_method: 'delivery',
      dropoff_latitude: String(location[0]),
      dropoff_longitude: String(location[1]),
    }
  }

  async function claimPost(postId) {
    if (!isAuthed) {
      toast.error('Log in before requesting a meetup.')
      return
    }

    try {
      const payload = await buildClaimPayload()
      const updatedPost = normalizePost(await claimSharePost(postId, payload), userLocation)
      setSharePosts((currentPosts) =>
        currentPosts.map((post) => (post.id === postId ? updatedPost : post)),
      )
      if (selectedPostId === postId) {
        setSelectedPostDetail(updatedPost)
      }
      removePostFromCart(postId)
      toast.success('Meetup request sent. The owner needs to approve it.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not request that meetup.'))
      await loadShareFeed(userLocation)
    }
  }

  async function claimCart() {
    if (!cartPostIds.length || isClaimingCart) {
      return
    }

    setIsClaimingCart(true)
    try {
      const payload = await buildClaimPayload()
      const updatedPosts = []
      for (const postId of cartPostIds) {
        const updatedPost = await claimSharePost(postId, payload)
        updatedPosts.push(normalizePost(updatedPost, userLocation))
      }

      const updatedPostMap = new Map(updatedPosts.map((post) => [post.id, post]))
      setSharePosts((currentPosts) =>
        currentPosts.map((post) => updatedPostMap.get(post.id) || post),
      )
      if (selectedPostId && updatedPostMap.has(selectedPostId)) {
        setSelectedPostDetail(updatedPostMap.get(selectedPostId))
      }
      setCartPostIds([])
      toast.success('Meetup requests sent for owner approval.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not request one of the meetups.'))
      await loadShareFeed(userLocation)
    } finally {
      setIsClaimingCart(false)
    }
  }

  if (status === 'loading') {
    return (
      <main className="marketplace-page min-h-screen overflow-hidden text-ink">
        <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-12 md:px-10">
          <div className="mx-auto max-w-7xl">
            <p className="pantry-label">marketplace</p>
            <h1 className="mt-3 text-6xl font-black uppercase leading-[0.85] md:text-8xl">
              Share shelf
            </h1>
            <p className="mt-5 text-lg font-bold leading-8 text-ink/75">Checking your session...</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <main className="marketplace-page min-h-screen overflow-hidden text-ink">
        <div className="marketplace-sticker-pattern" aria-hidden="true">
          {marketplaceBackgroundStickers.map((sticker) => (
            <span
              className={`marketplace-sticker marketplace-sticker--${sticker.color} marketplace-sticker--${sticker.shape}`}
              key={`${sticker.label}-${sticker.top}`}
              style={{
                '--sticker-left': sticker.left,
                '--sticker-rotate': sticker.rotate,
                '--sticker-top': sticker.top,
              }}
            >
              {sticker.label}
            </span>
          ))}
        </div>
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
                community feed
              </p>
              <h1 className="max-w-3xl text-6xl font-black uppercase leading-[0.85] md:text-8xl">
                Marketplace
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
            {(feedError || selectedPostDetailError) && (
              <section className="mx-auto grid max-w-[92rem] gap-4 px-5 pt-8 md:px-10 lg:grid-cols-2">
                {feedError && ( null
                  // <article className="pantry-card">
                  //   <p className="pantry-label">Feed error</p>
                  //   <p className="mt-3 text-sm font-bold leading-7 text-danger">{feedError}</p>
                  //   <button
                  //     className="pantry-button mt-4"
                  //     onClick={() => loadShareFeed(userLocation)}
                  //     type="button"
                  //   >
                  //     Retry feed
                  //   </button>
                  // </article>
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
              </section>
            )}

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
                        onClick={() => openListingModal(post.id)}
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

            <section className="mx-auto grid max-w-[92rem] gap-4 px-5 pt-6 md:px-10">
              <div className="pantry-card grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className="block">
                  <span className="pantry-field-label">Search marketplace</span>
                  <input
                    className="pantry-input py-2.5 text-sm"
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search items, locations, pending matches, descriptions..."
                    type="search"
                    value={searchTerm}
                  />
                </label>

                <div>
                  <p className="pantry-field-label">Filter posts</p>
                  <div className="flex flex-wrap gap-2">
                    {feedFilters.map((filter, index) => (
                      <button
                        className={`pantry-filter-button px-3 py-2 text-[0.7rem] ${
                          activeFilter === filter ? 'pantry-filter-button--active' : ''
                        }`}
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        style={{ '--filter-tilt': index % 2 === 0 ? '-1.5deg' : '1.5deg' }}
                        type="button"
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/55 md:col-span-2">
                  Showing {filteredPosts.length} of {sharePosts.length}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="rounded-full border border-ink/15 bg-white/85 px-5 py-3 text-sm font-black uppercase text-ink shadow-sticker">
                  The Marketplace
                </h3>
                <button
                  className="pantry-button whitespace-nowrap"
                  onClick={() => setIsShareModalOpen(true)}
                  type="button"
                >
                  Share item
                </button>
              </div>
            </section>

            <section className="mx-auto grid max-w-[92rem] gap-5 px-5 py-8 md:px-10 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPosts.map((post, index) => (
                  <MarketplacePostCard
                    index={index}
                    isInCart={cartPostIds.includes(post.id)}
                    isSelected={post.id === selectedPostId}
                    key={post.id}
                    onAddToCart={addPostToCart}
                    onClaimPost={claimPost}
                    onClearSelection={() => {}}
                    onSelectPost={openListingModal}
                    post={post}
                    showInlinePreview={false}
                  />
                ))}

                {feedState === 'ready' && filteredPosts.length === 0 && (
                  <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2">
                    No marketplace posts match this search.
                  </p>
                )}
              </div>

              <div className="xl:sticky xl:top-6">
                <MarketplaceFeedMap
                  className="market-map-panel--compact"
                  filteredPosts={filteredPosts}
                  isLoadingFeed={feedState === 'loading'}
                  locationError={locationError}
                  locationMeta={locationMeta}
                  locationState={locationState}
                  onRequestCurrentLocation={requestCurrentLocation}
                  onSelectPost={openListingModal}
                  selectedPost={selectedPost}
                  selectedPostId={selectedPostId}
                  userLocation={userLocation}
                />
              </div>
            </section>

            <div
              className={`market-cart-dock ${basketPosition ? 'market-cart-dock--moved' : ''}`}
              ref={basketDockRef}
              style={
                basketPosition
                  ? { transform: `translate3d(${basketPosition.x}px, ${basketPosition.y}px, 0)` }
                  : { top: `${basketTopOffset}px` }
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
              {cartPosts.length > 0 && (
                <p className="mt-2 text-center text-xs font-black uppercase tracking-[0.12em] text-ink/65">
                  Basket mode: {getFulfillmentLabel(requestMode)}
                </p>
              )}
              {isClaimingCart && (
                <p className="mt-2 text-center text-xs font-black uppercase tracking-[0.12em] text-ink/65">
                  Sending meetup requests...
                </p>
              )}
            </div>

            {isListingModalOpen && selectedPost && (
              <div className="market-modal" role="dialog" aria-modal="true">
                <button
                  aria-label="Close selected listing"
                  className="market-modal__scrim"
                  onClick={closeListingModal}
                  type="button"
                />

                <div className="market-modal__panel !max-w-6xl rounded-xl border border-ink/15 bg-cream p-5 shadow-pop">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b-2 border-moonstone pb-4">
                    <div>
                      <p className="pantry-label">Selected listing</p>
                      <h2 className="mt-2 text-4xl font-black uppercase leading-none">
                        {selectedPost.title}
                      </h2>
                    </div>
                    <button
                      className="pantry-filter-button shrink-0"
                      onClick={closeListingModal}
                      type="button"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:items-start">
                    <MarketplaceFeedMap
                      className="market-map-panel--compact"
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

                    <div className="grid gap-4">
                      <MarketplaceListingPreview
                        onClearSelection={closeListingModal}
                        post={selectedPost}
                      />

                      {!selectedPost.is_owner && selectedPost.status === 'available' && (
                        <div className="market-map-address-card">
                          <p className="pantry-label">Request method</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {['pickup', 'delivery'].map((mode) => (
                              <button
                                className={`pantry-filter-button ${
                                  requestMode === mode ? 'pantry-filter-button--active' : ''
                                }`}
                                key={mode}
                                onClick={() => setRequestMode(mode)}
                                type="button"
                              >
                                {mode === 'delivery' ? 'Simulated delivery' : 'Pickup'}
                              </button>
                            ))}
                          </div>
                          <p className="mt-3 text-sm font-bold leading-6 text-ink/70">
                            {requestMode === 'delivery'
                              ? 'Delivery uses your current location to estimate the request.'
                              : 'Pickup reveals the exact address after the owner approves.'}
                          </p>
                        </div>
                      )}

                      {selectedPost.viewer_delivery_quote && (
                        <div className="market-map-address-card market-map-address-card--revealed">
                          <p className="pantry-label">Delivery quote</p>
                          <strong>
                            {selectedPost.viewer_delivery_quote.delivery_available
                              ? `$${selectedPost.viewer_delivery_quote.estimated_fee} - ${selectedPost.viewer_delivery_quote.estimated_minutes} min`
                              : 'Unavailable'}
                          </strong>
                          <p>{selectedPost.viewer_delivery_quote.message}</p>
                          <span className="market-map-address-card__meta">
                            Dropoff: {selectedPost.viewer_delivery_quote.dropoff_location}
                          </span>
                        </div>
                      )}

                      {selectedPostDetailState === 'loading' && (
                        <p className="text-sm font-black uppercase tracking-[0.14em] text-ink/55">
                          Loading listing details...
                        </p>
                      )}

                      {selectedPostDetailError && (
                        <div className="market-map-address-card">
                          <p className="pantry-label">Detail error</p>
                          <p>{selectedPostDetailError}</p>
                          <button
                            className="pantry-button mt-3"
                            onClick={() => selectedPostId && loadSelectedPostDetail(selectedPostId, userLocation)}
                            type="button"
                          >
                            Retry selected listing
                          </button>
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedPost.is_owner ? (
                          <button className="pantry-button w-full" disabled type="button">
                            Your listing
                          </button>
                        ) : (
                          <>
                            <button
                              className="pantry-button pantry-button--light w-full"
                              disabled={
                                selectedPost.status !== 'available' ||
                                cartPostIds.includes(selectedPost.id)
                              }
                              onClick={() => addPostToCart(selectedPost.id)}
                              type="button"
                            >
                              {cartPostIds.includes(selectedPost.id) ? 'Already in basket' : 'Add to basket'}
                            </button>
                            <button
                              className="pantry-button w-full"
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
                                    : requestMode === 'delivery'
                                      ? 'Request delivery'
                                      : 'Request meetup'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isShareModalOpen && (
              <SharePostModal
                currentLocation={userLocation}
                foodItems={foodItems}
                form={form}
                isResolvingLocation={isResolvingLocation}
                isSubmitting={isSubmittingPost}
                locationResolutionError={locationResolutionError}
                onClose={() => {
                  resetShareForm()
                  setIsShareModalOpen(false)
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
