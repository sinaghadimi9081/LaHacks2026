import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { toast } from 'react-toastify'

import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../Auth/useAuth.jsx'
import {
  approveShareRequest,
  claimSharePost,
  declineShareRequest,
  fetchIncomingShareRequests,
  fetchShareFeed,
} from '../../Utils/shareApi.jsx'
import { getLocationErrorMessage, requestBrowserLocation } from './marketplaceLocation.js'
import './marketplaceMapLab.css'

const MAP_CENTER = [34.0835, -118.257]
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const statusStyles = {
  available: {
    badge: 'bg-citrus text-ink',
    circle: '#2f7d4f',
    fill: '#9fcfb2',
  },
  pending: {
    badge: 'bg-feed-soft text-danger',
    circle: '#c48a43',
    fill: '#f0d7ab',
  },
  matched: {
    badge: 'bg-phthalo text-white',
    circle: '#174733',
    fill: '#7cc7b5',
  },
}

function getClaimName(user) {
  return user?.display_name || user?.username || user?.email || 'Neighbor'
}

function formatDateTime(value) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatPostedDate(value) {
  if (!value) return ''
  const dateStr = value.includes('T') ? value : `${value}T12:00:00`
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(dateStr),
  )
}

function isExactLocationVisible(post) {
  return post.status === 'matched' && post.exact_location?.point != null
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function getDistanceMiles(fromPoint, toPoint) {
  if (!fromPoint || !toPoint) return null
  const earthRadiusMiles = 3958.8
  const [fromLat, fromLng] = fromPoint
  const [toLat, toLng] = toPoint
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const latA = toRadians(fromLat)
  const latB = toRadians(toLat)
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) ** 2
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function formatDistanceMiles(distanceMiles) {
  if (distanceMiles == null) return 'Unknown'
  if (distanceMiles < 0.2) return '< 0.2 mi'
  return `${distanceMiles.toFixed(1)} mi`
}

function formatAccuracyMeters(accuracy) {
  if (typeof accuracy !== 'number' || Number.isNaN(accuracy)) return 'Unknown'
  return `${Math.round(accuracy)} m`
}

function normalizeMapPost(post) {
  const publicLat = post.public_pickup_latitude != null
    ? parseFloat(post.public_pickup_latitude)
    : null
  const publicLng = post.public_pickup_longitude != null
    ? parseFloat(post.public_pickup_longitude)
    : null
  const exactLat =
    post.exact_location_visible && post.pickup_latitude != null
      ? parseFloat(post.pickup_latitude)
      : null
  const exactLng =
    post.exact_location_visible && post.pickup_longitude != null
      ? parseFloat(post.pickup_longitude)
      : null
  const mapStatus = post.status === 'claimed' ? 'matched' : post.status

  return {
    id: post.id,
    title: post.title || 'Untitled',
    description: post.description || '',
    owner_name:
      post.owner?.full_name || post.owner?.display_name || post.owner?.username || 'Neighbor',
    neighborhood_name: post.public_pickup_location || 'Local area',
    neighborhood_hint: post.public_pickup_location
      ? `Pickup area: ${post.public_pickup_location}`
      : 'Approximate neighborhood',
    public_center: publicLat != null && publicLng != null ? [publicLat, publicLng] : null,
    public_radius_meters: 500,
    exact_location: {
      point: exactLat != null && exactLng != null ? [exactLat, exactLng] : null,
      address: post.exact_location_visible ? post.pickup_location || '' : '',
      pickup_notes: post.description || '',
    },
    food_item: {
      name: post.food_item?.name || post.item_name || post.title,
      image: post.food_item?.image || '',
    },
    status: mapStatus,
    claimed_by: post.claimed_by || '',
    requested_at:
      mapStatus === 'pending' ? post.updated_at || null : null,
    matched_at: mapStatus === 'matched' ? post.updated_at || null : null,
    created_at: post.created_at ? post.created_at.split('T')[0] : '',
    is_owner: post.is_owner || false,
    viewer_request_status: post.viewer_request_status || null,
  }
}

function MapViewportController({ focusPoint }) {
  const map = useMap()

  useEffect(() => {
    if (!focusPoint) return
    map.setView(focusPoint, 12, { animate: true, duration: 0.8 })
  }, [focusPoint, map])

  return null
}

export default function MarketplaceMapLab() {
  const { user, isAuthed, status: authStatus } = useAuth()
  const [posts, setPosts] = useState([])
  const [pendingRequestsByPostId, setPendingRequestsByPostId] = useState({})
  const [feedState, setFeedState] = useState('loading')
  const [selectedPostId, setSelectedPostId] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationState, setLocationState] = useState('idle')
  const [locationError, setLocationError] = useState('')
  const [locationPermission, setLocationPermission] = useState('unknown')
  const [locationMeta, setLocationMeta] = useState({
    accuracy: null,
    latitude: null,
    longitude: null,
    timestamp: null,
  })

  const loadFeed = useCallback(async () => {
    if (!isAuthed) return
    setFeedState('loading')
    try {
      const response = await fetchShareFeed()
      const normalized = (response.posts || [])
        .map(normalizeMapPost)
        .filter((p) => p.public_center != null)
      setPosts(normalized)
      setSelectedPostId((prev) => {
        if (normalized.some((p) => p.id === prev)) return prev
        return normalized[0]?.id ?? null
      })
      setFeedState('ready')
    } catch {
      setFeedState('error')
    }
  }, [isAuthed])

  const loadIncomingRequests = useCallback(async () => {
    if (!isAuthed) return
    try {
      const response = await fetchIncomingShareRequests({ status: 'pending' })
      const map = {}
      for (const req of response.requests || []) {
        if (req.post?.id) map[req.post.id] = req.id
      }
      setPendingRequestsByPostId(map)
    } catch {
      // Non-critical
    }
  }, [isAuthed])

  useEffect(() => {
    if (authStatus !== 'ready') return
    loadFeed()
    loadIncomingRequests()
  }, [authStatus, loadFeed, loadIncomingRequests])

  useEffect(() => {
    let permissionStatus = null
    async function read() {
      if (!navigator.permissions?.query) return
      try {
        permissionStatus = await navigator.permissions.query({ name: 'geolocation' })
        setLocationPermission(permissionStatus.state)
        permissionStatus.onchange = () => setLocationPermission(permissionStatus.state)
      } catch {
        setLocationPermission('unknown')
      }
    }
    read()
    return () => {
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [])

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) || posts[0] || null,
    [posts, selectedPostId],
  )
  const pendingPosts = useMemo(() => posts.filter((p) => p.status === 'pending'), [posts])
  const matchedPosts = useMemo(() => posts.filter((p) => p.status === 'matched'), [posts])
  const postsWithDistance = useMemo(
    () =>
      posts.map((post) => ({
        ...post,
        distance_miles: getDistanceMiles(userLocation, post.public_center),
      })),
    [posts, userLocation],
  )
  const sortedPosts = useMemo(
    () =>
      [...postsWithDistance].sort((a, b) => {
        if (a.distance_miles == null && b.distance_miles == null) return a.id - b.id
        if (a.distance_miles == null) return 1
        if (b.distance_miles == null) return -1
        return a.distance_miles - b.distance_miles
      }),
    [postsWithDistance],
  )
  const nearestPosts = sortedPosts.slice(0, 3)
  const selectedDistanceMiles = getDistanceMiles(userLocation, selectedPost?.public_center)

  function requestCurrentLocation() {
    setLocationState('loading')
    setLocationError('')
    requestBrowserLocation()
      .then((location) => {
        setUserLocation(location.point)
        setLocationMeta({
          accuracy: location.accuracy,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: location.timestamp,
        })
        setLocationState('granted')
      })
      .catch((error) => {
        setLocationState('error')
        setLocationError(getLocationErrorMessage(error))
      })
  }

  async function requestMatch(postId) {
    const claimant = getClaimName(user)
    setPosts((current) =>
      current.map((p) =>
        p.id === postId && p.status === 'available'
          ? { ...p, status: 'pending', claimed_by: claimant, requested_at: new Date().toISOString() }
          : p,
      ),
    )
    setSelectedPostId(postId)

    try {
      await claimSharePost(postId)
      await Promise.all([loadFeed(), loadIncomingRequests()])
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not request this item.')
      await loadFeed()
    }
  }

  async function approveMatch(postId) {
    const requestId = pendingRequestsByPostId[postId]
    if (!requestId) {
      toast.error('Could not find the pending request to approve.')
      return
    }

    setPosts((current) =>
      current.map((p) =>
        p.id === postId && p.status === 'pending'
          ? { ...p, status: 'matched', matched_at: new Date().toISOString() }
          : p,
      ),
    )
    setSelectedPostId(postId)

    try {
      await approveShareRequest(requestId)
      await Promise.all([loadFeed(), loadIncomingRequests()])
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not approve request.')
      await loadFeed()
    }
  }

  async function declineMatch(postId) {
    const requestId = pendingRequestsByPostId[postId]
    if (!requestId) {
      toast.error('Could not find the pending request to decline.')
      return
    }

    setPosts((current) =>
      current.map((p) =>
        p.id === postId && p.status === 'pending'
          ? { ...p, status: 'available', claimed_by: '', requested_at: null, matched_at: null }
          : p,
      ),
    )

    try {
      await declineShareRequest(requestId)
      await Promise.all([loadFeed(), loadIncomingRequests()])
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not decline request.')
      await loadFeed()
    }
  }

  function refreshAll() {
    loadFeed()
    loadIncomingRequests()
    setUserLocation(null)
    setLocationState('idle')
    setLocationError('')
    setLocationMeta({ accuracy: null, latitude: null, longitude: null, timestamp: null })
  }

  const mapCenter =
    selectedPost?.public_center || (posts[0]?.public_center ?? MAP_CENTER)

  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="mb-4 w-fit rounded-full border border-ink/15 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sticker backdrop-blur">
              privacy-first marketplace
            </p>
            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.88] md:text-7xl">
              Neighborhood map, exact address after match
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-bold leading-8 text-ink/75">
              OpenStreetMap shows only a broad pickup neighborhood in public. The exact
              street-level pickup point stays hidden until the owner approves a match request.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="metric-card bg-phthalo text-white">
              <span>Listings</span>
              <strong>{posts.length}</strong>
            </div>
            <div className="metric-card bg-citrus text-ink">
              <span>Pending</span>
              <strong>{pendingPosts.length}</strong>
            </div>
            <div className="metric-card bg-white text-ink">
              <span>Matched</span>
              <strong>{matchedPosts.length}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:px-10 xl:grid-cols-[1.35fr_0.95fr]">
        <article className="pantry-card market-map-panel">
          <div className="market-map-panel__header">
            <div>
              <p className="pantry-label">OpenStreetMap preview</p>
              <h2 className="mt-2 text-4xl font-black uppercase leading-none">
                Public neighborhood view
              </h2>
            </div>
            <button className="pantry-button pantry-button--light" onClick={refreshAll} type="button">
              Refresh
            </button>
          </div>

          <div className="market-map-notice">
            <strong>Public map rule:</strong> everyone sees the neighborhood area. Only matched
            posts reveal the exact pickup pin and address.
          </div>

          <div className="market-map-location-bar">
            <div>
              <p className="pantry-label">Nearby mode</p>
              <p className="market-map-location-bar__copy">
                Use the browser&apos;s current location to rank listings by distance from you.
              </p>
            </div>

            <div className="market-map-location-bar__actions">
              <div className="market-map-location-bar__buttons">
                <button
                  className="pantry-button pantry-button--accent"
                  onClick={requestCurrentLocation}
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
                <span>Permission state: {locationPermission}</span>
                {userLocation && (
                  <>
                    <span>Location active. Showing nearby listings around your position.</span>
                    <span>
                      Accuracy: {formatAccuracyMeters(locationMeta.accuracy)} at{' '}
                      {locationMeta.latitude?.toFixed(5)}, {locationMeta.longitude?.toFixed(5)}
                    </span>
                  </>
                )}
                {!userLocation && locationState !== 'error' && (
                  <span>Current location is optional.</span>
                )}
                {locationError && <span>{locationError}</span>}
              </div>
            </div>
          </div>

          {feedState === 'loading' && (
            <p className="py-8 text-center text-sm font-black uppercase tracking-[0.14em] text-ink/60">
              Loading listings...
            </p>
          )}

          {feedState === 'ready' && posts.length === 0 && (
            <p className="py-8 text-center text-sm font-black uppercase tracking-[0.14em] text-ink/60">
              No listings with location data found.
            </p>
          )}

          {feedState === 'ready' && posts.length > 0 && (
            <MapContainer
              center={mapCenter}
              className="market-map-canvas"
              scrollWheelZoom
              zoom={12}
            >
              <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
              <MapViewportController
                focusPoint={userLocation || selectedPost?.public_center || mapCenter}
              />

              {posts.map((post) => {
                const isSelected = post.id === selectedPostId
                const style = statusStyles[post.status] || statusStyles.available

                return (
                  <Circle
                    center={post.public_center}
                    eventHandlers={{ click: () => setSelectedPostId(post.id) }}
                    key={`area-${post.id}`}
                    pathOptions={{
                      color: style.circle,
                      fillColor: style.fill,
                      fillOpacity: isSelected ? 0.34 : 0.22,
                      weight: isSelected ? 3 : 2,
                    }}
                    radius={post.public_radius_meters}
                  />
                )
              })}

              {posts.map((post) => {
                const isSelected = post.id === selectedPostId
                const style = statusStyles[post.status] || statusStyles.available

                return (
                  <CircleMarker
                    center={post.public_center}
                    eventHandlers={{ click: () => setSelectedPostId(post.id) }}
                    key={`public-pin-${post.id}`}
                    pathOptions={{
                      color: '#12312a',
                      fillColor: style.circle,
                      fillOpacity: 1,
                      weight: isSelected ? 3 : 2,
                    }}
                    radius={isSelected ? 10 : 8}
                  >
                    <Tooltip
                      className="market-map-tooltip"
                      direction="top"
                      opacity={1}
                      permanent={isSelected}
                    >
                      <div>
                        <strong>{post.neighborhood_name}</strong>
                        <span>{post.title}</span>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )
              })}

              {userLocation && (
                <CircleMarker
                  center={userLocation}
                  pathOptions={{
                    color: '#12312a',
                    fillColor: '#2563eb',
                    fillOpacity: 1,
                    weight: 3,
                  }}
                  radius={9}
                >
                  <Tooltip className="market-map-tooltip" direction="top" opacity={1} permanent>
                    <div>
                      <strong>Your location</strong>
                      <span>Used only to rank nearby listings.</span>
                    </div>
                  </Tooltip>
                </CircleMarker>
              )}

              {posts
                .filter((post) => isExactLocationVisible(post))
                .map((post) => (
                  <Polyline
                    key={`line-${post.id}`}
                    pathOptions={{
                      color: '#12312a',
                      dashArray: '8 8',
                      opacity: 0.75,
                      weight: 2,
                    }}
                    positions={[post.public_center, post.exact_location.point]}
                  />
                ))}

              {posts
                .filter((post) => isExactLocationVisible(post))
                .map((post) => (
                  <CircleMarker
                    center={post.exact_location.point}
                    eventHandlers={{ click: () => setSelectedPostId(post.id) }}
                    key={`exact-pin-${post.id}`}
                    pathOptions={{
                      color: '#7d4a16',
                      fillColor: '#ff785a',
                      fillOpacity: 1,
                      weight: 2,
                    }}
                    radius={7}
                  >
                    <Tooltip className="market-map-tooltip" direction="top" opacity={1}>
                      <div>
                        <strong>Exact pickup unlocked</strong>
                        <span>{post.exact_location.address}</span>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}
            </MapContainer>
          )}

          <div className="market-map-legend">
            <div>
              <span className="market-map-legend__swatch market-map-legend__swatch--public" />
              <p>
                <strong>Neighborhood zone</strong>
                Public shoppers only see this broad area.
              </p>
            </div>
            <div>
              <span className="market-map-legend__swatch market-map-legend__swatch--exact" />
              <p>
                <strong>Exact pickup point</strong>
                Revealed only after owner approval.
              </p>
            </div>
          </div>
        </article>

        <div className="grid gap-6">
          {selectedPost && (
            <article className="pantry-card">
              <div className="flex items-start justify-between gap-4 border-b border-dashed border-ink/20 pb-4">
                <div>
                  <p className="pantry-label">Selected listing</p>
                  <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                    {selectedPost.title}
                  </h2>
                </div>
                <span
                  className={`rounded-full border border-ink/15 px-3 py-1.5 text-xs font-black uppercase shadow-sticker ${(statusStyles[selectedPost.status] || statusStyles.available).badge}`}
                >
                  {selectedPost.status}
                </span>
              </div>

              <div className="market-map-selected">
                {selectedPost.food_item.image ? (
                  <img
                    alt={`${selectedPost.food_item.name} listing`}
                    className="market-map-selected__image"
                    src={selectedPost.food_item.image}
                  />
                ) : (
                  <div className="market-map-selected__image bg-cream grid place-items-center text-4xl">
                    🥬
                  </div>
                )}

                <dl className="receipt-lines">
                  <div>
                    <dt>food</dt>
                    <dd>{selectedPost.food_item.name}</dd>
                  </div>
                  <div>
                    <dt>owner</dt>
                    <dd>{selectedPost.owner_name}</dd>
                  </div>
                  <div>
                    <dt>posted</dt>
                    <dd>{formatPostedDate(selectedPost.created_at)}</dd>
                  </div>
                  <div>
                    <dt>public</dt>
                    <dd>{selectedPost.neighborhood_name}</dd>
                  </div>
                  <div>
                    <dt>distance</dt>
                    <dd>{formatDistanceMiles(selectedDistanceMiles)}</dd>
                  </div>
                  <div>
                    <dt>requestor</dt>
                    <dd>{selectedPost.claimed_by || 'Open'}</dd>
                  </div>
                </dl>
              </div>

              <p className="mt-4 text-sm font-bold leading-7 text-ink/75">
                {selectedPost.description}
              </p>

              <div className="market-map-address-card">
                <p className="pantry-label">Public neighborhood hint</p>
                <p className="text-sm font-bold leading-7 text-ink/75">
                  {selectedPost.neighborhood_hint}
                </p>
              </div>

              <div
                className={`market-map-address-card ${isExactLocationVisible(selectedPost)
                    ? 'market-map-address-card--revealed'
                    : 'market-map-address-card--locked'
                  }`}
              >
                <p className="pantry-label">
                  {isExactLocationVisible(selectedPost)
                    ? 'Exact pickup unlocked'
                    : 'Exact pickup hidden until match'}
                </p>
                {isExactLocationVisible(selectedPost) ? (
                  <>
                    <strong>{selectedPost.exact_location.address}</strong>
                    <p>{selectedPost.exact_location.pickup_notes}</p>
                    <p className="market-map-address-card__meta">
                      Matched {formatDateTime(selectedPost.matched_at)}
                    </p>
                  </>
                ) : (
                  <>
                    <strong>Neighborhood only</strong>
                    <p>
                      The exact street-level address stays hidden until the owner approves the
                      request.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {selectedPost.status === 'available' && !selectedPost.is_owner && (
                  <button
                    className="pantry-button"
                    onClick={() => requestMatch(selectedPost.id)}
                    type="button"
                  >
                    Request match
                  </button>
                )}

                {selectedPost.status === 'available' && selectedPost.is_owner && (
                  <button className="pantry-button pantry-button--light" disabled type="button">
                    Your listing
                  </button>
                )}

                {selectedPost.status === 'pending' && (
                  <button className="pantry-button pantry-button--accent" disabled type="button">
                    Waiting for owner approval
                  </button>
                )}

                {selectedPost.status === 'matched' && (
                  <button className="pantry-button pantry-button--accent" disabled type="button">
                    Exact location unlocked
                  </button>
                )}
              </div>
            </article>
          )}

          <aside className="pantry-card">
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-ink/20 pb-4">
              <div>
                <p className="pantry-label">Owner approval panel</p>
                <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                  Match queue
                </h2>
              </div>
              <span className="grid h-12 min-w-12 place-items-center rounded-full border border-ink/15 bg-white text-lg font-black shadow-sticker">
                {pendingPosts.length}
              </span>
            </div>

            <p className="mt-4 text-sm font-bold leading-7 text-ink/75">
              Pending requests on listings you own. Approve to reveal the exact pickup address to
              the requester.
            </p>

            <div className="market-map-queue">
              {pendingPosts.filter((p) => p.is_owner).length === 0 ? (
                <div className="market-map-queue__empty">
                  No pending requests on your listings.
                </div>
              ) : (
                pendingPosts
                  .filter((p) => p.is_owner)
                  .map((post) => (
                    <article className="market-map-request" key={post.id}>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-tomato">
                          {post.neighborhood_name}
                        </p>
                        <h3 className="mt-1 text-lg font-black uppercase leading-none">
                          {post.title}
                        </h3>
                        <p className="mt-2 text-sm font-bold text-ink/70">
                          Requested by {post.claimed_by} on {formatDateTime(post.requested_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          className="pantry-button"
                          onClick={() => approveMatch(post.id)}
                          type="button"
                        >
                          Approve reveal
                        </button>
                        <button
                          className="pantry-button pantry-button--light"
                          onClick={() => declineMatch(post.id)}
                          type="button"
                        >
                          Decline
                        </button>
                      </div>
                    </article>
                  ))
              )}
            </div>

            {matchedPosts.length > 0 && (
              <div className="market-map-matched">
                <p className="pantry-label">Approved matches</p>
                <div className="grid gap-3">
                  {matchedPosts.map((post) => (
                    <button
                      className="market-map-matched__item"
                      key={post.id}
                      onClick={() => setSelectedPostId(post.id)}
                      type="button"
                    >
                      <strong>{post.title}</strong>
                      <span>{post.exact_location.address || post.neighborhood_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-10 md:px-10">
        <div className="market-map-nearby-strip">
          <div>
            <p className="pantry-label">Nearby suggestions</p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none">
              Closest public zones
            </h2>
          </div>

          <div className="market-map-nearby-strip__cards">
            {nearestPosts.map((post) => (
              <button
                className="market-map-nearby-strip__card"
                key={`nearby-${post.id}`}
                onClick={() => setSelectedPostId(post.id)}
                type="button"
              >
                <strong>{post.title}</strong>
                <span>{post.neighborhood_name}</span>
                <em>{formatDistanceMiles(post.distance_miles)}</em>
              </button>
            ))}
            {nearestPosts.length === 0 && feedState === 'ready' && (
              <p className="text-sm font-bold text-ink/60">No listings to show.</p>
            )}
          </div>
        </div>

        <div className="mb-5">
          <p className="pantry-label">Listing cards</p>
          <h2 className="mt-2 text-4xl font-black uppercase leading-none">
            Live feed
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {sortedPosts.map((post) => (
            <article
              className={`pantry-card market-map-post ${post.id === selectedPostId ? 'market-map-post--selected' : ''
                }`}
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
            >
              {post.food_item.image ? (
                <img
                  alt={`${post.food_item.name} listing`}
                  className="market-map-post__image"
                  src={post.food_item.image}
                />
              ) : (
                <div className="market-map-post__image bg-cream grid place-items-center text-4xl">
                  🥬
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-tomato">
                    {post.food_item.name}
                  </p>
                  <h3 className="mt-1 text-2xl font-black uppercase leading-none">
                    {post.title}
                  </h3>
                </div>
                <span
                  className={`rounded-full border border-ink/15 px-2.5 py-1 text-[0.65rem] font-black uppercase shadow-sticker ${(statusStyles[post.status] || statusStyles.available).badge}`}
                >
                  {post.status}
                </span>
              </div>

              <p className="text-sm font-bold leading-7 text-ink/75">
                {post.neighborhood_name} only in public view.
              </p>

              <div className="market-map-post__footer">
                <div>
                  <span>Owner</span>
                  <strong>{post.owner_name}</strong>
                </div>
                <div>
                  <span>Distance</span>
                  <strong>{formatDistanceMiles(post.distance_miles)}</strong>
                </div>
              </div>

              {post.status === 'available' && !post.is_owner && (
                <button
                  className="pantry-button w-full"
                  onClick={(e) => { e.stopPropagation(); requestMatch(post.id) }}
                  type="button"
                >
                  Request match
                </button>
              )}

              {post.status === 'available' && post.is_owner && (
                <button className="pantry-button pantry-button--light w-full" disabled type="button">
                  Your listing
                </button>
              )}

              {post.status === 'pending' && (
                <button className="pantry-button pantry-button--accent w-full" disabled type="button">
                  Pending approval
                </button>
              )}

              {post.status === 'matched' && (
                <button
                  className="pantry-button pantry-button--light w-full"
                  onClick={(e) => { e.stopPropagation(); setSelectedPostId(post.id) }}
                  type="button"
                >
                  View exact pickup
                </button>
              )}
            </article>
          ))}

          {feedState === 'ready' && sortedPosts.length === 0 && (
            <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 md:col-span-2 xl:col-span-4">
              No listings available on the marketplace yet.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
