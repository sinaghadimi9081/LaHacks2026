import client from './axiosClient.jsx'

export async function apiFetch(path, method, body = null, config = {}) {
  const normalizedMethod = method.toUpperCase()
  const requestConfig =
    typeof FormData !== 'undefined' && body instanceof FormData
      ? {
          ...config,
          headers: {
            ...(config.headers || {}),
            'Content-Type': undefined,
          },
        }
      : config

  if (normalizedMethod === 'GET') {
    const response = await client.get(path, requestConfig)
    return response.data
  }

  if (normalizedMethod === 'POST') {
    const response = await client.post(path, body, requestConfig)
    return response.data
  }

  if (normalizedMethod === 'PUT') {
    const response = await client.put(path, body, requestConfig)
    return response.data
  }

  if (normalizedMethod === 'PATCH') {
    const response = await client.patch(path, body, requestConfig)
    return response.data
  }

  if (normalizedMethod === 'DELETE') {
    const response = await client.delete(path, { ...requestConfig, data: body })
    return response.data
  }

  throw new Error(`Unsupported method: ${method}`)
}
