const { put, del } = require('@vercel/blob');

const UPLOAD_TIMEOUT_MS = 15_000;

// PDFs are per-event, not per-person (see INTENT.md): a deterministic
// pathname means re-uploading for the same event overwrites in place,
// with no extra bookkeeping to find "the" PDF for an event.
function pdfPathname(eventId) {
  return `tickets/event-${eventId}.pdf`;
}

async function uploadEventPdf(eventId, buffer) {
  // A bad/missing BLOB_READ_WRITE_TOKEN or a network hiccup must fail fast
  // with a clear error, not hang the request (and eat into the serverless
  // function's own execution budget) indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const blob = await put(pdfPathname(eventId), buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/pdf',
      abortSignal: controller.signal,
    });
    return blob.url;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('PDF yükleme zaman aşımına uğradı. BLOB_READ_WRITE_TOKEN doğru mu kontrol edin.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function deleteEventPdf(eventId) {
  await del(pdfPathname(eventId));
}

module.exports = { uploadEventPdf, deleteEventPdf };
