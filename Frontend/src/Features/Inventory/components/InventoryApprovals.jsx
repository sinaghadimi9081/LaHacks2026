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
  if (status === 'approved') return 'matched'
  if (status === 'declined') return 'declined'
  return 'pending approval'
}

function getStatusClass(status) {
  if (status === 'approved') return 'bg-phthalo text-white'
  if (status === 'declined') return 'bg-white text-ink'
  return 'bg-mustard text-white'
}

function formatRequestDate(value) {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleString()
}

export default function InventoryApprovals() {
  const { isAuthed, status } = useAuth()
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [requestsState, setRequestsState] = useState('idle')
  const [requestsError, setRequestsError] = useState('')
  const [requestActionId, setRequestActionId] = useState(null)
  const [openRequestId, setOpenRequestId] = useState(null)

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
    if (status !== 'ready') return

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

  function toggleRequest(requestId) {
    setOpenRequestId((currentId) => (currentId === requestId ? null : requestId))
  }

  const pendingIncomingRequests = incomingRequests.filter((request) => request.status === 'pending')

  if (status === 'loading') {
    return (
      <section className="mx-auto grid max-w-5xl gap-3 px-4 pt-6 md:px-6 lg:grid-cols-2">
        <article className="pantry-card !p-4 lg:col-span-2">
          <p className="pantry-label">Approvals</p>
          <p className="mt-2 text-sm font-bold leading-6 text-ink/70">
            Loading marketplace approvals...
          </p>
        </article>
      </section>
    )
  }

  if (!isAuthed) return null

  return (
    <section className="mx-auto grid max-w-5xl gap-3 px-4 pt-6 md:px-6 lg:grid-cols-2">
      <article className="pantry-card !p-4" id="inventory-owner-inbox">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="pantry-label">Owner inbox</p>
            <h2 className="mt-1 text-2xl font-black uppercase leading-tight">
              Approve requests
            </h2>
          </div>

          <button
            className="pantry-filter-button px-3 py-1.5 text-sm"
            disabled={requestsState === 'loading'}
            onClick={loadRequestQueues}
            type="button"
          >
            {requestsState === 'loading' ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <p className="mt-2 text-sm font-bold leading-6 text-ink/75">
          Pending requests for your listings land here. Approving reveals the exact pickup address.
        </p>

        {pendingIncomingRequests.length === 0 ? (
          <div className="market-map-queue__empty mt-3">No pending requests yet.</div>
        ) : (
          <div className="market-map-queue mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {pendingIncomingRequests.map((request) => {
              const isOpen = openRequestId === `incoming:${request.id}`
              const isBusyApprove = requestActionId === `approve:${request.id}`
              const isBusyDecline = requestActionId === `decline:${request.id}`

              return (
                <div className="market-map-request p-3" key={request.id}>
                  <button
                    className="w-full text-left"
                    onClick={() => toggleRequest(`incoming:${request.id}`)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="pantry-label">Pending request</p>
                        <h3 className="mt-1 text-xl font-black uppercase leading-tight">
                          {request.post?.title || 'Marketplace post'}
                        </h3>
                        <p className="mt-1 text-sm font-black text-ink/70">
                          {request.requester?.full_name ||
                            request.requester?.username ||
                            'Neighbor'}{' '}
                          wants this item
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-ink/15 bg-mustard px-2.5 py-1 text-[0.65rem] font-black uppercase text-white shadow-sticker">
                          {getRequestStatusLabel(request.status)}
                        </span>
                        <span className="text-xs font-black uppercase text-ink/60">
                          {isOpen ? 'Hide' : 'Review'}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isOpen ? (
                    <>
                      <dl className="receipt-lines mt-2 text-sm">
                        <div>
                          <dt>requester</dt>
                          <dd>
                            {request.requester?.full_name ||
                              request.requester?.username ||
                              'Neighbor'}
                          </dd>
                        </div>
                        <div>
                          <dt>pickup</dt>
                          <dd>
                            {request.post?.pickup_location ||
                              request.post?.public_pickup_location}
                          </dd>
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

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          className="pantry-button pantry-button--light px-3 py-1.5 text-sm"
                          to="/marketplace"
                        >
                          View listing
                        </Link>

                        <button
                          className="pantry-button px-3 py-1.5 text-sm"
                          disabled={Boolean(requestActionId)}
                          onClick={() => handleRequestAction(request.id, 'approve')}
                          type="button"
                        >
                          {isBusyApprove ? 'Approving...' : 'Approve'}
                        </button>

                        <button
                          className="pantry-filter-button px-3 py-1.5 text-sm"
                          disabled={Boolean(requestActionId)}
                          onClick={() => handleRequestAction(request.id, 'decline')}
                          type="button"
                        >
                          {isBusyDecline ? 'Declining...' : 'Decline'}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </article>

      <article className="pantry-card !p-4">
        <p className="pantry-label">My requests</p>
        <h2 className="mt-1 text-2xl font-black uppercase leading-tight">Track approvals</h2>

        <p className="mt-2 text-sm font-bold leading-6 text-ink/75">
          See whether your marketplace requests are approved, declined, or still pending.
        </p>

        {outgoingRequests.length === 0 ? (
          <div className="market-map-queue__empty mt-3">
            You have not requested any marketplace posts yet.
          </div>
        ) : (
          <div className="market-map-queue mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {outgoingRequests.map((request) => {
              const isOpen = openRequestId === `outgoing:${request.id}`

              return (
                <div className="market-map-request p-3" key={request.id}>
                  <button
                    className="w-full text-left"
                    onClick={() => toggleRequest(`outgoing:${request.id}`)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="pantry-label">Outgoing request</p>
                        <h3 className="mt-1 text-xl font-black uppercase leading-tight">
                          {request.post?.title || 'Marketplace post'}
                        </h3>
                        <p className="mt-1 text-sm font-black text-ink/70">
                          {request.post?.exact_location_visible
                            ? 'Exact pickup unlocked'
                            : 'Waiting for owner approval'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border border-ink/15 px-2.5 py-1 text-[0.65rem] font-black uppercase shadow-sticker ${getStatusClass(
                            request.status,
                          )}`}
                        >
                          {getRequestStatusLabel(request.status)}
                        </span>
                        <span className="text-xs font-black uppercase text-ink/60">
                          {isOpen ? 'Hide' : 'Details'}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isOpen ? (
                    <>
                      <dl className="receipt-lines mt-2 text-sm">
                        <div>
                          <dt>food</dt>
                          <dd>
                            {request.post?.food_item?.name ||
                              request.post?.title ||
                              'Food item'}
                          </dd>
                        </div>
                        <div>
                          <dt>pickup</dt>
                          <dd>
                            {request.post?.exact_location_visible
                              ? request.post?.pickup_location
                              : request.post?.public_pickup_location ||
                                request.post?.pickup_location}
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
                          <dd>
                            {request.post?.exact_location_visible
                              ? 'exact location unlocked'
                              : 'area only'}
                          </dd>
                        </div>
                      </dl>

                      <Link
                        className="pantry-button pantry-button--light mt-3 px-3 py-1.5 text-sm"
                        to="/marketplace"
                      >
                        {request.status === 'approved' ? 'View pickup' : 'View listing'}
                      </Link>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </article>

      {requestsError ? (
        <article className="pantry-card !p-4 border-danger/25 bg-danger-soft/80 lg:col-span-2">
          <p className="pantry-label">Approval error</p>
          <p className="mt-2 text-sm font-bold leading-6 text-danger">{requestsError}</p>
        </article>
      ) : null}
    </section>
  )
}