import client from './axiosClient.jsx'

export async function apiFetch(path, method, body = null, config = {}) {
  const normalizedMethod = method.toUpperCase()

  if (normalizedMethod === 'GET') {
    const response = await client.get(path, config)
    return response.data
  }

  if (normalizedMethod === 'POST') {
    const response = await client.post(path, body, config)
    return response.data
  }

  if (normalizedMethod === 'PUT') {
    const response = await client.put(path, body, config)
    return response.data
  }

  if (normalizedMethod === 'PATCH') {
    const response = await client.patch(path, body, config)
    return response.data
  }

  if (normalizedMethod === 'DELETE') {
    const response = await client.delete(path, { ...config, data: body })
    return response.data
  }

  throw new Error(`Unsupported method: ${method}`)
}
