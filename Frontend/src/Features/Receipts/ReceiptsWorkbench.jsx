import { startTransition, useMemo, useState } from 'react'

import { fetchReceipt, uploadReceipt } from '../../Utils/receiptsApi.jsx'

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') {
    return 'N/A'
  }

  const amount = Number(value)
  if (Number.isNaN(amount)) {
    return String(value)
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatTimestamp(value) {
  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallbackMessage
}

export default function ReceiptsWorkbench() {
  const configuredApiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'
  const apiBaseUrl = configuredApiBaseUrl.replace(/\/$/, '')

  const [selectedFile, setSelectedFile] = useState(null)
  const [receiptIdInput, setReceiptIdInput] = useState('')
  const [receiptData, setReceiptData] = useState(null)
  const [statusMessage, setStatusMessage] = useState(
    'Choose a receipt image, upload it, and inspect the parsed draft items below.',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false)

  const parsedItems = receiptData?.parsed_items ?? []
  const selectedItemCount = parsedItems.filter((item) => item.selected).length
  const estimatedTotal = useMemo(
    () =>
      parsedItems.reduce((sum, item) => {
        const price = Number(item.estimated_price)
        if (Number.isNaN(price)) {
          return sum
        }

        return sum + price
      }, 0),
    [parsedItems],
  )
  const parsedItemTotal = receiptData?.parsed_item_total ?? estimatedTotal
  const detectedTotal = receiptData?.detected_total ?? null
  const parsedItemTotalNumber = Number(parsedItemTotal)
  const detectedTotalNumber = Number(detectedTotal)
  const totalsAreComparable =
    !Number.isNaN(parsedItemTotalNumber) && !Number.isNaN(detectedTotalNumber)
  const totalDifference = totalsAreComparable
    ? detectedTotalNumber - parsedItemTotalNumber
    : null
  const hasMeaningfulTotalGap =
    totalDifference !== null && Math.abs(totalDifference) >= 0.01

  async function handleUpload(event) {
    event.preventDefault()

    if (!selectedFile) {
      setErrorMessage('Select a receipt image before uploading.')
      return
    }

    const formData = new FormData()
    formData.append('image', selectedFile)

    setIsUploading(true)
    setErrorMessage('')
    setStatusMessage(`Uploading ${selectedFile.name} and running OCR...`)

    try {
      const payload = await uploadReceipt(formData)
      startTransition(() => {
        setReceiptData(payload)
        setReceiptIdInput(String(payload.receipt_id))
      })
      setStatusMessage(
        `Parsed receipt #${payload.receipt_id}. Review the draft items before saving anything to the pantry.`,
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          'Receipt upload failed. Check that the Django server is running.',
        ),
      )
      setStatusMessage('Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleLoadReceipt(event) {
    event.preventDefault()

    if (!receiptIdInput.trim()) {
      setErrorMessage('Enter a receipt ID to load an existing upload.')
      return
    }

    setIsLoadingReceipt(true)
    setErrorMessage('')
    setStatusMessage(`Loading receipt #${receiptIdInput}...`)

    try {
      const payload = await fetchReceipt(receiptIdInput.trim())
      startTransition(() => {
        setReceiptData(payload)
      })
      setStatusMessage(`Loaded receipt #${payload.receipt_id}.`)
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'Could not load that receipt ID from the backend.'),
      )
      setStatusMessage('Receipt lookup failed.')
    } finally {
      setIsLoadingReceipt(false)
    }
  }

  return (
    <main className="px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-card backdrop-blur">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-emerald-700/20 bg-emerald-50 px-4 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-800">
                NeighborFridge receipt OCR
              </span>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-slate-950 md:text-5xl">
                  Upload a grocery receipt and inspect the draft pantry items.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                  The browser sends the image as multipart form-data, Django
                  stores it, and the backend returns draft receipt items for
                  review instead of saving them directly as pantry objects.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm font-medium text-slate-700">
                <span className="rounded-full bg-slate-950 px-4 py-2 text-white">
                  POST /receipts/upload/
                </span>
                <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">
                  GET /receipts/&lt;id&gt;/
                </span>
                <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">
                  Draft items only
                </span>
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-slate-950 p-6 text-sm text-slate-200">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                Current API target
              </p>
              <code className="mt-3 block overflow-x-auto rounded-2xl bg-black/30 p-4 text-emerald-200">
                {apiBaseUrl}
              </code>
              <div className="mt-5 space-y-3 text-slate-300">
                <p>{statusMessage}</p>
                <p>
                  If uploads fail, confirm Django is running on
                  `http://127.0.0.1:8000`.
                </p>
                <p>
                  If OCR fails, confirm the Tesseract system binary is installed
                  and the Veryfi credentials are configured.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Upload receipt
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  Test the OCR flow from the browser
                </h2>
              </div>

              <form className="space-y-4" onSubmit={handleUpload}>
                <label className="block rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50/90 p-5">
                  <span className="block text-sm font-semibold text-slate-800">
                    Receipt image
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    Choose a `.jpg`, `.jpeg`, or `.png` grocery receipt.
                  </span>
                  <input
                    accept="image/*"
                    className="mt-4 block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-slate-800"
                    onChange={(event) =>
                      setSelectedFile(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                </label>

                <button
                  className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  disabled={isUploading}
                  type="submit"
                >
                  {isUploading ? 'Uploading and parsing...' : 'Upload and parse'}
                </button>
              </form>

              <div className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Selected file</p>
                <p className="mt-1">
                  {selectedFile
                    ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`
                    : 'No file selected yet.'}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Load existing upload
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  Re-open a saved receipt by ID
                </h2>
              </div>

              <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleLoadReceipt}>
                <input
                  className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-emerald-700"
                  onChange={(event) => setReceiptIdInput(event.target.value)}
                  placeholder="Enter receipt id, e.g. 2"
                  type="text"
                  value={receiptIdInput}
                />
                <button
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isLoadingReceipt}
                  type="submit"
                >
                  {isLoadingReceipt ? 'Loading...' : 'Load receipt'}
                </button>
              </form>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-[1.25rem] bg-slate-50 p-4 md:col-span-2 xl:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Store
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    {receiptData?.store_name || 'Unknown'}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Draft items
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">
                    {parsedItems.length}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Selected
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">
                    {selectedItemCount}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Parsed item sum
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">
                    {formatCurrency(parsedItemTotal)}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Detected total
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">
                    {formatCurrency(detectedTotal)}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.25rem] bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {hasMeaningfulTotalGap ? (
                  <>
                    Draft item sum differs from the receipt total by{' '}
                    <strong>{formatCurrency(totalDifference)}</strong>. That
                    usually means the receipt includes discounts, gift cards, or
                    other non-pantry/payment rows that were excluded or still
                    need review. Trust detected total for the actual receipt
                    amount.
                  </>
                ) : (
                  <>
                    Parsed item sum is the sum of draft line items. Detected
                    total is the receipt balance/total read from the summary
                    section, and it is the more reliable number for the full
                    receipt amount.
                  </>
                )}
              </div>

              {errorMessage ? (
                <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {errorMessage}
                </div>
              ) : null}
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Parsed items
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  Draft items returned by the backend
                </h2>
              </div>
              {receiptData ? (
                <div className="text-sm text-slate-500">
                  Receipt #{receiptData.receipt_id} · Uploaded{' '}
                  {formatTimestamp(receiptData.created_at)}
                </div>
              ) : null}
            </div>

            {receiptData ? (
              parsedItems.length > 0 ? (
                <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Price</th>
                          <th className="px-4 py-3 font-semibold">Qty</th>
                          <th className="px-4 py-3 font-semibold">Selected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {parsedItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {formatCurrency(item.estimated_price)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {item.selected ? 'Yes' : 'No'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
                  OCR ran, but the parser did not find draft items for this
                  receipt. Use the raw text panel to inspect what the OCR
                  returned.
                </div>
              )
            ) : (
              <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                No receipt loaded yet. Upload a receipt or load one by ID.
              </div>
            )}

            {receiptData?.raw_text ? (
              <div className="mt-6 rounded-[1.25rem] bg-slate-950 p-5 text-sm text-slate-200">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
                  Raw OCR text
                </p>
                <pre className="mt-3 max-h-[24rem] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-100">
                  {receiptData.raw_text}
                </pre>
              </div>
            ) : null}
          </article>

          <article className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="border-b border-slate-200 pb-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Receipt preview
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Saved backend image and quick notes
              </h2>
            </div>

            {receiptData?.image ? (
              <img
                alt={`Receipt ${receiptData.receipt_id}`}
                className="mt-5 w-full rounded-[1.5rem] border border-slate-200 object-cover shadow-sm"
                src={receiptData.image}
              />
            ) : (
              <div className="mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                The saved receipt image will appear here after a successful upload
                or lookup.
              </div>
            )}

            <div className="mt-5 space-y-3 rounded-[1.25rem] bg-slate-50 p-5 text-sm leading-7 text-slate-700">
              <p>
                The browser uploads using the `image` form-data key, matching the
                DRF endpoint you already built.
              </p>
              <p>
                Uploaded files are stored in `Backend/media/receipts/`, and the
                parsed rows in the table above are still draft `ParsedReceiptItem`
                records.
              </p>
              <p>
                If a receipt looks wrong, compare the table against the raw OCR
                block to see whether the issue is OCR quality or parsing logic.
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  )
}
