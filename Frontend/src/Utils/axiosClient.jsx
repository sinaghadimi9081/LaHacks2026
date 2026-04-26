import axios from 'axios'

import { getCookie } from './cookies.jsx'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

const client = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
})

client.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase()
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json'
  }

  if (needsCsrf) {
    const csrfToken = getCookie('csrftoken')
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken
    }
  }

  return config
})

export default client
