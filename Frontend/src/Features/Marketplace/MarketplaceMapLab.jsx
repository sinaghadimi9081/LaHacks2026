import { useEffect, useMemo, useState } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../Auth/useAuth.jsx'
import { createMarketplaceMapPosts } from './marketplaceMapLabData.js'
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
  return user?.display_name || user?.username || user?.email || 'Demo Neighbor'
}

function formatDateTime(value) {
  if (!value) {
    return 'Not yet'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatPostedDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function isExactLocationVisible(post) {
  return post.status === 'matched'
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function getDistanceMiles(fromPoint, toPoint) {
  if (!fromPoint || !toPoint) {
    return null
  }

  const earthRadiusMiles = 3958.8
  const [fromLat, fromLng] = fromPoint
  const [toLat, toLng] = toPoint
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const latitudeA = toRadians(fromLat)
  const latitudeB = toRadians(toLat)

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2)

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  return earthRadiusMiles * arc
}

function formatDistanceMiles(distanceMiles) {
  if (distanceMiles == null) {
    return 'Unknown'
  }

  if (distanceMiles < 0.2) {
    return '< 0.2 mi'
  }

  return `${distanceMiles.toFixed(1)} mi`
}

function formatAccuracyMeters(accuracy) {
  if (typeof accuracy !== 'number' || Number.isNaN(accuracy)) {
    return 'Unknown'
  }

  return `${Math.round(accuracy)} m`
}

function getLocationErrorMessage(error) {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Location permission was denied in the browser.'
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return (
      error.message ||
      'The browser or operating system could not determine your current location.'
    )
  }

  if (error.code === error.TIMEOUT) {
    return 'Location request timed out.'
  }

  return error.message || 'Could not read current location.'
}

function MapViewportController({ focusPoint }) {
  const map = useMap()

  useEffect(() => {
    if (!focusPoint) {
      return
    }

    map.setView(focusPoint, 12, {
      animate: true,
      duration: 0.8,
    })
  }, [focusPoint, map])

  return null
}

export default function MarketplaceMapLab() {
  const { user } = useAuth()
  const [posts, setPosts] = useState(() => createMarketplaceMapPosts())
  const [selectedPostId, setSelectedPostId] = useState(301)
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

  useEffect(() => {
    let permissionStatus = null

    async function readPermissionState() {
      if (!navigator.permissions?.query) {
        return
      }

      try {
        permissionStatus = await navigator.permissions.query({
          name: 'geolocation',
        })
        setLocationPermission(permissionStatus.state)
        permissionStatus.onchange = () => {
          setLocationPermission(permissionStatus.state)
        }
      } catch {
        setLocationPermission('unknown')
      }
    }

    readPermissionState()

    return () => {
      if (permissionStatus) {
        permissionStatus.onchange = null
      }
    }
  }, [])

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || posts[0],
    [posts, selectedPostId],
  )
  const pendingPosts = useMemo(
    () => posts.filter((post) => post.status === 'pending'),
    [posts],
  )
  const matchedPosts = useMemo(
    () => posts.filter((post) => post.status === 'matched'),
    [posts],
  )
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
      [...postsWithDistance].sort((firstPost, secondPost) => {
        if (firstPost.distance_miles == null && secondPost.distance_miles == null) {
          return firstPost.id - secondPost.id
        }

        if (firstPost.distance_miles == null) {
          return 1
        }

        if (secondPost.distance_miles == null) {
          return -1
        }

        return firstPost.distance_miles - secondPost.distance_miles
      }),
    [postsWithDistance],
  )
  const nearestPosts = sortedPosts.slice(0, 3)
  const selectedDistanceMiles = getDistanceMiles(
    userLocation,
    selectedPost?.public_center,
  )

  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationState('error')
      setLocationError('This browser does not support geolocation.')
      return
    }

    if (!window.isSecureContext) {
      setLocationState('error')
      setLocationError('Location access requires https or localhost.')
      return
    }

    setLocationState('loading')
    setLocationError('')

    let watchId = null
    let settled = false

    function handleSuccess(position) {
      if (settled) {
        return
      }

      settled = true
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
      }

      setUserLocation([position.coords.latitude, position.coords.longitude])
      setLocationMeta({
        accuracy: position.coords.accuracy,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: position.timestamp,
      })
      setLocationState('granted')
    }

    function handleFailure(error) {
      if (settled) {
        return
      }

      settled = true
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
      }

      setLocationState('error')
      setLocationError(getLocationErrorMessage(error))
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        handleSuccess(position)
      },
      (error) => {
        if (error.code === error.POSITION_UNAVAILABLE) {
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            handleFailure,
            {
              enableHighAccuracy: true,
              timeout: 30000,
              maximumAge: 0,
            },
          )
          return
        }

        handleFailure(error)
      },
      {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 0,
      },
    )
  }

  function requestMatch(postId) {
    const claimant = getClaimName(user)

    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId && post.status === 'available'
          ? {
              ...post,
              status: 'pending',
              claimed_by: claimant,
              requested_at: new Date().toISOString(),
            }
          : post,
      ),
    )
    setSelectedPostId(postId)
  }

  function approveMatch(postId) {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId && post.status === 'pending'
          ? {
              ...post,
              status: 'matched',
              matched_at: new Date().toISOString(),
            }
          : post,
      ),
    )
    setSelectedPostId(postId)
  }

  function declineMatch(postId) {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId && post.status === 'pending'
          ? {
              ...post,
              status: 'available',
              claimed_by: '',
              requested_at: '',
              matched_at: '',
            }
          : post,
      ),
    )
  }

  function resetLab() {
    setPosts(createMarketplaceMapPosts())
    setSelectedPostId(301)
    setUserLocation(null)
    setLocationState('idle')
    setLocationError('')
    setLocationMeta({
      accuracy: null,
      latitude: null,
      longitude: null,
      timestamp: null,
    })
  }

  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="mb-4 w-fit rounded-full border border-ink/15 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sticker backdrop-blur">
              privacy-first marketplace prototype
            </p>
            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.88] md:text-7xl">
              Neighborhood map, exact address after match
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-bold leading-8 text-ink/75">
              This test page uses OpenStreetMap tiles to show only a broad
              pickup neighborhood in public. The exact street-level pickup point
              stays hidden until the owner approves a match request.
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
            <button className="pantry-button pantry-button--light" onClick={resetLab} type="button">
              Reset demo
            </button>
          </div>

          <div className="market-map-notice">
            <strong>Public map rule:</strong> everyone sees the neighborhood
            area. Only matched posts reveal the exact pickup pin and address.
          </div>

          <div className="market-map-location-bar">
            <div>
              <p className="pantry-label">Nearby mode</p>
              <p className="market-map-location-bar__copy">
                Use the browser&apos;s current location to rank listings by
                distance from you. The app still uses the public neighborhood
                center, not the hidden exact address.
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
                    <span>
                      Location active. Showing nearby products around your
                      current position.
                    </span>
                    <span>
                      Accuracy: {formatAccuracyMeters(locationMeta.accuracy)} at{' '}
                      {locationMeta.latitude?.toFixed(5)},{' '}
                      {locationMeta.longitude?.toFixed(5)}
                    </span>
                  </>
                )}
                {!userLocation && locationState !== 'error' && (
                  <span>Current location is optional for this test page.</span>
                )}
                {locationError && <span>{locationError}</span>}
              </div>
            </div>
          </div>

          <MapContainer
            center={MAP_CENTER}
            className="market-map-canvas"
            scrollWheelZoom
            zoom={12}
          >
            <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
            <MapViewportController
              focusPoint={userLocation || selectedPost?.public_center || MAP_CENTER}
            />

            {posts.map((post) => {
              const isSelected = post.id === selectedPostId
              const style = statusStyles[post.status]

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
              const style = statusStyles[post.status]

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
                <Tooltip
                  className="market-map-tooltip"
                  direction="top"
                  opacity={1}
                  permanent
                >
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
                  className={`rounded-full border border-ink/15 px-3 py-1.5 text-xs font-black uppercase shadow-sticker ${statusStyles[selectedPost.status].badge}`}
                >
                  {selectedPost.status}
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
                className={`market-map-address-card ${
                  isExactLocationVisible(selectedPost)
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
                      The consumer does not see the street-level address until
                      the owner approves the request.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {selectedPost.status === 'available' && (
                  <button
                    className="pantry-button"
                    onClick={() => requestMatch(selectedPost.id)}
                    type="button"
                  >
                    Request match
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
                <p className="pantry-label">Owner approval sandbox</p>
                <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                  Match queue
                </h2>
              </div>
              <span className="grid h-12 min-w-12 place-items-center rounded-full border border-ink/15 bg-white text-lg font-black shadow-sticker">
                {pendingPosts.length}
              </span>
            </div>

            <p className="mt-4 text-sm font-bold leading-7 text-ink/75">
              This panel is exposed only for testing. In the real product, the
              owner would approve the request from their own marketplace inbox.
            </p>

            <div className="market-map-queue">
              {pendingPosts.length === 0 ? (
                <div className="market-map-queue__empty">
                  No pending match requests. Request one from a listing card to
                  test the reveal flow.
                </div>
              ) : (
                pendingPosts.map((post) => (
                  <article className="market-map-request" key={post.id}>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-tomato">
                        {post.neighborhood_name}
                      </p>
                      <h3 className="mt-1 text-lg font-black uppercase leading-none">
                        {post.title}
                      </h3>
                      <p className="mt-2 text-sm font-bold text-ink/70">
                        Requested by {post.claimed_by} on{' '}
                        {formatDateTime(post.requested_at)}
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
                      <span>{post.exact_location.address}</span>
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
          </div>
        </div>

        <div className="mb-5">
          <p className="pantry-label">Listing cards</p>
          <h2 className="mt-2 text-4xl font-black uppercase leading-none">
            Consumer test feed
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {sortedPosts.map((post) => (
            <article
              className={`pantry-card market-map-post ${
                post.id === selectedPostId ? 'market-map-post--selected' : ''
              }`}
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
            >
              <img
                alt={`${post.food_item.name} listing`}
                className="market-map-post__image"
                src={post.food_item.image}
              />

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
                  className={`rounded-full border border-ink/15 px-2.5 py-1 text-[0.65rem] font-black uppercase shadow-sticker ${statusStyles[post.status].badge}`}
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

              {post.status === 'available' && (
                <button
                  className="pantry-button w-full"
                  onClick={() => requestMatch(post.id)}
                  type="button"
                >
                  Request match
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
                  onClick={() => setSelectedPostId(post.id)}
                  type="button"
                >
                  View exact pickup
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
