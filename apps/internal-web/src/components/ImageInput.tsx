/**
 * ImageInput — three-mode image picker for artist portraits and album covers.
 *
 * Modes:
 *   upload   — file picker that POSTs the image and resolves to a storage URL
 *   url      — direct text input for an existing CDN / local data/ path
 *   generate — placeholder for Nano Banana AI image generation (not yet wired)
 *
 * The parent always works with a plain string URL. Mode is local UI state only.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { uploadImage } from '../services/internal'
import type { AxiosError } from 'axios'

type ImageMode = 'upload' | 'url' | 'generate'

const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/avif'

interface ImageInputProps {
  label: string
  value: string
  onChange: (url: string) => void
  required?: boolean
  disabled?: boolean
  /** Hint shown under the URL input */
  placeholder?: string
}

export default function ImageInput({
  label,
  value,
  onChange,
  required,
  disabled,
  placeholder = 'data/images/photo.jpg  or  https://...',
}: ImageInputProps) {
  const [mode, setMode] = useState<ImageMode>('url')

  const uploadMutation = useMutation({
    mutationFn: uploadImage,
    onSuccess: ({ storageUrl }) => onChange(storageUrl),
  })

  // Safely extract a displayable string from the Axios error.
  // FastAPI validation failures return detail as an array of objects; rendering
  // a non-string value in JSX throws "Objects are not valid as a React child"
  // which, without an error boundary, unmounts the entire app (black page).
  const uploadError = (() => {
    if (!uploadMutation.error) return null
    const err = uploadMutation.error as AxiosError<{ detail?: unknown }>
    const detail = err?.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail.trim()
    if (Array.isArray(detail) && detail.length > 0) {
      const first = (detail[0] as { msg?: string })?.msg
      return first ? `Validation error: ${first}` : 'Upload failed.'
    }
    return 'Upload failed.'
  })()

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm">
          {label}{required && <span className="ml-0.5 text-accent">*</span>}
        </span>

        {/* Mode selector */}
        <div className="flex gap-1">
          {(['upload', 'url', 'generate'] as ImageMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`rounded px-2 py-0.5 text-xs capitalize transition-colors
                ${mode === m
                  ? 'bg-accent text-accent-fg'
                  : 'studio-outline-button text-muted-fg hover:text-foreground'}
                ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'generate' ? 'Nano Banana' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Upload mode ─────────────────────────────────────────────── */}
      {mode === 'upload' && (
        <div className="space-y-1">
          <input
            type="file"
            accept={ACCEPTED_IMAGES}
            className="block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm
              file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-accent
              file:px-2 file:py-1 file:text-xs file:font-medium file:text-accent-fg
              disabled:opacity-50"
            disabled={disabled || uploadMutation.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadMutation.mutate(file)
            }}
          />
          {uploadMutation.isPending && (
            <p className="text-xs text-muted-fg">Uploading…</p>
          )}
          {uploadError && (
            <p className="text-xs text-red-300">{uploadError}</p>
          )}
          {value && !uploadMutation.isPending && (
            <p className="truncate text-xs text-muted-fg">{value}</p>
          )}
        </div>
      )}

      {/* ── URL mode ────────────────────────────────────────────────── */}
      {mode === 'url' && (
        <input
          className="w-full rounded-md bg-background border border-border px-3 py-2 text-sm disabled:opacity-50"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}

      {/* ── Generate mode (placeholder) ─────────────────────────────── */}
      {mode === 'generate' && (
        <div className="studio-card-soft flex items-center gap-3 rounded-2xl px-3 py-2">
          <button
            type="button"
            disabled
            className="rounded-md bg-accent/50 px-3 py-1.5 text-xs font-medium text-accent-fg opacity-60 cursor-not-allowed"
          >
            Generate image
          </button>
          <span className="text-xs text-muted-fg">
            AI image generation coming soon — Nano Banana integration pending.
          </span>
        </div>
      )}
    </div>
  )
}
