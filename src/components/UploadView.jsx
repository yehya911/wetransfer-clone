import React, { useCallback, useRef, useState } from 'react'
import { supabase, BUCKET, TABLE, DEFAULT_EXPIRY_DAYS, generateTrackingCode, formatBytes } from '../supabaseClient'

const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024 // 2GB soft cap, adjust to your Supabase plan

export default function UploadView() {
  const [files, setFiles] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const [status, setStatus] = useState('idle') // idle | sealing | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errorMsg, setErrorMsg] = useState('')
  const [ticket, setTicket] = useState(null) // { code, url }
  const inputRef = useRef(null)

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

  const addFiles = useCallback((incoming) => {
    setErrorMsg('')
    const arr = Array.from(incoming)
    setFiles((prev) => {
      const merged = [...prev, ...arr]
      const newTotal = merged.reduce((s, f) => s + f.size, 0)
      if (newTotal > MAX_TOTAL_BYTES) {
        setErrorMsg(`That's over the ${formatBytes(MAX_TOTAL_BYTES)} limit for one parcel. Trim it down.`)
        return prev
      }
      return merged
    })
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const sealAndSend = async () => {
    if (files.length === 0) return
    setStatus('sealing')
    setErrorMsg('')
    setProgress({ done: 0, total: files.length })

    const code = generateTrackingCode()

    try {
      const uploaded = []
      for (const file of files) {
        const path = `${code}/${file.name}`
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (uploadError) throw uploadError
        uploaded.push({ name: file.name, size: file.size, path, type: file.type })
        setProgress((p) => ({ ...p, done: p.done + 1 }))
      }

      const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const { error: insertError } = await supabase.from(TABLE).insert({
        code,
        files: uploaded,
        total_bytes: totalBytes,
        expires_at: expiresAt,
        download_count: 0,
      })
      if (insertError) throw insertError

      const url = `${window.location.origin}/p/${code}`
      setTicket({ code, url })
      setStatus('done')
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Something jammed at the loading dock. Try again.')
      setStatus('error')
    }
  }

  const reset = () => {
    setFiles([])
    setTicket(null)
    setStatus('idle')
    setProgress({ done: 0, total: 0 })
    setErrorMsg('')
  }

  const copyLink = async () => {
    if (!ticket) return
    await navigator.clipboard.writeText(ticket.url)
  }

  return (
    <div className="min-h-screen bg-ink bg-crate flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <header className="mb-10">
          <p className="font-mono text-xs tracking-[0.3em] text-kraft uppercase mb-2">Parcel // Transfer Service</p>
          <h1 className="font-display text-6xl sm:text-7xl tracking-wide text-paper leading-none">
            Send it through.
          </h1>
          <p className="font-body text-slate mt-3 max-w-md">
            Drop files in the crate, seal the parcel, get a tracking code. Anyone with the code can pick it up before it expires in {DEFAULT_EXPIRY_DAYS} days.
          </p>
        </header>

        {status !== 'done' && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
              className={`focus-ring cursor-pointer border-2 border-dashed rounded-sm px-8 py-16 text-center transition-colors
                ${dragActive ? 'border-kraft bg-kraft/10' : 'border-slate/40 hover:border-kraft/70'}`}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              <p className="font-mono text-sm text-kraft uppercase tracking-widest mb-2">
                {dragActive ? 'Drop it' : 'Drop files here'}
              </p>
              <p className="font-body text-slate text-sm">or click to browse — up to {formatBytes(MAX_TOTAL_BYTES)} per parcel</p>
            </div>

            {files.length > 0 && (
              <div className="mt-6 border border-slate/30 rounded-sm divide-y divide-slate/20">
                {files.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="flex items-center justify-between px-4 py-3 font-mono text-sm">
                    <span className="truncate max-w-[60%] text-paper">{f.name}</span>
                    <span className="text-slate">{formatBytes(f.size)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                      className="focus-ring text-stamp hover:text-stamp-dark ml-4"
                      aria-label={`Remove ${f.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2 font-mono text-xs text-slate uppercase tracking-widest">
                  <span>{files.length} item{files.length !== 1 ? 's' : ''}</span>
                  <span>{formatBytes(totalBytes)} total</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <p className="mt-4 font-mono text-sm text-stamp" role="alert">{errorMsg}</p>
            )}

            <button
              onClick={sealAndSend}
              disabled={files.length === 0 || status === 'sealing'}
              className="focus-ring mt-8 w-full bg-stamp hover:bg-stamp-dark disabled:opacity-40 disabled:cursor-not-allowed
                text-paper font-display text-2xl tracking-widest uppercase py-4 rounded-sm transition-colors"
            >
              {status === 'sealing' ? `Sealing ${progress.done}/${progress.total}…` : 'Seal & Send'}
            </button>
          </>
        )}

        {status === 'done' && ticket && (
          <div className="mt-4">
            <div className="relative perforated notch-left notch-right bg-paper text-ink rounded-sm px-8 py-8 shadow-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-stamp mb-1">Waybill sealed</p>
              <p className="font-display text-5xl tracking-widest mb-4">{ticket.code}</p>
              <div className="border-t border-dashed border-ink/30 pt-4">
                <p className="font-mono text-xs text-ink/60 mb-1">Pickup link</p>
                <p className="font-mono text-sm break-all mb-4">{ticket.url}</p>
                <div className="flex gap-3">
                  <button
                    onClick={copyLink}
                    className="focus-ring bg-ink text-paper font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm hover:bg-ink-light"
                  >
                    Copy link
                  </button>
                  <a
                    href={ticket.url}
                    className="focus-ring bg-transparent border border-ink/40 text-ink font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm hover:border-ink"
                  >
                    Open pickup page
                  </a>
                </div>
              </div>
              <p className="font-mono text-[11px] text-ink/50 mt-6">Expires in {DEFAULT_EXPIRY_DAYS} days · {files.length} file{files.length !== 1 ? 's' : ''} · {formatBytes(totalBytes)}</p>
            </div>
            <button
              onClick={reset}
              className="focus-ring mt-6 font-mono text-xs uppercase tracking-widest text-slate hover:text-kraft"
            >
              ← Send another parcel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
