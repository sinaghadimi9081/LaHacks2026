import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'
import {
  fetchIncomingShareRequests,
  fetchOutgoingShareRequests,
  fetchShareRequestMessages,
  sendShareRequestMessage,
} from '../../Utils/shareApi.jsx'

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

function formatTimestamp(value) {
  if (!value) {
    return 'Unknown'
  }

  return new Date(value).toLocaleString()
}

function getCounterpartName(thread, currentUserId) {
  const isOwner = thread.post?.owner?.id === currentUserId
  if (isOwner) {
    return thread.requester?.full_name || thread.requester?.username || 'Neighbor'
  }

  return thread.post?.owner?.full_name || thread.post?.food_item?.owner_name || 'Neighbor'
}

function getThreadRoleLabel(thread, currentUserId) {
  return thread.post?.owner?.id === currentUserId ? 'Requester' : 'Owner'
}

export default function Inbox() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [threads, setThreads] = useState([])
  const [threadsState, setThreadsState] = useState('loading')
  const [threadsError, setThreadsError] = useState('')
  const [conversation, setConversation] = useState(null)
  const [conversationState, setConversationState] = useState('idle')
  const [conversationError, setConversationError] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const loadThreads = useCallback(async () => {
    setThreadsState('loading')
    setThreadsError('')

    try {
      const [incomingResponse, outgoingResponse] = await Promise.all([
        fetchIncomingShareRequests({ status: 'approved' }),
        fetchOutgoingShareRequests({ status: 'approved' }),
      ])

      const merged = [
        ...(incomingResponse.requests || []),
        ...(outgoingResponse.requests || []),
      ]

      const uniqueThreads = Array.from(
        new Map(merged.map((thread) => [thread.id, thread])).values(),
      ).sort((left, right) => {
        const leftTime = new Date(left.responded_at || left.created_at || 0).getTime()
        const rightTime = new Date(right.responded_at || right.created_at || 0).getTime()
        return rightTime - leftTime
      })

      setThreads(uniqueThreads)
      setThreadsState('ready')
    } catch (error) {
      setThreadsState('error')
      setThreadsError(getApiErrorMessage(error, 'Could not load your inbox.'))
    }
  }, [])

  const loadConversation = useCallback(async (targetRequestId) => {
    if (!targetRequestId) {
      setConversation(null)
      setConversationState('idle')
      setConversationError('')
      return
    }

    setConversationState('loading')
    setConversationError('')

    try {
      const response = await fetchShareRequestMessages(targetRequestId)
      setConversation(response)
      setConversationState('ready')
    } catch (error) {
      setConversationState('error')
      setConversationError(getApiErrorMessage(error, 'Could not load this conversation.'))
    }
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (threadsState !== 'ready' || requestId || threads.length === 0) {
      return
    }

    navigate(`/inbox/${threads[0].id}`, { replace: true })
  }, [navigate, requestId, threads, threadsState])

  useEffect(() => {
    void loadConversation(requestId)
  }, [loadConversation, requestId])

  const selectedThread = useMemo(
    () => threads.find((thread) => String(thread.id) === String(requestId)) || conversation?.request || null,
    [conversation?.request, requestId, threads],
  )

  async function handleSendMessage(event) {
    event.preventDefault()

    if (!requestId || !draftMessage.trim()) {
      return
    }

    setIsSending(true)

    try {
      const response = await sendShareRequestMessage(requestId, { body: draftMessage })
      setConversation((currentConversation) => {
        if (!currentConversation) {
          return currentConversation
        }

        return {
          ...currentConversation,
          messages: [...(currentConversation.messages || []), response.message],
        }
      })
      setDraftMessage('')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not send your message.'))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="pantry-label">Approved match inbox</p>
            <h1 className="mt-3 max-w-4xl text-5xl font-black uppercase leading-none md:text-7xl">
              Inbox
            </h1>
            <p className="mt-4 max-w-2xl text-base font-bold leading-7 text-ink/70">
              Use approved request threads to coordinate pickup time, ask questions, and keep marketplace communication in one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="metric-card bg-white/90">
              <span>Threads</span>
              <strong className="metric-card__value--wrap text-xl">{threads.length}</strong>
            </div>
            <div className="metric-card bg-citrus">
              <span>Approved</span>
              <strong className="metric-card__value--wrap text-xl">
                {threads.filter((thread) => thread.status === 'approved').length}
              </strong>
            </div>
            <div className="metric-card bg-petal">
              <span>Selected</span>
              <strong className="metric-card__value--wrap text-xl">
                {selectedThread ? 'Open chat' : 'Choose one'}
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
          {selectedThread ? (
            <Link className="pantry-filter-button" to={`/dashboard/requests/${selectedThread.id}`}>
              View request page
            </Link>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:px-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="pantry-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="pantry-label">Your chats</p>
              <h2 className="mt-2 text-3xl font-black uppercase leading-none">Approved threads</h2>
            </div>
            <button
              className="pantry-filter-button"
              onClick={() => void loadThreads()}
              type="button"
            >
              Refresh
            </button>
          </div>

          {threadsState === 'loading' ? (
            <p className="mt-4 text-sm font-bold leading-7 text-ink/70">Loading inbox...</p>
          ) : threadsError ? (
            <p className="mt-4 text-sm font-bold leading-7 text-danger">{threadsError}</p>
          ) : threads.length === 0 ? (
            <div className="market-map-queue__empty mt-4">
              No approved chats yet. Once a request is approved, it will show up here.
            </div>
          ) : (
            <div className="message-thread-list">
              {threads.map((thread) => {
                const isActive = String(thread.id) === String(requestId)
                return (
                  <button
                    className={`message-thread-button ${isActive ? 'message-thread-button--active' : ''}`}
                    key={thread.id}
                    onClick={() => navigate(`/inbox/${thread.id}`)}
                    type="button"
                  >
                    <p className="pantry-label">{getThreadRoleLabel(thread, user?.id)}</p>
                    <strong>{thread.post?.title || thread.post?.food_item?.name || 'Marketplace request'}</strong>
                    <span>{getCounterpartName(thread, user?.id)}</span>
                    <span>{formatTimestamp(thread.responded_at || thread.created_at)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <section className="space-y-6">
          {!requestId ? (
            <article className="pantry-card">
              <p className="pantry-label">Conversation</p>
              <p className="mt-3 text-sm font-bold leading-7 text-ink/70">
                Pick an approved request from the inbox to start chatting.
              </p>
            </article>
          ) : conversationState === 'loading' ? (
            <article className="pantry-card">
              <p className="pantry-label">Conversation</p>
              <p className="mt-3 text-sm font-bold leading-7 text-ink/70">
                Loading this conversation...
              </p>
            </article>
          ) : conversationError ? (
            <article className="pantry-card border-danger/25 bg-danger-soft/80">
              <p className="pantry-label">Conversation</p>
              <p className="mt-3 text-sm font-bold leading-7 text-danger">{conversationError}</p>
            </article>
          ) : (
            <>
              <article className="pantry-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="pantry-label">Active conversation</p>
                    <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                      {conversation?.request?.post?.title || 'Marketplace request'}
                    </h2>
                  </div>
                  <span className="rounded-full border border-ink/15 bg-phthalo px-3 py-1.5 text-xs font-black uppercase text-white shadow-sticker">
                    approved
                  </span>
                </div>

                <dl className="receipt-lines mt-4">
                  <div>
                    <dt>with</dt>
                    <dd>{getCounterpartName(conversation?.request || {}, user?.id)}</dd>
                  </div>
                  <div>
                    <dt>method</dt>
                    <dd>{conversation?.request?.fulfillment_method === 'delivery' ? 'Simulated delivery' : 'Pickup'}</dd>
                  </div>
                  <div>
                    <dt>pickup</dt>
                    <dd>
                      {conversation?.request?.post?.exact_location_visible
                        ? conversation?.request?.post?.pickup_location
                        : conversation?.request?.post?.public_pickup_location || conversation?.request?.post?.pickup_location}
                    </dd>
                  </div>
                  <div>
                    <dt>approved</dt>
                    <dd>{formatTimestamp(conversation?.request?.responded_at)}</dd>
                  </div>
                </dl>
              </article>

              <article className="pantry-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="pantry-label">Messages</p>
                    <h2 className="mt-2 text-3xl font-black uppercase leading-none">Chat</h2>
                  </div>
                  <button
                    className="pantry-filter-button"
                    onClick={() => void loadConversation(requestId)}
                    type="button"
                  >
                    Refresh chat
                  </button>
                </div>

                <div className="message-conversation">
                  {(conversation?.messages || []).length === 0 ? (
                    <div className="market-map-queue__empty">
                      No messages yet. Ask your first question about timing or pickup details.
                    </div>
                  ) : (
                    (conversation?.messages || []).map((message) => (
                      <div
                        className={`message-bubble ${message.is_mine ? 'message-bubble--mine' : 'message-bubble--theirs'}`}
                        key={message.id}
                      >
                        <strong>{message.sender?.full_name || message.sender?.username || 'Neighbor'}</strong>
                        <p>{message.body}</p>
                        <span>{formatTimestamp(message.created_at)}</span>
                      </div>
                    ))
                  )}
                </div>

                <form className="message-composer" onSubmit={handleSendMessage}>
                  <label className="pantry-field-label" htmlFor="inbox-message-body">
                    Ask a question
                  </label>
                  <textarea
                    className="pantry-input message-composer__input"
                    id="inbox-message-body"
                    onChange={(event) => setDraftMessage(event.target.value)}
                    placeholder="Example: What time works best for pickup?"
                    rows={4}
                    value={draftMessage}
                  />
                  <div className="flex justify-end">
                    <button className="pantry-button" disabled={isSending || !draftMessage.trim()} type="submit">
                      {isSending ? 'Sending...' : 'Send message'}
                    </button>
                  </div>
                </form>
              </article>
            </>
          )}
        </section>
      </section>
    </main>
  )
}
