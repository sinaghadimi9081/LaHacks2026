import { apiFetch } from './apiFetch.jsx'

export function fetchImpact() {
  return apiFetch('/impact/', 'GET')
}

export function fetchImpactTips() {
  return apiFetch('/impact/tips/', 'POST', {})
}
