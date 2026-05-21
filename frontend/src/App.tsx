import { useState, useCallback } from 'react'
import { Upload, FileText, Download, CheckCircle, AlertCircle, Loader2, Link } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

type Status = 'idle' | 'uploading' | 'converting' | 'done' | 'error'

interface ConversionResult {
  filename: string
  download_url: string
  links_found: number
  links_injected: number
  links_not_found: { url: string; text: string }[]
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0]
      if (dropped.name.endsWith('.html') || dropped.name.endsWith('.htm')) {
        setFile(dropped)
        setStatus('idle')
        setResult(null)
        setError('')
      } else {
        setError('Please upload an .html or .htm file')
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setStatus('idle')
      setResult(null)
      setError('')
    }
  }

  const handleConvert = async () => {
    if (!file) return

    setStatus('uploading')
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      setStatus('converting')
      const response = await fetch(`${API_URL}/convert`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Conversion failed')
      }

      const data: ConversionResult = await response.json()
      setResult(data)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  const handleDownload = () => {
    if (!result) return
    window.open(`${API_URL}${result.download_url}`, '_blank')
  }

  const reset = () => {
    setFile(null)
    setStatus('idle')
    setResult(null)
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 bg-red-900 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Flypower PDF Generator
            </h1>
          </div>
          <p className="text-zinc-500 text-sm">
            Convert HTML flyovers to PDF with clickable links preserved
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl">
          {/* Drop Zone */}
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
              ${dragActive
                ? 'border-red-500 bg-red-950/20'
                : file
                  ? 'border-zinc-600 bg-zinc-800/50'
                  : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30'
              }
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".html,.htm"
              onChange={handleFileSelect}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-5 h-5 text-red-400" />
                <span className="text-zinc-200 font-medium">{file.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); reset() }}
                  className="text-zinc-500 hover:text-zinc-300 text-xs ml-2"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                <p className="text-zinc-300 font-medium mb-1">
                  Drop HTML file here
                </p>
                <p className="text-zinc-600 text-sm">
                  or click to browse
                </p>
              </div>
            )}
          </div>

          {/* Convert Button */}
          <button
            onClick={handleConvert}
            disabled={!file || status === 'converting' || status === 'uploading'}
            className={`
              w-full mt-4 py-3 px-4 rounded-lg font-medium text-sm transition-all
              flex items-center justify-center gap-2
              ${!file || status === 'converting'
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-red-900 hover:bg-red-800 text-white shadow-lg shadow-red-900/20'
              }
            `}
          >
            {status === 'converting' || status === 'uploading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate PDF
              </>
            )}
          </button>

          {/* Result */}
          {status === 'done' && result && (
            <div className="mt-4 space-y-3">
              <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-medium text-sm">
                    Conversion successful
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Link className="w-3 h-3" />
                    {result.links_found} links found
                  </span>
                  <span>
                    {result.links_injected} injected into PDF
                  </span>
                </div>
                {result.links_not_found.length > 0 && (
                  <p className="text-xs text-amber-400 mt-2">
                    {result.links_not_found.length} links couldn't be matched in PDF
                  </p>
                )}
              </div>

              <button
                onClick={handleDownload}
                className="w-full py-3 px-4 rounded-lg font-medium text-sm bg-white text-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download {result.filename}
              </button>
            </div>
          )}

          {/* Error */}
          {status === 'error' && error && (
            <div className="mt-4 bg-red-950/30 border border-red-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-700 text-xs mt-6">
          Flypower Internal Tool · Playwright + PyMuPDF
        </p>
      </div>
    </div>
  )
}

export default App
