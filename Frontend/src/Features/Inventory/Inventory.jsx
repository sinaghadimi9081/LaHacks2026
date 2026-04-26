import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'
import { fetchItems, updateItem, deleteItem } from '../../Utils/itemsApi.jsx'
import { createSharePost, resolveShareLocation } from '../../Utils/shareApi.jsx'
import FoodItem from './components/FoodItem.jsx'
import FoodItemNoImage from './components/FoodItemNoImage.jsx'
import InventoryApprovals from './components/InventoryApprovals.jsx'
import { foodItems, pantryNotes } from './inventoryData.js'
import SharePostModal from '../Marketplace/components/SharePostModal.jsx'

const filterOptions = ['all', 'fresh', 'use soon', 'feed today', 'critical']

const blankSellForm = {
  foodItemName: '',
  title: '',
  description: '',
  pickup_location: '',
  pickup_latitude: '',
  pickup_longitude: '',
}

function getItemKey(item) {
  return item.id || `${item.name}-${item.created_at || item.expiration_date}`
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

  const totalValue = inventoryItems.reduce(
    (sum, item) => sum + Number(item.estimated_price || 0),
    0,
  )
  const soonCount = inventoryItems.filter((item) => item.status !== 'fresh').length
  const normalizedSearch = searchTerm.trim().toLowerCase()

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
  const visibleCount = filteredInventoryItems.length

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

      await createSharePost(payload)
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

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-8 md:px-10">
        <div className="pantry-card grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
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

          <button
            className="pantry-button h-fit"
            type="button"
          >
            Add items
          </button>

          <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/55 lg:col-span-3">
            {loadState === 'loading'
              ? 'Loading items...'
              : `Showing ${visibleCount} of ${inventoryItems.length}`}
          </p>
        </div>
      </section>

      <InventoryApprovals />

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
