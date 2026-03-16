/**
 * Artists screen — create new artists and browse the existing artist catalog.
 *
 * Two tabs: Create (form + image upload) and Catalog (filterable list).
 *
 * Creation flow mirrors the web panel:
 *   fill form → "Preview & Submit" card → confirm → POST /v1/internal/artists
 *   → status='review'; reviewers promote via the Staging tab.
 *
 * Image upload uses expo-image-picker to let the user pick from their photo library.
 * The file is uploaded to /v1/internal/images/upload which returns a storage URL,
 * then that URL is passed to createArtist / updateArtist.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  createArtist,
  listArtists,
  listGenres,
  updateArtist,
  uploadImage,
} from '@/src/services/studio';
import type { ArtistItem, ContentStatus } from '@/src/types/studio';
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

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

type ScreenTab = 'create' | 'catalog';

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContentStatus }) {
  const { theme } = useTheme();
  const colors: Record<ContentStatus, { bg: string; text: string; border: string }> = {
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
  const c = colors[status];
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

// ── Image upload button ────────────────────────────────────────────────────────

function ImageUploadButton({
  label,
  storageUrl,
  uploading,
  onPick,
}: {
  label: string;
  storageUrl: string | null;
  uploading: boolean;
  onPick: () => void;
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
      <Pressable
        onPress={onPick}
        disabled={uploading}
        style={({ pressed }) => ({
          minHeight: 52,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: storageUrl
            ? theme.colors.primary + '60'
            : theme.colors.surfaceBorder,
          backgroundColor: theme.colors.glassBgHeavy,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 18,
          gap: 10,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <SymbolView
            name={storageUrl ? 'checkmark.circle.fill' : 'photo.badge.plus'}
            size={18}
            tintColor={storageUrl ? theme.colors.primary : theme.colors.textSubtle}
          />
        )}
        <Text
          style={{
            color: storageUrl ? theme.colors.primary : theme.colors.textSubtle,
            fontSize: 14,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {uploading
            ? 'Uploading…'
            : storageUrl
              ? 'Image uploaded ✓'
              : 'Choose from library'}
        </Text>
      </Pressable>
    </View>
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

// ── Field helper ───────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  monospace,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  monospace?: boolean;
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
          minHeight: multiline ? 90 : 52,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: theme.colors.surfaceBorder,
          backgroundColor: theme.colors.glassBgHeavy,
          color: theme.colors.text,
          paddingHorizontal: 18,
          paddingTop: multiline ? 14 : 0,
          fontSize: 15,
          fontFamily: monospace ? 'Courier' : theme.typography.bodyFontFamily,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

// ── Create form ────────────────────────────────────────────────────────────────

function CreateArtistForm({ onSuccess }: { onSuccess: () => void }) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [personaPrompt, setPersonaPrompt] = useState('');
  const [styleTagsRaw, setStyleTagsRaw] = useState('');
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-artists'] });
      onSuccess();
      // Reset form
      setName('');
      setBio('');
      setPersonaPrompt('');
      setStyleTagsRaw('');
      setSelectedGenreIds([]);
      setImageUrl(null);
      setHeaderImageUrl(null);
      setShowPreview(false);
    },
    onError: (err) => setError(apiError(err)),
  });

  async function pickImage(isHeader: boolean) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const file = {
      uri: asset.uri,
      type: asset.mimeType ?? `image/${ext}`,
      name: asset.fileName ?? `upload.${ext}`,
    };

    try {
      if (isHeader) {
        setUploadingHeader(true);
        const { storageUrl } = await uploadImage(file);
        setHeaderImageUrl(storageUrl);
      } else {
        setUploadingImage(true);
        const { storageUrl } = await uploadImage(file);
        setImageUrl(storageUrl);
      }
    } catch (err) {
      Alert.alert('Upload failed', apiError(err));
    } finally {
      setUploadingImage(false);
      setUploadingHeader(false);
    }
  }

  function toggleGenre(id: string) {
    setSelectedGenreIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  function handlePreview() {
    if (!name.trim()) {
      setError('Artist name is required.');
      return;
    }
    setError(null);
    setShowPreview(true);
  }

  if (showPreview) {
    return (
      <GlassSurface style={{ padding: 20, gap: 16 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 18,
            fontWeight: '800',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          Review & Confirm
        </Text>
        <View style={{ gap: 8 }}>
          <Row label="Name" value={name.trim()} />
          {bio.trim() ? <Row label="Bio" value={bio.trim()} /> : null}
          {personaPrompt.trim() ? (
            <Row label="Persona prompt" value={personaPrompt.trim()} />
          ) : null}
          {styleTagsRaw.trim() ? (
            <Row label="Style tags" value={styleTagsRaw.trim()} />
          ) : null}
          <Row label="Genres" value={String(selectedGenreIds.length) + ' selected'} />
          <Row label="Artwork" value={imageUrl ? 'Uploaded' : 'None'} />
        </View>

        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={() => setShowPreview(false)}
            style={({ pressed }) => ({
              flex: 1,
              height: 48,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.colors.surfaceBorder,
              backgroundColor: theme.colors.glassBgHeavy,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setError(null);
              createMutation.mutate({
                name: name.trim(),
                bio: bio.trim() || undefined,
                personaPrompt: personaPrompt.trim() || undefined,
                styleTags: parseTags(styleTagsRaw),
                genreIds: selectedGenreIds,
                imageUrl: imageUrl ?? undefined,
                headerImageUrl: headerImageUrl ?? undefined,
              });
            }}
            disabled={createMutation.isPending}
            style={({ pressed }) => ({
              flex: 2,
              height: 48,
              borderRadius: 18,
              backgroundColor: theme.colors.cta,
              alignItems: 'center',
              justifyContent: 'center',
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
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 18,
          fontWeight: '700',
          fontFamily: theme.typography.displayFontFamily,
        }}
      >
        New Artist
      </Text>

      <Field
        label="Name *"
        value={name}
        onChangeText={setName}
        placeholder="Artist display name"
      />
      <Field
        label="Bio"
        value={bio}
        onChangeText={setBio}
        placeholder="Short artist biography"
        multiline
      />
      <Field
        label="Persona Prompt"
        value={personaPrompt}
        onChangeText={setPersonaPrompt}
        placeholder="Describe the artist's musical persona for AI generation"
        multiline
      />
      <Field
        label="Style Tags (comma-separated)"
        value={styleTagsRaw}
        onChangeText={setStyleTagsRaw}
        placeholder="e.g. ambient, lo-fi, cinematic"
      />

      <GenreChips selectedIds={selectedGenreIds} onToggle={toggleGenre} />

      <ImageUploadButton
        label="Profile Image"
        storageUrl={imageUrl}
        uploading={uploadingImage}
        onPick={() => pickImage(false)}
      />
      <ImageUploadButton
        label="Header Image"
        storageUrl={headerImageUrl}
        uploading={uploadingHeader}
        onPick={() => pickImage(true)}
      />

      {error ? (
        <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text>
      ) : null}

      <PrimaryButton label="Preview & Submit" onPress={handlePreview} />
    </GlassSurface>
  );
}

// ── Row helper for preview card ────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 13, minWidth: 100 }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1 }} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

// ── Catalog ────────────────────────────────────────────────────────────────────

function ArtistCatalog() {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');
  const [editTarget, setEditTarget] = useState<ArtistItem | null>(null);

  const artistsQuery = useQuery({
    queryKey: ['studio-artists', statusFilter],
    queryFn: () =>
      listArtists({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100,
      }),
  });

  const items = (artistsQuery.data?.items ?? []).filter((a) =>
    search.trim() ? a.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <View style={{ gap: 12 }}>
      {/* Search */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search artists…"
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

      {/* Status filter chips */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all', 'review', 'published', 'archived'] as const).map((s) => {
          const active = statusFilter === s;
          return (
            <Pressable
              key={s}
              onPress={() => setStatusFilter(s)}
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
                  textTransform: 'capitalize',
                }}
              >
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {artistsQuery.isLoading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : items.length === 0 ? (
        <GlassSurface style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No artists found.</Text>
        </GlassSurface>
      ) : (
        items.map((artist) => (
          <GlassSurface key={artist.id} style={{ padding: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 16,
                    fontWeight: '700',
                    fontFamily: theme.typography.displayFontFamily,
                  }}
                >
                  {artist.name}
                </Text>
                <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>{artist.slug}</Text>
              </View>
              <StatusBadge status={artist.status} />
            </View>
            {artist.bio ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: 13 }} numberOfLines={2}>
                {artist.bio}
              </Text>
            ) : null}
            {artist.status !== 'published' && (
              <Pressable
                onPress={() => setEditTarget(artist)}
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.colors.surfaceBorder,
                  backgroundColor: theme.colors.glassBgHeavy,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                  Edit
                </Text>
              </Pressable>
            )}
          </GlassSurface>
        ))
      )}

      {editTarget ? (
        <EditArtistModal artist={editTarget} onClose={() => setEditTarget(null)} />
      ) : null}
    </View>
  );
}

// ── Edit modal (inline, shown over content) ────────────────────────────────────

function EditArtistModal({
  artist,
  onClose,
}: {
  artist: ArtistItem;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [bio, setBio] = useState(artist.bio ?? '');
  const [personaPrompt, setPersonaPrompt] = useState(artist.personaPrompt ?? '');
  const [styleTagsRaw, setStyleTagsRaw] = useState(artist.styleTags.join(', '));
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateArtist>[1]) =>
      updateArtist(artist.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-artists'] });
      onClose();
    },
    onError: (err) => setError(apiError(err)),
  });

  return (
    <View
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <GlassSurface style={{ padding: 20, gap: 16 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 18,
            fontWeight: '800',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          Edit {artist.name}
        </Text>
        <Field label="Bio" value={bio} onChangeText={setBio} multiline />
        <Field
          label="Persona Prompt"
          value={personaPrompt}
          onChangeText={setPersonaPrompt}
          multiline
        />
        <Field
          label="Style Tags"
          value={styleTagsRaw}
          onChangeText={setStyleTagsRaw}
          placeholder="ambient, lo-fi, cinematic"
        />
        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              flex: 1,
              height: 48,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.colors.surfaceBorder,
              backgroundColor: theme.colors.glassBgHeavy,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              updateMutation.mutate({
                bio: bio.trim() || undefined,
                personaPrompt: personaPrompt.trim() || undefined,
                styleTags: parseTags(styleTagsRaw),
              })
            }
            disabled={updateMutation.isPending}
            style={({ pressed }) => ({
              flex: 2,
              height: 48,
              borderRadius: 18,
              backgroundColor: theme.colors.cta,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed || updateMutation.isPending ? 0.7 : 1,
            })}
          >
            <Text style={{ color: theme.colors.ctaText, fontWeight: '700' }}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  );
}

// ── Tab pill selector ──────────────────────────────────────────────────────────

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

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ArtistsScreen() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<ScreenTab>('create');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  return (
    <ScreenView bottomInset={120}>
      <StudioHeader subtitle="Artists" />

      <TabPill
        tabs={[
          { key: 'create', label: 'Create' },
          { key: 'catalog', label: 'Catalog' },
        ]}
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
        <CreateArtistForm
          onSuccess={() => {
            setSuccessMsg('Artist submitted to staging.');
            setActiveTab('catalog');
            setTimeout(() => setSuccessMsg(null), 4000);
          }}
        />
      ) : (
        <ArtistCatalog />
      )}
    </ScreenView>
  );
}
