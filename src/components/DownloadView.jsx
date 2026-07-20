import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import JSZip from 'jszip'
import { supabase, BUCKET, TABLE, formatBytes } from '../supabaseClient'
import { buildTree } from '../lib/collectFiles'
import FileTree from './FileTree'

export default function DownloadView() {
  const { code } = useParams()
  const [state, setState] = useState('loading') // loading | ready | expired | not_found | error
  const [transfer, setTransfer] = useState(null)
  const [zipping, setZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from(TABLE).select('*').eq('code', code).maybeSingle()
      if (cancelled) return
      if (error) { setState('error'); return }
      if (!data) { setState('not_found'); return }
      if (new Date(data.expires_at).getTime() < Date.now()) {
        setState('expired')
        setTransfer(data)
        return
      }
      setTransfer(data)
      setState('ready')
    }
    load()
    return () => { cancelled = true }
  }, [code])

  const signedUrlFor = async (path) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
    if (error) throw error
    return data.signedUrl
  }

  const downloadFile = async (file) => {
    const url = await signedUrlFor(file.path)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const downloadAllAsZip = async () => {
    if (!transfer) return
    setZipping(true)
    setZipProgress(0)
    try {
      const zip = new JSZip()
      let done = 0
      for (const file of transfer.files) {
        // eslint-disable-next-line no-await-in-loop
        const url = await signedUrlFor(file.path)
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(url)
        // eslint-disable-next-line no-await-in-loop
        const blob = await res.blob()
        zip.file(file.relativePath || file.name, blob)
        done += 1
        setZipProgress(done / transfer.files.length)
      }
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `parcel-${transfer.code}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      supabase.rpc('increment_download_count', { transfer_code: code }).catch(() => {})
    } catch (err) {
      console.error(err)
    } finally {
      setZipping(false)
    }
  }

  const tree = transfer ? buildTree(transfer.files.map((f) => ({ ...f, file: { name: f.name, size: f.size } }))) : null

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
            <span className="font-display font-bold text-sm text-white">P</span>
          </div>
          <span className="font-display font-semibold text-lg text-ink">Parcel</span>
        </div>

        {state === 'loading' && <p className="font-body text-ink-soft">Looking up this parcel…</p>}

        {state === 'not_found' && (
          <div>
            <h1 className="font-display font-semibold text-3xl text-ink mb-2">No parcel found</h1>
            <p className="font-body text-ink-soft">
              Tracking code <span className="font-mono text-accent">{code}</span> doesn't match anything. Double-check the link or code your sender gave you.
            </p>
          </div>
        )}

        {state === 'expired' && (
          <div>
            <h1 className="font-display font-semibold text-3xl text-ink mb-2">This parcel has expired</h1>
            <p className="font-body text-ink-soft">
              <span className="font-mono text-accent">{code}</span> is no longer available. Ask the sender to send it again.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div>
            <h1 className="font-display font-semibold text-3xl text-ink mb-2">Couldn't load this parcel</h1>
            <p className="font-body text-ink-soft">Try refreshing in a moment.</p>
          </div>
        )}

        {state === 'ready' && transfer && (
          <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
            <div className="px-6 py-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal mb-1">Ready for pickup</p>
              <p className="font-display font-semibold text-2xl text-ink">{transfer.code}</p>
            </div>
            <div className="border-t border-line">
              <FileTree tree={tree} mode="download" onDownloadFile={(entry) => downloadFile({ path: entry.path, name: entry.file.name })} />
            </div>
            <div className="px-6 py-5 border-t border-line">
              <button
                onClick={downloadAllAsZip}
                disabled={zipping}
                className="focus-ring w-full bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-display font-semibold text-lg py-3 rounded-xl transition-colors"
              >
                {zipping ? `Zipping… ${Math.round(zipProgress * 100)}%` : 'Download all (.zip)'}
              </button>
              <p className="font-mono text-[11px] text-muted mt-3">
                Expires {new Date(transfer.expires_at).toLocaleDateString()} · {transfer.files.length} file{transfer.files.length !== 1 ? 's' : ''} · {formatBytes(transfer.total_bytes)}
              </p>
            </div>
          </div>
        )}

        <Link to="/" className="focus-ring inline-block mt-8 font-body text-sm text-ink-soft hover:text-accent">
          ← Send your own parcel
        </Link>
      </div>
    </div>
  )
}
