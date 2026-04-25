import { apiFetch } from './apiFetch.jsx'

export function fetchImpact() {
  return apiFetch('/impact/', 'GET')
}
