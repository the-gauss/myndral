import type { AxiosError } from 'axios'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchGeneratedMusicFile,
  generateMusic,
  listMusicJobs,
} from '../services/internal'
import type { LyriaGenerationMode, LyriaScale, MusicGenerationJob } from '../types'

const SCALE_OPTIONS: LyriaScale[] = [
  'SCALE_UNSPECIFIED',
  'C_MAJOR_A_MINOR',
  'D_FLAT_MAJOR_B_FLAT_MINOR',
  'D_MAJOR_B_MINOR',
  'E_FLAT_MAJOR_C_MINOR',
  'E_MAJOR_D_FLAT_MINOR',
  'F_MAJOR_D_MINOR',
  'G_FLAT_MAJOR_E_FLAT_MINOR',
  'G_MAJOR_E_MINOR',
  'A_FLAT_MAJOR_F_MINOR',
  'A_MAJOR_G_FLAT_MINOR',
  'B_FLAT_MAJOR_G_MINOR',
  'B_MAJOR_A_FLAT_MINOR',
]

const MODE_OPTIONS: LyriaGenerationMode[] = [
  'QUALITY',
  'DIVERSITY',
  'VOCALIZATION',
  'MUSIC_GENERATION_MODE_UNSPECIFIED',
]

function parseOptionalNumber(raw: string): number | undefined {
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function parseOptionalInt(raw: string): number | undefined {
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function asErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>
  return axiosError.response?.data?.detail ?? fallback
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatDuration(job: MusicGenerationJob): string {
  const durationMs = Number(job.outputMetadata?.durationMs)
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '-'
  }
  return `${Math.round(durationMs / 1000)}s`
}

function formatFileSize(job: MusicGenerationJob): string {
  const raw = Number(job.outputMetadata?.fileSizeBytes)
  if (!Number.isFinite(raw) || raw <= 0) {
    return '-'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = raw
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  return `${amount.toFixed(1)} ${units[unitIndex]}`
}

export default function CreateMusicPanel() {
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState('')
  const [promptWeight, setPromptWeight] = useState('1')
  const [secondaryPrompt, setSecondaryPrompt] = useState('')
  const [secondaryWeight, setSecondaryWeight] = useState('0.7')
  const [lengthSeconds, setLengthSeconds] = useState('20')
  const [fileName, setFileName] = useState('')
  const [model, setModel] = useState('models/lyria-realtime-exp')
  const [temperature, setTemperature] = useState('1.0')
  const [topK, setTopK] = useState('40')
  const [seed, setSeed] = useState('')
  const [guidance, setGuidance] = useState('4.0')
  const [bpm, setBpm] = useState('120')
  const [density, setDensity] = useState('0.5')
  const [brightness, setBrightness] = useState('0.5')
  const [scale, setScale] = useState<LyriaScale>('SCALE_UNSPECIFIED')
  const [mode, setMode] = useState<LyriaGenerationMode>('QUALITY')
  const [muteBass, setMuteBass] = useState(false)
  const [muteDrums, setMuteDrums] = useState(false)
  const [onlyBassAndDrums, setOnlyBassAndDrums] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)

  const jobs = useQuery({
    queryKey: ['music-jobs'],
    queryFn: () => listMusicJobs({ limit: 50 }),
  })

  const createMusicMutation = useMutation({
    mutationFn: generateMusic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music-jobs'] })
    },
  })

  const previewMutation = useMutation({
    mutationFn: async ({ jobId, storageUrl }: { jobId: string; storageUrl: string }) => {
      const blob = await fetchGeneratedMusicFile(storageUrl)
      return { blob, jobId }
    },
    onSuccess: ({ blob, jobId }) => {
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(blob)
      })
      setPreviewJobId(jobId)
    },
  })

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const controlsEnabled = useMemo(
    () => !createMusicMutation.isPending,
    [createMusicMutation.isPending],
  )

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const weightedPrompts = secondaryPrompt.trim()
      ? [{
        text: secondaryPrompt.trim(),
        weight: parseOptionalNumber(secondaryWeight) ?? 0.7,
      }]
      : []

    createMusicMutation.mutate({
      prompt: prompt.trim(),
      promptWeight: parseOptionalNumber(promptWeight) ?? 1.0,
      weightedPrompts,
      lengthSeconds: parseOptionalInt(lengthSeconds) ?? 20,
      fileName: fileName.trim() || undefined,
      model: model.trim() || undefined,
      temperature: parseOptionalNumber(temperature),
      topK: parseOptionalInt(topK),
      seed: parseOptionalInt(seed),
      guidance: parseOptionalNumber(guidance),
      bpm: parseOptionalInt(bpm),
      density: parseOptionalNumber(density),
      brightness: parseOptionalNumber(brightness),
      scale,
      muteBass,
      muteDrums,
      onlyBassAndDrums,
      musicGenerationMode: mode,
    })
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border bg-surface/40 p-4">
        <h3 className="text-lg font-semibold">Create Music (Lyria)</h3>
        <p className="mt-1 text-sm text-muted-fg">
          Generates a local WAV file into <code>data/generated/music/</code>. This is separate from Add Track.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface/40 p-4 lg:grid-cols-3">
        <label className="text-sm lg:col-span-3">
          Prompt
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ambient cinematic track, warm analog pads, gentle pulse..."
            required
            disabled={!controlsEnabled}
          />
        </label>

        <label className="text-sm">
          Prompt weight
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={promptWeight} onChange={(e) => setPromptWeight(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm lg:col-span-2">
          Secondary weighted prompt (optional)
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={secondaryPrompt} onChange={(e) => setSecondaryPrompt(e.target.value)} placeholder="No distorted guitars" disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Secondary weight
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={secondaryWeight} onChange={(e) => setSecondaryWeight(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Length (seconds)
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" type="number" min={5} max={240} value={lengthSeconds} onChange={(e) => setLengthSeconds(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          File name (optional)
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="evening-drift" disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Model
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs" value={model} onChange={(e) => setModel(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Temperature
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={temperature} onChange={(e) => setTemperature(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Top K
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={topK} onChange={(e) => setTopK(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Seed (optional)
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={seed} onChange={(e) => setSeed(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Guidance
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={guidance} onChange={(e) => setGuidance(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          BPM
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={bpm} onChange={(e) => setBpm(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Density
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={density} onChange={(e) => setDensity(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Brightness
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={brightness} onChange={(e) => setBrightness(e.target.value)} disabled={!controlsEnabled} />
        </label>
        <label className="text-sm">
          Scale
          <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={scale} onChange={(e) => setScale(e.target.value as LyriaScale)} disabled={!controlsEnabled}>
            {SCALE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Generation mode
          <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={mode} onChange={(e) => setMode(e.target.value as LyriaGenerationMode)} disabled={!controlsEnabled}>
            {MODE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={muteBass} onChange={(e) => setMuteBass(e.target.checked)} disabled={!controlsEnabled} />
          Mute bass
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={muteDrums} onChange={(e) => setMuteDrums(e.target.checked)} disabled={!controlsEnabled} />
          Mute drums
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyBassAndDrums} onChange={(e) => setOnlyBassAndDrums(e.target.checked)} disabled={!controlsEnabled} />
          Only bass and drums
        </label>

        {createMusicMutation.error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 lg:col-span-3">
            {asErrorMessage(createMusicMutation.error, 'Music generation failed.')}
          </p>
        )}

        <div className="lg:col-span-3">
          <button disabled={!controlsEnabled} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
            {createMusicMutation.isPending ? 'Generating…' : 'Generate music'}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-border">
        <div className="border-b border-border bg-surface/70 px-4 py-3 text-sm text-muted-fg">
          Recent generated files ({jobs.data?.total ?? 0})
        </div>
        {jobs.isLoading && (
          <p className="px-4 py-3 text-sm text-muted-fg">Loading generation history...</p>
        )}
        {!jobs.isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/40">
                <tr>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Prompt</th>
                  <th className="px-3 py-2 text-left">Duration</th>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Preview</th>
                </tr>
              </thead>
              <tbody>
                {(jobs.data?.items ?? []).map((job) => (
                  <tr key={job.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2">{job.status}</td>
                    <td className="px-3 py-2 max-w-md">
                      <p className="line-clamp-2">{job.prompt || '-'}</p>
                      {job.errorMessage && (
                        <p className="mt-1 text-xs text-red-300">{job.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">{formatDuration(job)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-fg">
                      {job.outputStorageUrl || '-'}
                    </td>
                    <td className="px-3 py-2">{formatFileSize(job)}</td>
                    <td className="px-3 py-2 text-muted-fg">{formatDate(job.createdAt)}</td>
                    <td className="px-3 py-2">
                      {job.outputStorageUrl ? (
                        <button
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-60"
                          disabled={previewMutation.isPending}
                          onClick={() => previewMutation.mutate({ jobId: job.id, storageUrl: job.outputStorageUrl! })}
                        >
                          Preview
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {previewUrl && (
          <div className="border-t border-border bg-surface/30 px-4 py-3">
            <p className="mb-2 text-xs text-muted-fg">Previewing job {previewJobId}</p>
            <audio controls src={previewUrl} className="w-full" />
          </div>
        )}
      </div>
    </section>
  )
}
