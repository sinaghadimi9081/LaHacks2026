import { apiFetch } from './apiFetch.jsx'

export function uploadReceipt(formData) {
  return apiFetch('/receipts/upload/', 'POST', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export function fetchReceipt(receiptId) {
  return apiFetch(`/receipts/${receiptId}/`, 'GET')
}

export function confirmReceipt(receiptId, payload) {
  return apiFetch(`/receipts/${receiptId}/confirm/`, 'POST', payload)
}
