import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../Auth/useAuth.jsx'
import { fetchItems } from '../../Utils/itemsApi.jsx'
import {
  buyLockerListing,
  confirmLockerDropoff,
  confirmLockerPickup,
  fetchLockerFeed,
  fetchLockerSites,
  fetchMyLockerListings,
  reserveLockerListing,
} from '../../Utils/lockersApi.jsx'
import LockersSiteMap from './components/LockersSiteMap.jsx'
import {
  formatDistanceMiles,
  formatLocationAccuracy,
  getDistanceMiles,
  getLocationErrorMessage,
  requestBrowserLocation,
  toCoordinateNumber,
} from '../Marketplace/marketplaceLocation.js'
import '../Marketplace/marketplaceMapLab.css'

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

function formatMoney(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toFixed(2) : '0.00'
}

function getSitePoint(site) {
  const latitude = toCoordinateNumber(site?.latitude)
  const longitude = toCoordinateNumber(site?.longitude)
  if (latitude == null || longitude == null) return null
  return [latitude, longitude]
}

export default function Lockers() {
  const { user, isAuthed, status: authStatus, refreshUser } = useAuth()
  const credits = user?.credits_balance ?? 0

  const [sites, setSites] = useState([])
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [sitesState, setSitesState] = useState('loading')
  const [locationState, setLocationState] = useState('idle')
  const [locationError, setLocationError] = useState('')
  const [locationMeta, setLocationMeta] = useState({})
  const [userLocation, setUserLocation] = useState(null)
  const [didAutoSelectClosest, setDidAutoSelectClosest] = useState(false)

  const [inventoryItems, setInventoryItems] = useState([])
  const [selectedFoodItemId, setSelectedFoodItemId] = useState('')

  const [feedListings, setFeedListings] = useState([])
  const [feedState, setFeedState] = useState('idle')

  const [myListings, setMyListings] = useState([])
  const [myState, setMyState] = useState('idle')

  const [reservedListing, setReservedListing] = useState(null)
  const [dropoffCode, setDropoffCode] = useState('')
  const [pickupCodes, setPickupCodes] = useState({})
  const [busyAction, setBusyAction] = useState('')

  const closestSite = useMemo(() => {
    if (!userLocation || sites.length === 0) return null

    let best = null
    for (const site of sites) {
      const point = getSitePoint(site)
      if (!point) continue
      const distance = getDistanceMiles(userLocation, point)
      if (distance == null) continue
      if (!best || distance < best.distance) {
        best = { site, distance }
      }
    }
    return best
  }, [sites, userLocation])

  const selectedFoodItem = useMemo(
    () => inventoryItems.find((it) => String(it.id) === String(selectedFoodItemId)) || null,
    [inventoryItems, selectedFoodItemId],
  )

  async function loadMyListings() {
    setMyState('loading')
    try {
      const response = await fetchMyLockerListings()
      setMyListings(response.listings || [])
      setMyState('ready')
    } catch (error) {
      setMyState('error')
      toast.error(getApiErrorMessage(error, 'Could not load your locker activity.'))
    }
  }

  async function loadFeed(siteId) {
    if (!siteId) return
    setFeedState('loading')
    try {
      const response = await fetchLockerFeed({ site_id: siteId })
      setFeedListings(response.listings || [])
      setFeedState('ready')
    } catch (error) {
      setFeedState('error')
      toast.error(getApiErrorMessage(error, 'Could not load locker listings.'))
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadSitesAndInventory() {
      if (!isAuthed) return
      setSitesState('loading')
      try {
        const [sitesResponse, itemsResponse] = await Promise.all([fetchLockerSites(), fetchItems()])
        if (cancelled) return
        const loadedSites = sitesResponse.sites || []
        setSites(loadedSites)
        const firstSite = loadedSites[0]?.id ? String(loadedSites[0].id) : ''
        setSelectedSiteId((current) => current || firstSite)

        const items = itemsResponse.items || []
        setInventoryItems(items)
        setSelectedFoodItemId((current) => current || (items[0]?.id ? String(items[0].id) : ''))

        setSitesState('ready')
      } catch (error) {
        if (!cancelled) {
          setSitesState('error')
          toast.error(getApiErrorMessage(error, 'Could not load lockers.'))
        }
      }
    }

    loadSitesAndInventory()
    return () => {
      cancelled = true
    }
  }, [isAuthed])

  useEffect(() => {
    if (!isAuthed || !selectedSiteId) return
    loadFeed(selectedSiteId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, selectedSiteId])

  useEffect(() => {
    if (!closestSite || didAutoSelectClosest) return
    if (!selectedSiteId) {
      setSelectedSiteId(String(closestSite.site.id))
      setDidAutoSelectClosest(true)
      return
    }
    setDidAutoSelectClosest(true)
  }, [closestSite, didAutoSelectClosest, selectedSiteId])

  useEffect(() => {
    if (!isAuthed) return
    loadMyListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed])

  if (authStatus === 'loading') {
    return (
      <main className="marketplace-page min-h-screen overflow-hidden text-ink">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
          <h1 className="text-3xl font-black uppercase">Lockers</h1>
          <p className="mt-3 text-sm font-bold text-ink/70">Loading…</p>
        </div>
      </main>
    )
  }

  if (!isAuthed) {
    return (
      <main className="marketplace-page min-h-screen overflow-hidden text-ink">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
          <h1 className="text-3xl font-black uppercase">Lockers</h1>
          <p className="mt-3 text-sm font-bold text-ink/70">Log in to view the demo locker system.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="dashboard-readable-text text-3xl font-black uppercase z-10">Lockers</h1>
            <p className="dashboard-readable-text mt-2 text-sm font-bold text-ink/70">
              Proof-of-concept public lockers (demo data). Pay with credits.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 shadow-sticker">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/60">Your credits</p>
            <p className="text-2xl font-black">${formatMoney(credits)}</p>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-sticker">
          <h2 className="text-lg font-black uppercase">Reserve a compartment (sell via locker)</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-bold">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-ink/60">Locker site</span>
              <select
                className="rounded-xl border border-ink/15 px-3 py-2"
                disabled={sitesState !== 'ready'}
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
              >
                {sites.map((site) => (
                  <option key={site.id} value={String(site.id)}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-bold">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-ink/60">Inventory item</span>
              <select
                className="rounded-xl border border-ink/15 px-3 py-2"
                value={selectedFoodItemId}
                onChange={(event) => setSelectedFoodItemId(event.target.value)}
              >
                {inventoryItems.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name} (${formatMoney(item.estimated_price)})
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                className="w-full rounded-xl border border-ink/15 bg-citrus px-4 py-2 text-sm font-black uppercase shadow-sticker transition hover:-translate-y-0.5 disabled:opacity-60"
                disabled={
                  busyAction === 'reserve' ||
                  !selectedSiteId ||
                  !selectedFoodItemId ||
                  !selectedFoodItem ||
                  Number(selectedFoodItem.estimated_price || 0) <= 0
                }
                type="button"
                onClick={async () => {
                  setBusyAction('reserve')
                  try {
                    const response = await reserveLockerListing({
                      food_item_id: Number(selectedFoodItemId),
                      site_id: Number(selectedSiteId),
                    })
                    const listing = response.listing
                    setReservedListing(listing)
                    setDropoffCode(listing.dropoff_code || '')
                    toast.success('Locker reserved. Use the dropoff code to load it.')
                    await loadMyListings()
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, 'Could not reserve locker compartment.'))
                  } finally {
                    setBusyAction('')
                  }
                }}
              >
                Reserve
              </button>
            </div>
          </div>

          {reservedListing ? (
            <div className="mt-5 rounded-2xl border border-ink/10 bg-petal/40 p-4">
              <p className="text-sm font-black">
                Reserved: <span className="font-extrabold">{reservedListing.compartment_label}</span> (
                {reservedListing.storage_type})
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-bold">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-ink/60">Dropoff code</span>
                  <input
                    className="rounded-xl border border-ink/15 px-3 py-2"
                    value={dropoffCode}
                    onChange={(event) => setDropoffCode(event.target.value)}
                    placeholder="6 digits"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    className="w-full rounded-xl border border-ink/15 bg-moonstone px-4 py-2 text-sm font-black uppercase shadow-sticker transition hover:-translate-y-0.5 disabled:opacity-60"
                    disabled={busyAction === 'dropoff' || !dropoffCode.trim()}
                    type="button"
                    onClick={async () => {
                      setBusyAction('dropoff')
                      try {
                        const response = await confirmLockerDropoff(reservedListing.id, { dropoff_code: dropoffCode })
                        setReservedListing(response.listing)
                        toast.success('Dropoff confirmed. Your listing is now available to buy.')
                        await Promise.all([loadFeed(selectedSiteId), loadMyListings(), refreshUser?.()])
                      } catch (error) {
                        toast.error(getApiErrorMessage(error, 'Could not confirm dropoff.'))
                      } finally {
                        setBusyAction('')
                      }
                    }}
                  >
                    I dropped it off
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <div className="market-map-location-bar">
            <div>
              <p className="pantry-label">Closest locker</p>
              <p className="market-map-location-bar__copy">
                Enable location to automatically highlight the closest locker site and quickly switch sites.
              </p>
              {closestSite ? (
                <p className="mt-2 text-sm font-bold text-ink/70">
                  Closest: {closestSite.site.name} ({formatDistanceMiles(closestSite.distance)})
                </p>
              ) : null}
            </div>

            <div className="market-map-location-bar__actions">
              <div className="market-map-location-bar__buttons">
                <button
                  className="pantry-button pantry-button--accent"
                  onClick={async () => {
                    setLocationError('')
                    setLocationState('loading')
                    try {
                      const result = await requestBrowserLocation()
                      setUserLocation(result.point)
                      setLocationMeta(result)
                      setLocationState('ready')
                      setDidAutoSelectClosest(false)
                      toast.success('Location enabled.')
                    } catch (error) {
                      setLocationState('error')
                      setLocationError(getLocationErrorMessage(error))
                    }
                  }}
                  type="button"
                >
                  {locationState === 'loading'
                    ? 'Finding your location...'
                    : userLocation
                      ? 'Refresh my location'
                      : 'Use my current location'}
                </button>
              </div>

              <div className="market-map-location-bar__status">
                {userLocation ? (
                  <>
                    <span>
                      Location active at {locationMeta.latitude?.toFixed(5)},{' '}
                      {locationMeta.longitude?.toFixed(5)}
                    </span>
                    <span>
                      Accuracy: {formatLocationAccuracy(locationMeta.accuracy)}
                    </span>
                  </>
                ) : (
                  <span>Distance highlighting activates after location access.</span>
                )}
                {locationError ? <span>{locationError}</span> : null}
              </div>
            </div>
          </div>

          <LockersSiteMap
            sites={sites}
            selectedSiteId={selectedSiteId}
            closestSiteId={closestSite?.site?.id ? String(closestSite.site.id) : ''}
            userLocation={userLocation}
            onSelectSiteId={(siteId) => setSelectedSiteId(String(siteId))}
          />

          <article className="mt-6 rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-sticker">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="pantry-label">Locker sites</p>
                <h2 className="mt-2 text-2xl font-black uppercase leading-none">Pick a locker</h2>
              </div>
              {closestSite ? (
                <p className="text-sm font-bold text-ink/70">
                  Closest: <span className="font-black">{closestSite.site.name}</span> ({formatDistanceMiles(closestSite.distance)})
                </p>
              ) : (
                <p className="text-sm font-bold text-ink/60">Enable location to show closest site.</p>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {sites.map((site) => {
                const isSelected = String(site.id) === String(selectedSiteId)
                const isClosest = closestSite && String(site.id) === String(closestSite.site.id)
                const distance = userLocation ? getDistanceMiles(userLocation, getSitePoint(site)) : null

                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => setSelectedSiteId(String(site.id))}
                    className={[
                      'w-full rounded-2xl border-2 px-4 py-3 text-left shadow-sticker transition',
                      'hover:-translate-y-0.5',
                      isSelected
                        ? 'border-[#ff785a] bg-[#ff785a]/10'
                        : isClosest
                          ? 'border-[#2f7d4f] bg-[#2f7d4f]/10'
                          : 'border-ink/10 bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">{site.name}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-ink/60">
                          {site.address_label || 'Public locker site'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {isSelected ? (
                          <span className="rounded-full bg-[#ff785a] px-2.5 py-1 text-[0.65rem] font-black uppercase text-white">
                            Selected
                          </span>
                        ) : isClosest ? (
                          <span className="rounded-full bg-[#2f7d4f] px-2.5 py-1 text-[0.65rem] font-black uppercase text-white">
                            Closest
                          </span>
                        ) : null}
                        {distance != null ? (
                          <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-ink/60">
                            {formatDistanceMiles(distance)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </article>
        </section>

        <section className="mt-8">
          <div className="rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-sticker">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-black uppercase">My locker activity</h2>
                <p className="mt-2 text-sm font-bold text-ink/60">
                  All items at the selected locker site, including buyable listings.
                </p>
              </div>
              <div className="text-right text-sm font-bold text-ink/60">
                <div>
                  {feedState === 'loading'
                    ? 'Loading listings…'
                    : `${feedListings.length} buyable`}
                </div>
                <div>
                  {myState === 'loading'
                    ? 'Loading yours…'
                    : `${myListings.filter((listing) => String(listing.site) === String(selectedSiteId)).length} yours here`}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {(() => {
                const mineHere = myListings.filter(
                  (listing) => String(listing.site) === String(selectedSiteId),
                )
                const merged = new Map()
                ;[...feedListings, ...mineHere].forEach((listing) => {
                  if (listing?.id != null) merged.set(listing.id, listing)
                })
                const mergedList = Array.from(merged.values())
                mergedList.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
                return mergedList
              })().map((listing) => {
                const localPickupCode = pickupCodes[listing.id] || listing.pickup_code || ''
                const needsPickup = listing.is_buyer && listing.status === 'sold'
                const showDropoff = listing.is_seller && listing.status === 'reserved'
                const isBuyable = listing.status === 'available' && !listing.is_seller

                return (
                  <div
                    key={listing.id}
                    className="rounded-2xl border border-ink/10 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">{listing.item_name}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-ink/60">
                          {listing.status.replace('_', ' ')} • {listing.storage_type} • {listing.compartment_label}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black">${formatMoney(listing.price)}</p>
                        {isBuyable ? (
                          <span className="mt-2 inline-flex rounded-full bg-[#2f7d4f] px-2.5 py-1 text-[0.65rem] font-black uppercase text-white">
                            Buyable
                          </span>
                        ) : listing.is_seller ? (
                          <span className="mt-2 inline-flex rounded-full bg-[#ff785a] px-2.5 py-1 text-[0.65rem] font-black uppercase text-white">
                            Yours
                          </span>
                        ) : listing.is_buyer ? (
                          <span className="mt-2 inline-flex rounded-full bg-moonstone px-2.5 py-1 text-[0.65rem] font-black uppercase text-ink">
                            Bought
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {showDropoff ? (
                      <p className="mt-2 text-sm font-bold text-ink/70">
                        Dropoff code: <span className="font-black">{listing.dropoff_code}</span>
                      </p>
                    ) : null}

                    {isBuyable ? (
                      <button
                        className="mt-3 w-full rounded-xl border border-ink/15 bg-citrus px-4 py-2 text-sm font-black uppercase shadow-sticker transition hover:-translate-y-0.5 disabled:opacity-60"
                        disabled={busyAction === `buy-${listing.id}`}
                        type="button"
                        onClick={async () => {
                          setBusyAction(`buy-${listing.id}`)
                          try {
                            const response = await buyLockerListing(listing.id)
                            const updated = response.listing
                            setPickupCodes((current) => ({ ...current, [updated.id]: updated.pickup_code || '' }))
                            toast.success('Purchased. Your pickup code is ready.')
                            await Promise.all([loadFeed(selectedSiteId), loadMyListings(), refreshUser?.()])
                          } catch (error) {
                            toast.error(getApiErrorMessage(error, 'Could not buy listing.'))
                          } finally {
                            setBusyAction('')
                          }
                        }}
                      >
                        Buy with credits
                      </button>
                    ) : null}

                    {needsPickup ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        <input
                          className="rounded-xl border border-ink/15 px-3 py-2 text-sm font-bold"
                          value={localPickupCode}
                          onChange={(event) =>
                            setPickupCodes((current) => ({ ...current, [listing.id]: event.target.value }))
                          }
                          placeholder="Pickup code"
                        />
                        <button
                          className="rounded-xl border border-ink/15 bg-moonstone px-4 py-2 text-sm font-black uppercase shadow-sticker transition hover:-translate-y-0.5 disabled:opacity-60 md:col-span-2"
                          disabled={busyAction === `pickup-${listing.id}` || !localPickupCode.trim()}
                          type="button"
                          onClick={async () => {
                            setBusyAction(`pickup-${listing.id}`)
                            try {
                              await confirmLockerPickup(listing.id, { pickup_code: localPickupCode })
                              toast.success('Pickup confirmed.')
                              await Promise.all([loadFeed(selectedSiteId), loadMyListings(), refreshUser?.()])
                            } catch (error) {
                              toast.error(getApiErrorMessage(error, 'Could not confirm pickup.'))
                            } finally {
                              setBusyAction('')
                            }
                          }}
                        >
                          Confirm pickup
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}

              {feedState !== 'loading' &&
              myState !== 'loading' &&
              feedListings.length === 0 &&
              myListings.filter((listing) => String(listing.site) === String(selectedSiteId)).length === 0 ? (
                <p className="text-sm font-bold text-ink/60">No listings at this locker site yet.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
