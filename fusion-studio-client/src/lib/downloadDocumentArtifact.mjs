/** Trigger a renderer-owned artifact download and retire its Blob URL later. */
export function downloadDocumentArtifact(
  { bytes, filename, mimeType },
  {
    BlobImpl = Blob,
    documentImpl = document,
    scheduleRevoke = (callback) => setTimeout(callback, 0),
    urlImpl = URL,
  } = {},
) {
  const blob = new BlobImpl([bytes], { type: mimeType })
  const url = urlImpl.createObjectURL(blob)
  let anchor
  let removalAttempted = false
  try {
    anchor = documentImpl.createElement('a')
    anchor.href = url
    anchor.download = filename
    documentImpl.body.appendChild(anchor)
    anchor.click()
    removalAttempted = true
    anchor.remove()
    scheduleRevoke(() => urlImpl.revokeObjectURL(url))
  } catch (error) {
    if (anchor && !removalAttempted) {
      try { anchor.remove() } catch { /* preserve the primary setup failure */ }
    }
    urlImpl.revokeObjectURL(url)
    throw error
  }
}
