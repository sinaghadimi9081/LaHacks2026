import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'

import { useAuth } from '../../../Auth/useAuth.jsx'
import {
  approveShareRequest,
  declineShareRequest,
  fetchIncomingShareRequests,
  fetchOutgoingShareRequests,
} from '../../../Utils/shareApi.jsx'
import '../../Marketplace/marketplaceMapLab.css'

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

function formatRequestDate(value) {
  if (!value) {
    return 'Unknown'
  }

  return new Date(value).toLocaleString()
}

export default function InventoryApprovals() {
  const { isAuthed, status } = useAuth()
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [requestsState, setRequestsState] = useState('idle')
  const [requestsError, setRequestsError] = useState('')
  const [requestActionId, setRequestActionId] = useState(null)

  const loadRequestQueues = useCallback(async () => {
    if (!isAuthed) {
      setIncomingRequests([])
      setOutgoingRequests([])
      setRequestsState('idle')
      setRequestsError('')
      return
    }

    setRequestsState('loading')
    setRequestsError('')

    try {
      const [incomingResponse, outgoingResponse] = await Promise.all([
        fetchIncomingShareRequests(),
        fetchOutgoingShareRequests(),
      ])

      setIncomingRequests(incomingResponse.requests || [])
      setOutgoingRequests(outgoingResponse.requests || [])
      setRequestsState('ready')
    } catch (error) {
      setRequestsState('error')
      setRequestsError(getApiErrorMessage(error, 'Could not load marketplace requests.'))
    }
  }, [isAuthed])

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadRequestQueues()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadRequestQueues, status])

  async function handleRequestAction(requestId, action) {
    setRequestActionId(`${action}:${requestId}`)

    try {
      if (action === 'approve') {
        await approveShareRequest(requestId)
      } else {
        await declineShareRequest(requestId)
      }

      await loadRequestQueues()
      toast.success(action === 'approve' ? 'Request approved.' : 'Request declined.')
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          action === 'approve' ? 'Could not approve that request.' : 'Could not decline that request.',
        ),
      )
    } finally {
      setRequestActionId(null)
    }
  }

  const pendingIncomingRequests = incomingRequests.filter((request) => request.status === 'pending')

  if (status === 'loading') {
    return (
      <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-8 md:px-10 lg:grid-cols-2">
        <article className="pantry-card lg:col-span-2">
          <p className="pantry-label">Approvals</p>
          <p className="mt-3 text-sm font-bold leading-7 text-ink/70">
            Loading marketplace approvals...
          </p>
        </article>
      </section>
    )
  }

  if (!isAuthed) {
    return null
  }

  return (
    <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-8 md:px-10 lg:grid-cols-2">
      <article className="pantry-card" id="inventory-owner-inbox">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="pantry-label">Owner inbox</p>
            <h2 className="mt-2 text-3xl font-black uppercase leading-none">Approve requests</h2>
          </div>
          <button
            className="pantry-filter-button"
            disabled={requestsState === 'loading'}
            onClick={loadRequestQueues}
            type="button"
          >
            {requestsState === 'loading' ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <p className="mt-3 text-sm font-bold leading-7 text-ink/75">
          Pending requests for your listings land here. Approving a request reveals the exact pickup
          address to that requester.
        </p>

        {pendingIncomingRequests.length === 0 ? (
          <div className="market-map-queue__empty">
            No pending requests yet.
          </div>
        ) : (
          <div className="market-map-queue">
            {pendingIncomingRequests.map((request) => {
              const isBusyApprove = requestActionId === `approve:${request.id}`
              const isBusyDecline = requestActionId === `decline:${request.id}`

              return (
                <div className="market-map-request" key={request.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="pantry-label">Pending request</p>
                      <h3 className="mt-2 text-2xl font-black uppercase leading-none">
                        {request.post?.title || 'Marketplace post'}
                      </h3>
                    </div>
                    <span className="rounded-full border border-ink/15 bg-mustard px-3 py-1.5 text-xs font-black uppercase text-white shadow-sticker">
                      {getRequestStatusLabel(request.status)}
                    </span>
                  </div>

                  <dl className="receipt-lines">
                    <div>
                      <dt>requester</dt>
                      <dd>{request.requester?.full_name || request.requester?.username || 'Neighbor'}</dd>
                    </div>
                    <div>
                      <dt>pickup</dt>
                      <dd>{request.post?.pickup_location || request.post?.public_pickup_location}</dd>
                    </div>
                    <div>
                      <dt>submitted</dt>
                      <dd>{formatRequestDate(request.created_at)}</dd>
                    </div>
                    <div>
                      <dt>status</dt>
                      <dd>{getRequestStatusLabel(request.status)}</dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-3">
                    <Link className="pantry-button pantry-button--light" to="/marketplace">
                      View listing
                    </Link>
                    <button
                      className="pantry-button"
                      disabled={Boolean(requestActionId)}
                      onClick={() => handleRequestAction(request.id, 'approve')}
                      type="button"
                    >
                      {isBusyApprove ? 'Approving...' : 'Approve reveal'}
                    </button>
                    <button
                      className="pantry-filter-button"
                      disabled={Boolean(requestActionId)}
                      onClick={() => handleRequestAction(request.id, 'decline')}
                      type="button"
                    >
                      {isBusyDecline ? 'Declining...' : 'Decline'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </article>

      <article className="pantry-card">
        <p className="pantry-label">My requests</p>
        <h2 className="mt-2 text-3xl font-black uppercase leading-none">Track approvals</h2>
        <p className="mt-3 text-sm font-bold leading-7 text-ink/75">
          This queue shows every request you sent and whether the owner has approved, declined, or
          is still reviewing it.
        </p>

        {outgoingRequests.length === 0 ? (
          <div className="market-map-queue__empty">
            You have not requested any marketplace posts yet.
          </div>
        ) : (
          <div className="market-map-queue">
            {outgoingRequests.map((request) => (
              <div className="market-map-request" key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="pantry-label">Outgoing request</p>
                    <h3 className="mt-2 text-2xl font-black uppercase leading-none">
                      {request.post?.title || 'Marketplace post'}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full border border-ink/15 px-3 py-1.5 text-xs font-black uppercase shadow-sticker ${getStatusClass(request.status)}`}
                  >
                    {getRequestStatusLabel(request.status)}
                  </span>
                </div>

                <dl className="receipt-lines">
                  <div>
                    <dt>food</dt>
                    <dd>{request.post?.food_item?.name || request.post?.title || 'Food item'}</dd>
                  </div>
                  <div>
                    <dt>pickup</dt>
                    <dd>
                      {request.post?.exact_location_visible
                        ? request.post?.pickup_location
                        : request.post?.public_pickup_location || request.post?.pickup_location}
                    </dd>
                  </div>
                  <div>
                    <dt>owner</dt>
                    <dd>
                      {request.post?.owner?.full_name ||
                        request.post?.food_item?.owner_name ||
                        'Neighbor'}
                    </dd>
                  </div>
                  <div>
                    <dt>detail access</dt>
                    <dd>{request.post?.exact_location_visible ? 'exact location unlocked' : 'area only'}</dd>
                  </div>
                </dl>

                <Link className="pantry-button pantry-button--light" to="/marketplace">
                  {request.status === 'approved' ? 'View exact pickup' : 'View listing'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </article>

      {requestsError ? (
        <article className="pantry-card border-danger/25 bg-danger-soft/80 lg:col-span-2">
          <p className="pantry-label">Approval error</p>
          <p className="mt-3 text-sm font-bold leading-7 text-danger">{requestsError}</p>
        </article>
      ) : null}
    </section>
  )
}
