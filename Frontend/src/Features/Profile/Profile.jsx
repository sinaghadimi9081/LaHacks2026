import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'
import {
  acceptHouseholdInvitation,
  declineHouseholdInvitation,
  fetchHouseholdInvitations,
  fetchMyHousehold,
  fetchMyHouseholdInvitations,
  inviteHouseholdMember,
  removeHouseholdMember,
} from '../../Utils/householdApi.jsx'
import {
  createSharePost,
  deleteSharePost,
  fetchMySharePosts,
  updateSharePost,
} from '../../Utils/shareApi.jsx'
import MarketplacePostForm from '../Marketplace/components/MarketplacePostForm.jsx'

const marketTagStyles = [
  'bg-citrus rotate-[-6deg]',
  'bg-petal rotate-[5deg]',
  'bg-moonstone rotate-[-4deg]',
]

function getDefaultExpirationDate() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

const emptyPostForm = {
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

function parseTagInput(value) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function toPostForm(post) {
  return {
    item_name: post.item_name || post.food_item?.name || '',
    quantity_label: post.quantity_label || post.food_item?.quantity || '',
    estimated_price: post.estimated_price ?? post.food_item?.estimated_price ?? '',
    title: post.title || '',
    description: post.description || '',
    expiration_date: post.expiration_date || post.food_item?.expiration_date || '',
    pickup_location: post.pickup_location || '',
    pickup_latitude: post.pickup_latitude ?? '',
    pickup_longitude: post.pickup_longitude ?? '',
    tags: (post.tags || post.food_item?.recipe_uses || []).join(', '),
  }
}

function ProfileCard({ title, children }) {
  return (
    <section className="pantry-card">
      <p className="pantry-label">
        {title}
      </p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export default function Profile() {
  const { user, refreshUser, saveProfile, saveHousehold } = useAuth()
  const [profileDraft, setProfileDraft] = useState({})
  const [householdDraft, setHouseholdDraft] = useState({})
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingHousehold, setSavingHousehold] = useState(false)
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [householdMembers, setHouseholdMembers] = useState([])
  const [incomingInvitations, setIncomingInvitations] = useState([])
  const [ownerInvitations, setOwnerInvitations] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [inviteFeaturesAvailable, setInviteFeaturesAvailable] = useState(true)
  const [memberActionsAvailable, setMemberActionsAvailable] = useState(true)
  const [myPosts, setMyPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsSaving, setPostsSaving] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState(null)
  const [postForm, setPostForm] = useState(emptyPostForm)
  const [postVerificationImage, setPostVerificationImage] = useState('')
  const [postVerificationFile, setPostVerificationFile] = useState(null)
  const [editingPostId, setEditingPostId] = useState(null)
  const [editingPostForm, setEditingPostForm] = useState(emptyPostForm)

  const householdOptions = useMemo(() => user?.households ?? [], [user?.households])
  const activeMembership = useMemo(
    () =>
      householdOptions.find((household) => household.id === user?.default_household?.id) || null,
    [householdOptions, user?.default_household?.id],
  )
  const canManageMembers = activeMembership?.role === 'owner'
  const profileImageUrl = user?.profile_image_url || user?.profile_image || ''
  const profileInitial = (user?.display_name || user?.username || 'N').slice(0, 1).toUpperCase()
  const profileForm = {
    display_name: profileDraft.display_name ?? user?.display_name ?? '',
    first_name: profileDraft.first_name ?? user?.first_name ?? '',
    last_name: profileDraft.last_name ?? user?.last_name ?? '',
    default_household_id:
      profileDraft.default_household_id ?? user?.default_household?.id ?? '',
  }
  const householdForm = {
    name: householdDraft.name ?? user?.default_household?.name ?? '',
  }
  const reverifiedPostFoodItem = useMemo(
    () => ({
      image: postVerificationImage || '/favicon.svg',
    }),
    [postVerificationImage],
  )

  useEffect(() => {
    let isActive = true

    async function loadMembers() {
      if (!user?.default_household?.id) {
        if (!isActive) return
        setHouseholdMembers([])
        setMembersLoading(false)
        return
      }

      setMembersLoading(true)

      try {
        const response = await fetchMyHousehold()
        if (!isActive) return
        const nextMembers = response?.household?.members || response?.members || []
        setHouseholdMembers(nextMembers)
      } catch {
        if (!isActive) return
        setHouseholdMembers([])
      } finally {
        if (isActive) {
          setMembersLoading(false)
        }
      }
    }

    void loadMembers()

    return () => {
      isActive = false
    }
  }, [user?.default_household?.id])

  useEffect(() => {
    let isActive = true

    async function loadInvitations() {
      if (!user?.id) {
        if (!isActive) return
        setIncomingInvitations([])
        setOwnerInvitations([])
        setInvitesLoading(false)
        return
      }

      setInvitesLoading(true)

      try {
        const [incomingResponse, ownerResponse] = await Promise.all([
          fetchMyHouseholdInvitations(),
          fetchHouseholdInvitations(),
        ])

        if (!isActive) return
        setIncomingInvitations(incomingResponse?.invitations || incomingResponse || [])
        setOwnerInvitations(ownerResponse?.invitations || ownerResponse || [])
        setInviteFeaturesAvailable(true)
      } catch (error) {
        if (!isActive) return

        if (error?.response?.status === 404) {
          setInviteFeaturesAvailable(false)
          setIncomingInvitations([])
          setOwnerInvitations([])
        }
      } finally {
        if (isActive) {
          setInvitesLoading(false)
        }
      }
    }

    void loadInvitations()

    return () => {
      isActive = false
    }
  }, [user?.id, user?.default_household?.id])

  useEffect(() => {
    let isActive = true

    async function loadMyPosts() {
      if (!user?.id) {
        if (!isActive) return
        setMyPosts([])
        setPostsLoading(false)
        return
      }

      setPostsLoading(true)

      try {
        const response = await fetchMySharePosts()
        if (!isActive) return
        setMyPosts(response?.posts || [])
      } catch (error) {
        if (!isActive) return
        setMyPosts([])
        toast.error(getErrorMessage(error, 'Failed to load your marketplace posts.'))
      } finally {
        if (isActive) {
          setPostsLoading(false)
        }
      }
    }

    void loadMyPosts()

    return () => {
      isActive = false
    }
  }, [user?.id])

  const handleProfileChange = (event) => {
    const { name, value } = event.target
    setProfileDraft((current) => ({ ...current, [name]: value }))
  }

  const handleHouseholdChange = (event) => {
    const { name, value } = event.target
    setHouseholdDraft((current) => ({ ...current, [name]: value }))
  }

  const handlePostFormChange = (fieldOrEvent, nextValue) => {
    if (typeof fieldOrEvent === 'string') {
      setPostForm((current) => ({ ...current, [fieldOrEvent]: nextValue }))
      return
    }

    const { name, value } = fieldOrEvent.target
    setPostForm((current) => ({ ...current, [name]: value }))
  }

  const handleEditingPostChange = (event) => {
    const { name, value } = event.target
    setEditingPostForm((current) => ({ ...current, [name]: value }))
  }

  const handlePostImageUpload = (event) => {
    const file = event.target.files?.[0]

    setPostVerificationFile(file || null)
    setPostVerificationImage(file ? URL.createObjectURL(file) : '')
  }

  const submitProfile = async (event) => {
    event.preventDefault()
    setSavingProfile(true)

    try {
      const payload = new FormData()
      payload.append('display_name', profileForm.display_name)
      payload.append('first_name', profileForm.first_name)
      payload.append('last_name', profileForm.last_name)

      if (profileForm.default_household_id) {
        payload.append('default_household_id', String(profileForm.default_household_id))
      }

      if (profileImageFile) {
        payload.append('profile_image', profileImageFile)
      }

      await saveProfile(payload)
      setProfileDraft({})
      setProfileImageFile(null)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Profile update failed.'))
    } finally {
      setSavingProfile(false)
    }
  }

  const submitHousehold = async (event) => {
    event.preventDefault()
    setSavingHousehold(true)

    try {
      await saveHousehold(householdForm)
      setHouseholdDraft({})
    } catch (error) {
      toast.error(getErrorMessage(error, 'Household update failed.'))
    } finally {
      setSavingHousehold(false)
    }
  }

  const submitInvite = async (event) => {
    event.preventDefault()
    setSendingInvite(true)

    try {
      await inviteHouseholdMember(inviteEmail.trim())
      setInviteEmail('')
      toast.success('Invitation sent.')
      const ownerResponse = await fetchHouseholdInvitations()
      setOwnerInvitations(ownerResponse?.invitations || ownerResponse || [])
      setInviteFeaturesAvailable(true)
    } catch (error) {
      if (error?.response?.status === 404) {
        setInviteFeaturesAvailable(false)
        toast.error('Invite endpoints are not available on this backend branch yet.')
      } else {
        toast.error(getErrorMessage(error, 'Invitation failed.'))
      }
    } finally {
      setSendingInvite(false)
    }
  }

  const handleInvitationAction = async (invitationId, action) => {
    try {
      if (action === 'accept') {
        await acceptHouseholdInvitation(invitationId)
        toast.success('Invitation accepted.')
      } else {
        await declineHouseholdInvitation(invitationId)
        toast.success('Invitation declined.')
      }

      await refreshUser()

      const incomingResponse = await fetchMyHouseholdInvitations()
      setIncomingInvitations(incomingResponse?.invitations || incomingResponse || [])
    } catch (error) {
      if (error?.response?.status === 404) {
        setInviteFeaturesAvailable(false)
        toast.error('Invite endpoints are not available on this backend branch yet.')
      } else {
        toast.error(getErrorMessage(error, 'Invitation update failed.'))
      }
    }
  }

  const handleRemoveMember = async (member) => {
    try {
      await removeHouseholdMember(member.user_id)
      setHouseholdMembers((current) => current.filter((item) => item.user_id !== member.user_id))
      toast.success('Member removed.')
    } catch (error) {
      if (error?.response?.status === 404) {
        setMemberActionsAvailable(false)
        toast.error('Member management endpoints are not available on this backend branch yet.')
      } else {
        toast.error(getErrorMessage(error, 'Failed to remove member.'))
      }
    }
  }

  const buildPostPayload = (formState, imageFile = null) => {
    if (imageFile) {
      const payload = new FormData()

      payload.append('item_name', formState.item_name.trim())
      payload.append('quantity_label', formState.quantity_label.trim())
      payload.append('title', formState.item_name.trim())
      payload.append('description', formState.description.trim())
      payload.append('expiration_date', formState.expiration_date)
      payload.append('pickup_location', formState.pickup_location.trim())
      payload.append('image_file', imageFile)

      if (formState.estimated_price !== undefined && formState.estimated_price !== '') {
        payload.append('estimated_price', formState.estimated_price)
      }

      return payload
    }

    const payload = {
      item_name: formState.item_name.trim(),
      quantity_label: formState.quantity_label.trim(),
      title: formState.item_name.trim(),
      description: formState.description.trim(),
      expiration_date: formState.expiration_date,
      pickup_location: formState.pickup_location.trim(),
      tags: parseTagInput(formState.tags || ''),
      pickup_latitude: formState.pickup_latitude === '' ? null : formState.pickup_latitude,
      pickup_longitude: formState.pickup_longitude === '' ? null : formState.pickup_longitude,
    }

    if (formState.estimated_price !== '') {
      payload.estimated_price = formState.estimated_price
    }

    return payload
  }

  const submitPost = async (event) => {
    event.preventDefault()
    setPostsSaving(true)

    try {
      const createdPost = await createSharePost(
        buildPostPayload(postForm, postVerificationFile),
      )
      setMyPosts((current) => [createdPost, ...current])
      setPostForm({ ...emptyPostForm, expiration_date: getDefaultExpirationDate() })
      setPostVerificationImage('')
      setPostVerificationFile(null)
      event.currentTarget.reset()
      toast.success('Marketplace post created.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create marketplace post.'))
    } finally {
      setPostsSaving(false)
    }
  }

  const startEditingPost = (post) => {
    setEditingPostId(post.id)
    setEditingPostForm(toPostForm(post))
  }

  const cancelEditingPost = () => {
    setEditingPostId(null)
    setEditingPostForm(emptyPostForm)
  }

  const submitPostUpdate = async (postId) => {
    setPostsSaving(true)

    try {
      const updatedPost = await updateSharePost(postId, buildPostPayload(editingPostForm))
      setMyPosts((current) =>
        current.map((post) => (post.id === postId ? updatedPost : post)),
      )
      cancelEditingPost()
      toast.success('Marketplace post updated.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update marketplace post.'))
    } finally {
      setPostsSaving(false)
    }
  }

  const removePost = async (postId) => {
    setDeletingPostId(postId)

    try {
      await deleteSharePost(postId)
      setMyPosts((current) => current.filter((post) => post.id !== postId))
      if (editingPostId === postId) {
        cancelEditingPost()
      }
      toast.success('Marketplace post deleted.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete marketplace post.'))
    } finally {
      setDeletingPostId(null)
    }
  }

  return (
    <main className="pantry-shell">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <ProfileCard title="User summary">
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-phthalo p-6 text-white shadow-pop">
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                  {profileImageUrl ? (
                    <img
                      alt={`${user?.display_name || user?.username} profile`}
                      className="h-20 w-20 rounded-3xl border-4 border-white/20 object-cover shadow-sticker"
                      src={profileImageUrl}
                    />
                  ) : (
                    <div className="grid h-20 w-20 place-items-center rounded-3xl border-4 border-white/20 bg-white/10 text-3xl font-black text-white shadow-sticker">
                      {profileInitial}
                    </div>
                  )}

                  <div>
                    <p className="text-3xl font-black">
                      {user?.display_name || user?.username}
                    </p>
                    <p className="mt-2 font-bold text-white/80">{user?.email}</p>
                    <p className="mt-4 text-sm font-bold text-white/60">
                      Signed in with cookie-based JWT auth.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-ink/15 bg-citrus p-4 shadow-sticker">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/70">
                    Default household
                  </p>
                  <p className="mt-2 text-lg font-black text-ink">
                    {user?.default_household?.name}
                  </p>
                </div>

                <div className="rounded-xl border border-ink/15 bg-moonstone p-4 shadow-sticker">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/70">
                    Known households
                  </p>
                  <p className="mt-2 text-lg font-black text-ink">
                    {householdOptions.length}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-ink/15 bg-white/90 p-5 shadow-sticker">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/70">
                  Marketplace preview
                </p>
                <div className="mt-4 flex items-center gap-4">
                  {profileImageUrl ? (
                    <img
                      alt={`${user?.username} marketplace`}
                      className="h-14 w-14 rounded-2xl object-cover shadow-sticker"
                      src={profileImageUrl}
                    />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-petal text-lg font-black text-ink shadow-sticker">
                      {profileInitial}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-black text-ink">@{user?.username}</p>
                    <p className="text-sm font-bold text-ink/65">
                      {user?.display_name || user?.username}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard title="Profile settings">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitProfile}>
              <label className="block">
                <span className="pantry-field-label">
                  Display name
                </span>
                <input
                  className="pantry-input"
                  name="display_name"
                  onChange={handleProfileChange}
                  value={profileForm.display_name}
                />
              </label>

              <label className="block">
                <span className="pantry-field-label">
                  Default household
                </span>
                <select
                  className="pantry-input"
                  name="default_household_id"
                  onChange={handleProfileChange}
                  value={profileForm.default_household_id}
                >
                  {householdOptions.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="pantry-field-label">
                  First name
                </span>
                <input
                  className="pantry-input"
                  name="first_name"
                  onChange={handleProfileChange}
                  value={profileForm.first_name}
                />
              </label>

              <label className="block">
                <span className="pantry-field-label">
                  Last name
                </span>
                <input
                  className="pantry-input"
                  name="last_name"
                  onChange={handleProfileChange}
                  value={profileForm.last_name}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="pantry-field-label">
                  Profile picture
                </span>
                <input
                  accept="image/*"
                  className="pantry-input file:mr-4 file:rounded-full file:border-0 file:bg-citrus file:px-4 file:py-2 file:font-black file:text-ink"
                  onChange={(event) => setProfileImageFile(event.target.files?.[0] || null)}
                  type="file"
                />
                <p className="mt-2 text-sm font-bold text-ink/55">
                  Optional now, but ready for the marketplace and future family views.
                </p>
              </label>

              <div className="md:col-span-2">
                <button
                  className="pantry-button"
                  disabled={savingProfile}
                  type="submit"
                >
                  {savingProfile ? 'Saving profile...' : 'Save profile'}
                </button>
              </div>
            </form>
          </ProfileCard>

          <ProfileCard title="Household members">
            <div className="space-y-3">
              {membersLoading ? (
                <p className="text-sm font-bold text-ink/60">Loading household members...</p>
              ) : householdMembers.length ? (
                householdMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="rounded-xl border border-ink/15 bg-white/85 p-4 shadow-sticker"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-black text-ink">
                          {member.display_name || member.username}
                        </p>
                        <p className="mt-1 text-sm font-bold text-ink/60">
                          @{member.username} · {member.email}
                        </p>
                        <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-ink/55">
                          {member.role} · {member.status}
                        </p>
                      </div>

                      {canManageMembers && member.user_id !== user?.id ? (
                        <button
                          className="pantry-button pantry-button--light"
                          onClick={() => void handleRemoveMember(member)}
                          type="button"
                        >
                          Remove member
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm font-bold text-ink/60">No members found for this household yet.</p>
              )}

              {!memberActionsAvailable ? (
                <p className="text-sm font-bold text-danger">
                  Member management routes are not available on the current backend branch yet.
                </p>
              ) : null}
            </div>
          </ProfileCard>
        </div>

        <div className="space-y-6">
          <ProfileCard title="Household settings">
            <form className="space-y-4" onSubmit={submitHousehold}>
              <label className="block">
                <span className="pantry-field-label">
                  Household name
                </span>
                <input
                  className="pantry-input"
                  name="name"
                  onChange={handleHouseholdChange}
                  value={householdForm.name}
                />
              </label>

              <button
                className="pantry-button pantry-button--accent"
                disabled={savingHousehold}
                type="submit"
              >
                {savingHousehold ? 'Saving household...' : 'Save household'}
              </button>
            </form>
          </ProfileCard>

          <ProfileCard title="Invitations">
            <div className="space-y-5">
              {inviteFeaturesAvailable && canManageMembers ? (
                <form className="space-y-3" onSubmit={submitInvite}>
                  <label className="block">
                    <span className="pantry-field-label">
                      Invite by email
                    </span>
                    <input
                      className="pantry-input"
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="friend@example.com"
                      type="email"
                      value={inviteEmail}
                    />
                  </label>

                  <button
                    className="pantry-button pantry-button--accent"
                    disabled={sendingInvite || !inviteEmail.trim()}
                    type="submit"
                  >
                    {sendingInvite ? 'Sending invite...' : 'Send invite'}
                  </button>
                </form>
              ) : null}

              {!inviteFeaturesAvailable ? (
                <p className="text-sm font-bold text-danger">
                  Invite endpoints are not available on the current backend branch yet.
                </p>
              ) : null}

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/60">
                  Incoming invites
                </p>

                {invitesLoading ? (
                  <p className="text-sm font-bold text-ink/60">Loading invitations...</p>
                ) : incomingInvitations.length ? (
                  incomingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="rounded-xl border border-ink/15 bg-white/85 p-4 shadow-sticker"
                    >
                      <p className="text-sm font-black text-ink">
                        {invitation.household_name || invitation.household?.name || 'Household invite'}
                      </p>
                      <p className="mt-1 text-sm font-bold text-ink/60">
                        Invited by {invitation.invited_by_name || invitation.invited_by?.display_name || 'a household owner'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          className="pantry-button pantry-button--accent"
                          onClick={() => void handleInvitationAction(invitation.id, 'accept')}
                          type="button"
                        >
                          Accept
                        </button>
                        <button
                          className="pantry-button pantry-button--light"
                          onClick={() => void handleInvitationAction(invitation.id, 'decline')}
                          type="button"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-ink/60">No pending invites.</p>
                )}
              </div>

              {canManageMembers ? (
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/60">
                    Sent invites
                  </p>

                  {ownerInvitations.length ? (
                    ownerInvitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="rounded-xl border border-ink/15 bg-white/85 p-4 shadow-sticker"
                      >
                        <p className="text-sm font-black text-ink">
                          {invitation.invited_email || invitation.email}
                        </p>
                        <p className="mt-1 text-sm font-bold text-ink/60">
                          Status: {invitation.status || 'pending'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-bold text-ink/60">No sent invites yet.</p>
                  )}
                </div>
              ) : null}
            </div>
          </ProfileCard>

          <ProfileCard title="My marketplace posts">
            <div className="space-y-5">
              <MarketplacePostForm
                form={postForm}
                isSaving={postsSaving}
                onImageUpload={handlePostImageUpload}
                onSubmit={submitPost}
                onUpdateForm={handlePostFormChange}
                postSuggestions={myPosts}
                reverifiedFoodItem={reverifiedPostFoodItem}
                submitLabel="Create post"
              />

              {postsLoading ? (
                <p className="text-sm font-bold text-ink/60">Loading your posts...</p>
              ) : myPosts.length ? (
                <div className="space-y-4">
                  {myPosts.map((post) => {
                    const isEditing = editingPostId === post.id
                    const activeForm = isEditing ? editingPostForm : toPostForm(post)

                    return (
                      <div
                        key={post.id}
                        className="rounded-2xl border border-ink/15 bg-white/90 p-5 shadow-sticker"
                      >
                        {isEditing ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="pantry-field-label">
                                Post title
                              </span>
                              <input
                                className="pantry-input"
                                name="item_name"
                                onChange={handleEditingPostChange}
                                value={activeForm.item_name}
                              />
                            </label>

                            <label className="block">
                              <span className="pantry-field-label">
                                Quantity
                              </span>
                              <input
                                className="pantry-input"
                                name="quantity_label"
                                onChange={handleEditingPostChange}
                                value={activeForm.quantity_label}
                              />
                            </label>

                            <label className="block md:col-span-2">
                              <span className="pantry-field-label">
                                Description
                              </span>
                              <textarea
                                className="pantry-input min-h-24 resize-y"
                                name="description"
                                onChange={handleEditingPostChange}
                                value={activeForm.description}
                              />
                            </label>

                            <label className="block">
                              <span className="pantry-field-label">
                                Pickup location
                              </span>
                              <input
                                className="pantry-input"
                                name="pickup_location"
                                onChange={handleEditingPostChange}
                                value={activeForm.pickup_location}
                              />
                            </label>

                            <label className="block">
                              <span className="pantry-field-label">
                                Estimated price
                              </span>
                              <input
                                className="pantry-input"
                                name="estimated_price"
                                onChange={handleEditingPostChange}
                                step="0.01"
                                type="number"
                                value={activeForm.estimated_price}
                              />
                            </label>

                            <label className="block">
                              <span className="pantry-field-label">
                                Latitude
                              </span>
                              <input
                                className="pantry-input"
                                name="pickup_latitude"
                                onChange={handleEditingPostChange}
                                step="0.000001"
                                type="number"
                                value={activeForm.pickup_latitude}
                              />
                            </label>

                            <label className="block">
                              <span className="pantry-field-label">
                                Longitude
                              </span>
                              <input
                                className="pantry-input"
                                name="pickup_longitude"
                                onChange={handleEditingPostChange}
                                step="0.000001"
                                type="number"
                                value={activeForm.pickup_longitude}
                              />
                            </label>

                            <label className="block md:col-span-2">
                              <span className="pantry-field-label">
                                Tags
                              </span>
                              <input
                                className="pantry-input"
                                name="tags"
                                onChange={handleEditingPostChange}
                                value={activeForm.tags}
                              />
                            </label>

                            <div className="flex flex-wrap gap-3 md:col-span-2">
                              <button
                                className="pantry-button pantry-button--accent"
                                disabled={postsSaving}
                                onClick={() => void submitPostUpdate(post.id)}
                                type="button"
                              >
                                {postsSaving ? 'Saving...' : 'Save changes'}
                              </button>
                              <button
                                className="pantry-button pantry-button--light"
                                onClick={cancelEditingPost}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-tomato">
                                  @{post.owner?.username || user?.username || 'you'}
                                </p>
                                <h3 className="mt-1 text-2xl font-black uppercase leading-none text-ink">
                                  {post.title || post.item_name || post.food_item?.name}
                                </h3>
                                <p className="mt-3 text-sm font-bold leading-7 text-ink/70">
                                  {post.description || 'No extra details added yet.'}
                                </p>
                              </div>

                              <span className="rounded-full border-2 border-ink bg-citrus px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-ink">
                                {post.status}
                              </span>
                            </div>

                            <dl className="receipt-lines">
                              <div>
                                <dt>pickup</dt>
                                <dd>{post.pickup_location}</dd>
                              </div>
                              <div>
                                <dt>quantity</dt>
                                <dd>{post.quantity_label || post.food_item?.quantity || 'n/a'}</dd>
                              </div>
                              <div>
                                <dt>price</dt>
                                <dd>${Number(post.estimated_price || 0).toFixed(2)}</dd>
                              </div>
                            </dl>

                            {post.pickup_latitude && post.pickup_longitude ? (
                              <p className="text-sm font-bold text-ink/55">
                                Point: {post.pickup_latitude}, {post.pickup_longitude}
                              </p>
                            ) : null}

                            {(post.tags || []).length ? (
                              <div className="flex flex-wrap gap-2">
                                {post.tags.map((tag, tagIndex) => (
                                  <span
                                    className={`rounded-full border border-ink/15 px-2.5 py-1 text-[0.65rem] font-black uppercase shadow-sticker ${marketTagStyles[tagIndex % marketTagStyles.length]}`}
                                    key={`${post.id}-${tag}`}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            <div className="flex flex-wrap gap-3">
                              <button
                                className="pantry-button pantry-button--accent"
                                onClick={() => startEditingPost(post)}
                                type="button"
                              >
                                Edit post
                              </button>
                              <button
                                className="pantry-button pantry-button--light"
                                disabled={deletingPostId === post.id}
                                onClick={() => void removePost(post.id)}
                                type="button"
                              >
                                {deletingPostId === post.id ? 'Deleting...' : 'Delete post'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm font-bold text-ink/60">
                  You have not posted anything to the marketplace yet.
                </p>
              )}
            </div>
          </ProfileCard>

          <ProfileCard title="Memberships">
            <div className="space-y-3">
              {householdOptions.map((household) => (
                <div
                  key={household.id}
                  className="rounded-xl border border-ink/15 bg-white/85 p-4 shadow-sticker"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-ink">
                        {household.name}
                      </p>
                      <p className="mt-1 text-sm font-bold text-ink/60">
                        Role: {household.role || 'member'}
                      </p>
                    </div>
                    <span className="rounded-full border-2 border-ink bg-petal px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-ink">
                      {household.status || 'active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ProfileCard>
        </div>
      </div>
    </main>
  )
}
