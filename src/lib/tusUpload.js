import * as tus from 'tus-js-client'
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET } from '../supabaseClient'

// Supabase Storage speaks the TUS resumable-upload protocol at this endpoint.
// Using it (instead of a plain PUT) gives us real per-chunk progress events
// and automatic retry/resume if a big upload gets interrupted mid-way.
// Chunk size must be a multiple of 6MB per Supabase's implementation.
const CHUNK_SIZE = 6 * 1024 * 1024

export function uploadFile({ file, path, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: CHUNK_SIZE,
      headers: {
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET,
        objectName: path,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onError: reject,
      onProgress: (bytesSent, bytesTotal) => {
        onProgress?.(bytesSent / bytesTotal)
      },
      onSuccess: () => resolve(),
    })

    if (signal) {
      signal.addEventListener('abort', () => upload.abort())
    }

    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0])
      upload.start()
    })
  })
}
