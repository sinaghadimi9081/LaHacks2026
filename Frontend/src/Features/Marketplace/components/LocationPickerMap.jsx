import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'

import {
  DEFAULT_MARKETPLACE_CENTER,
  MARKETPLACE_TILE_ATTRIBUTION,
  MARKETPLACE_TILE_URL,
} from '../marketplaceLocation.js'

function MapViewportController({ focusPoint }) {
  const map = useMap()

  useEffect(() => {
    if (!focusPoint) {
      return
    }

    map.setView(focusPoint, 14, {
      animate: true,
      duration: 0.6,
    })
  }, [focusPoint, map])

  return null
}

function ClickCapture({ onPickPoint }) {
  useMapEvents({
    click(event) {
      onPickPoint([event.latlng.lat, event.latlng.lng])
    },
  })

  return null
}

export default function LocationPickerMap({
  currentLocation,
  onPickPoint,
  selectedPoint,
}) {
  const focusPoint = selectedPoint || currentLocation || DEFAULT_MARKETPLACE_CENTER

  return (
    <div className="market-location-picker">
      <p className="pantry-field-label">Pickup point on map</p>
      <p className="market-location-picker__copy">
        Click the map to pin a pickup point, or use your current location.
      </p>

      <MapContainer
        center={DEFAULT_MARKETPLACE_CENTER}
        className="market-location-picker__map"
        scrollWheelZoom
        zoom={13}
      >
        <TileLayer
          attribution={MARKETPLACE_TILE_ATTRIBUTION}
          url={MARKETPLACE_TILE_URL}
        />
        <MapViewportController focusPoint={focusPoint} />
        <ClickCapture onPickPoint={onPickPoint} />

        {currentLocation && (
          <CircleMarker
            center={currentLocation}
            pathOptions={{
              color: '#12312a',
              fillColor: '#2563eb',
              fillOpacity: 1,
              weight: 3,
            }}
            radius={8}
          >
            <Tooltip className="market-map-tooltip" direction="top" opacity={1}>
              <div>
                <strong>Your location</strong>
                <span>Tap to reuse as pickup point if needed.</span>
              </div>
            </Tooltip>
          </CircleMarker>
        )}

        {selectedPoint && (
          <CircleMarker
            center={selectedPoint}
            pathOptions={{
              color: '#7d4a16',
              fillColor: '#ff785a',
              fillOpacity: 1,
              weight: 2,
            }}
            radius={8}
          >
            <Tooltip className="market-map-tooltip" direction="top" opacity={1} permanent>
              <div>
                <strong>Selected pickup point</strong>
                <span>Release the item from this location.</span>
              </div>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  )
}
