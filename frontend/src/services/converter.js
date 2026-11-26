const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function convertModel(file, targetFormat) {
  const form = new FormData()
  form.append('file', file)
  form.append('target_format', targetFormat)

  const response = await fetch(`${API_BASE}/api/convert`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    let message = 'Conversion failed. Please try another file.'
    try {
      const payload = await response.json()
      message = payload.detail || message
    } catch {
      // Keep the default message when the server response isn't JSON.
    }
    throw new Error(message)
  }

  const disposition = response.headers.get('content-disposition') || ''
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  return { blob: await response.blob(), filename }
}
