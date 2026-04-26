import { apiFetch } from './apiFetch.jsx'

export function uploadReceipt(formData) {
  return apiFetch('/receipts/upload/', 'POST', formData)
}

export function fetchReceipt(receiptId) {
  return apiFetch(`/receipts/${receiptId}/`, 'GET')
}

export function searchReceiptsByVendor(vendorName) {
  const query = new URLSearchParams({ vendor_name: vendorName })
  return apiFetch(`/receipts/search/?${query.toString()}`, 'GET')
}

export function confirmReceipt(receiptId, payload) {
  return apiFetch(`/receipts/${receiptId}/confirm/`, 'POST', payload)
}
