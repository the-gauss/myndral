/**
 * Songs screen — the primary music creation surface of Creator Studio.
 *
 * Three tabs:
 *   Generate — AI music generation (prompt, style, lyrics, seed, instrumental toggle)
 *   Upload   — Upload an audio file from device or link an external URL
 *   Catalog  — Browse all tracks with search and status filter
 *
 * Music generation flow:
 *   fill params → Preview & Submit → POST /v1/internal/music/generate
 *   → job created → Jobs section shows live status → completed job links to
 *   the track that entered staging.
 *
 * Upload flow (mirrors web CreateMusicPanel):
 *   file mode: expo-document-picker → FormData → POST /v1/internal/music/upload
 *   url mode:  external CDN URL → POST /v1/internal/music/link
 *
 * Jobs list auto-refreshes every 10 s while any job is pending/in-progress.
 *
 * Audio preview uses expo-audio to stream the generated track directly from the
 * storage URL returned by the API (authenticated via the same JWT).
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { SymbolView } from 'expo-symbols';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { AxiosError } from 'axios';
import { GlassSurface } from '@/src/components/GlassSurface';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenView } from '@/src/components/ScreenView';
import { StudioHeader } from '@/src/components/StudioHeader';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';
import {
  generateMusic,
  linkExternalUrl,
  listAlbums,
  listArtists,
  listMusicJobs,
  listTracks,
  uploadCustomMusic,
} from '@/src/services/studio';
import type {
  AlbumItem,
  ArtistItem,
  ContentStatus,
  MusicGenerateRequest,
  MusicGenerationJob,
  MusicGenerationStatus,
  TrackItem,
} from '@/src/types/studio';
import { canEdit, humanizeStatus } from '@/src/types/studio';

// ── Helpers ────────────────────────────────────────────────────────────────────

function apiError(error: unknown): string {
  const e = error as AxiosError<{ detail?: unknown }>;
  const detail = e.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && detail.length > 0) {
    const first = (detail[0] as { msg?: string })?.msg;
    return first ? `Validation error: ${first}` : 'Request failed.';
  }
  return 'Something went wrong. Please try again.';
}

function parseOptionalInt(raw: string): number | undefined {
  const n = parseInt(raw, 10);
  return isFinite(n) ? n : undefined;
}

function formatJobStatus(status: MusicGenerationStatus): string {
  return status.replace(/_/g, ' ');
}

function jobStatusColor(status: MusicGenerationStatus, colors: Record<string, string>): string {
  if (status === 'completed') return colors.success;
  if (status === 'failed' || status === 'cancelled') return colors.danger;
  if (status === 'in_progress') return colors.primary;
  return colors.textMuted; // pending
}

function formatShortDate(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type CreatorTab = 'generate' | 'upload' | 'catalog';
type UploadMode = 'file' | 'url';

// ── Sub-components ─────────────────────────────────────────────────────────────

function TabPill({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: theme.colors.glassBgHeavy, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.glassBorder, padding: 4, gap: 2 }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable key={tab.key} onPress={() => onSelect(tab.key)}
            style={({ pressed }) => ({ flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: isActive ? theme.colors.primary : 'transparent', alignItems: 'center', opacity: pressed ? 0.8 : 1 })}
          >
            <Text style={{ color: isActive ? '#fff' : theme.colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.85 }}>
        {label}
      </Text>
      {hint ? <Text style={{ color: theme.colors.textSubtle, fontSize: 12, lineHeight: 16 }}>{hint}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSubtle}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          minHeight: multiline ? 80 : 52,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: theme.colors.surfaceBorder,
          backgroundColor: theme.colors.glassBgHeavy,
          color: theme.colors.text,
          paddingHorizontal: 18,
          paddingTop: multiline ? 14 : 0,
          fontSize: 15,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {hint ? <Text style={{ color: theme.colors.textSubtle, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.glassBorder, true: theme.colors.primary + '80' }}
        thumbColor={value ? theme.colors.primary : theme.colors.textSubtle}
      />
    </View>
  );
}

function StatusBadge({ status }: { status: ContentStatus }) {
  const { theme } = useTheme();
  const map: Record<ContentStatus, { bg: string; text: string; border: string }> = {
    published: { bg: theme.colors.success + '20', text: theme.colors.success, border: theme.colors.success + '40' },
    review: { bg: theme.colors.warning + '20', text: theme.colors.warning, border: theme.colors.warning + '40' },
    archived: { bg: theme.colors.textSubtle + '18', text: theme.colors.textSubtle, border: theme.colors.textSubtle + '30' },
  };
  const c = map[status];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{humanizeStatus(status)}</Text>
    </View>
  );
}

// ── Artist / Album picker modal ────────────────────────────────────────────────

function EntityPickerModal<T extends { id: string; name?: string; title?: string }>({
  visible,
  label,
  selected,
  items,
  loading,
  onSelect,
  onClose,
}: {
  visible: boolean;
  label: string;
  selected: string;
  items: T[];
  loading: boolean;
  onSelect: (item: T) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');

  const filtered = items.filter((i) => {
    const name = (i as unknown as ArtistItem).name ?? (i as unknown as AlbumItem).title ?? '';
    return search.trim() ? name.toLowerCase().includes(search.toLowerCase()) : true;
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700', fontFamily: theme.typography.displayFontFamily }}>
              {label}
            </Text>
            <Pressable onPress={onClose}>
              <SymbolView name="xmark.circle.fill" size={28} tintColor={theme.colors.textSubtle} />
            </Pressable>
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search…"
            placeholderTextColor={theme.colors.textSubtle}
            style={{ height: 46, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.glassBgHeavy, color: theme.colors.text, paddingHorizontal: 18, fontSize: 15 }}
          />
        </View>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} />
        ) : (
          filtered.map((item) => {
            const displayName = (item as unknown as ArtistItem).name ?? (item as unknown as AlbumItem).title ?? item.id;
            const isSelected = item.id === selected;
            return (
              <Pressable
                key={item.id}
                onPress={() => { onSelect(item); setSearch(''); onClose(); }}
                style={({ pressed }) => ({
                  marginHorizontal: 20, marginBottom: 10, padding: 16, borderRadius: 22, borderWidth: 1,
                  borderColor: isSelected ? theme.colors.primary + '70' : theme.colors.glassBorder,
                  backgroundColor: isSelected ? theme.colors.primary + '18' : theme.colors.glassBgHeavy,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>{displayName}</Text>
              </Pressable>
            );
          })
        )}
      </View>
    </Modal>
  );
}

// ── Common catalog/linking fields used by all three create modes ───────────────

function CatalogLinkFields({
  selectedArtistId,
  selectedArtistName,
  selectedAlbumId,
  selectedAlbumTitle,
  trackTitle,
  explicit,
  onSelectArtist,
  onSelectAlbum,
  onChangeTitle,
  onChangeExplicit,
}: {
  selectedArtistId: string;
  selectedArtistName: string;
  selectedAlbumId: string;
  selectedAlbumTitle: string;
  trackTitle: string;
  explicit: boolean;
  onSelectArtist: (a: ArtistItem) => void;
  onSelectAlbum: (a: AlbumItem) => void;
  onChangeTitle: (v: string) => void;
  onChangeExplicit: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  const [showArtistPicker, setShowArtistPicker] = useState(false);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);

  const artistsQuery = useQuery({
    queryKey: ['studio-artists-all'],
    queryFn: () => listArtists({ limit: 200 }),
  });

  const albumsQuery = useQuery({
    queryKey: ['studio-albums-for-artist', selectedArtistId],
    queryFn: () => listAlbums({ artistId: selectedArtistId, limit: 200 }),
    enabled: !!selectedArtistId,
  });

  return (
    <>
      {/* Artist */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.85 }}>Artist *</Text>
        <Pressable
          onPress={() => setShowArtistPicker(true)}
          style={({ pressed }) => ({
            height: 52, borderRadius: 22, borderWidth: 1,
            borderColor: selectedArtistId ? theme.colors.primary + '60' : theme.colors.surfaceBorder,
            backgroundColor: theme.colors.glassBgHeavy,
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10, opacity: pressed ? 0.7 : 1,
          })}
        >
          <SymbolView name="person.fill" size={16} tintColor={selectedArtistId ? theme.colors.primary : theme.colors.textSubtle} />
          <Text style={{ color: selectedArtistId ? theme.colors.primary : theme.colors.textSubtle, fontSize: 14 }}>
            {selectedArtistName || 'Choose artist…'}
          </Text>
        </Pressable>
      </View>

      {/* Album */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.85 }}>Album *</Text>
        <Pressable
          onPress={() => selectedArtistId ? setShowAlbumPicker(true) : Alert.alert('Select artist first')}
          style={({ pressed }) => ({
            height: 52, borderRadius: 22, borderWidth: 1,
            borderColor: selectedAlbumId ? theme.colors.primary + '60' : theme.colors.surfaceBorder,
            backgroundColor: theme.colors.glassBgHeavy,
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10, opacity: pressed ? 0.7 : 1,
          })}
        >
          <SymbolView name="square.stack" size={16} tintColor={selectedAlbumId ? theme.colors.primary : theme.colors.textSubtle} />
          <Text style={{ color: selectedAlbumId ? theme.colors.primary : theme.colors.textSubtle, fontSize: 14 }}>
            {selectedAlbumTitle || 'Choose album…'}
          </Text>
        </Pressable>
      </View>

      {/* Track title */}
      <Field label="Track Title *" value={trackTitle} onChangeText={onChangeTitle} placeholder="Track name" />

      {/* Explicit */}
      <ToggleRow label="Explicit content" value={explicit} onChange={onChangeExplicit} />

      <EntityPickerModal
        visible={showArtistPicker}
        label="Select Artist"
        selected={selectedArtistId}
        items={artistsQuery.data?.items ?? []}
        loading={artistsQuery.isLoading}
        onSelect={onSelectArtist}
        onClose={() => setShowArtistPicker(false)}
      />
      <EntityPickerModal
        visible={showAlbumPicker}
        label="Select Album"
        selected={selectedAlbumId}
        items={albumsQuery.data?.items ?? []}
        loading={albumsQuery.isLoading}
        onSelect={onSelectAlbum}
        onClose={() => setShowAlbumPicker(false)}
      />
    </>
  );
}

// ── AI Generate form ───────────────────────────────────────────────────────────

function GenerateForm({ onSuccess }: { onSuccess: () => void }) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  // Catalog linking
  const [artistId, setArtistId] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [explicit, setExplicit] = useState(false);

  // Generation params
  const [prompt, setPrompt] = useState('');
  const [styleNote, setStyleNote] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [lengthSeconds, setLengthSeconds] = useState('150');
  const [seed, setSeed] = useState('');
  const [fileName, setFileName] = useState('');
  const [forceInstrumental, setForceInstrumental] = useState(false);
  const [useCustomLyrics, setUseCustomLyrics] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [withTimestamps, setWithTimestamps] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: generateMusic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music-jobs'] });
      onSuccess();
    },
    onError: (err) => setError(apiError(err)),
  });

  function handlePreview() {
    if (!artistId) { setError('Select an artist.'); return; }
    if (!albumId) { setError('Select an album.'); return; }
    if (!trackTitle.trim()) { setError('Track title is required.'); return; }
    if (!prompt.trim()) { setError('Prompt is required.'); return; }
    setError(null);
    setShowPreview(true);
  }

  function buildRequest(): MusicGenerateRequest {
    return {
      artist_id: artistId,
      album_id: albumId,
      track_title: trackTitle.trim(),
      explicit,
      prompt: prompt.trim(),
      style_note: styleNote.trim() || undefined,
      negative_prompt: negativePrompt.trim() || undefined,
      length_seconds: parseOptionalInt(lengthSeconds),
      seed: parseOptionalInt(seed),
      file_name: fileName.trim() || undefined,
      force_instrumental: forceInstrumental,
      use_custom_lyrics: useCustomLyrics,
      lyrics: useCustomLyrics ? lyrics.trim() || undefined : undefined,
      with_timestamps: withTimestamps,
    };
  }

  if (showPreview) {
    const req = buildRequest();
    return (
      <GlassSurface style={{ padding: 20, gap: 14 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800', fontFamily: theme.typography.displayFontFamily }}>
          Review & Generate
        </Text>
        <View style={{ gap: 8 }}>
          {([['Track', req.track_title], ['Artist', artistName], ['Album', albumTitle],
             ['Prompt', req.prompt ?? ''], req.style_note && ['Style', req.style_note],
             req.negative_prompt && ['Avoid', req.negative_prompt],
             ['Length', `${req.length_seconds ?? 150}s`],
             req.seed && ['Seed', String(req.seed)],
             ['Instrumental', String(req.force_instrumental)],
             req.use_custom_lyrics && ['Custom lyrics', 'yes'],
          ] as [string, string][]).filter(Boolean).map(([label, val]) => (
            <View key={label} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13, minWidth: 90 }}>{label}</Text>
              <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1 }} numberOfLines={4}>{val}</Text>
            </View>
          ))}
        </View>
        {error ? <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => setShowPreview(false)} style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.glassBgHeavy, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => { setError(null); generateMutation.mutate(req); }}
            disabled={generateMutation.isPending}
            style={({ pressed }) => ({ flex: 2, height: 48, borderRadius: 18, backgroundColor: theme.colors.cta, alignItems: 'center', justifyContent: 'center', opacity: pressed || generateMutation.isPending ? 0.7 : 1 })}
          >
            <Text style={{ color: theme.colors.ctaText, fontWeight: '700' }}>
              {generateMutation.isPending ? 'Queuing…' : 'Start Generation'}
            </Text>
          </Pressable>
        </View>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface style={{ padding: 18, gap: 16 }}>
      <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700', fontFamily: theme.typography.displayFontFamily }}>
        AI Generation
      </Text>

      <CatalogLinkFields
        selectedArtistId={artistId} selectedArtistName={artistName}
        selectedAlbumId={albumId} selectedAlbumTitle={albumTitle}
        trackTitle={trackTitle} explicit={explicit}
        onSelectArtist={(a) => { setArtistId(a.id); setArtistName(a.name); setAlbumId(''); setAlbumTitle(''); }}
        onSelectAlbum={(a) => { setAlbumId(a.id); setAlbumTitle(a.title); }}
        onChangeTitle={setTrackTitle}
        onChangeExplicit={setExplicit}
      />

      <Field
        label="Prompt *"
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Describe the music — mood, instruments, tempo, genre…"
        multiline
        hint="Be specific about emotion and instrumentation for best results."
      />
      <Field
        label="Style note"
        value={styleNote}
        onChangeText={setStyleNote}
        placeholder="Additional style guidance (optional)"
        multiline
      />
      <Field
        label="Avoid (negative prompt)"
        value={negativePrompt}
        onChangeText={setNegativePrompt}
        placeholder="Instruments or styles to avoid"
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Length (seconds)" value={lengthSeconds} onChangeText={setLengthSeconds} placeholder="150" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Seed (optional)" value={seed} onChangeText={setSeed} placeholder="Random" />
        </View>
      </View>

      <Field label="File name (optional)" value={fileName} onChangeText={setFileName} placeholder="output_v1" />

      <ToggleRow label="Force instrumental" hint="No vocals will be generated." value={forceInstrumental} onChange={setForceInstrumental} />
      <ToggleRow label="Use custom lyrics" value={useCustomLyrics} onChange={setUseCustomLyrics} />

      {useCustomLyrics ? (
        <>
          <Field label="Lyrics" value={lyrics} onChangeText={setLyrics} placeholder="Enter your lyrics…" multiline />
          <ToggleRow label="Include timestamps" hint="Adds [MM:SS] markers to the generated lyrics output." value={withTimestamps} onChange={setWithTimestamps} />
        </>
      ) : null}

      {error ? <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text> : null}

      <PrimaryButton label="Preview & Generate" onPress={handlePreview} />
    </GlassSurface>
  );
}

// ── Upload form ────────────────────────────────────────────────────────────────

function UploadForm({ onSuccess }: { onSuccess: () => void }) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [artistId, setArtistId] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [explicit, setExplicit] = useState(false);
  const [lyrics, setLyrics] = useState('');

  const [uploadMode, setUploadMode] = useState<UploadMode>('file');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (uploadMode === 'file') {
        if (!pickedFile) throw new Error('No file selected.');
        return uploadCustomMusic(pickedFile, {
          artistId, albumId, trackTitle: trackTitle.trim(), explicit,
          lyrics: lyrics.trim() || undefined,
        });
      } else {
        if (!linkUrl.trim()) throw new Error('URL is required.');
        return linkExternalUrl({
          storageUrl: linkUrl.trim(), artistId, albumId,
          trackTitle: trackTitle.trim(), explicit, lyrics: lyrics.trim() || undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music-jobs'] });
      onSuccess();
    },
    onError: (err) => setError(apiError(err)),
  });

  async function pickAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setPickedFile({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'audio/mpeg',
        });
      }
    } catch {
      Alert.alert('Could not open file picker.');
    }
  }

  function handleSubmit() {
    if (!artistId) { setError('Select an artist.'); return; }
    if (!albumId) { setError('Select an album.'); return; }
    if (!trackTitle.trim()) { setError('Track title is required.'); return; }
    if (uploadMode === 'file' && !pickedFile) { setError('Select an audio file.'); return; }
    if (uploadMode === 'url' && !linkUrl.trim()) { setError('Enter a URL.'); return; }
    setError(null);
    uploadMutation.mutate();
  }

  return (
    <GlassSurface style={{ padding: 18, gap: 16 }}>
      <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700', fontFamily: theme.typography.displayFontFamily }}>
        Upload Track
      </Text>

      {/* Mode picker */}
      <TabPill
        tabs={[{ key: 'file', label: 'Upload File' }, { key: 'url', label: 'Link URL' }]}
        active={uploadMode}
        onSelect={(k) => setUploadMode(k as UploadMode)}
      />

      <CatalogLinkFields
        selectedArtistId={artistId} selectedArtistName={artistName}
        selectedAlbumId={albumId} selectedAlbumTitle={albumTitle}
        trackTitle={trackTitle} explicit={explicit}
        onSelectArtist={(a) => { setArtistId(a.id); setArtistName(a.name); setAlbumId(''); setAlbumTitle(''); }}
        onSelectAlbum={(a) => { setAlbumId(a.id); setAlbumTitle(a.title); }}
        onChangeTitle={setTrackTitle}
        onChangeExplicit={setExplicit}
      />

      {uploadMode === 'file' ? (
        <Pressable
          onPress={pickAudio}
          style={({ pressed }) => ({
            height: 52, borderRadius: 22, borderWidth: 1,
            borderColor: pickedFile ? theme.colors.primary + '60' : theme.colors.surfaceBorder,
            backgroundColor: theme.colors.glassBgHeavy,
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <SymbolView
            name={pickedFile ? 'checkmark.circle.fill' : 'waveform.badge.plus'}
            size={18}
            tintColor={pickedFile ? theme.colors.primary : theme.colors.textSubtle}
          />
          <Text style={{ color: pickedFile ? theme.colors.primary : theme.colors.textSubtle, fontSize: 14, flex: 1 }} numberOfLines={1}>
            {pickedFile ? pickedFile.name : 'Choose audio file…'}
          </Text>
        </Pressable>
      ) : (
        <Field
          label="External URL"
          value={linkUrl}
          onChangeText={setLinkUrl}
          placeholder="https://cdn.example.com/track.mp3"
          hint="Direct link to an audio file (mp3, wav, flac, etc.)"
        />
      )}

      <Field label="Lyrics (optional)" value={lyrics} onChangeText={setLyrics} placeholder="Song lyrics…" multiline />

      {error ? <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text> : null}

      <PrimaryButton
        label={uploadMutation.isPending ? 'Uploading…' : 'Submit to Staging'}
        onPress={handleSubmit}
        disabled={uploadMutation.isPending}
      />
    </GlassSurface>
  );
}

// ── Jobs list ──────────────────────────────────────────────────────────────────

function JobsList() {
  const { theme } = useTheme();
  const accessToken = useAuthStore((s) => s.accessToken);
  const playerRef = useRef<AudioPlayer | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const jobsQuery = useQuery({
    queryKey: ['music-jobs'],
    queryFn: () => listMusicJobs({ limit: 30 }),
    // Refresh while any job is actively being processed.
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasActive = items.some((j) => j.status === 'pending' || j.status === 'in_progress');
      return hasActive ? 10_000 : false;
    },
  });

  const jobs = jobsQuery.data?.items ?? [];

  async function playPreview(job: MusicGenerationJob) {
    if (!job.outputStorageUrl) return;

    // Stop any existing preview.
    if (playerRef.current) {
      playerRef.current.remove();
      playerRef.current = null;
      if (previewJobId === job.id) {
        setPreviewJobId(null);
        setPreviewPlaying(false);
        return;
      }
    }

    // The storage URL may require auth. We request it through the proxy endpoint
    // using a signed fetch, then play the returned URL directly.
    try {
      const { API_BASE_URL } = await import('@/src/lib/env');
      const proxyUrl = `${API_BASE_URL}/v1/internal/music/file?storageUrl=${encodeURIComponent(job.outputStorageUrl)}`;
      const player = createAudioPlayer({ uri: proxyUrl, headers: { Authorization: `Bearer ${accessToken ?? ''}` } });
      playerRef.current = player;
      player.play();
      setPreviewJobId(job.id);
      setPreviewPlaying(true);
    } catch {
      Alert.alert('Preview failed', 'Could not load the audio file.');
    }
  }

  // Cleanup player on unmount.
  useEffect(() => {
    return () => {
      playerRef.current?.remove();
    };
  }, []);

  if (jobsQuery.isLoading) {
    return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 8 }} />;
  }

  if (jobs.length === 0) {
    return (
      <GlassSurface style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No generation jobs yet.</Text>
      </GlassSurface>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {jobs.map((job) => {
        const statusColor = jobStatusColor(job.status, theme.colors as unknown as Record<string, string>);
        const isThisPreview = previewJobId === job.id;
        return (
          <GlassSurface key={job.id} style={{ padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                  {job.trackTitle}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {job.artistName ?? '—'} · {job.albumTitle ?? '—'}
                </Text>
              </View>
              <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: statusColor + '20', borderWidth: 1, borderColor: statusColor + '44' }}>
                <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                  {formatJobStatus(job.status)}
                </Text>
              </View>
            </View>

            <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>
              {formatShortDate(job.createdAt)}
            </Text>

            {job.status === 'in_progress' && (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ alignSelf: 'flex-start' }} />
            )}

            {job.status === 'failed' && job.errorMessage ? (
              <Text style={{ color: theme.colors.danger, fontSize: 12 }} numberOfLines={2}>
                {job.errorMessage}
              </Text>
            ) : null}

            {job.status === 'completed' && job.outputStorageUrl ? (
              <Pressable
                onPress={() => playPreview(job)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7,
                  borderRadius: 18, borderWidth: 1, borderColor: theme.colors.primary + '60',
                  backgroundColor: theme.colors.primary + '18', opacity: pressed ? 0.7 : 1,
                })}
              >
                <SymbolView
                  name={isThisPreview && previewPlaying ? 'stop.fill' : 'play.fill'}
                  size={14}
                  tintColor={theme.colors.primary}
                />
                <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
                  {isThisPreview && previewPlaying ? 'Stop' : 'Preview'}
                </Text>
              </Pressable>
            ) : null}
          </GlassSurface>
        );
      })}
    </View>
  );
}

// ── Catalog ────────────────────────────────────────────────────────────────────

function TrackCatalog() {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');

  const tracksQuery = useQuery({
    queryKey: ['studio-tracks', statusFilter],
    queryFn: () => listTracks({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 100 }),
  });

  const items = (tracksQuery.data?.items ?? []).filter((t) =>
    search.trim() ? t.title.toLowerCase().includes(search.toLowerCase()) : true,
  );

  function formatDuration(ms: number | null | undefined): string {
    if (!ms || ms <= 0) return '-';
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search tracks…"
        placeholderTextColor={theme.colors.textSubtle}
        style={{ height: 46, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.glassBgHeavy, color: theme.colors.text, paddingHorizontal: 18, fontSize: 15 }}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all', 'review', 'published', 'archived'] as const).map((s) => {
          const active = statusFilter === s;
          return (
            <Pressable key={s} onPress={() => setStatusFilter(s)}
              style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: active ? theme.colors.primary + '28' : theme.colors.glassBgHeavy, borderWidth: 1, borderColor: active ? theme.colors.primary + '70' : theme.colors.surfaceBorder, opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ color: active ? theme.colors.primary : theme.colors.textMuted, fontSize: 13, fontWeight: active ? '700' : '400', textTransform: 'capitalize' }}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tracksQuery.isLoading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : items.length === 0 ? (
        <GlassSurface style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No tracks found.</Text>
        </GlassSurface>
      ) : (
        items.map((track) => (
          <GlassSurface key={track.id} style={{ padding: 14, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                    {track.title}
                  </Text>
                  {track.explicit ? (
                    <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: theme.colors.danger + '28' }}>
                      <Text style={{ color: theme.colors.danger, fontSize: 10, fontWeight: '700' }}>E</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {track.primaryArtistName ?? '—'} · {track.albumTitle}
                </Text>
                <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>
                  {formatDuration(track.durationMs)}
                </Text>
              </View>
              <StatusBadge status={track.status} />
            </View>
          </GlassSurface>
        ))
      )}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function SongsScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<CreatorTab>('generate');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const canCreate = canEdit(user?.role);

  function handleSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }

  return (
    <ScreenView bottomInset={120}>
      <StudioHeader subtitle="Songs" />

      <TabPill
        tabs={[
          { key: 'generate', label: 'Generate' },
          { key: 'upload', label: 'Upload' },
          { key: 'catalog', label: 'Catalog' },
        ]}
        active={activeTab}
        onSelect={(k) => setActiveTab(k as CreatorTab)}
      />

      {successMsg ? (
        <GlassSurface style={{ padding: 14 }}>
          <Text style={{ color: theme.colors.success, fontWeight: '600', fontSize: 14 }}>
            {successMsg}
          </Text>
        </GlassSurface>
      ) : null}

      {activeTab === 'generate' ? (
        canCreate ? (
          <GenerateForm onSuccess={() => handleSuccess('Generation job queued. Check Jobs below.')} />
        ) : (
          <GlassSurface style={{ padding: 20, alignItems: 'center', gap: 8 }}>
            <SymbolView name="lock.fill" size={24} tintColor={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' }}>
              Music generation requires Content Editor or Admin privileges.
            </Text>
          </GlassSurface>
        )
      ) : activeTab === 'upload' ? (
        canCreate ? (
          <UploadForm onSuccess={() => handleSuccess('Track submitted to staging.')} />
        ) : (
          <GlassSurface style={{ padding: 20, alignItems: 'center', gap: 8 }}>
            <SymbolView name="lock.fill" size={24} tintColor={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' }}>
              Track upload requires Content Editor or Admin privileges.
            </Text>
          </GlassSurface>
        )
      ) : (
        <TrackCatalog />
      )}

      {/* Jobs section — always visible regardless of active tab when there are jobs */}
      {activeTab !== 'catalog' ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700', fontFamily: theme.typography.displayFontFamily }}>
            Recent Jobs
          </Text>
          <JobsList />
        </View>
      ) : null}
    </ScreenView>
  );
}
