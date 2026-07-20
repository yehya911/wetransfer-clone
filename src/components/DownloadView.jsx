import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, BUCKET, TABLE, formatBytes } from '../supabaseClient'

export default function DownloadView() {
  const { code } = useParams()
  const [state, setState] = useState('loading') // loading | ready | expired | not_found | error
  const [transfer, setTransfer] = useState(null)
  const [downloadingPath, setDownloadingPath] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from(TABLE).select('*').eq('code', code).maybeSingle()
      if (cancelled) return
      if (error) {
        setState('error')
        return
      }
      if (!data) {
        setState('not_found')
        return
      }
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

  const downloadFile = async (file) => {
    setDownloadingPath(file.path)
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.path, 60)
      if (error) throw error
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      console.error(err)
    } finally {
      setDownloadingPath(null)
    }
  }

  const downloadAll = async () => {
    if (!transfer) return
    for (const file of transfer.files) {
      // eslint-disable-next-line no-await-in-loop
      await downloadFile(file)
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 400))
    }
    supabase.rpc('increment_download_count', { transfer_code: code }).then(() => {}).catch(() => {})
  }

  return (
    <div className="min-h-screen bg-ink bg-crate flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="font-mono text-xs tracking-[0.3em] text-kraft uppercase mb-2">Parcel // Pickup</p>

        {state === 'loading' && (
          <p className="font-body text-slate mt-8">Checking the manifest…</p>
        )}

        {state === 'not_found' && (
          <div className="mt-8">
            <h1 className="font-display text-5xl text-paper mb-3">No such parcel.</h1>
            <p className="font-body text-slate">Tracking code <span className="font-mono text-kraft">{code}</span> doesn't match anything on the shelf. Double-check the code your sender gave you.</p>
          </div>
        )}

        {state === 'expired' && (
          <div className="mt-8">
            <h1 className="font-display text-5xl text-paper mb-3">This parcel expired.</h1>
            <p className="font-body text-slate">
              Parcel <span className="font-mono text-kraft">{code}</span> was picked up or aged out and has been cleared from storage. Ask the sender to send it again.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="mt-8">
            <h1 className="font-display text-5xl text-paper mb-3">Something jammed.</h1>
            <p className="font-body text-slate">We couldn't reach the manifest. Try refreshing in a moment.</p>
          </div>
        )}

        {state === 'ready' && transfer && (
          <div className="relative perforated notch-left notch-right bg-paper text-ink rounded-sm px-8 py-8 shadow-2xl mt-4">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-stamp mb-1">Ready for pickup</p>
            <p className="font-display text-5xl tracking-widest mb-4">{transfer.code}</p>

            <div className="border-t border-dashed border-ink/30 pt-4 divide-y divide-ink/10">
              {transfer.files.map((file) => (
                <div key={file.path} className="flex items-center justify-between py-3">
                  <div className="min-w-0 mr-4">
                    <p className="font-mono text-sm truncate">{file.name}</p>
                    <p className="font-mono text-xs text-ink/50">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    onClick={() => downloadFile(file)}
                    disabled={downloadingPath === file.path}
                    className="focus-ring shrink-0 bg-ink text-paper font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm hover:bg-ink-light disabled:opacity-50"
                  >
                    {downloadingPath === file.path ? 'Fetching…' : 'Download'}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={downloadAll}
              className="focus-ring mt-6 w-full bg-stamp hover:bg-stamp-dark text-paper font-display text-xl tracking-widest uppercase py-3 rounded-sm transition-colors"
            >
              Download all
            </button>

            <p className="font-mono text-[11px] text-ink/50 mt-6">
              Expires {new Date(transfer.expires_at).toLocaleDateString()} · {transfer.files.length} file{transfer.files.length !== 1 ? 's' : ''} · {formatBytes(transfer.total_bytes)}
            </p>
          </div>
        )}

        <Link to="/" className="focus-ring inline-block mt-8 font-mono text-xs uppercase tracking-widest text-slate hover:text-kraft">
          ← Send your own parcel
        </Link>
      </div>
    </div>
  )
}
