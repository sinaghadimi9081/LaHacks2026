import { apiFetch } from './apiFetch.jsx'

function buildShareQuery(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          searchParams.append(key, item)
        }
      })
      return
    }

    searchParams.append(key, value)
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export function createSharePost(payload) {
  return apiFetch('/share/', 'POST', payload)
}

export function fetchShareFeed(params = {}) {
  return apiFetch(`/share/feed/${buildShareQuery(params)}`, 'GET')
}

export function fetchMySharePosts(params = {}) {
  return apiFetch(`/share/mine/${buildShareQuery(params)}`, 'GET')
}

export function fetchSharePost(sharePostId) {
  return apiFetch(`/share/${sharePostId}/`, 'GET')
}

export function updateSharePost(sharePostId, payload) {
  return apiFetch(`/share/${sharePostId}/`, 'PATCH', payload)
}

export function deleteSharePost(sharePostId) {
  return apiFetch(`/share/${sharePostId}/`, 'DELETE')
}

export function claimSharePost(sharePostId, payload = {}) {
  return apiFetch(`/share/${sharePostId}/claim/`, 'PATCH', payload)
}
