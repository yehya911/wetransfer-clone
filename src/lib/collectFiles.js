// Turns whatever the browser hands us (a flat FileList from a normal picker,
// or a DataTransferItemList from a drag-and-drop that may contain folders)
// into a flat array of { file, relativePath } entries. relativePath preserves
// folder structure, e.g. "designs/logo/final.png".

function readEntry(entry) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (file) => resolve([{ file, relativePath: entry.fullPath.replace(/^\//, '') }]),
        () => resolve([])
      )
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const all = []
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            const nested = await Promise.all(all.map(readEntry))
            resolve(nested.flat())
            return
          }
          all.push(...entries)
          readBatch()
        }, () => resolve([]))
      }
      readBatch()
    } else {
      resolve([])
    }
  })
}

// From a drag-and-drop DataTransfer
export async function collectFromDataTransfer(dataTransfer) {
  const items = Array.from(dataTransfer.items || [])
  const entries = items
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter(Boolean)

  if (entries.length === 0) {
    // Fallback: browser didn't support the entries API, just use flat files
    return Array.from(dataTransfer.files || []).map((file) => ({
      file,
      relativePath: file.name,
    }))
  }

  const nested = await Promise.all(entries.map(readEntry))
  return nested.flat()
}

// From a normal <input type="file" webkitdirectory> or <input type="file" multiple>
export function collectFromFileList(fileList) {
  return Array.from(fileList).map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }))
}

// Groups a flat entry list into a tree for display purposes.
// Returns { folders: { [name]: tree }, files: [entry, ...] }
export function buildTree(entries) {
  const root = { folders: {}, files: [] }
  for (const entry of entries) {
    const parts = entry.relativePath.split('/').filter(Boolean)
    let node = root
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i]
      if (!node.folders[part]) node.folders[part] = { folders: {}, files: [] }
      node = node.folders[part]
    }
    node.files.push(entry)
  }
  return root
}
