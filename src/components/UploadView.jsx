import React, { useCallback, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  supabase,
  TABLE,
  DEFAULT_EXPIRY_DAYS,
  MAX_TOTAL_BYTES,
  generateTrackingCode,
  formatBytes,
} from '../supabaseClient'
import { collectFromDataTransfer, collectFromFileList, buildTree } from '../lib/collectFiles'
import { uploadFile } from '../lib/tusUpload'
import FileTree from './FileTree'

export default function UploadView() {
  const [entries, setEntries] = useState([]) // [{ file, relativePath }]
  const [dragActive, setDragActive] = useState(false)
  const [email, setEmail] = useState('')
  const [notifyByEmail, setNotifyByEmail] = useState(false)
  const [status, setStatus] = useState('idle') // idle | sealing | done | error
  const [fileProgress, setFileProgress] = useState({}) // relativePath -> 0..1
  const [errorMsg, setErrorMsg] = useState('')
  const [ticket, setTicket] = useState(null) // { code, url, qr }
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  const totalBytes = useMemo(() => entries.reduce((s, e) => s + e.file.size, 0), [entries])
  const tree = useMemo(() => buildTree(entries), [entries])

  const overallProgress = useMemo(() => {
    if (entries.length === 0) return 0
    const sum = entries.reduce((s, e) => s + (fileProgress[e.relativePath] || 0), 0)
    return sum / entries.length
  }, [entries, fileProgress])

  const addEntries = useCallback((incoming) => {
    setErrorMsg('')
    setEntries((prev) => {
      const merged = [...prev, ...incoming]
      const newTotal = merged.reduce((s, e) => s + e.file.size, 0)
      if (newTotal > MAX_TOTAL_BYTES) {
        setErrorMsg(
          `That's over the ${formatBytes(MAX_TOTAL_BYTES)} limit configured in this app. Trim it down, or raise MAX_TOTAL_BYTES / your Supabase plan's file size limit.`
        )
        return prev
      }
      // de-dupe on relativePath, keep latest
      const map = new Map(merged.map((e) => [e.relativePath, e]))
      return Array.from(map.values())
    })
  }, [])

  const onDrop = async (e) => {
    e.preventDefault()
    setDragActive(false)
    const collected = await collectFromDataTransfer(e.dataTransfer)
    if (collected.length) addEntries(collected)
  }

  const removeEntry = (relativePath) =>
    setEntries((prev) => prev.filter((e) => e.relativePath !== relativePath))

  const removeFolder = (folderPrefix) =>
    setEntries((prev) => prev.filter((e) => !e.relativePath.startsWith(`${folderPrefix}/`)))

  const sealAndSend = async () => {
    if (entries.length === 0) return
    setStatus('sealing')
    setErrorMsg('')
    setFileProgress({})

    const code = generateTrackingCode()
    const controller = new AbortController()

    try {
      const uploaded = []
      // Upload sequentially so progress reporting stays simple and predictable;
      // switch to a small concurrency pool here if you want faster parallel uploads.
      for (const entry of entries) {
        const path = `${code}/${entry.relativePath}`
        // eslint-disable-next-line no-await-in-loop
        await uploadFile({
          file: entry.file,
          path,
          signal: controller.signal,
          onProgress: (p) =>
            setFileProgress((prev) => ({ ...prev, [entry.relativePath]: p })),
        })
        uploaded.push({
          name: entry.relativePath.split('/').pop(),
          relativePath: entry.relativePath,
          size: entry.file.size,
          path,
          type: entry.file.type,
        })
      }

      const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const { error: insertError } = await supabase.from(TABLE).insert({
        code,
        files: uploaded,
        total_bytes: totalBytes,
        expires_at: expiresAt,
        download_count: 0,
        recipient_email: notifyByEmail && email ? email : null,
      })
      if (insertError) throw insertError

      const url = `${window.location.origin}/p/${code}`
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#10131A', light: '#00000000' } })

      if (notifyByEmail && email) {
        // Best-effort: don't block the "done" state on email delivery.
        supabase.functions
          .invoke('send-transfer-email', { body: { to: email, code, url } })
          .catch((err) => console.warn('Email notification failed (parcel still sent):', err))
      }

      setTicket({ code, url, qr })
      setStatus('done')
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Upload failed partway through. Try again.')
      setStatus('error')
    }
  }

  const reset = () => {
    setEntries([])
    setTicket(null)
    setStatus('idle')
    setFileProgress({})
    setErrorMsg('')
    setEmail('')
    setNotifyByEmail(false)
  }

  const copyLink = async () => {
    if (!ticket) return
    await navigator.clipboard.writeText(ticket.url)
  }

  const pctUsed = Math.min(100, (totalBytes / MAX_TOTAL_BYTES) * 100)

  return (
    <div className="min-h-screen flex">
      {/* Left rail */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-rail text-white flex-col justify-between px-7 py-8">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
              <span className="font-display font-bold text-sm">P</span>
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">Parcel</span>
          </div>
          <p className="font-body text-sm text-white/50 leading-relaxed">
            Send files and folders. Get a tracking link back. Nothing sits around
            forever — every parcel clears itself out after {DEFAULT_EXPIRY_DAYS} days.
          </p>
        </div>
        <div className="font-mono text-[11px] text-white/30 leading-relaxed">
          Files &amp; folders supported<br />
          Resumable uploads<br />
          Expires automatically
        </div>
      </aside>

      {/* Main canvas */}
      <main className="flex-1 bg-canvas px-6 sm:px-12 py-10 sm:py-16">
        <div className="w-full max-w-2xl mx-auto">
          <header className="mb-8 lg:hidden">
            <span className="font-display font-semibold text-xl">Parcel</span>
          </header>

          {status !== 'done' && (
            <>
              <h1 className="font-display font-semibold text-3xl sm:text-4xl text-ink mb-2">
                Send a file or folder
              </h1>
              <p className="font-body text-ink-soft mb-8">
                Drop it below, or use the buttons to pick from your computer.
              </p>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={`rounded-2xl border-2 border-dashed bg-surface px-8 py-14 text-center transition-colors shadow-card
                  ${dragActive ? 'border-accent bg-accent-soft' : 'border-line'}`}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 text-accent">
                  <path d="M12 3v12m0-12 4 4m-4-4-4 4M5 17v1a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="font-body font-medium text-ink mb-1">
                  {dragActive ? 'Drop it here' : 'Drag files or a whole folder here'}
                </p>
                <p className="font-body text-sm text-muted mb-5">Folder structure is kept intact</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="focus-ring bg-ink text-white font-body text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-ink-soft transition-colors"
                  >
                    Choose files
                  </button>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="focus-ring bg-white border border-line text-ink font-body text-sm font-medium px-4 py-2.5 rounded-lg hover:border-accent transition-colors"
                  >
                    Choose a folder
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files) addEntries(collectFromFileList(e.target.files)); e.target.value = '' }}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files) addEntries(collectFromFileList(e.target.files)); e.target.value = '' }}
                />
              </div>

              {entries.length > 0 && (
                <div className="mt-6 bg-surface rounded-2xl shadow-card overflow-hidden">
                  <FileTree
                    tree={tree}
                    progress={status === 'sealing' ? fileProgress : null}
                    onRemoveFile={removeEntry}
                    onRemoveFolder={removeFolder}
                  />
                  <div className="flex items-center justify-between px-5 py-3 border-t border-line font-mono text-xs text-muted">
                    <span>{entries.length} item{entries.length !== 1 ? 's' : ''}</span>
                    <span>{formatBytes(totalBytes)} of {formatBytes(MAX_TOTAL_BYTES)}</span>
                  </div>
                  <div className="h-1 bg-line">
                    <div
                      className={`h-full ${pctUsed > 90 ? 'bg-danger' : 'bg-accent'}`}
                      style={{ width: `${pctUsed}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 bg-surface rounded-2xl shadow-card px-5 py-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyByEmail}
                    onChange={(e) => setNotifyByEmail(e.target.checked)}
                    className="focus-ring w-4 h-4 accent-accent"
                  />
                  <span className="font-body text-sm text-ink">Email the recipient when it's ready</span>
                </label>
                {notifyByEmail && (
                  <input
                    type="email"
                    required
                    placeholder="recipient@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="focus-ring mt-3 w-full border border-line rounded-lg px-3 py-2 font-body text-sm text-ink placeholder:text-muted"
                  />
                )}
              </div>

              {errorMsg && (
                <p className="mt-4 font-body text-sm text-danger" role="alert">{errorMsg}</p>
              )}

              <button
                onClick={sealAndSend}
                disabled={entries.length === 0 || status === 'sealing' || (notifyByEmail && !email)}
                className="focus-ring mt-6 w-full bg-accent hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed
                  text-white font-display font-semibold text-lg py-3.5 rounded-xl transition-colors"
              >
                {status === 'sealing' ? `Uploading… ${Math.round(overallProgress * 100)}%` : 'Send parcel'}
              </button>
            </>
          )}

          {status === 'done' && ticket && (
            <div className="mt-4">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal mb-2">Parcel sent</p>
              <div className="relative ticket-notch bg-surface rounded-2xl shadow-card overflow-hidden">
                <div className="flex items-center gap-6 px-8 py-8">
                  <img src={ticket.qr} alt="QR code linking to the parcel" width={112} height={112} className="rounded-lg shrink-0" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted mb-1">Tracking code</p>
                    <p className="font-display font-semibold text-3xl text-ink tracking-wide mb-3">{ticket.code}</p>
                    <p className="font-mono text-xs text-muted mb-1">Link</p>
                    <p className="font-mono text-sm text-ink break-all">{ticket.url}</p>
                  </div>
                </div>
                <div className="ticket-tear" />
                <div className="flex items-center justify-between px-8 py-4">
                  <p className="font-mono text-xs text-muted">
                    Expires in {DEFAULT_EXPIRY_DAYS} days · {entries.length} item{entries.length !== 1 ? 's' : ''} · {formatBytes(totalBytes)}
                    {notifyByEmail && email ? ` · emailed to ${email}` : ''}
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={copyLink} className="focus-ring bg-ink text-white font-body text-xs font-medium px-3 py-2 rounded-lg hover:bg-ink-soft">
                      Copy link
                    </button>
                    <a href={ticket.url} className="focus-ring border border-line text-ink font-body text-xs font-medium px-3 py-2 rounded-lg hover:border-accent">
                      Open
                    </a>
                  </div>
                </div>
              </div>
              <button onClick={reset} className="focus-ring mt-6 font-body text-sm text-ink-soft hover:text-accent">
                ← Send another parcel
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
