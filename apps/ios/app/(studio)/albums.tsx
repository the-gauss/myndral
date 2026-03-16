/**
 * Albums screen — create albums linked to existing artists and browse the catalog.
 *
 * Two tabs: Create (form + cover upload) and Catalog (filterable by artist & status).
 *
 * Creation flow: fill form → Preview & Submit → confirm → POST /v1/internal/albums
 * → status='review'. Artists must already be in the system (staged or published).
 * Cover image upload follows the same pattern as the Artists screen.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { GlassSurface } from '@/src/components/GlassSurface';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenView } from '@/src/components/ScreenView';
import { StudioHeader } from '@/src/components/StudioHeader';
import { useTheme } from '@/src/providers/ThemeProvider';
import {
  createAlbum,
  listAlbums,
  listArtists,
  listGenres,
  updateAlbum,
  uploadImage,
} from '@/src/services/studio';
import type { AlbumItem, AlbumType, ArtistItem, ContentStatus } from '@/src/types/studio';
import { humanizeStatus } from '@/src/types/studio';

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

type ScreenTab = 'create' | 'catalog';

const ALBUM_TYPES: AlbumType[] = ['album', 'ep', 'single', 'compilation'];

// ── Shared sub-components ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContentStatus }) {
  const { theme } = useTheme();
  const map: Record<ContentStatus, { bg: string; text: string; border: string }> = {
    published: {
      bg: theme.colors.success + '20',
      text: theme.colors.success,
      border: theme.colors.success + '40',
    },
    review: {
      bg: theme.colors.warning + '20',
      text: theme.colors.warning,
      border: theme.colors.warning + '40',
    },
    archived: {
      bg: theme.colors.textSubtle + '18',
      text: theme.colors.textSubtle,
      border: theme.colors.textSubtle + '30',
    },
  };
  const c = map[status];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: c.bg,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>
        {humanizeStatus(status)}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.85,
        }}
      >
        {label}
      </Text>
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
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.glassBgHeavy,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.colors.glassBorder,
        padding: 4,
        gap: 2,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isActive ? theme.colors.primary : 'transparent',
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: isActive ? '#fff' : theme.colors.textMuted,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 13, minWidth: 90 }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1 }}>{value}</Text>
    </View>
  );
}

// ── Artist picker modal ────────────────────────────────────────────────────────

function ArtistPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (artist: ArtistItem) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const artistsQuery = useQuery({
    queryKey: ['studio-artists-picker'],
    queryFn: () => listArtists({ limit: 200 }),
  });

  const items = (artistsQuery.data?.items ?? []).filter((a) =>
    search.trim() ? a.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 20,
                fontWeight: '700',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              Select Artist
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
            style={{
              height: 46,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: theme.colors.surfaceBorder,
              backgroundColor: theme.colors.glassBgHeavy,
              color: theme.colors.text,
              paddingHorizontal: 18,
              fontSize: 15,
            }}
          />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}>
          {artistsQuery.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            items.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => { onSelect(a); onClose(); }}
                style={({ pressed }) => ({
                  padding: 16,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: a.id === selected ? theme.colors.primary + '70' : theme.colors.glassBorder,
                  backgroundColor:
                    a.id === selected
                      ? theme.colors.primary + '18'
                      : theme.colors.glassBgHeavy,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 15,
                    fontWeight: '600',
                  }}
                >
                  {a.name}
                </Text>
                <Text style={{ color: theme.colors.textSubtle, fontSize: 12, textTransform: 'capitalize' }}>
                  {a.status}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Genre chips ────────────────────────────────────────────────────────────────

function GenreChips({
  selectedIds,
  onToggle,
}: {
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const { theme } = useTheme();
  const { data: genres = [] } = useQuery({ queryKey: ['genres'], queryFn: listGenres });

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.85,
        }}
      >
        Genres
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {genres.map((g) => {
          const active = selectedIds.includes(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={() => onToggle(g.id)}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: active
                  ? theme.colors.primary + '28'
                  : theme.colors.glassBgHeavy,
                borderWidth: 1,
                borderColor: active ? theme.colors.primary + '70' : theme.colors.surfaceBorder,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: active ? theme.colors.primary : theme.colors.textMuted,
                  fontSize: 13,
                  fontWeight: active ? '700' : '400',
                }}
              >
                {g.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Create form ────────────────────────────────────────────────────────────────

function CreateAlbumForm({ onSuccess }: { onSuccess: () => void }) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [albumType, setAlbumType] = useState<AlbumType>('album');
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [selectedArtistName, setSelectedArtistName] = useState('');
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showArtistPicker, setShowArtistPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createAlbum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-albums'] });
      onSuccess();
      setTitle('');
      setDescription('');
      setReleaseDate('');
      setAlbumType('album');
      setSelectedArtistId('');
      setSelectedArtistName('');
      setSelectedGenreIds([]);
      setCoverUrl(null);
      setShowPreview(false);
    },
    onError: (err) => setError(apiError(err)),
  });

  async function pickCover() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    try {
      setUploadingCover(true);
      const { storageUrl } = await uploadImage({
        uri: asset.uri,
        type: asset.mimeType ?? `image/${ext}`,
        name: asset.fileName ?? `cover.${ext}`,
      });
      setCoverUrl(storageUrl);
    } catch (err) {
      Alert.alert('Upload failed', apiError(err));
    } finally {
      setUploadingCover(false);
    }
  }

  function handlePreview() {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!selectedArtistId) { setError('Select an artist.'); return; }
    setError(null);
    setShowPreview(true);
  }

  if (showPreview) {
    return (
      <GlassSurface style={{ padding: 20, gap: 16 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800', fontFamily: theme.typography.displayFontFamily }}>
          Review & Confirm
        </Text>
        <View style={{ gap: 8 }}>
          <Row label="Title" value={title.trim()} />
          <Row label="Artist" value={selectedArtistName} />
          <Row label="Type" value={albumType} />
          {description.trim() ? <Row label="Description" value={description.trim()} /> : null}
          {releaseDate.trim() ? <Row label="Release date" value={releaseDate.trim()} /> : null}
          <Row label="Genres" value={`${selectedGenreIds.length} selected`} />
          <Row label="Cover" value={coverUrl ? 'Uploaded' : 'None'} />
        </View>
        {error ? <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={() => setShowPreview(false)}
            style={({ pressed }) => ({
              flex: 1, height: 48, borderRadius: 18, borderWidth: 1,
              borderColor: theme.colors.surfaceBorder,
              backgroundColor: theme.colors.glassBgHeavy,
              alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setError(null);
              createMutation.mutate({
                title: title.trim(),
                artistId: selectedArtistId,
                albumType,
                description: description.trim() || undefined,
                releaseDate: releaseDate.trim() || undefined,
                genreIds: selectedGenreIds,
                coverUrl: coverUrl ?? undefined,
              });
            }}
            disabled={createMutation.isPending}
            style={({ pressed }) => ({
              flex: 2, height: 48, borderRadius: 18, backgroundColor: theme.colors.cta,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed || createMutation.isPending ? 0.7 : 1,
            })}
          >
            <Text style={{ color: theme.colors.ctaText, fontWeight: '700' }}>
              {createMutation.isPending ? 'Submitting…' : 'Submit to Staging'}
            </Text>
          </Pressable>
        </View>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface style={{ padding: 18, gap: 16 }}>
      <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700', fontFamily: theme.typography.displayFontFamily }}>
        New Album
      </Text>

      <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Album title" />

      {/* Artist picker */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.85 }}>
          Artist *
        </Text>
        <Pressable
          onPress={() => setShowArtistPicker(true)}
          style={({ pressed }) => ({
            height: 52, borderRadius: 22, borderWidth: 1,
            borderColor: selectedArtistId ? theme.colors.primary + '60' : theme.colors.surfaceBorder,
            backgroundColor: theme.colors.glassBgHeavy,
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <SymbolView
            name={selectedArtistId ? 'person.fill.checkmark' : 'person.2'}
            size={18}
            tintColor={selectedArtistId ? theme.colors.primary : theme.colors.textSubtle}
          />
          <Text style={{ color: selectedArtistId ? theme.colors.primary : theme.colors.textSubtle, fontSize: 14 }}>
            {selectedArtistName || 'Choose artist…'}
          </Text>
        </Pressable>
      </View>

      {/* Album type chips */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.85 }}>
          Type
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {ALBUM_TYPES.map((t) => {
            const active = albumType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setAlbumType(t)}
                style={({ pressed }) => ({
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: active ? theme.colors.primary + '28' : theme.colors.glassBgHeavy,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary + '70' : theme.colors.surfaceBorder,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: active ? theme.colors.primary : theme.colors.textMuted, fontSize: 13, fontWeight: active ? '700' : '400', textTransform: 'capitalize' }}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Field label="Description" value={description} onChangeText={setDescription} multiline />
      <Field label="Release Date (YYYY-MM-DD)" value={releaseDate} onChangeText={setReleaseDate} placeholder="2026-06-01" />

      <GenreChips selectedIds={selectedGenreIds} onToggle={(id) =>
        setSelectedGenreIds((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id])
      } />

      {/* Cover upload */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.85 }}>
          Cover Image
        </Text>
        <Pressable
          onPress={pickCover}
          disabled={uploadingCover}
          style={({ pressed }) => ({
            height: 52, borderRadius: 22, borderWidth: 1,
            borderColor: coverUrl ? theme.colors.primary + '60' : theme.colors.surfaceBorder,
            backgroundColor: theme.colors.glassBgHeavy,
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {uploadingCover
            ? <ActivityIndicator size="small" color={theme.colors.primary} />
            : <SymbolView name={coverUrl ? 'checkmark.circle.fill' : 'photo.badge.plus'} size={18} tintColor={coverUrl ? theme.colors.primary : theme.colors.textSubtle} />}
          <Text style={{ color: coverUrl ? theme.colors.primary : theme.colors.textSubtle, fontSize: 14 }}>
            {uploadingCover ? 'Uploading…' : coverUrl ? 'Cover uploaded ✓' : 'Choose from library'}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text> : null}

      <PrimaryButton label="Preview & Submit" onPress={handlePreview} />

      <ArtistPickerModal
        visible={showArtistPicker}
        selected={selectedArtistId}
        onSelect={(a) => { setSelectedArtistId(a.id); setSelectedArtistName(a.name); }}
        onClose={() => setShowArtistPicker(false)}
      />
    </GlassSurface>
  );
}

// ── Catalog ────────────────────────────────────────────────────────────────────

function AlbumCatalog() {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');
  const [editTarget, setEditTarget] = useState<AlbumItem | null>(null);

  const albumsQuery = useQuery({
    queryKey: ['studio-albums', statusFilter],
    queryFn: () => listAlbums({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 100 }),
  });

  const items = (albumsQuery.data?.items ?? []).filter((a) =>
    search.trim() ? a.title.toLowerCase().includes(search.toLowerCase()) || a.artistName.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search albums or artists…"
        placeholderTextColor={theme.colors.textSubtle}
        style={{ height: 46, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.glassBgHeavy, color: theme.colors.text, paddingHorizontal: 18, fontSize: 15 }}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all', 'review', 'published', 'archived'] as const).map((s) => {
          const active = statusFilter === s;
          return (
            <Pressable key={s} onPress={() => setStatusFilter(s)}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: active ? theme.colors.primary + '28' : theme.colors.glassBgHeavy,
                borderWidth: 1, borderColor: active ? theme.colors.primary + '70' : theme.colors.surfaceBorder,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: active ? theme.colors.primary : theme.colors.textMuted, fontSize: 13, fontWeight: active ? '700' : '400', textTransform: 'capitalize' }}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {albumsQuery.isLoading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : items.length === 0 ? (
        <GlassSurface style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No albums found.</Text>
        </GlassSurface>
      ) : (
        items.map((album) => (
          <GlassSurface key={album.id} style={{ padding: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', fontFamily: theme.typography.displayFontFamily }}>
                  {album.title}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                  {album.artistName} · <Text style={{ textTransform: 'capitalize' }}>{album.albumType}</Text>
                </Text>
                <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>
                  {album.trackCount} track{album.trackCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <StatusBadge status={album.status} />
            </View>
            {album.status !== 'published' && (
              <Pressable
                onPress={() => setEditTarget(album)}
                style={({ pressed }) => ({
                  alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6,
                  borderRadius: 16, borderWidth: 1, borderColor: theme.colors.surfaceBorder,
                  backgroundColor: theme.colors.glassBgHeavy, opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>Edit</Text>
              </Pressable>
            )}
          </GlassSurface>
        ))
      )}

      {editTarget ? <EditAlbumModal album={editTarget} onClose={() => setEditTarget(null)} /> : null}
    </View>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditAlbumModal({ album, onClose }: { album: AlbumItem; onClose: () => void }) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(album.description ?? '');
  const [releaseDate, setReleaseDate] = useState(album.releaseDate ?? '');
  const [albumType, setAlbumType] = useState<AlbumType>(album.albumType);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateAlbum>[1]) => updateAlbum(album.id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['studio-albums'] }); onClose(); },
    onError: (err) => setError(apiError(err)),
  });

  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20, zIndex: 100 }}>
      <GlassSurface style={{ padding: 20, gap: 14 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800', fontFamily: theme.typography.displayFontFamily }}>
          Edit {album.title}
        </Text>
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.85 }}>Type</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {ALBUM_TYPES.map((t) => {
              const active = albumType === t;
              return (
                <Pressable key={t} onPress={() => setAlbumType(t)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18,
                    backgroundColor: active ? theme.colors.primary + '28' : theme.colors.glassBgHeavy,
                    borderWidth: 1, borderColor: active ? theme.colors.primary + '70' : theme.colors.surfaceBorder,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: active ? theme.colors.primary : theme.colors.textMuted, fontSize: 13, textTransform: 'capitalize' }}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Field label="Description" value={description} onChangeText={setDescription} multiline />
        <Field label="Release Date (YYYY-MM-DD)" value={releaseDate} onChangeText={setReleaseDate} />
        {error ? <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.glassBgHeavy, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => updateMutation.mutate({ description: description.trim() || undefined, releaseDate: releaseDate.trim() || undefined, albumType })}
            disabled={updateMutation.isPending}
            style={({ pressed }) => ({ flex: 2, height: 48, borderRadius: 18, backgroundColor: theme.colors.cta, alignItems: 'center', justifyContent: 'center', opacity: pressed || updateMutation.isPending ? 0.7 : 1 })}
          >
            <Text style={{ color: theme.colors.ctaText, fontWeight: '700' }}>{updateMutation.isPending ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function AlbumsScreen() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<ScreenTab>('create');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  return (
    <ScreenView bottomInset={120}>
      <StudioHeader subtitle="Albums" />

      <TabPill
        tabs={[{ key: 'create', label: 'Create' }, { key: 'catalog', label: 'Catalog' }]}
        active={activeTab}
        onSelect={(k) => setActiveTab(k as ScreenTab)}
      />

      {successMsg ? (
        <GlassSurface style={{ padding: 14 }}>
          <Text style={{ color: theme.colors.success, fontWeight: '600', fontSize: 14 }}>
            {successMsg}
          </Text>
        </GlassSurface>
      ) : null}

      {activeTab === 'create' ? (
        <CreateAlbumForm
          onSuccess={() => {
            setSuccessMsg('Album submitted to staging.');
            setActiveTab('catalog');
            setTimeout(() => setSuccessMsg(null), 4000);
          }}
        />
      ) : (
        <AlbumCatalog />
      )}
    </ScreenView>
  );
}
