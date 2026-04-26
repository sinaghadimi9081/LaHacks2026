import { startTransition, useMemo, useState } from 'react'

import {
  confirmReceipt,
  fetchReceipt,
  searchReceiptsByVendor,
  uploadReceipt,
} from '../../Utils/receiptsApi.jsx'

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

function createDraftItems(items = []) {
  return items.map((item) => ({
    ...item,
    standardized_name: item.standardized_name || '',
    estimated_price: item.estimated_price ?? '',
    expiration_days:
      item.expiration_days === null || item.expiration_days === undefined
        ? ''
        : String(item.expiration_days),
    quantity:
      item.quantity === null || item.quantity === undefined ? '1' : String(item.quantity),
    selected: item.selected ?? true,
  }))
}

function createConfirmItems(items = []) {
  return items.map((item) => ({
    id: item.id,
    selected: item.selected,
    name: item.name,
    standardized_name: item.standardized_name?.trim() || item.name,
    quantity: Number.parseInt(item.quantity, 10) || 1,
    estimated_price: item.estimated_price === '' ? null : item.estimated_price,
    expiration_days:
      item.expiration_days === '' ? null : Number.parseInt(item.expiration_days, 10),
    image_url: item.image_url || '',
    description: item.description || '',
  }))
}

function sumEstimatedPrices(items = []) {
  return items.reduce((sum, item) => {
    const price = Number(item.estimated_price)
    if (Number.isNaN(price)) {
      return sum
    }

    return sum + price
  }, 0)
}

export default function ReceiptsWorkbench() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [vendorSearchInput, setVendorSearchInput] = useState('')
  const [vendorSearchResults, setVendorSearchResults] = useState([])
  const [receiptData, setReceiptData] = useState(null)
  const [draftItems, setDraftItems] = useState([])
  const [statusMessage, setStatusMessage] = useState(
    'Add a grocery receipt and we will turn it into pantry items you can review.',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  const parsedItems = draftItems
  const selectedItemCount = parsedItems.filter((item) => item.selected).length
  const confirmItems = useMemo(() => createConfirmItems(draftItems), [draftItems])
  const selectedConfirmItems = useMemo(
    () => confirmItems.filter((item) => item.selected),
    [confirmItems],
  )
  const selectedEstimatedTotal = useMemo(
    () => sumEstimatedPrices(selectedConfirmItems),
    [selectedConfirmItems],
  )
  const parsedItemTotal = selectedEstimatedTotal
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

  function applyReceiptPayload(payload) {
    startTransition(() => {
      setReceiptData(payload)
      setDraftItems(createDraftItems(payload?.parsed_items || []))
      setVendorSearchInput(payload?.store_name || '')
    })
  }

  async function openReceiptById(receiptId, successMessage) {
    const payload = await fetchReceipt(receiptId)
    applyReceiptPayload({ ...payload, confirmed_at: null })
    setStatusMessage(successMessage)
  }

  function handleDraftItemChange(itemId, field, value) {
    setDraftItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    )
  }

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
    setStatusMessage(`Reading ${selectedFile.name}...`)

    try {
      const payload = await uploadReceipt(formData)
      applyReceiptPayload(payload)
      setVendorSearchResults([])
      setStatusMessage(
        'Receipt ready. Review the items before adding them to your pantry.',
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          'Receipt upload failed. Please try again in a moment.',
        ),
      )
      setStatusMessage('Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleLoadReceipt(event) {
    event.preventDefault()

    if (!vendorSearchInput.trim()) {
      setErrorMessage('Enter a vendor name to load an earlier receipt.')
      return
    }

    setIsLoadingReceipt(true)
    setErrorMessage('')
    setStatusMessage('Searching receipts by vendor...')

    try {
      const payload = await searchReceiptsByVendor(vendorSearchInput.trim())
      const results = payload?.results || []
      setVendorSearchResults(results)

      if (results.length === 1) {
        await openReceiptById(
          results[0].receipt_id,
          `Loaded the ${results[0].store_name || vendorSearchInput.trim()} receipt from ${formatTimestamp(results[0].created_at)}.`,
        )
      } else {
        startTransition(() => {
          setReceiptData(null)
          setDraftItems([])
        })
        setStatusMessage(
          `Found ${results.length} ${vendorSearchInput.trim()} receipt${results.length === 1 ? '' : 's'}. Pick a date to preview one.`,
        )
      }
    } catch (error) {
      setVendorSearchResults([])
      setErrorMessage(
        getErrorMessage(error, 'Could not find a receipt for that vendor.'),
      )
      setStatusMessage('Vendor search failed.')
    } finally {
      setIsLoadingReceipt(false)
    }
  }

  async function handleSelectVendorResult(result) {
    setErrorMessage('')
    setIsLoadingReceipt(true)
    setStatusMessage(`Opening ${result.store_name || 'receipt'} from ${formatTimestamp(result.created_at)}...`)

    try {
      await openReceiptById(
        result.receipt_id,
        `Loaded ${result.store_name || 'receipt'} from ${formatTimestamp(result.created_at)}.`,
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'Could not open that receipt.'),
      )
      setStatusMessage('Receipt load failed.')
    } finally {
      setIsLoadingReceipt(false)
    }
  }

  function handleBackToVendorResults() {
    startTransition(() => {
      setReceiptData(null)
      setDraftItems([])
    })
    setStatusMessage(
      `Found ${vendorSearchResults.length} ${vendorSearchInput.trim()} receipt${vendorSearchResults.length === 1 ? '' : 's'}. Pick a date to preview one.`,
    )
  }

  async function handleConfirmReceipt(event) {
    event.preventDefault()

    if (!receiptData?.receipt_id) {
      setErrorMessage('Upload or load a receipt before confirming items.')
      return
    }

    if (!draftItems.some((item) => item.selected)) {
      setErrorMessage('Select at least one item to save to the pantry.')
      return
    }

    setIsConfirming(true)
    setErrorMessage('')

    try {
      const payload = await confirmReceipt(receiptData.receipt_id, {
        items: confirmItems,
      })

      startTransition(() => {
        setReceiptData((currentReceipt) =>
          currentReceipt
            ? {
                ...currentReceipt,
                confirmed_at: payload.confirmed_at,
                parsed_items: draftItems,
                parsed_item_total: selectedEstimatedTotal,
              }
            : currentReceipt,
        )
      })
      setStatusMessage(
        `Saved ${payload.created_count} pantry item${payload.created_count === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not confirm this receipt.'))
      setStatusMessage('Receipt confirmation failed.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-8 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="pantry-label">Receipts</p>
            <h1 className="mt-3 max-w-3xl text-5xl font-black uppercase leading-none md:text-7xl">
              Upload your receipts!
            </h1>
            <p className="mt-4 max-w-2xl text-base font-bold leading-7 text-ink/70">
              Snap a grocery receipt, tidy up the items, and add only what you want to your pantry.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="metric-card bg-white/90">
              <span>Items found</span>
              <strong>{parsedItems.length}</strong>
            </div>
            <div className="metric-card bg-citrus">
              <span>Ready to save</span>
              <strong>{selectedItemCount}</strong>
            </div>
            <div className="metric-card bg-petal">
              <span>Receipt total</span>
              <strong className="text-2xl">{formatCurrency(detectedTotal)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:px-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <article className="pantry-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="pantry-label">Add receipt</p>
                <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                  Upload a photo
                </h2>
              </div>
              <span className="fruit-sticker static bg-citrus rotate-6">
                <span>Step 1</span>
              </span>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleUpload}>
              <label className="block rounded-2xl border-2 border-dashed border-ink/20 bg-white/70 p-5 shadow-sticker">
                <span className="pantry-field-label">Receipt image</span>
                <input
                  accept="image/*"
                  className="pantry-input file:mr-4 file:rounded-full file:border-0 file:bg-citrus file:px-4 file:py-2 file:font-black file:text-ink"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
              </label>

              <button className="pantry-button w-full" disabled={isUploading} type="submit">
                {isUploading ? 'Reading receipt...' : 'Read receipt'}
              </button>
            </form>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="pantry-label">Receipt preview</p>
                {receiptData?.receipt_id && vendorSearchResults.length > 1 ? (
                  <button
                    className="pantry-filter-button"
                    onClick={handleBackToVendorResults}
                    type="button"
                  >
                    Back to matches
                  </button>
                ) : null}
              </div>
              {receiptData?.image ? (
                <img
                  alt="Uploaded receipt"
                  className="mt-4 w-full rounded-2xl border border-ink/15 object-cover shadow-pop"
                  src={receiptData.image}
                />
              ) : vendorSearchResults.length > 1 ? (
                <div className="mt-4 space-y-3 rounded-2xl border border-ink/15 bg-white/80 p-4 shadow-sticker">
                  <p className="text-sm font-bold leading-7 text-ink/70">
                    Choose which receipt date you want to open for {vendorSearchInput.trim()}.
                  </p>
                  <div className="grid gap-3">
                    {vendorSearchResults.map((result) => (
                      <button
                        className="recipe-card recipe-card--full text-left"
                        key={result.receipt_id}
                        onClick={() => handleSelectVendorResult(result)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-black uppercase leading-5 text-ink">
                              {result.store_name || 'Grocery receipt'}
                            </p>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-ink/50">
                              {formatTimestamp(result.created_at)}
                            </p>
                          </div>
                          <span className="rounded-full border border-ink/15 bg-citrus px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-ink shadow-sticker">
                            {formatCurrency(result.detected_total)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-ink/20 bg-white/70 px-4 py-12 text-center text-sm font-black uppercase tracking-[0.14em] text-ink/55">
                  Your receipt photo will appear here.
                </div>
              )}
            </div>
          </article>

          <article className="pantry-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="pantry-label">Find a receipt</p>
                <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                  Open an earlier upload
                </h2>
              </div>
              <span className="fruit-sticker static bg-petal -rotate-6">
                <span>Saved</span>
              </span>
            </div>

            <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleLoadReceipt}>
              <input
                className="pantry-input min-w-0 flex-1"
                onChange={(event) => setVendorSearchInput(event.target.value)}
                placeholder="Vendor name, like Target or Ralphs"
                type="text"
                value={vendorSearchInput}
              />
              <button
                className="pantry-button pantry-button--light"
                disabled={isLoadingReceipt}
                type="submit"
              >
                {isLoadingReceipt ? 'Loading...' : 'Open'}
              </button>
            </form>

          </article>

          <article className="pantry-card">
            <p className="pantry-label">Status</p>
            <p className="mt-3 text-sm font-bold leading-7 text-ink/70">{statusMessage}</p>

            {errorMessage ? (
              <div className="mt-4 rounded-xl border border-danger/25 bg-danger-soft/80 px-4 py-3 text-sm font-bold text-danger">
                {errorMessage}
              </div>
            ) : null}

            {receiptData?.confirmed_at ? (
              <div className="mt-4 rounded-xl border border-ink/15 bg-citrus/70 px-4 py-3 text-sm font-bold text-ink">
                Saved on {formatTimestamp(receiptData.confirmed_at)}.
              </div>
            ) : null}
          </article>

        </div>

        <div className="space-y-6">
          <article className="pantry-card">
            <div className="flex flex-col gap-3 border-b-2 border-moonstone pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="pantry-label">Review items</p>
                <h2 className="mt-2 text-3xl font-black uppercase leading-none">
                  Choose what goes in
                </h2>
              </div>
              {receiptData ? (
                <span className="fruit-sticker static bg-moonstone rotate-3">
                  <span>{formatTimestamp(receiptData.created_at)}</span>
                </span>
              ) : null}
            </div>

            {receiptData ? (
              parsedItems.length > 0 ? (
                <div className="mt-5 grid gap-4">
                  {parsedItems.map((item, index) => (
                    <details
                      className={`ingredient-card ingredient-card--text-only group ${
                        item.selected ? '' : 'ingredient-card--critical'
                      }`}
                      key={item.id}
                      style={{ '--tilt': index % 2 === 0 ? '-0.5deg' : '0.5deg' }}
                    >
                      <summary className="recipe-card recipe-card--full cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-black uppercase leading-5 text-ink">
                              {item.standardized_name || item.name}
                            </p>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-ink/50">
                              Qty {item.quantity || 1}
                              {item.expiration_days === ''
                                ? ''
                                : ` - fresh for ${item.expiration_days} day${Number(item.expiration_days) === 1 ? '' : 's'}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <button
                              className={`rounded-full border border-ink/15 px-3 py-1 text-xs font-black uppercase shadow-sticker transition hover:-translate-y-0.5 ${
                                item.selected ? 'bg-moonstone text-ink' : 'bg-white text-ink/45'
                              }`}
                              onClick={(event) => {
                                event.preventDefault()
                                handleDraftItemChange(item.id, 'selected', !item.selected)
                              }}
                              type="button"
                            >
                              {item.selected ? 'Save' : 'Skip'}
                            </button>
                            <span className="rounded-full border border-ink/15 bg-citrus px-3 py-1 text-xs font-black uppercase shadow-sticker">
                              {formatCurrency(item.estimated_price)}
                            </span>
                            <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-black uppercase text-ink/65 shadow-sticker group-open:hidden">
                              Open
                            </span>
                            <span className="hidden rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-black uppercase text-ink/65 shadow-sticker group-open:inline-flex">
                              Close
                            </span>
                          </div>
                        </div>
                      </summary>

                      <div className="recipe-card recipe-card--full border-t border-dashed border-ink/15">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <label className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.12em] text-ink">
                            <input
                              checked={Boolean(item.selected)}
                              className="h-5 w-5 rounded border-ink/30 text-phthalo focus:ring-phthalo"
                              onChange={(event) =>
                                handleDraftItemChange(item.id, 'selected', event.target.checked)
                              }
                              type="checkbox"
                            />
                            Save
                          </label>
                          <span className="rounded-full border border-ink/15 bg-citrus px-3 py-1 text-xs font-black uppercase shadow-sticker">
                            {formatCurrency(item.estimated_price)}
                          </span>
                        </div>

                        <label className="block">
                          <span className="pantry-field-label">Pantry name</span>
                          <input
                            className="pantry-input"
                            onChange={(event) =>
                              handleDraftItemChange(item.id, 'standardized_name', event.target.value)
                            }
                            value={item.standardized_name || item.name}
                          />
                          <p className="mt-2 text-xs font-bold text-ink/50">
                            Original line: {item.name}
                          </p>
                        </label>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="block">
                            <span className="pantry-field-label">Price</span>
                            <input
                              className="pantry-input"
                              min="0"
                              onChange={(event) =>
                                handleDraftItemChange(item.id, 'estimated_price', event.target.value)
                              }
                              step="0.01"
                              type="number"
                              value={item.estimated_price}
                            />
                          </label>

                          <label className="block">
                            <span className="pantry-field-label">Quantity</span>
                            <input
                              className="pantry-input"
                              min="1"
                              onChange={(event) =>
                                handleDraftItemChange(item.id, 'quantity', event.target.value)
                              }
                              step="1"
                              type="number"
                              value={item.quantity}
                            />
                          </label>

                          <label className="block">
                            <span className="pantry-field-label">Fresh for</span>
                            <input
                              className="pantry-input"
                              min="0"
                              onChange={(event) =>
                                handleDraftItemChange(item.id, 'expiration_days', event.target.value)
                              }
                              step="1"
                              type="number"
                              value={item.expiration_days}
                            />
                          </label>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-ink/15 bg-white/80 px-4 py-5 text-sm font-bold text-ink/65 shadow-sticker">
                  We could not find pantry items on this receipt. Try another photo with clearer lighting.
                </div>
              )
            ) : (
              <div className="mt-5 rounded-2xl border border-ink/15 bg-white/80 px-4 py-5 text-sm font-bold text-ink/65 shadow-sticker">
                Upload a receipt to start building your pantry list.
              </div>
            )}

            {receiptData ? (
              <form className="mt-6 rounded-2xl border-2 border-ink bg-citrus p-5 shadow-pop" onSubmit={handleConfirmReceipt}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/70">
                      Add to pantry
                    </p>
                    <p className="mt-2 text-sm font-bold text-ink/75">
                      Only checked items will be saved.
                    </p>
                  </div>
                <button
                  className="pantry-button bg-white text-ink font-black tracking-wide"
                  disabled={isConfirming || Boolean(receiptData.confirmed_at) || selectedItemCount === 0}
                  type="submit"
                >
                  {receiptData.confirmed_at
                    ? 'Submitted'
                    : isConfirming
                      ? 'Submitting...'
                      : `Submit to Pantry (${selectedItemCount})`}
                </button>                
                </div>
              </form>
            ) : null}
          </article>

          <article className="pantry-card">
            <p className="pantry-label">Quick check</p>

            <div className="mt-4 rounded-md border-2 border-ink bg-white px-4 py-5 font-mono text-xs text-ink shadow-pop">
              <div className="border-b border-dashed border-ink/35 pb-3 text-center">
                <p className="text-base font-black uppercase tracking-[0.16em]">
                  {receiptData?.store_name || 'Grocery receipt'}
                </p>
                <p className="mt-1 uppercase tracking-[0.12em] text-ink/55">
                  {receiptData ? formatTimestamp(receiptData.created_at) : 'No receipt loaded'}
                </p>
              </div>

              {selectedConfirmItems.length > 0 ? (
                <div className="border-b border-dashed border-ink/35 py-3">
                  {selectedConfirmItems.map((item) => (
                    <div className="py-2" key={item.id}>
                      <div className="flex items-start justify-between gap-4">
                        <span className="max-w-[70%] font-black uppercase">
                          {item.standardized_name}
                        </span>
                        <span className="shrink-0 font-black">
                          {formatCurrency(item.estimated_price)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-start justify-between gap-4 uppercase text-ink/55">
                        <span>
                          Qty {item.quantity}
                          {item.expiration_days === null
                            ? ''
                            : ` - fresh ${item.expiration_days} day${item.expiration_days === 1 ? '' : 's'}`}
                        </span>
                        <span>{item.selected ? 'Save' : 'Skip'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-b border-dashed border-ink/35 py-6 text-center font-black uppercase tracking-[0.12em] text-ink/50">
                  No checked items
                </div>
              )}

              <div className="grid gap-2 border-b border-dashed border-ink/35 py-3 uppercase">
                <div className="flex justify-between gap-4">
                  <span>Chosen items</span>
                  <span className="font-black">{selectedItemCount}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Chosen total</span>
                  <span className="font-black">{formatCurrency(parsedItemTotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Receipt total</span>
                  <span className="font-black">{formatCurrency(detectedTotal)}</span>
                </div>
                {hasMeaningfulTotalGap ? (
                  <div className="flex justify-between gap-4">
                    <span>Difference</span>
                    <span className="font-black">{formatCurrency(totalDifference)}</span>
                  </div>
                ) : null}
              </div>

              <div className="pt-3 text-center uppercase tracking-[0.12em] text-ink/55">
                Review before adding to pantry
              </div>
            </div>
            {hasMeaningfulTotalGap ? (
              <p className="mt-4 rounded-xl border border-ink/15 bg-soon-soft/80 px-4 py-3 text-sm font-bold leading-7 text-ink/70">
                The receipt total and item total are a little different. That can happen when a receipt includes discounts, tax, or non-food purchases.
              </p>
            ) : (
              <p className="mt-4 rounded-xl border border-ink/15 bg-white/80 px-4 py-3 text-sm font-bold leading-7 text-ink/60">
                Totals are here as a quick confidence check before saving.
              </p>
            )}
          </article>
        </div>
      </section>
    </main>
  )
}
