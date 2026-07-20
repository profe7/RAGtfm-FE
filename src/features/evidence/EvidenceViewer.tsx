import { useEffect, useMemo, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getDocumentContent } from '../../api'
import type { RetrievedChunk, SourceLocation } from '../../api'

GlobalWorkerOptions.workerSrc = pdfWorker

interface EvidenceViewerProps {
  token: string
  source: RetrievedChunk
  onClose: () => void
}

type DisplaySize = { width: number; height: number }

function highlightStyle(location: SourceLocation, display: DisplaySize) {
  const coordinates = location.coordinates
  const points = coordinates?.points
  const sourceWidth = coordinates?.layout_width
  const sourceHeight = coordinates?.layout_height
  if (!points?.length || !sourceWidth || !sourceHeight) return null

  const xs = points.map(point => point[0]).filter(Number.isFinite)
  const ys = points.map(point => point[1]).filter(Number.isFinite)
  if (!xs.length || !ys.length) return null

  const left = (Math.min(...xs) / sourceWidth) * display.width
  const top = (Math.min(...ys) / sourceHeight) * display.height
  const width = ((Math.max(...xs) - Math.min(...xs)) / sourceWidth) * display.width
  const height = ((Math.max(...ys) - Math.min(...ys)) / sourceHeight) * display.height
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null
  }
  return { left, top, width, height }
}

export function EvidenceViewer({ token, source, onClose }: EvidenceViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(() => source.citation?.page_numbers[0] ?? 1)
  const [display, setDisplay] = useState<DisplaySize>({ width: 0, height: 0 })
  const [bodyWidth, setBodyWidth] = useState(0)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const evidencePages = useMemo(
    () => source.citation?.page_numbers.filter(page => page > 0) ?? [],
    [source],
  )

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const updateWidth = () => setBodyWidth(body.clientWidth)
    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }

    const observer = new ResizeObserver(updateWidth)
    observer.observe(body)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!source.citation?.document_id) return
    let active = true
    let loadedPdf: PDFDocumentProxy | null = null

    void getDocumentContent(token, source.citation.document_id)
      .then(data => getDocument({ data }).promise)
      .then(document => {
        loadedPdf = document
        if (active) {
          setPdf(document)
        } else {
          void document.destroy()
        }
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load evidence.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      void loadedPdf?.destroy()
    }
  }, [source, token])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let renderTask: RenderTask | null = null
    let cancelled = false

    void pdf.getPage(Math.min(pageNumber, pdf.numPages)).then(page => {
      if (cancelled || !canvasRef.current) return
      const baseViewport = page.getViewport({ scale: 1 })
      const body = bodyRef.current
      const bodyStyle = body ? window.getComputedStyle(body) : null
      const horizontalPadding = bodyStyle
        ? Number.parseFloat(bodyStyle.paddingLeft) + Number.parseFloat(bodyStyle.paddingRight)
        : 0
      const availableWidth = Math.max(280, bodyWidth - horizontalPadding)
      const scale = Math.min(1.35, Math.max(0.45, availableWidth / baseViewport.width))
      const viewport = page.getViewport({ scale })
      const outputScale = window.devicePixelRatio || 1
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas rendering is unavailable.')

      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      setDisplay({ width: viewport.width, height: viewport.height })

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      })
      return renderTask.promise
    }).catch(reason => {
      if (!cancelled && reason?.name !== 'RenderingCancelledException') {
        setError('Could not render the cited page.')
      }
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [bodyWidth, pdf, pageNumber])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [source, onClose])

  const locations = (source.citation?.source_locations ?? []).filter(
    location => location.page_number === pageNumber,
  )
  const currentEvidenceIndex = evidencePages.indexOf(pageNumber)

  return (
    <div className="evidence-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label="Citation evidence"
        aria-modal="true"
        className="evidence-viewer"
        role="dialog"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="evidence-head">
          <div>
            <p className="evidence-kicker">Original evidence</p>
            <h2>{source.citation?.filename ?? 'Cited document'}</h2>
            <p className="evidence-meta">
              Page {pageNumber}
              {source.citation?.chunk_type ? ` · ${source.citation.chunk_type}` : ''}
            </p>
          </div>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="evidence-toolbar">
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            disabled={currentEvidenceIndex <= 0}
            onClick={() => setPageNumber(evidencePages[currentEvidenceIndex - 1])}
          >
            Previous evidence
          </button>
          <span>
            {evidencePages.length > 0
              ? `${currentEvidenceIndex + 1} of ${evidencePages.length} cited pages`
              : 'No page coordinates available'}
          </span>
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            disabled={currentEvidenceIndex < 0 || currentEvidenceIndex >= evidencePages.length - 1}
            onClick={() => setPageNumber(evidencePages[currentEvidenceIndex + 1])}
          >
            Next evidence
          </button>
        </div>

        <div className="evidence-body" ref={bodyRef}>
          {(isLoading || (!pdf && !error)) && <p className="evidence-state">Loading PDF…</p>}
          {error && <p className="evidence-state evidence-state--error">{error}</p>}
          <div className="evidence-page" hidden={!pdf || Boolean(error)}>
            <canvas ref={canvasRef} />
            <div className="evidence-highlights" style={display} aria-hidden="true">
              {locations.map((location, index) => {
                const style = highlightStyle(location, display)
                return style ? (
                  <span className="evidence-highlight" key={location.element_id ?? index} style={style} />
                ) : null
              })}
            </div>
          </div>
          {pdf && locations.length === 0 && (
            <p className="evidence-fallback">
              Exact coordinates were unavailable for this chunk. The extracted evidence is shown
              below.
            </p>
          )}
          <blockquote className="evidence-excerpt">{source.text}</blockquote>
        </div>
      </section>
    </div>
  )
}
