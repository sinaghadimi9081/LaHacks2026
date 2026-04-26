import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import { fetchItems, updateItem, deleteItem } from '../../Utils/itemsApi.jsx'
import {
  createSharePost,
  deleteSharePost,
  fetchMySharePosts,
  resolveShareLocation,
  updateSharePost,
} from '../../Utils/shareApi.jsx'
import { useAuth } from '../../Auth/useAuth.jsx'
import FoodItem from './components/FoodItem.jsx'
import FoodItemNoImage from './components/FoodItemNoImage.jsx'
import InventoryApprovals from './components/InventoryApprovals.jsx'
import SharePostModal from '../Marketplace/components/SharePostModal.jsx'
import LocationPickerMap from '../Marketplace/components/LocationPickerMap.jsx'
import { Link } from 'react-router-dom'

const filterOptions = ['all', 'fresh', 'use soon', 'feed today', 'critical']

const inventoryBackgroundStickers = [
  { label: 'Fresh', color: 'fresh', shape: 'oval', top: '15rem', left: '6%', rotate: '-10deg' },
  { label: 'Pantry', color: 'paper', shape: 'circle', top: '23rem', left: '78%', rotate: '12deg' },
  { label: 'Ripe', color: 'ripe', shape: 'squircle', top: '36rem', left: '86%', rotate: '8deg' },
  { label: 'Stock', color: 'local', shape: 'oval', top: '48rem', left: '4%', rotate: '-7deg' },
  { label: 'Apple', color: 'apple', shape: 'circle', top: '60rem', left: '64%', rotate: '15deg' },
  { label: 'Citrus', color: 'fresh', shape: 'squircle', top: '72rem', left: '88%', rotate: '-13deg' },
  { label: 'Basil', color: 'basil', shape: 'oval', top: '86rem', left: '10%', rotate: '9deg' },
  { label: 'Tomato', color: 'share', shape: 'circle', top: '100rem', left: '72%', rotate: '-11deg' },
  { label: 'Carrot', color: 'local', shape: 'squircle', top: '114rem', left: '3%', rotate: '11deg' },
  { label: 'Dinner', color: 'fresh', shape: 'oval', top: '128rem', left: '84%', rotate: '-6deg' },
  { label: 'Use soon', color: 'ripe', shape: 'circle', top: '144rem', left: '18%', rotate: '14deg' },
  { label: 'Soup', color: 'local', shape: 'circle', top: '160rem', left: '42%', rotate: '10deg' },
]

const blankSellForm = {
  foodItemName: '',
  title: '',
  description: '',
  pickup_location: '',
  pickup_latitude: '',
  pickup_longitude: '',
}

const blankListingEditForm = {
  title: '',
  description: '',
  pickup_location: '',
  pickup_latitude: '',
  pickup_longitude: '',
  quantity_label: '',
  estimated_price: '',
}

function getItemKey(item) {
  return item.id || `${item.name}-${item.created_at || item.expiration_date}`
}

function normalizeListing(post) {
  const foodItem = post?.food_item || {}

  return {
    ...post,
    pickup_location: post?.pickup_location || post?.public_pickup_location || '',
    pickup_latitude: post?.pickup_latitude ?? post?.public_pickup_latitude ?? '',
    pickup_longitude: post?.pickup_longitude ?? post?.public_pickup_longitude ?? '',
    food_item: {
      ...foodItem,
      image: foodItem.image || post?.image_url || '',
      name: foodItem.name || post?.item_name || post?.title || 'Listing',
      quantity: foodItem.quantity || post?.quantity_label || '',
      estimated_price: foodItem.estimated_price ?? post?.estimated_price ?? '',
      status: foodItem.status || post?.status || 'available',
      recipe_uses: foodItem.recipe_uses || post?.tags || [],
    },
  }
}

function formatListingDate(date) {
  if (!date) return 'recent'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(String(date).includes('T') ? date : `${date}T12:00:00`))
}

function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data
  if (data?.detail) return String(data.detail)
  if (data && typeof data === 'object') {
    for (const v of Object.values(data)) {
      if (Array.isArray(v) && v.length > 0) return String(v[0])
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  return error?.message || fallback
}

export default function Inventory() {
  const { user } = useAuth()
  const [inventoryItems, setInventoryItems] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [editingItem, setEditingItem] = useState(null)
  const [editedQuantity, setEditedQuantity] = useState('')
  const [sellItem, setSellItem] = useState(null)
  const [sellForm, setSellForm] = useState(blankSellForm)
  const [verificationImage, setVerificationImage] = useState('')
  const [verificationFile, setVerificationFile] = useState(null)
  const [isSubmittingPost, setIsSubmittingPost] = useState(false)
  const [isResolvingLocation, setIsResolvingLocation] = useState(false)
  const [locationResolutionError, setLocationResolutionError] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [activeListings, setActiveListings] = useState([])
  const [listingLoadState, setListingLoadState] = useState('loading')
  const [editingListing, setEditingListing] = useState(null)
  const [listingEditForm, setListingEditForm] = useState(blankListingEditForm)
  const [isSavingListing, setIsSavingListing] = useState(false)
  const [deletingListingId, setDeletingListingId] = useState(null)
  const [listingSearchTerm, setListingSearchTerm] = useState('')
  const [listingSortOption, setListingSortOption] = useState('newest')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadState('loading')
      try {
        const response = await fetchItems()
        if (!cancelled) {
          setInventoryItems(response.items || [])
          setLoadState('ready')
        }
      } catch (error) {
        if (!cancelled) {
          setLoadState('error')
          toast.error(getApiErrorMessage(error, 'Could not load pantry items.'))
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadListings() {
      setListingLoadState('loading')
      try {
        const response = await fetchMySharePosts({ status: 'available' })
        if (!cancelled) {
          setActiveListings((response.posts || []).map(normalizeListing))
          setListingLoadState('ready')
        }
      } catch (error) {
        if (!cancelled) {
          setListingLoadState('error')
          toast.error(getApiErrorMessage(error, 'Could not load your active listings.'))
        }
      }
    }

    loadListings()
    return () => { cancelled = true }
  }, [])

  const totalValue = inventoryItems.reduce(
    (sum, item) => sum + Number(item.estimated_price || 0),
    0,
  )
  const soonCount = inventoryItems.filter((item) => item.status !== 'fresh').length
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const normalizedListingSearch = listingSearchTerm.trim().toLowerCase()
  const dashboardName = user?.username || 'Your'

  const matchesSearchAndFilter = useCallback(
    (item) => {
      const searchableText = [
        item.name,
        String(item.quantity ?? ''),
        item.status,
        item.owner_name,
        item.expiration_date,
        ...(item.recipe_uses || []),
        ...(item.notes || []),
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        normalizedSearch.length === 0 || searchableText.includes(normalizedSearch)
      const matchesFilter =
        activeFilter === 'all' || item.status === activeFilter

      return matchesSearch && matchesFilter
    },
    [activeFilter, normalizedSearch],
  )

  const filteredInventoryItems = useMemo(
    () => inventoryItems.filter(matchesSearchAndFilter),
    [inventoryItems, matchesSearchAndFilter],
  )
  const filteredActiveListings = useMemo(() => {
    const matchingListings = activeListings.filter((listing) => {
      const searchableText = [
        listing.title,
        listing.description,
        listing.pickup_location,
        listing.status,
        listing.food_item?.name,
        listing.food_item?.quantity,
        listing.food_item?.estimated_price,
        ...(listing.food_item?.recipe_uses || []),
      ]
        .join(' ')
        .toLowerCase()

      return (
        normalizedListingSearch.length === 0 ||
        searchableText.includes(normalizedListingSearch)
      )
    })

    return [...matchingListings].sort((firstListing, secondListing) => {
      if (listingSortOption === 'oldest') {
        return new Date(firstListing.created_at) - new Date(secondListing.created_at)
      }

      if (listingSortOption === 'title') {
        return String(firstListing.title || '').localeCompare(String(secondListing.title || ''))
      }

      if (listingSortOption === 'value-high') {
        return (
          Number(secondListing.food_item?.estimated_price || secondListing.estimated_price || 0) -
          Number(firstListing.food_item?.estimated_price || firstListing.estimated_price || 0)
        )
      }

      if (listingSortOption === 'value-low') {
        return (
          Number(firstListing.food_item?.estimated_price || firstListing.estimated_price || 0) -
          Number(secondListing.food_item?.estimated_price || secondListing.estimated_price || 0)
        )
      }

      return new Date(secondListing.created_at) - new Date(firstListing.created_at)
    })
  }, [activeListings, listingSortOption, normalizedListingSearch])
  const visibleCount = filteredInventoryItems.length
  const selectedListingPickupPoint = useMemo(() => {
    if (!listingEditForm.pickup_latitude || !listingEditForm.pickup_longitude) return null
    return [Number(listingEditForm.pickup_latitude), Number(listingEditForm.pickup_longitude)]
  }, [listingEditForm.pickup_latitude, listingEditForm.pickup_longitude])

  const selectedPickupPoint = useMemo(() => {
    if (!sellForm.pickup_latitude || !sellForm.pickup_longitude) return null
    return [Number(sellForm.pickup_latitude), Number(sellForm.pickup_longitude)]
  }, [sellForm.pickup_latitude, sellForm.pickup_longitude])

  const sellFoodItems = useMemo(
    () =>
      inventoryItems.map((item) => ({
        ...item,
        image: item.image || '',
        recipe_uses: item.recipe_uses || [],
      })),
    [inventoryItems],
  )

  const selectedSellItem = useMemo(
    () =>
      sellFoodItems.find((item) => item.name === sellForm.foodItemName) || sellItem || sellFoodItems[0],
    [sellFoodItems, sellForm.foodItemName, sellItem],
  )

  const reverifiedFoodItem = useMemo(
    () =>
      selectedSellItem
        ? { ...selectedSellItem, image: verificationImage || selectedSellItem.image || '' }
        : { name: '', image: '' },
    [selectedSellItem, verificationImage],
  )

  function openEditQuantity(item) {
    setEditingItem(item)
    setEditedQuantity(String(item.quantity ?? ''))
  }

  async function handleEditQuantity(event) {
    event.preventDefault()
    if (!editingItem || !editedQuantity.trim()) return

    const rawQuantity = editedQuantity.trim()
    const parsed = parseInt(rawQuantity, 10)
    const newQuantity = Number.isFinite(parsed) ? parsed : 1
    const isZero = newQuantity === 0 || rawQuantity === '0' || rawQuantity.toLowerCase() === 'none'

    if (isZero) {
      if (window.confirm(`It looks like you're out of ${editingItem.name}. Would you like to delete this item?`)) {
        handleDeleteItem(editingItem)
        setEditingItem(null)
        setEditedQuantity('')
        return
      }
    }

    const itemId = editingItem.id
    const editingKey = getItemKey(editingItem)

    setInventoryItems((current) =>
      current.map((item) =>
        getItemKey(item) === editingKey ? { ...item, quantity: newQuantity } : item,
      ),
    )
    setEditingItem(null)
    setEditedQuantity('')

    try {
      await updateItem(itemId, { quantity: newQuantity })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save quantity change.'))
      setInventoryItems((current) =>
        current.map((item) =>
          getItemKey(item) === editingKey ? { ...item, quantity: editingItem.quantity } : item,
        ),
      )
    }
  }

  async function handleDeleteItem(itemToDelete) {
    const deleteKey = getItemKey(itemToDelete)
    setInventoryItems((current) => current.filter((item) => getItemKey(item) !== deleteKey))

    try {
      await deleteItem(itemToDelete.id)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not delete item.'))
      setInventoryItems((current) => [...current, itemToDelete])
    }
  }

  function openSellItem(item) {
    setSellItem({
      ...item,
      image: item.image || '',
      recipe_uses: item.recipe_uses || [],
    })
    setSellForm({
      foodItemName: item.name,
      title: item.name,
      description: `${item.quantity} available.`,
      pickup_location: '',
      pickup_latitude: '',
      pickup_longitude: '',
    })
    setVerificationImage('')
    setVerificationFile(null)
    setLocationResolutionError('')
  }

  function updateSellForm(field, value) {
    setSellForm((current) => ({ ...current, [field]: value }))
  }

  function handleSellImageUpload(event) {
    const file = event.target.files?.[0]
    setVerificationFile(file || null)
    setVerificationImage(file ? URL.createObjectURL(file) : '')
  }

  async function handleResolveTypedAddress() {
    const address = sellForm.pickup_location?.trim()
    if (!address) return

    setIsResolvingLocation(true)
    setLocationResolutionError('')
    try {
      const resolved = await resolveShareLocation({ pickup_location: address })
      setSellForm((current) => ({
        ...current,
        pickup_location: resolved.pickup_location,
        pickup_latitude: String(resolved.pickup_latitude),
        pickup_longitude: String(resolved.pickup_longitude),
      }))
    } catch (error) {
      setLocationResolutionError(getApiErrorMessage(error, 'Could not resolve address.'))
    } finally {
      setIsResolvingLocation(false)
    }
  }

  function handleSelectMapPoint(point) {
    setSellForm((current) => ({
      ...current,
      pickup_latitude: String(point[0]),
      pickup_longitude: String(point[1]),
    }))
  }

  async function handleUseCurrentLocationForPost() {
    if (!navigator.geolocation) return

    setIsResolvingLocation(true)
    setLocationResolutionError('')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setCurrentLocation([lat, lng])
        try {
          const resolved = await resolveShareLocation({ latitude: lat, longitude: lng })
          setSellForm((current) => ({
            ...current,
            pickup_location: resolved.pickup_location,
            pickup_latitude: String(resolved.pickup_latitude),
            pickup_longitude: String(resolved.pickup_longitude),
          }))
        } catch {
          setSellForm((current) => ({
            ...current,
            pickup_latitude: String(lat),
            pickup_longitude: String(lng),
          }))
        } finally {
          setIsResolvingLocation(false)
        }
      },
      () => {
        setLocationResolutionError('Could not access your current location.')
        setIsResolvingLocation(false)
      },
    )
  }

  function openEditListing(listing) {
    setEditingListing(listing)
    setListingEditForm({
      title: listing.title || '',
      description: listing.description || '',
      pickup_location: listing.pickup_location || '',
      pickup_latitude: listing.pickup_latitude ? String(listing.pickup_latitude) : '',
      pickup_longitude: listing.pickup_longitude ? String(listing.pickup_longitude) : '',
      quantity_label: listing.food_item?.quantity || listing.quantity_label || '',
      estimated_price: String(
        listing.food_item?.estimated_price ?? listing.estimated_price ?? '',
      ),
    })
    setLocationResolutionError('')
  }

  function updateListingEditForm(field, value) {
    setListingEditForm((current) => ({ ...current, [field]: value }))
  }

  async function handleResolveListingAddress() {
    const address = listingEditForm.pickup_location?.trim()
    if (!address) {
      setLocationResolutionError('Enter an address to place it on the map.')
      return
    }

    setIsResolvingLocation(true)
    setLocationResolutionError('')
    try {
      const resolved = await resolveShareLocation({ address })
      setListingEditForm((current) => ({
        ...current,
        pickup_location: resolved.pickup_location,
        pickup_latitude: String(resolved.pickup_latitude),
        pickup_longitude: String(resolved.pickup_longitude),
      }))
      toast.success('Listing address resolved.')
    } catch (error) {
      setLocationResolutionError(getApiErrorMessage(error, 'Could not resolve address.'))
    } finally {
      setIsResolvingLocation(false)
    }
  }

  async function handleSelectListingMapPoint(point) {
    setListingEditForm((current) => ({
      ...current,
      pickup_latitude: String(point[0]),
      pickup_longitude: String(point[1]),
    }))

    setIsResolvingLocation(true)
    setLocationResolutionError('')
    try {
      const resolved = await resolveShareLocation({
        latitude: point[0],
        longitude: point[1],
      })
      setListingEditForm((current) => ({
        ...current,
        pickup_location: resolved.pickup_location,
        pickup_latitude: String(resolved.pickup_latitude),
        pickup_longitude: String(resolved.pickup_longitude),
      }))
    } catch (error) {
      setLocationResolutionError(getApiErrorMessage(error, 'Could not resolve map point.'))
    } finally {
      setIsResolvingLocation(false)
    }
  }

  async function handleUseCurrentLocationForListing() {
    if (!navigator.geolocation) {
      setLocationResolutionError('Current location is not available in this browser.')
      return
    }

    setIsResolvingLocation(true)
    setLocationResolutionError('')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setCurrentLocation([lat, lng])
        try {
          const resolved = await resolveShareLocation({ latitude: lat, longitude: lng })
          setListingEditForm((current) => ({
            ...current,
            pickup_location: resolved.pickup_location,
            pickup_latitude: String(resolved.pickup_latitude),
            pickup_longitude: String(resolved.pickup_longitude),
          }))
        } catch {
          setListingEditForm((current) => ({
            ...current,
            pickup_latitude: String(lat),
            pickup_longitude: String(lng),
          }))
        } finally {
          setIsResolvingLocation(false)
        }
      },
      () => {
        setLocationResolutionError('Could not access your current location.')
        setIsResolvingLocation(false)
      },
    )
  }

  async function handleSaveListing(event) {
    event.preventDefault()
    if (!editingListing || isSavingListing) return

    setIsSavingListing(true)
    try {
      const payload = {
        title: listingEditForm.title.trim(),
        description: listingEditForm.description.trim(),
        pickup_location: listingEditForm.pickup_location.trim(),
        quantity_label: listingEditForm.quantity_label.trim(),
        estimated_price: listingEditForm.estimated_price || 0,
      }

      if (listingEditForm.pickup_latitude && listingEditForm.pickup_longitude) {
        payload.pickup_latitude = listingEditForm.pickup_latitude
        payload.pickup_longitude = listingEditForm.pickup_longitude
      }

      const updatedListing = normalizeListing(await updateSharePost(editingListing.id, payload))
      setActiveListings((current) =>
        current.map((listing) =>
          listing.id === updatedListing.id ? updatedListing : listing,
        ),
      )
      setEditingListing(null)
      setListingEditForm(blankListingEditForm)
      toast.success('Listing updated.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not update listing.'))
    } finally {
      setIsSavingListing(false)
    }
  }

  async function handleDeleteListing(listing) {
    if (!listing || deletingListingId) return
    if (!window.confirm(`Delete "${listing.title}" from your active listings?`)) return

    setDeletingListingId(listing.id)
    const removedListing = listing
    setActiveListings((current) => current.filter((item) => item.id !== listing.id))

    try {
      await deleteSharePost(listing.id)
      if (editingListing?.id === listing.id) {
        setEditingListing(null)
        setListingEditForm(blankListingEditForm)
      }
      toast.success('Listing deleted.')
    } catch (error) {
      setActiveListings((current) => [removedListing, ...current])
      toast.error(getApiErrorMessage(error, 'Could not delete listing.'))
    } finally {
      setDeletingListingId(null)
    }
  }

  async function handleSellSubmit(event) {
    event.preventDefault()
    if (isSubmittingPost) return

    setIsSubmittingPost(true)
    try {
      const payload = new FormData()
      payload.append('title', sellForm.title)
      payload.append('description', sellForm.description)
      payload.append('pickup_location', sellForm.pickup_location)
      if (sellForm.pickup_latitude) payload.append('pickup_latitude', sellForm.pickup_latitude)
      if (sellForm.pickup_longitude) payload.append('pickup_longitude', sellForm.pickup_longitude)
      if (selectedSellItem?.id) payload.append('food_item_id', selectedSellItem.id)
      else payload.append('item_name', sellForm.foodItemName || sellForm.title)
      if (verificationFile) payload.append('image_file', verificationFile)
      for (const tag of selectedSellItem?.recipe_uses || []) {
        payload.append('recipe_uses', tag)
      }

      const createdListing = normalizeListing(await createSharePost(payload))
      if (createdListing.status === 'available') {
        setActiveListings((current) => [createdListing, ...current])
      }
      toast.success('Item listed on the marketplace!')
      setSellItem(null)
      setSellForm(blankSellForm)
      setVerificationImage('')
      setVerificationFile(null)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not create share post.'))
    } finally {
      setIsSubmittingPost(false)
    }
  }

  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <div className="marketplace-sticker-pattern" aria-hidden="true">
        {inventoryBackgroundStickers.map((sticker) => (
          <div
            className={`marketplace-sticker marketplace-sticker--${sticker.color} marketplace-sticker--${sticker.shape}`}
            key={`${sticker.label}-${sticker.top}`}
            style={{
              '--sticker-left': sticker.left,
              '--sticker-rotate': sticker.rotate,
              '--sticker-top': sticker.top,
            }}
          >
            {sticker.label}
          </div>
        ))}
      </div>

      <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="mb-4 w-fit rounded-full border border-ink/15 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sticker backdrop-blur">
              your dashboard
            </p>
            <h1 className="max-w-3xl text-6xl font-black uppercase leading-[0.85] md:text-8xl">
              {dashboardName}'s Dashboard
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-ink/75">
              A bright ingredient board for tracking what is fresh, what needs
              attention, and what can become dinner later.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="metric-card bg-phthalo text-white">
              <span>Items</span>
              <strong>{inventoryItems.length}</strong>
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

      <InventoryApprovals />

      <section className="mx-auto max-w-7xl px-5 pt-8 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-moonstone pb-4">
          <div>
            <p className="pantry-label">Marketplace</p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none">
              Your Active Listings
            </h2>
          </div>
          <p className="max-w-xl text-sm font-bold leading-7 text-ink/65">
            Manage your active listings, regardless if they are selling or not. 
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-4 md:px-10">
        <div className="pantry-card grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(13rem,auto)] md:items-end">
          <label className="block">
            <span className="pantry-field-label">Search active listings</span>
            <input
              className="pantry-input py-2.5 text-sm"
              onChange={(event) => setListingSearchTerm(event.target.value)}
              placeholder="Search titles, items, pickup spots..."
              type="search"
              value={listingSearchTerm}
            />
          </label>

          <label className="block">
            <span className="pantry-field-label">Sort listings</span>
            <select
              className="pantry-input py-2.5 text-sm"
              onChange={(event) => setListingSortOption(event.target.value)}
              value={listingSortOption}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A-Z</option>
              <option value="value-high">Value high-low</option>
              <option value="value-low">Value low-high</option>
            </select>
          </label>

          <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/55 md:col-span-2">
            {listingLoadState === 'loading'
              ? 'Loading listings...'
              : `Showing ${filteredActiveListings.length} of ${activeListings.length}`}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-3 px-5 pt-4 md:px-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listingLoadState === 'loading' && (
          <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            Loading your active listings...
          </p>
        )}

        {listingLoadState === 'ready' && filteredActiveListings.map((listing, index) => (
          <article
            className="ingredient-card overflow-hidden"
            key={listing.id}
            style={{ '--tilt': index % 2 === 0 ? '-0.45deg' : '0.45deg' }}
          >
            {listing.food_item.image ? (
              <div className="photo-sheet !p-2">
                <div className="fruit-sticker right-2 top-3 min-h-9 min-w-9 bg-citrus px-2 text-[0.52rem] rotate-6">
                  <span>{listing.food_item.quantity || 'open'}</span>
                </div>
                <img
                  alt={`${listing.food_item.name} active listing`}
                  className="food-item-image !aspect-[5/3] max-h-32"
                  loading="lazy"
                  src={listing.food_item.image}
                />
              </div>
            ) : null}

            <div className={`recipe-card !gap-2 !p-3 ${listing.food_item.image ? '' : 'recipe-card--full'}`}>
              <div className="flex items-start justify-between gap-2 border-b-2 border-moonstone pb-2">
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-tomato">
                    active listing
                  </p>
                  <h3 className="mt-1 text-lg font-black uppercase leading-none">
                    {listing.title}
                  </h3>
                </div>
                <span className="rounded-full border border-ink/15 bg-citrus px-2.5 py-1.5 text-[0.65rem] font-black uppercase text-ink shadow-sticker">
                  {listing.status}
                </span>
              </div>

              <p className="max-h-12 overflow-hidden text-xs font-bold leading-6 text-ink/75">
                {listing.description || 'No description added yet.'}
              </p>

              <dl className="receipt-lines text-[0.68rem]">
                <div>
                  <dt>item</dt>
                  <dd>{listing.food_item.name}</dd>
                </div>
                <div>
                  <dt>pickup</dt>
                  <dd>{listing.pickup_location || 'unset'}</dd>
                </div>
                <div>
                  <dt>posted</dt>
                  <dd>{formatListingDate(listing.created_at)}</dd>
                </div>
                <div>
                  <dt>value</dt>
                  <dd>
                    {listing.food_item.estimated_price !== ''
                      ? `$${Number(listing.food_item.estimated_price || 0).toFixed(2)}`
                      : 'n/a'}
                  </dd>
                </div>
              </dl>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="pantry-button pantry-button--light px-3 py-2 text-xs"
                  onClick={() => openEditListing(listing)}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="pantry-button px-3 py-2 text-xs !border-danger/20 !bg-petal !text-danger"
                  disabled={deletingListingId === listing.id}
                  onClick={() => handleDeleteListing(listing)}
                  type="button"
                >
                  {deletingListingId === listing.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </article>
        ))}

        {listingLoadState === 'ready' && activeListings.length === 0 && (
          <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            You do not have any active listings right now.
          </p>
        )}

        {listingLoadState === 'ready' && activeListings.length > 0 && filteredActiveListings.length === 0 && (
          <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            No active listings match this search.
          </p>
        )}

        {listingLoadState === 'error' && (
          <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-danger sm:col-span-2 lg:col-span-3 xl:col-span-4">
            Could not load your active listings.
          </p>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-8 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-moonstone pb-4">
          <div>
            <p className="pantry-label">Pantry</p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none">
              Your pantry items
            </h2>
          </div>
          <p className="max-w-xl text-sm font-bold leading-7 text-ink/65">
            Search, sort, edit amounts, and share items from your household dashboard.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-4 md:px-10">
        <div className="pantry-card grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(18rem,auto)_auto] lg:items-end">
          <label className="block">
            <span className="pantry-field-label">Search inventory</span>
            <input
              className="pantry-input py-2.5 text-sm"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search names, owners, quantities, ideas..."
              type="search"
              value={searchTerm}
            />
          </label>

          <div>
            <p className="pantry-field-label">Filter status</p>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((filter, index) => (
                <button
                  className={`pantry-filter-button ${
                    activeFilter === filter ? 'pantry-filter-button--active' : ''
                  } px-3 py-2 text-[0.7rem]`}
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
         <Link to="/receipts">
            <button
              className="pantry-button h-fit"
              type="button"
            >
              Upload Receipts
            </button>
         </Link>
         
          <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/55 md:col-span-2 lg:col-span-3">
            {loadState === 'loading'
              ? 'Loading items...'
              : `Showing ${visibleCount} of ${inventoryItems.length}`}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:grid-cols-2 md:px-10 lg:grid-cols-3 xl:grid-cols-4 grid-flow-row-dense">
        {loadState === 'loading' && (
          <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            Loading pantry items...
          </p>
        )}

        {loadState === 'ready' && filteredInventoryItems.map((item, index) =>
          item.image ? (
            <FoodItem
              index={index}
              item={item}
              key={getItemKey(item)}
              onDelete={handleDeleteItem}
              onEditQuantity={openEditQuantity}
              onSell={openSellItem}
            />
          ) : (
            <FoodItemNoImage
              index={index}
              item={item}
              key={getItemKey(item)}
              onDelete={handleDeleteItem}
              onEditQuantity={openEditQuantity}
              onSell={openSellItem}
            />
          ),
        )}

        {loadState === 'ready' && filteredInventoryItems.length === 0 && (
          <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            {inventoryItems.length === 0
              ? 'No pantry items yet. Upload a receipt to get started.'
              : 'No inventory items match this search.'}
          </p>
        )}
      </section>

      {editingListing && (
        <div className="market-modal" role="dialog" aria-modal="true">
          <button
            aria-label="Close edit listing form"
            className="market-modal__scrim"
            onClick={() => setEditingListing(null)}
            type="button"
          />

          <form
            className="market-modal__panel pantry-card grid gap-4"
            onSubmit={handleSaveListing}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="pantry-label">edit listing</p>
                <h2 className="mt-2 text-4xl font-black uppercase leading-none">
                  {editingListing.food_item?.name || editingListing.title}
                </h2>
              </div>
              <button
                className="pantry-filter-button shrink-0"
                onClick={() => setEditingListing(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <label className="block">
              <span className="pantry-field-label">Title</span>
              <input
                className="pantry-input"
                onChange={(event) => updateListingEditForm('title', event.target.value)}
                required
                type="text"
                value={listingEditForm.title}
              />
            </label>

            <label className="block">
              <span className="pantry-field-label">Description</span>
              <textarea
                className="pantry-input min-h-28 resize-y"
                onChange={(event) => updateListingEditForm('description', event.target.value)}
                required
                value={listingEditForm.description}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="pantry-field-label">Quantity</span>
                <input
                  className="pantry-input"
                  onChange={(event) => updateListingEditForm('quantity_label', event.target.value)}
                  type="text"
                  value={listingEditForm.quantity_label}
                />
              </label>

              <label className="block">
                <span className="pantry-field-label">Estimated value</span>
                <input
                  className="pantry-input"
                  min="0"
                  onChange={(event) => updateListingEditForm('estimated_price', event.target.value)}
                  step="0.01"
                  type="number"
                  value={listingEditForm.estimated_price}
                />
              </label>
            </div>

            <div className="grid gap-4 rounded-2xl border border-ink/15 bg-white/70 p-4">
              <div>
                <p className="pantry-field-label">Pickup location</p>
                <p className="text-sm font-bold leading-7 text-ink/70">
                  Update the address, use your current location, or click the map.
                </p>
              </div>

              <LocationPickerMap
                currentLocation={currentLocation}
                onPickPoint={handleSelectListingMapPoint}
                selectedPoint={selectedListingPickupPoint}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  className="pantry-button pantry-button--accent"
                  onClick={handleUseCurrentLocationForListing}
                  type="button"
                >
                  {isResolvingLocation ? 'Resolving location...' : 'Use my current location'}
                </button>
                <button
                  className="pantry-button pantry-button--light"
                  onClick={handleResolveListingAddress}
                  type="button"
                >
                  Find typed address
                </button>
              </div>

              <label className="block">
                <span className="pantry-field-label">Pickup address</span>
                <input
                  className="pantry-input"
                  onChange={(event) => updateListingEditForm('pickup_location', event.target.value)}
                  required
                  type="text"
                  value={listingEditForm.pickup_location}
                />
              </label>

              <div className="market-location-picker__meta">
                <div>
                  <span>Selected point</span>
                  <strong>
                    {listingEditForm.pickup_latitude && listingEditForm.pickup_longitude
                      ? `${Number(listingEditForm.pickup_latitude).toFixed(5)}, ${Number(listingEditForm.pickup_longitude).toFixed(5)}`
                      : 'No coordinates yet'}
                  </strong>
                </div>
                <div>
                  <span>Listing status</span>
                  <strong>{editingListing.status || 'available'}</strong>
                </div>
              </div>

              {locationResolutionError && (
                <p className="market-location-picker__error">{locationResolutionError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                className="pantry-button !border-danger/20 !bg-petal !text-danger"
                disabled={deletingListingId === editingListing.id}
                onClick={() => handleDeleteListing(editingListing)}
                type="button"
              >
                {deletingListingId === editingListing.id ? 'Deleting...' : 'Delete'}
              </button>
              <button className="pantry-button" disabled={isSavingListing} type="submit">
                {isSavingListing ? 'Saving...' : 'Save listing'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingItem && (
        <div className="market-modal" role="dialog" aria-modal="true">
          <button
            aria-label="Close edit amount form"
            className="market-modal__scrim"
            onClick={() => setEditingItem(null)}
            type="button"
          />

          <form
            className="market-modal__panel pantry-card grid gap-4"
            onSubmit={handleEditQuantity}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="pantry-label">edit amount</p>
                <h2 className="mt-2 text-4xl font-black uppercase leading-none">
                  {editingItem.name}
                </h2>
              </div>
              <button
                className="pantry-filter-button shrink-0"
                onClick={() => setEditingItem(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <label className="block">
              <span className="pantry-field-label">Quantity</span>
              <input
                className="pantry-input"
                onChange={(event) => setEditedQuantity(event.target.value)}
                required
                type="text"
                value={editedQuantity}
              />
            </label>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                className="pantry-button !bg-petal !text-danger !border-danger/20"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete ${editingItem.name}?`)) {
                    handleDeleteItem(editingItem)
                    setEditingItem(null)
                    setEditedQuantity('')
                  }
                }}
                type="button"
              >
                Delete
              </button>
              <button className="pantry-button" type="submit">
                Save amount
              </button>
            </div>
          </form>
        </div>
      )}

      {sellItem && selectedSellItem && (
        <SharePostModal
          currentLocation={currentLocation}
          foodItems={sellFoodItems}
          form={sellForm}
          isResolvingLocation={isResolvingLocation}
          isSubmitting={isSubmittingPost}
          locationResolutionError={locationResolutionError}
          onClose={() => setSellItem(null)}
          onImageUpload={handleSellImageUpload}
          onResolveTypedAddress={handleResolveTypedAddress}
          onSelectMapPoint={handleSelectMapPoint}
          onSubmit={handleSellSubmit}
          onUpdateForm={updateSellForm}
          onUseCurrentLocationForPost={handleUseCurrentLocationForPost}
          reverifiedFoodItem={reverifiedFoodItem}
          selectedInventoryItem={selectedSellItem}
          selectedPickupPoint={selectedPickupPoint}
        />
      )}
    </main>
  )
}
