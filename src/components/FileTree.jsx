import React, { useState } from 'react'
import { formatBytes } from '../supabaseClient'

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber shrink-0">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted shrink-0">
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function ProgressDot({ value }) {
  if (value === undefined) return null
  if (value >= 1) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-teal shrink-0">
        <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <span className="relative w-3.5 h-3.5 shrink-0">
      <span className="absolute inset-0 rounded-full border-2 border-line" />
      <span
        className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin"
        style={{ opacity: value > 0 ? 1 : 0.4 }}
      />
    </span>
  )
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Folder({ name, node, depth, prefix, progress, mode, onRemoveFile, onRemoveFolder, onDownloadFile }) {
  const [open, setOpen] = useState(true)
  const fullPath = prefix ? `${prefix}/${name}` : name

  return (
    <div>
      <div
        className="flex items-center gap-2 px-5 py-2.5 hover:bg-canvas/60 cursor-pointer group"
        style={{ paddingLeft: `${20 + depth * 16}px` }}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <FolderIcon />
        <span className="font-body text-sm text-ink truncate">{name}</span>
        {mode === 'edit' && !progress && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveFolder(fullPath) }}
            className="focus-ring ml-auto text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Remove folder ${name}`}
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <Tree tree={node} depth={depth + 1} prefix={fullPath} progress={progress} mode={mode} onRemoveFile={onRemoveFile} onRemoveFolder={onRemoveFolder} onDownloadFile={onDownloadFile} />
      )}
    </div>
  )
}

function Tree({ tree, depth, prefix, progress, mode, onRemoveFile, onRemoveFolder, onDownloadFile }) {
  return (
    <>
      {Object.entries(tree.folders).map(([name, node]) => (
        <Folder key={name} name={name} node={node} depth={depth} prefix={prefix} progress={progress} mode={mode} onRemoveFile={onRemoveFile} onRemoveFolder={onRemoveFolder} onDownloadFile={onDownloadFile} />
      ))}
      {tree.files.map((entry) => (
        <div
          key={entry.relativePath}
          className="flex items-center gap-2 px-5 py-2.5 hover:bg-canvas/60 group"
          style={{ paddingLeft: `${20 + depth * 16}px` }}
        >
          <FileIcon />
          <span className="font-body text-sm text-ink truncate">{entry.file.name}</span>
          <span className="font-mono text-xs text-muted ml-2 shrink-0">{formatBytes(entry.file.size)}</span>
          {mode === 'download' ? (
            <button
              onClick={() => onDownloadFile(entry)}
              className="focus-ring ml-auto text-ink-soft hover:text-accent"
              aria-label={`Download ${entry.file.name}`}
            >
              <DownloadIcon />
            </button>
          ) : progress ? (
            <span className="ml-auto"><ProgressDot value={progress[entry.relativePath]} /></span>
          ) : (
            <button
              onClick={() => onRemoveFile(entry.relativePath)}
              className="focus-ring ml-auto text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${entry.file.name}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </>
  )
}

export default function FileTree({ tree, progress, mode = 'edit', onRemoveFile, onRemoveFolder, onDownloadFile }) {
  return (
    <div className="py-1 max-h-80 overflow-y-auto">
      <Tree tree={tree} depth={0} prefix="" progress={progress} mode={mode} onRemoveFile={onRemoveFile} onRemoveFolder={onRemoveFolder} onDownloadFile={onDownloadFile} />
    </div>
  )
}
