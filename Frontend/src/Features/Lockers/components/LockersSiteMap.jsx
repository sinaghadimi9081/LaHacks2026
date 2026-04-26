import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'

import {
  DEFAULT_MARKETPLACE_CENTER,
  MARKETPLACE_TILE_ATTRIBUTION,
  MARKETPLACE_TILE_URL,
  formatDistanceMiles,
  getDistanceMiles,
  toCoordinateNumber,
} from '../../Marketplace/marketplaceLocation.js'

function getSitePoint(site) {
  const latitude = toCoordinateNumber(site?.latitude)
  const longitude = toCoordinateNumber(site?.longitude)
  if (latitude == null || longitude == null) return null
  return [latitude, longitude]
}

function MapViewportController({ focusPoint }) {
  const map = useMap()

  useEffect(() => {
    if (!focusPoint) return
    map.setView(focusPoint, 12, { animate: true, duration: 0.8 })
  }, [focusPoint, map])

  return null
}

export default function LockersSiteMap({
  className = '',
  sites = [],
  selectedSiteId,
  closestSiteId,
  userLocation,
  onSelectSiteId,
}) {
  const focusPoint = useMemo(() => {
    const selected = sites.find((site) => String(site.id) === String(selectedSiteId))
    return getSitePoint(selected) || userLocation || getSitePoint(sites[0]) || DEFAULT_MARKETPLACE_CENTER
  }, [selectedSiteId, sites, userLocation])

  return (
    <article className={`pantry-card market-map-panel ${className}`}>
      <div className="market-map-panel__header">
        <div>
          <p className="pantry-label">OpenStreetMap locker view</p>
          <h2 className="mt-2 text-4xl font-black uppercase leading-none">Nearby lockers</h2>
        </div>
      </div>

      <MapContainer
        center={DEFAULT_MARKETPLACE_CENTER}
        className="market-map-canvas"
        scrollWheelZoom
        zoom={12}
      >
        <TileLayer attribution={MARKETPLACE_TILE_ATTRIBUTION} url={MARKETPLACE_TILE_URL} />
        <MapViewportController focusPoint={focusPoint} />

        {userLocation ? (
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
                <span>Used to find the closest locker site.</span>
              </div>
            </Tooltip>
          </CircleMarker>
        ) : null}

        {sites
          .map((site) => ({ site, point: getSitePoint(site) }))
          .filter(({ point }) => Boolean(point))
          .map(({ site, point }) => {
            const isSelected = String(site.id) === String(selectedSiteId)
            const isClosest = closestSiteId && String(site.id) === String(closestSiteId)
            const distance = userLocation ? getDistanceMiles(userLocation, point) : null

            return (
              <CircleMarker
                center={point}
                eventHandlers={{
                  click: () => onSelectSiteId?.(String(site.id)),
                }}
                key={site.id}
                pathOptions={{
                  color: '#12312a',
                  fillColor: isSelected ? '#ff785a' : isClosest ? '#2f7d4f' : '#174733',
                  fillOpacity: 1,
                  weight: isSelected ? 3 : 2,
                }}
                radius={isSelected ? 11 : 9}
              >
                <Tooltip
                  className="market-map-tooltip"
                  direction="top"
                  opacity={1}
                  permanent={isSelected}
                >
                  <div>
                    <strong>{site.name}</strong>
                    <span>
                      {site.address_label || 'Locker site'}
                      {distance != null ? ` • ${formatDistanceMiles(distance)}` : ''}
                    </span>
                  </div>
                </Tooltip>
              </CircleMarker>
            )
          })}
      </MapContainer>

      <div className="market-map-legend">
        <div>
          <span className="market-map-legend__swatch market-map-legend__swatch--public" />
          <p>
            <strong>Closest site</strong>
            Highlighted when location is enabled.
          </p>
        </div>
        <div>
          <span className="market-map-legend__swatch market-map-legend__swatch--exact" />
          <p>
            <strong>Selected site</strong>
            The active site used for the locker feed.
          </p>
        </div>
      </div>
    </article>
  )
}

