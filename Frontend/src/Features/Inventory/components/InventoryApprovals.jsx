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

function requestTitle(request) {
  return request.post?.title || 'Marketplace post'
}

function requesterName(request) {
  return request.requester?.full_name || request.requester?.username || 'Neighbor'
}

function requestOwnerName(request) {
  return request.post?.owner?.full_name || request.post?.food_item?.owner_name || 'Neighbor'
}

function requestFoodName(request) {
  return request.post?.food_item?.name || request.post?.title || 'Food item'
}

function requestVisiblePickup(request) {
  if (request.post?.exact_location_visible) {
    return request.post?.pickup_location || 'Exact pickup unlocked'
  }

  return request.post?.public_pickup_location || request.post?.pickup_location || 'Pickup area pending'
}

function RequestDetails({ rows }) {
  return (
    <dl className="receipt-lines">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function RequestDisclosure({ actions, badgeClassName, badgeLabel, children, eyebrow, index, meta, title }) {
  return (
    <details
      className="ingredient-card ingredient-card--text-only group"
      style={{ '--tilt': index % 2 === 0 ? '-0.5deg' : '0.5deg' }}
    >
      <summary className="recipe-card recipe-card--full cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-black uppercase leading-5 text-ink">{title}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-ink/50">
              {eyebrow}
              {meta ? ` - ${meta}` : ''}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className={`rounded-full border border-ink/15 px-3 py-1 text-xs font-black uppercase shadow-sticker ${badgeClassName}`}
            >
              {badgeLabel}
            </span>
            {actions}
            <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-black uppercase text-ink/65 shadow-sticker group-open:hidden">
              Open
            </span>
            <span className="hidden rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-black uppercase text-ink/65 shadow-sticker group-open:inline-flex">
              Close
            </span>
          </div>
        </div>
      </summary>

      <div className="recipe-card recipe-card--full border-t border-dashed border-ink/15">
        {children}
      </div>
    </details>
  )
}

function IncomingRequestRow({ index, isBusyApprove, isBusyDecline, onAction, request, requestActionId }) {
  const disabled = Boolean(requestActionId)
  const actionButtons = (
    <>
      <Link
        className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-black uppercase text-ink shadow-sticker transition hover:-translate-y-0.5"
        onClick={(event) => event.stopPropagation()}
        to="/marketplace"
      >
        View
      </Link>
      <button
        className="rounded-full border border-ink/15 bg-moonstone px-3 py-1 text-xs font-black uppercase text-ink shadow-sticker transition hover:-translate-y-0.5 disabled:opacity-60"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onAction(request.id, 'approve')
        }}
        type="button"
      >
        {isBusyApprove ? 'Approving...' : 'Approve'}
      </button>
      <button
        className="rounded-full border border-danger/20 bg-danger-soft/80 px-3 py-1 text-xs font-black uppercase text-danger shadow-sticker transition hover:-translate-y-0.5 disabled:opacity-60"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onAction(request.id, 'decline')
        }}
        type="button"
      >
        {isBusyDecline ? 'Declining...' : 'Decline'}
      </button>
    </>
  )

  return (
    <RequestDisclosure
      actions={actionButtons}
      badgeClassName="bg-mustard text-white"
      badgeLabel={getRequestStatusLabel(request.status)}
      eyebrow={`From ${requesterName(request)}`}
      index={index}
      meta={formatRequestDate(request.created_at)}
      title={requestTitle(request)}
    >
      <RequestDetails
        rows={[
          { label: 'requester', value: requesterName(request) },
          { label: 'pickup', value: request.post?.pickup_location || request.post?.public_pickup_location || 'Pickup unset' },
          { label: 'submitted', value: formatRequestDate(request.created_at) },
          { label: 'status', value: getRequestStatusLabel(request.status) },
        ]}
      />

      <div className="flex flex-wrap gap-3">
        <Link className="pantry-button pantry-button--light" to="/marketplace">
          View listing
        </Link>
        <button
          className="pantry-button"
          disabled={disabled}
          onClick={() => onAction(request.id, 'approve')}
          type="button"
        >
          {isBusyApprove ? 'Approving...' : 'Approve reveal'}
        </button>
        <button
          className="pantry-filter-button"
          disabled={disabled}
          onClick={() => onAction(request.id, 'decline')}
          type="button"
        >
          {isBusyDecline ? 'Declining...' : 'Decline'}
        </button>
      </div>
    </RequestDisclosure>
  )
}

function OutgoingRequestRow({ index, request }) {
  const viewLabel = request.status === 'approved' ? 'View exact pickup' : 'View listing'

  return (
    <RequestDisclosure
      actions={(
        <Link
          className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-black uppercase text-ink shadow-sticker transition hover:-translate-y-0.5"
          onClick={(event) => event.stopPropagation()}
          to="/marketplace"
        >
          {request.status === 'approved' ? 'Pickup' : 'View'}
        </Link>
      )}
      badgeClassName={getStatusClass(request.status)}
      badgeLabel={getRequestStatusLabel(request.status)}
      eyebrow={requestFoodName(request)}
      index={index}
      meta={request.post?.exact_location_visible ? 'exact pickup unlocked' : 'area only'}
      title={requestTitle(request)}
    >
      <RequestDetails
        rows={[
          { label: 'food', value: requestFoodName(request) },
          { label: 'pickup', value: requestVisiblePickup(request) },
          { label: 'owner', value: requestOwnerName(request) },
          {
            label: 'detail access',
            value: request.post?.exact_location_visible ? 'exact location unlocked' : 'area only',
          },
        ]}
      />

      <Link className="pantry-button pantry-button--light" to="/marketplace">
        {viewLabel}
      </Link>
    </RequestDisclosure>
  )
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
          <div className="mt-5 grid max-h-[34rem] gap-4 overflow-y-auto overscroll-contain pr-2 pt-2 pd-2">
            {pendingIncomingRequests.map((request, index) => {
              const isBusyApprove = requestActionId === `approve:${request.id}`
              const isBusyDecline = requestActionId === `decline:${request.id}`

              return (
                <IncomingRequestRow
                  index={index}
                  isBusyApprove={isBusyApprove}
                  isBusyDecline={isBusyDecline}
                  key={request.id}
                  onAction={handleRequestAction}
                  request={request}
                  requestActionId={requestActionId}
                />
              )
            })}
          </div>
        )}
      </article>

      <article className="pantry-card">
        <p className="pantry-label">My requests</p>
        <h2 className="mt-2 text-3xl font-black uppercase leading-none ">Track approvals</h2>
        <p className="mt-3 text-sm font-bold leading-7 text-ink/75">
          This queue shows every request you sent and whether the owner has approved, declined, or
          is still reviewing it.
        </p>

        {outgoingRequests.length === 0 ? (
          <div className="market-map-queue__empty">
            You have not requested any marketplace posts yet.
          </div>
        ) : (
          <div className="mt-5 grid max-h-[34rem] gap-4 overflow-y-auto overscroll-contain pr-2 pt-2 pd-2">
            {outgoingRequests.map((request, index) => (
              <OutgoingRequestRow index={index} key={request.id} request={request} />
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
