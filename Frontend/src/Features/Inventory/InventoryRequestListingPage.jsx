import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  fetchIncomingShareRequests,
  fetchOutgoingShareRequests,
  fetchSharePost,
} from '../../Utils/shareApi.jsx'
import MarketplaceListingPreview from '../Marketplace/components/MarketplaceListingPreview.jsx'
import MarketplaceFeedMap from '../Marketplace/components/MarketplaceFeedMap.jsx'
import {
  getDistanceMiles,
  getLocationErrorMessage,
  getPostPoint,
  requestBrowserLocation,
} from '../Marketplace/marketplaceLocation.js'
import '../Marketplace/marketplaceMapLab.css'

function getApiErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData
  }

  if (responseData?.detail) {
    return String(responseData.detail)
  }

  if (responseData && typeof responseData === 'object') {
    for (const value of Object.values(responseData)) {
      if (Array.isArray(value) && value.length > 0) {
        return String(value[0])
      }
      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }
  }

  return error?.message || fallbackMessage
}

function getRequestStatusLabel(status) {
  if (status === 'approved') {
    return 'matched'
  }
  if (status === 'declined') {
    return 'declined'
  }
  return 'pending approval'
}

function getStatusClass(status) {
  if (status === 'approved') {
    return 'bg-phthalo text-white'
  }
  if (status === 'declined') {
    return 'bg-white text-ink'
  }
  return 'bg-mustard text-white'
}

function getFulfillmentLabel(fulfillmentMethod) {
  if (fulfillmentMethod === 'delivery') {
    return 'Simulated delivery'
  }
  return 'Pickup'
}

function formatRequestDate(value) {
  if (!value) {
    return 'Unknown'
  }

  return new Date(value).toLocaleString()
}

function withComputedDistance(post, userLocation) {
  if (!post) {
    return null
  }

  if (post.distance_miles != null || !userLocation) {
    return post
  }

  const point = getPostPoint(post)
  if (!point) {
    return post
  }

  const distance = getDistanceMiles(userLocation, point)
  return {
    ...post,
    distance_miles: distance == null ? null : Number(distance.toFixed(2)),
  }
}

export default function InventoryRequestListingPage() {
  const { requestId } = useParams()
  const [requestData, setRequestData] = useState(null)
  const [loadState, setLoadState] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [userLocation, setUserLocation] = useState(null)
  const [locationState, setLocationState] = useState('idle')
  const [locationError, setLocationError] = useState('')
  const [locationMeta, setLocationMeta] = useState({
    accuracy: null,
    latitude: null,
    longitude: null,
    timestamp: null,
  })

  const loadRequestPage = useCallback(async () => {
    setLoadState('loading')
    setErrorMessage('')

    try {
      const [incomingResponse, outgoingResponse] = await Promise.all([
        fetchIncomingShareRequests(),
        fetchOutgoingShareRequests(),
      ])

      const allRequests = [
        ...(incomingResponse.requests || []),
        ...(outgoingResponse.requests || []),
      ]

      const matchedRequest = allRequests.find(
        (request) => String(request.id) === String(requestId),
      )

      if (!matchedRequest?.post?.id) {
        throw new Error('Could not find that marketplace request.')
      }

      const latestPost = await fetchSharePost(matchedRequest.post.id)
      setRequestData({
        ...matchedRequest,
        post: latestPost,
      })
      setLoadState('ready')
    } catch (error) {
      setLoadState('error')
      setErrorMessage(
        getApiErrorMessage(error, 'Could not load that marketplace listing.'),
      )
    }
  }, [requestId])

  useEffect(() => {
    void loadRequestPage()
  }, [loadRequestPage])

  async function handleRequestCurrentLocation() {
    setLocationState('loading')
    setLocationError('')

    try {
      const location = await requestBrowserLocation()
      setUserLocation(location.point)
      setLocationMeta({
        accuracy: location.accuracy,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp,
      })
      setLocationState('ready')
    } catch (error) {
      setLocationState('error')
      setLocationError(getLocationErrorMessage(error))
    }
  }

  const post = useMemo(
    () => withComputedDistance(requestData?.post, userLocation),
    [requestData?.post, userLocation],
  )

  if (loadState === 'loading') {
    return (
      <main className="marketplace-page min-h-screen overflow-hidden text-ink">
        <section className="mx-auto max-w-7xl px-5 py-8 md:px-10">
          <article className="pantry-card">
            <p className="pantry-label">Request listing</p>
            <p className="mt-3 text-sm font-bold leading-7 text-ink/70">
              Loading the selected marketplace listing...
            </p>
          </article>
        </section>
      </main>
    )
  }

  if (loadState === 'error' || !requestData || !post) {
    return (
      <main className="marketplace-page min-h-screen overflow-hidden text-ink">
        <section className="mx-auto max-w-7xl px-5 py-8 md:px-10">
          <article className="pantry-card border-danger/25 bg-danger-soft/80">
            <p className="pantry-label">Request listing</p>
            <p className="mt-3 text-sm font-bold leading-7 text-danger">
              {errorMessage || 'Could not load that marketplace listing.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="pantry-button" onClick={loadRequestPage} type="button">
                Retry
              </button>
              <Link className="pantry-button pantry-button--light" to="/dashboard">
                Back to dashboard
              </Link>
            </div>
          </article>
        </section>
      </main>
    )
  }

  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="pantry-label">Request listing</p>
            <h1 className="mt-3 max-w-3xl text-5xl font-black uppercase leading-none md:text-7xl">
              Pickup details
            </h1>
            <p className="mt-4 max-w-2xl text-base font-bold leading-7 text-ink/70">
              Review the map, status, and pickup information for this request without leaving the dashboard flow.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="metric-card bg-white/90">
              <span>Status</span>
              <strong className="metric-card__value--wrap text-xl">
                {getRequestStatusLabel(requestData.status)}
              </strong>
            </div>
            <div className="metric-card bg-citrus">
              <span>Method</span>
              <strong className="metric-card__value--wrap text-xl">
                {getFulfillmentLabel(requestData.fulfillment_method)}
              </strong>
            </div>
            <div className="metric-card bg-petal">
              <span>Access</span>
              <strong className="metric-card__value--wrap text-xl">
                {post.exact_location_visible ? 'Exact' : 'Area only'}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-6 md:px-10">
        <div className="flex flex-wrap gap-3">
          <Link className="pantry-filter-button" to="/dashboard">
            Back to dashboard
          </Link>
          <Link className="pantry-filter-button" to="/marketplace">
            Open full marketplace
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:px-10 xl:grid-cols-[1.1fr_0.9fr]">
        <MarketplaceFeedMap
          filteredPosts={[post]}
          isLoadingFeed={false}
          locationError={locationError}
          locationMeta={locationMeta}
          locationState={locationState}
          onRequestCurrentLocation={handleRequestCurrentLocation}
          onSelectPost={() => {}}
          selectedPost={post}
          selectedPostId={post.id}
          userLocation={userLocation}
        />

        <div className="space-y-6">
          <MarketplaceListingPreview post={post} />

          <article className="pantry-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="pantry-label">Request summary</p>
                <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                  {requestData.post?.title || 'Marketplace request'}
                </h2>
              </div>
              <span
                className={`rounded-full border border-ink/15 px-3 py-1.5 text-xs font-black uppercase shadow-sticker ${getStatusClass(requestData.status)}`}
              >
                {getRequestStatusLabel(requestData.status)}
              </span>
            </div>

            <dl className="receipt-lines mt-4">
              <div>
                <dt>food</dt>
                <dd>{requestData.post?.food_item?.name || requestData.post?.title || 'Food item'}</dd>
              </div>
              <div>
                <dt>owner</dt>
                <dd>
                  {requestData.post?.owner?.full_name ||
                    requestData.post?.food_item?.owner_name ||
                    'Neighbor'}
                </dd>
              </div>
              <div>
                <dt>submitted</dt>
                <dd>{formatRequestDate(requestData.created_at)}</dd>
              </div>
              <div>
                <dt>method</dt>
                <dd>{getFulfillmentLabel(requestData.fulfillment_method)}</dd>
              </div>
            </dl>

            {requestData.delivery_quote ? (
              <div className="market-map-address-card mt-5">
                <p className="pantry-label">Delivery quote</p>
                <strong>
                  {requestData.delivery_quote.delivery_available
                    ? `$${requestData.delivery_quote.estimated_fee} • ${requestData.delivery_quote.estimated_minutes} min`
                    : 'Unavailable'}
                </strong>
                <p>{requestData.delivery_quote.message}</p>
                <span className="market-map-address-card__meta">
                  Dropoff: {requestData.delivery_quote.dropoff_location}
                </span>
              </div>
            ) : null}
          </article>
        </div>
      </section>
    </main>
  )
}
