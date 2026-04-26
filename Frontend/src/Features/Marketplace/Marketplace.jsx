import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'
import {
  claimSharePost,
  createSharePost,
  fetchShareFeed,
} from '../../Utils/shareApi.jsx'
import MarketplaceBackground from './components/MarketplaceBackground.jsx'
import MarketplaceCart from './components/MarketplaceCart.jsx'
import MarketplaceDragLayer from './components/MarketplaceDragLayer.jsx'
import MarketplacePostCard from './components/MarketplacePostCard.jsx'
import SharePostModal from './components/SharePostModal.jsx'

const feedFilters = ['all', 'available', 'claimed']

function getDefaultExpirationDate() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

const blankForm = {
  item_name: '',
  quantity_label: '',
  description: '',
  expiration_date: getDefaultExpirationDate(),
  pickup_location: '',
}

function getErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.detail ||
    Object.values(error?.response?.data || {})
      .flat()
      .join(' ') ||
    fallbackMessage
  )
}

function buildSharePostPayload(form, verificationFile) {
  const payload = new FormData()
  payload.append('item_name', form.item_name.trim())
  payload.append('quantity_label', form.quantity_label.trim())
  payload.append('title', form.item_name.trim())
  payload.append('description', form.description.trim())
  payload.append('expiration_date', form.expiration_date)
  payload.append('pickup_location', form.pickup_location.trim())

  if (verificationFile) {
    payload.append('image_file', verificationFile)
  }

  return payload
}

function getPostExpirationDate(post) {
  return post.expiration_date || post.food_item?.expiration_date || ''
}

function parseDateKey(dateValue) {
  if (!dateValue) {
    return null
  }

  const [year, month, day] = dateValue.slice(0, 10).split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return Date.UTC(year, month - 1, day)
}

function getTodayKey() {
  const today = new Date()
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
}

function getPostDaysLeft(post) {
  const expirationKey = parseDateKey(getPostExpirationDate(post))

  if (expirationKey === null) {
    return null
  }

  return Math.round((expirationKey - getTodayKey()) / 86400000)
}

function isExpiredPost(post) {
  const daysLeft = getPostDaysLeft(post)
  return daysLeft !== null && daysLeft <= 0
}

export default function Marketplace() {
  const { isAuthed, status } = useAuth()
  const navigate = useNavigate()
  const [sharePosts, setSharePosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsSaving, setPostsSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [form, setForm] = useState(blankForm)
  const [verificationImage, setVerificationImage] = useState('')
  const [verificationFile, setVerificationFile] = useState(null)
  const [cartPostIds, setCartPostIds] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isBasketMoving, setIsBasketMoving] = useState(false)
  const [basketPosition, setBasketPosition] = useState(null)
  const basketDockRef = useRef(null)
  const basketDragRef = useRef(null)

  const reverifiedFoodItem = useMemo(
    () => ({
      image: verificationImage || '/favicon.svg',
    }),
    [verificationImage],
  )

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredPosts = useMemo(
    () => {
      const matchingPosts = sharePosts.filter((post) => {
        if (isExpiredPost(post)) {
          return false
        }

        const searchableText = [
          post.title,
          post.description,
          post.pickup_location,
          post.status,
          post.claimed_by,
          post.food_item.name,
          post.food_item.quantity,
          post.food_item.status,
          ...(post.food_item.recipe_uses || []),
        ]
          .join(' ')
          .toLowerCase()

        const matchesSearch =
          normalizedSearch.length === 0 ||
          searchableText.includes(normalizedSearch)
        const matchesFilter =
          activeFilter === 'all' || post.status === activeFilter

        return matchesSearch && matchesFilter
      })

      return [...matchingPosts].sort((firstPost, secondPost) => {
        if (firstPost.status === secondPost.status) {
          return 0
        }

        return firstPost.status === 'claimed' ? 1 : -1
      })
    },
    [activeFilter, normalizedSearch, sharePosts],
  )

  const availableCount = sharePosts.filter(
    (post) => post.status === 'available',
  ).length
  const claimedCount = sharePosts.length - availableCount
  const cartPosts = cartPostIds
    .map((postId) => sharePosts.find((post) => post.id === postId))
    .filter(Boolean)

  useEffect(() => {
    let isActive = true

    async function loadSharePosts() {
      setPostsLoading(true)

      try {
        const response = await fetchShareFeed()
        if (!isActive) return
        setSharePosts(response?.posts || [])
      } catch (error) {
        if (!isActive) return
        setSharePosts([])
        toast.error(getErrorMessage(error, 'Failed to load marketplace posts.'))
      } finally {
        if (isActive) {
          setPostsLoading(false)
        }
      }
    }

    void loadSharePosts()

    return () => {
      isActive = false
    }
  }, [])

  const moveBasketToPointer = useCallback((clientX, clientY) => {
    const dock = basketDockRef.current
    const dragState = basketDragRef.current

    if (!dock || !dragState) {
      return
    }

    const maxX = Math.max(12, window.innerWidth - dragState.width - 12)
    const maxY = Math.max(12, window.innerHeight - dragState.height - 12)
    const nextX = Math.min(Math.max(12, clientX - dragState.offsetX), maxX)
    const nextY = Math.min(Math.max(12, clientY - dragState.offsetY), maxY)

    setBasketPosition({ x: nextX, y: nextY })
  }, [])

  useEffect(() => {
    if (!isBasketMoving) {
      return undefined
    }

    function handlePointerMove(event) {
      event.preventDefault()
      moveBasketToPointer(event.clientX, event.clientY)
    }

    function handlePointerUp() {
      basketDragRef.current = null
      setIsBasketMoving(false)
      document.body.classList.remove('is-moving-market-basket')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    window.addEventListener('pointercancel', handlePointerUp, { once: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      document.body.classList.remove('is-moving-market-basket')
    }
  }, [isBasketMoving, moveBasketToPointer])

  function startBasketMove(event) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    const dock = basketDockRef.current

    if (!dock) {
      return
    }

    const rect = dock.getBoundingClientRect()
    basketDragRef.current = {
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
    }
    document.body.classList.add('is-moving-market-basket')
    setIsBasketMoving(true)
    moveBasketToPointer(event.clientX, event.clientY)
  }

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0]

    if (!file) {
      setVerificationImage('')
      setVerificationFile(null)
      return
    }

    setVerificationImage(URL.createObjectURL(file))
    setVerificationFile(file)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!isAuthed) {
      toast.info('Please log in to share an item.')
      navigate('/login', { state: { from: { pathname: '/marketplace' } } })
      return
    }

    setPostsSaving(true)

    try {
      const createdPost = await createSharePost(
        buildSharePostPayload(form, verificationFile),
      )

      setSharePosts((currentPosts) => [createdPost, ...currentPosts])
      setForm({ ...blankForm, expiration_date: getDefaultExpirationDate() })
      setVerificationImage('')
      setVerificationFile(null)
      setIsShareModalOpen(false)
      event.currentTarget.reset()
      toast.success('Marketplace post created.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create marketplace post.'))
    } finally {
      setPostsSaving(false)
    }
  }

  function addPostToCart(postId, insertIndex = cartPostIds.length) {
    const post = sharePosts.find((currentPost) => currentPost.id === postId)

    if (!post || post.status === 'claimed') {
      return
    }

    setCartPostIds((currentIds) => {
      const currentIndex = currentIds.indexOf(postId)
      const nextIds = currentIds.filter((currentId) => currentId !== postId)
      const adjustedIndex =
        currentIndex !== -1 && currentIndex < insertIndex
          ? insertIndex - 1
          : insertIndex
      const boundedIndex = Math.max(0, Math.min(adjustedIndex, nextIds.length))

      nextIds.splice(boundedIndex, 0, postId)
      return nextIds
    })
  }

  function removePostFromCart(postId) {
    setCartPostIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== postId),
    )
  }

  async function claimCart() {
    const cartIdSet = new Set(cartPostIds)
    const nextClaimedPosts = []

    try {
      for (const postId of cartIdSet) {
        nextClaimedPosts.push(await claimSharePost(postId))
      }

      setSharePosts((currentPosts) =>
        currentPosts.map((post) => {
          const claimedPost = nextClaimedPosts.find((item) => item.id === post.id)
          return claimedPost || post
        }),
      )
      setCartPostIds([])
      toast.success('Meetup requested.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to request meetup.'))
    }
  }

  async function claimPost(postId) {
    try {
      const claimedPost = await claimSharePost(postId)
      setSharePosts((currentPosts) =>
        currentPosts.map((post) => (post.id === postId ? claimedPost : post)),
      )
      removePostFromCart(postId)
      toast.success('Meetup requested.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to request meetup.'))
    }
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <main className="marketplace-page min-h-screen overflow-hidden text-ink">
        <MarketplaceBackground />
        <MarketplaceDragLayer />
      <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
        <div className="plant-trail" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((leaf) => (
            <svg
              className="plant-trail__leaf"
              fill="none"
              key={leaf}
              viewBox="0 0 64 64"
            >
              <path
                d="M32 55C25 42 19 27 33 10c16 9 18 27 5 41"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
              <path
                d="M32 55c1-14 2-25 9-36"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="4"
              />
            </svg>
          ))}
        </div>

        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="mb-4 w-fit rounded-full border border-ink/15 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sticker backdrop-blur">
              neighborhood feed
            </p>
            <h1 className="max-w-3xl text-6xl font-black uppercase leading-[0.85] md:text-8xl">
              Share shelf
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-ink/75">
              Post extra food from your pantry, reverify it with a fresh photo,
              and let nearby neighbors request a meetup for what they can use.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="metric-card bg-phthalo text-white">
              <span>Posts</span>
              <strong>{sharePosts.length}</strong>
            </div>
            <div className="metric-card bg-citrus text-ink">
              <span>Open</span>
              <strong>{availableCount}</strong>
            </div>
            <div className="metric-card bg-white text-ink">
              <span>Requested</span>
              <strong>{claimedCount}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pt-8 md:px-10">
        <div className="pantry-card grid gap-4 xl:mr-96 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
          <label className="block">
            <span className="pantry-field-label">Search marketplace</span>
            <input
              className="pantry-input"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search items, locations, claims, descriptions..."
              type="search"
              value={searchTerm}
            />
          </label>

          <div>
            <p className="pantry-field-label">Filter posts</p>
            <div className="flex flex-wrap gap-2">
              {feedFilters.map((filter) => (
                <button
                  className={`pantry-filter-button ${
                    activeFilter === filter ? 'pantry-filter-button--active' : ''
                  }`}
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <button
            className="pantry-button h-fit"
            disabled={status === 'loading'}
            onClick={() => {
              if (!isAuthed) {
                toast.info('Please log in to share an item.')
                navigate('/login', { state: { from: { pathname: '/marketplace' } } })
                return
              }

              setIsShareModalOpen(true)
            }}
            type="button"
          >
            Share item
          </button>

          <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/55 lg:col-span-3">
            Showing {filteredPosts.length} of {sharePosts.length}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 md:px-10 xl:pr-96">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post, index) => (
            <MarketplacePostCard
              index={index}
              isInCart={cartPostIds.includes(post.id)}
              key={post.id}
              onAddToCart={addPostToCart}
              onClaimPost={claimPost}
              post={post}
            />
          ))}

          {postsLoading && (
            <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-3">
              Loading marketplace posts...
            </p>
          )}

          {!postsLoading && filteredPosts.length === 0 && (
            <p className="pantry-card text-sm font-black uppercase tracking-[0.14em] text-ink/60 sm:col-span-2 lg:col-span-3">
              No share posts match this search.
            </p>
          )}
        </div>
      </section>

      <div
        className={`market-cart-dock ${basketPosition ? 'market-cart-dock--moved' : ''}`}
        ref={basketDockRef}
        style={
          basketPosition
            ? {
                transform: `translate3d(${basketPosition.x}px, ${basketPosition.y}px, 0)`,
              }
            : undefined
        }
      >
        <MarketplaceCart
          cartPosts={cartPosts}
          isOpen={isCartOpen}
          onAddPost={addPostToCart}
          onClaimCart={claimCart}
          onMoveStart={startBasketMove}
          onRemovePost={removePostFromCart}
          onToggleOpen={() => setIsCartOpen((currentValue) => !currentValue)}
        />
      </div>

      {isShareModalOpen && (
        <SharePostModal
          form={form}
          isSaving={postsSaving}
          onClose={() => setIsShareModalOpen(false)}
          onImageUpload={handleImageUpload}
          onSubmit={handleSubmit}
          onUpdateForm={updateForm}
          postSuggestions={sharePosts}
          reverifiedFoodItem={reverifiedFoodItem}
        />
      )}
      </main>
    </DndProvider>
  )
}
