export const DEFAULT_MARKETPLACE_CENTER = [34.0835, -118.257]
export const MARKETPLACE_TILE_URL =
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const MARKETPLACE_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function toRadians(value) {
  return (value * Math.PI) / 180
}

export function toCoordinateNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function getPostPoint(post) {
  const latitude = toCoordinateNumber(post?.pickup_latitude)
  const longitude = toCoordinateNumber(post?.pickup_longitude)

  if (latitude == null || longitude == null) {
    return null
  }

  return [latitude, longitude]
}

export function getDistanceMiles(fromPoint, toPoint) {
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

export function formatDistanceMiles(distanceMiles) {
  if (distanceMiles == null) {
    return 'Unknown'
  }

  if (distanceMiles < 0.2) {
    return '< 0.2 mi'
  }

  return `${distanceMiles.toFixed(1)} mi`
}

export function getLocationErrorMessage(error) {
  if (error?.code === error?.PERMISSION_DENIED || error?.code === 1) {
    return 'Location permission was denied in the browser.'
  }

  if (error?.code === error?.POSITION_UNAVAILABLE || error?.code === 2) {
    return (
      error?.message ||
      'The browser or operating system could not determine your current location.'
    )
  }

  if (error?.code === error?.TIMEOUT || error?.code === 3) {
    return 'Location request timed out.'
  }

  return error?.message || 'Could not read current location.'
}

export function formatLocationAccuracy(accuracy) {
  if (typeof accuracy !== 'number' || Number.isNaN(accuracy)) {
    return 'Unknown'
  }

  return `${Math.round(accuracy)} m`
}

export function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support geolocation.'))
      return
    }

    if (!window.isSecureContext) {
      reject(new Error('Location access requires https or localhost.'))
      return
    }

    let watchId = null
    let settled = false

    function cleanup() {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
    }

    function handleSuccess(position) {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resolve({
        accuracy: position.coords.accuracy,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        point: [position.coords.latitude, position.coords.longitude],
        timestamp: position.timestamp,
      })
    }

    function handleFailure(error) {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      reject(error)
    }

    watchId = navigator.geolocation.watchPosition(
      handleSuccess,
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
  })
}
