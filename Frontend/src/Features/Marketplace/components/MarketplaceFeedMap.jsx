import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'

import {
  DEFAULT_MARKETPLACE_CENTER,
  MARKETPLACE_TILE_ATTRIBUTION,
  MARKETPLACE_TILE_URL,
  formatDistanceMiles,
  formatLocationAccuracy,
  getPostPoint,
} from '../marketplaceLocation.js'

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

export default function MarketplaceFeedMap({
  filteredPosts,
  isLoadingFeed,
  locationError,
  locationMeta,
  locationState,
  onRequestCurrentLocation,
  onSelectPost,
  selectedPost,
  selectedPostId,
  userLocation,
}) {
  const selectedExactPoint = selectedPost?.exact_location_visible
    ? getPostPoint(selectedPost)
    : null
  const focusPoint =
    selectedExactPoint ||
    userLocation ||
    getPostPoint(filteredPosts.find((post) => post.id === selectedPostId)) ||
    getPostPoint(filteredPosts[0]) ||
    DEFAULT_MARKETPLACE_CENTER

  return (
    <article className="pantry-card market-map-panel">
      <div className="market-map-panel__header">
        <div>
          <p className="pantry-label">OpenStreetMap marketplace view</p>
          <h2 className="mt-2 text-4xl font-black uppercase leading-none">
            Nearby pickup map
          </h2>
        </div>
      </div>

      <div className="market-map-notice">
        <strong>Live marketplace view:</strong> the public map stays at the
        neighborhood level until a request is approved. When the selected post
        is matched to you, an exact pickup marker appears.
      </div>

      <div className="market-map-location-bar">
        <div>
          <p className="pantry-label">Nearby mode</p>
          <p className="market-map-location-bar__copy">
            Use your current location to sort the feed by nearby pickups and
            center the map around you.
          </p>
        </div>

        <div className="market-map-location-bar__actions">
          <div className="market-map-location-bar__buttons">
            <button
              className="pantry-button pantry-button--accent"
              onClick={onRequestCurrentLocation}
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
              <span>Distance sorting activates after location access.</span>
            )}
            {locationError && <span>{locationError}</span>}
          </div>
        </div>
      </div>

      <MapContainer
        center={DEFAULT_MARKETPLACE_CENTER}
        className="market-map-canvas"
        scrollWheelZoom
        zoom={12}
      >
        <TileLayer
          attribution={MARKETPLACE_TILE_ATTRIBUTION}
          url={MARKETPLACE_TILE_URL}
        />
        <MapViewportController focusPoint={focusPoint} />

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
                <span>Used to sort nearby listings.</span>
              </div>
            </Tooltip>
          </CircleMarker>
        )}

        {filteredPosts
          .map((post) => ({ point: getPostPoint(post), post }))
          .filter(({ point }) => Boolean(point))
          .map(({ point, post }) => {
            const isSelected = post.id === selectedPostId

            return (
              <CircleMarker
                center={point}
                eventHandlers={{ click: () => onSelectPost(post.id) }}
                key={post.id}
                pathOptions={{
                  color: '#12312a',
                  fillColor: post.status === 'claimed' ? '#174733' : '#2f7d4f',
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
                    <strong>{post.title}</strong>
                    <span>
                      {post.food_item.name}
                      {post.distance_miles != null
                        ? ` • ${formatDistanceMiles(post.distance_miles)}`
                        : ''}
                    </span>
                  </div>
                </Tooltip>
              </CircleMarker>
            )
          })}

        {selectedExactPoint && (
          <CircleMarker
            center={selectedExactPoint}
            pathOptions={{
              color: '#12312a',
              fillColor: '#ff785a',
              fillOpacity: 1,
              weight: 3,
            }}
            radius={11}
          >
            <Tooltip className="market-map-tooltip" direction="top" opacity={1} permanent>
              <div>
                <strong>Exact pickup</strong>
                <span>{selectedPost?.title || 'Matched listing'}</span>
              </div>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      <div className="market-map-legend">
        <div>
          <span className="market-map-legend__swatch market-map-legend__swatch--public" />
          <p>
            <strong>Available item</strong>
            Public neighborhood marker shown before approval.
          </p>
        </div>
        <div>
          <span className="market-map-legend__swatch market-map-legend__swatch--exact" />
          <p>
            <strong>Exact pickup</strong>
            Revealed only when the selected match is approved.
          </p>
        </div>
      </div>

      {isLoadingFeed && (
        <p className="text-sm font-black uppercase tracking-[0.14em] text-ink/55">
          Loading marketplace posts...
        </p>
      )}
    </article>
  )
}
