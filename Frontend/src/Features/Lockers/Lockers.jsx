import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

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

export default function Lockers() {
  const { user, isAuthed, status: authStatus, refreshUser } = useAuth()
  const credits = user?.credits_balance ?? 0

  const [sites, setSites] = useState([])
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [sitesState, setSitesState] = useState('loading')

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
            <h1 className="text-3xl font-black uppercase">Lockers</h1>
            <p className="mt-2 text-sm font-bold text-ink/70">
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

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-sticker">
            <h2 className="text-lg font-black uppercase">Available listings</h2>
            <p className="mt-2 text-sm font-bold text-ink/60">
              {feedState === 'loading' ? 'Loading…' : `${feedListings.length} items`}
            </p>

            <div className="mt-4 grid gap-3">
              {feedListings.map((listing) => (
                <div key={listing.id} className="rounded-2xl border border-ink/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black">{listing.item_name}</p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-ink/60">
                        {listing.storage_type} • {listing.compartment_label}
                      </p>
                    </div>
                    <p className="text-sm font-black">${formatMoney(listing.price)}</p>
                  </div>
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
                </div>
              ))}
              {feedListings.length === 0 && feedState !== 'loading' ? (
                <p className="text-sm font-bold text-ink/60">No available locker listings at this site.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-sticker">
            <h2 className="text-lg font-black uppercase">My locker activity</h2>
            <p className="mt-2 text-sm font-bold text-ink/60">
              {myState === 'loading' ? 'Loading…' : `${myListings.length} records`}
            </p>

            <div className="mt-4 grid gap-3">
              {myListings.map((listing) => {
                const localPickupCode = pickupCodes[listing.id] || listing.pickup_code || ''
                const needsPickup = listing.is_buyer && listing.status === 'sold'
                const showDropoff = listing.is_seller && listing.status === 'reserved'
                return (
                  <div key={listing.id} className="rounded-2xl border border-ink/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">{listing.item_name}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-ink/60">
                          {listing.status.replace('_', ' ')} • {listing.storage_type} • {listing.compartment_label}
                        </p>
                      </div>
                      <p className="text-sm font-black">${formatMoney(listing.price)}</p>
                    </div>

                    {showDropoff ? (
                      <p className="mt-2 text-sm font-bold text-ink/70">
                        Dropoff code: <span className="font-black">{listing.dropoff_code}</span>
                      </p>
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

              {myListings.length === 0 && myState !== 'loading' ? (
                <p className="text-sm font-bold text-ink/60">No locker activity yet.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
