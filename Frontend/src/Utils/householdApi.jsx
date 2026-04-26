import { apiFetch } from './apiFetch.jsx'

export function fetchMyHousehold() {
  return apiFetch('/households/me/', 'GET')
}

export function updateMyHousehold(payload) {
  return apiFetch('/households/me/', 'PATCH', payload)
}

export function fetchHouseholdMembers() {
  return apiFetch('/households/me/members/', 'GET')
}

export function updateHouseholdMember(memberId, payload) {
  return apiFetch(`/households/members/${memberId}/`, 'PATCH', payload)
}

export function removeHouseholdMember(memberId) {
  return apiFetch(`/households/members/${memberId}/`, 'DELETE')
}

export function inviteHouseholdMember(email) {
  return apiFetch('/households/me/invitations/', 'POST', { email })
}

export function fetchHouseholdInvitations() {
  return apiFetch('/households/me/invitations/', 'GET')
}

export function fetchMyHouseholdInvitations() {
  return apiFetch('/households/invitations/', 'GET')
}

export function acceptHouseholdInvitation(invitationId) {
  return apiFetch(`/households/invitations/${invitationId}/accept/`, 'PATCH', {})
}

export function declineHouseholdInvitation(invitationId) {
  return apiFetch(`/households/invitations/${invitationId}/decline/`, 'PATCH', {})
}
