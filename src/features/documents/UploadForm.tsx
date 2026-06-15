import { useState, useRef } from 'react'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface UploadFormProps {
  onUpload: (file: File) => Promise<void>
  isUploading: boolean
}

export function UploadForm({ onUpload, isUploading }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    
    await onUpload(selectedFile)
    
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="sidebar-section">
      <p className="section-label">Ingest</p>
      <form onSubmit={handleSubmit}>
        <label className="file-drop">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
          <span className="file-drop-icon">↑</span>
          <span className="file-drop-name">
            {selectedFile ? selectedFile.name : 'Choose PDF'}
          </span>
          {selectedFile && (
            <span className="file-drop-size">{formatBytes(selectedFile.size)}</span>
          )}
        </label>
        <button
          className="btn btn--primary btn--full"
          type="submit"
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </div>
  )
}
