/**
 * Staging screen — review queue for artists, albums, and tracks.
 *
 * Content editors see their own submissions. Reviewers (content_reviewer, admin)
 * additionally have Approve, Reject, and Revision actions. Reject archives the
 * entity; Revision sends it back to the creator with a note.
 *
 * All three entity types (Artists, Albums, Tracks) appear in sections within one
 * scrollable screen, mirroring the web StagingPanel layout.
 *
 * Track audio preview uses expo-audio to stream directly from the storage URL
 * via the authenticated API proxy endpoint (/v1/internal/music/file).
 *
 * The queue auto-refreshes every 30 s.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { AxiosError } from 'axios';
import { GlassSurface } from '@/src/components/GlassSurface';
import { ScreenView } from '@/src/components/ScreenView';
import { StudioHeader } from '@/src/components/StudioHeader';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';
import {
  approveStagingArtist,
  rejectStagingArtist,
  sendArtistForReview,
  approveStagingAlbum,
  rejectStagingAlbum,
  sendAlbumForReview,
  approveTrack,
  rejectTrack,
  sendTrackForReview,
  listStaging,
} from '@/src/services/studio';
import type {
  EntityType,
  StagingAlbum,
  StagingArtist,
  StagingReviewAction,
  StagingTrack,
} from '@/src/types/studio';
import { canReview, formatStagingDate, formatDurationMs, humanizeRole } from '@/src/types/studio';

// ── Helpers ────────────────────────────────────────────────────────────────────

function apiError(error: unknown): string {
  const e = error as AxiosError<{ detail?: string }>;
  return e.response?.data?.detail ?? 'Action failed. Please try again.';
}

function reviewActionLabel(action: StagingReviewAction): string {
  if (action === 'approved') return 'Approved';
  if (action === 'rejected') return 'Rejected';
  return 'Revision requested';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ReviewBadge({ action }: { action: StagingReviewAction }) {
  const { theme } = useTheme();
  const colors: Record<StagingReviewAction, string> = {
    approved: theme.colors.success,
    rejected: theme.colors.danger,
    sent_for_review: theme.colors.warning,
  };
  const color = colors[action];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: color + '20', borderWidth: 1, borderColor: color + '44' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{reviewActionLabel(action)}</Text>
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700', fontFamily: theme.typography.displayFontFamily, flex: 1 }}>
        {title}
      </Text>
      <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: theme.colors.primary + '20' }}>
        <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '700' }}>{count}</Text>
      </View>
    </View>
  );
}

// ── Notes modal (shared for reject and revision) ───────────────────────────────

interface NotesModalState {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  intent: 'reject' | 'revision';
}

function NotesModal({
  state,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  state: NotesModalState;
  onClose: () => void;
  onSubmit: (notes: string) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const { theme } = useTheme();
  const [notes, setNotes] = useState('');

  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 20, zIndex: 100 }}>
      <GlassSurface style={{ padding: 20, gap: 14 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800', fontFamily: theme.typography.displayFontFamily }}>
          {state.intent === 'reject' ? 'Reject' : 'Request Revision'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 }}>
          {state.intent === 'reject'
            ? `Rejecting "${state.entityName}" will move it to the archive.`
            : `"${state.entityName}" will be returned to the creator for changes.`}
          {' '}Add a note explaining what needs to be addressed.
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={
            state.intent === 'reject'
              ? 'The quality does not meet our standards because…'
              : 'Please revisit the intro — it feels too abrupt…'
          }
          placeholderTextColor={theme.colors.textSubtle}
          multiline
          autoFocus
          style={{
            minHeight: 100,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.colors.surfaceBorder,
            backgroundColor: theme.colors.glassBgHeavy,
            color: theme.colors.text,
            paddingHorizontal: 16,
            paddingTop: 12,
            fontSize: 15,
            textAlignVertical: 'top',
          }}
        />
        {error ? <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={onClose}
            disabled={isLoading}
            style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.glassBgHeavy, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => { if (notes.trim()) onSubmit(notes.trim()); }}
            disabled={isLoading || !notes.trim()}
            style={({ pressed }) => ({
              flex: 2, height: 48, borderRadius: 18,
              backgroundColor: state.intent === 'reject' ? theme.colors.danger : theme.colors.warning,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed || isLoading || !notes.trim() ? 0.6 : 1,
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {isLoading ? 'Saving…' : state.intent === 'reject' ? 'Reject' : 'Request Revision'}
            </Text>
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  );
}

// ── Action buttons (approve / reject / revision) ───────────────────────────────

function ActionButtons({
  isReviewer,
  isLoading,
  hasAudio,
  onApprove,
  onReject,
  onRevision,
  onPreview,
}: {
  isReviewer: boolean;
  isLoading: boolean;
  hasAudio: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRevision: () => void;
  onPreview?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {hasAudio && onPreview ? (
        <Pressable
          onPress={onPreview}
          disabled={isLoading}
          style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.primary + '60', backgroundColor: theme.colors.primary + '18', opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>Preview</Text>
        </Pressable>
      ) : null}

      {isReviewer ? (
        <>
          <Pressable
            onPress={onApprove}
            disabled={isLoading}
            style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.success + '60', backgroundColor: theme.colors.success + '18', opacity: pressed || isLoading ? 0.6 : 1 })}
          >
            <Text style={{ color: theme.colors.success, fontSize: 13, fontWeight: '600' }}>Approve</Text>
          </Pressable>
          <Pressable
            onPress={onReject}
            disabled={isLoading}
            style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.danger + '60', backgroundColor: theme.colors.danger + '18', opacity: pressed || isLoading ? 0.6 : 1 })}
          >
            <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '600' }}>Reject</Text>
          </Pressable>
          <Pressable
            onPress={onRevision}
            disabled={isLoading}
            style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.warning + '60', backgroundColor: theme.colors.warning + '18', opacity: pressed || isLoading ? 0.6 : 1 })}
          >
            <Text style={{ color: theme.colors.warning, fontSize: 13, fontWeight: '600' }}>Revision</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function StagingScreen() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isReviewer = canReview(user?.role);

  const [notesModal, setNotesModal] = useState<NotesModalState | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  const stagingQuery = useQuery({
    queryKey: ['staging'],
    queryFn: listStaging,
    refetchInterval: 30_000,
  });

  const artists: StagingArtist[] = stagingQuery.data?.artists ?? [];
  const albums: StagingAlbum[] = stagingQuery.data?.albums ?? [];
  const tracks: StagingTrack[] = stagingQuery.data?.tracks ?? [];
  const totalAll = (stagingQuery.data?.totalArtists ?? 0) + (stagingQuery.data?.totalAlbums ?? 0) + (stagingQuery.data?.totalTracks ?? 0);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const bustStaging = () => queryClient.invalidateQueries({ queryKey: ['staging'] });
  const bustAll = () => {
    bustStaging();
    queryClient.invalidateQueries({ queryKey: ['studio-artists'] });
    queryClient.invalidateQueries({ queryKey: ['studio-albums'] });
    queryClient.invalidateQueries({ queryKey: ['studio-tracks'] });
  };

  const approveArtistMut = useMutation({ mutationFn: approveStagingArtist, onSuccess: bustAll });
  const approveAlbumMut  = useMutation({ mutationFn: approveStagingAlbum,  onSuccess: bustAll });
  const approveTrackMut  = useMutation({ mutationFn: approveTrack,          onSuccess: bustAll });

  const rejectArtistMut   = useMutation({ mutationFn: ({ id, notes }: { id: string; notes: string }) => rejectStagingArtist(id, notes),   onSuccess: () => { bustStaging(); closeModal(); }, onError: (err) => setNotesError(apiError(err)) });
  const rejectAlbumMut    = useMutation({ mutationFn: ({ id, notes }: { id: string; notes: string }) => rejectStagingAlbum(id, notes),    onSuccess: () => { bustStaging(); closeModal(); }, onError: (err) => setNotesError(apiError(err)) });
  const rejectTrackMut    = useMutation({ mutationFn: ({ id, notes }: { id: string; notes: string }) => rejectTrack(id, notes),           onSuccess: () => { bustStaging(); closeModal(); }, onError: (err) => setNotesError(apiError(err)) });

  const revisionArtistMut = useMutation({ mutationFn: ({ id, notes }: { id: string; notes: string }) => sendArtistForReview(id, notes),   onSuccess: () => { bustStaging(); closeModal(); }, onError: (err) => setNotesError(apiError(err)) });
  const revisionAlbumMut  = useMutation({ mutationFn: ({ id, notes }: { id: string; notes: string }) => sendAlbumForReview(id, notes),    onSuccess: () => { bustStaging(); closeModal(); }, onError: (err) => setNotesError(apiError(err)) });
  const revisionTrackMut  = useMutation({ mutationFn: ({ id, notes }: { id: string; notes: string }) => sendTrackForReview(id, notes),    onSuccess: () => { bustStaging(); closeModal(); }, onError: (err) => setNotesError(apiError(err)) });

  const isModalPending =
    rejectArtistMut.isPending || rejectAlbumMut.isPending || rejectTrackMut.isPending ||
    revisionArtistMut.isPending || revisionAlbumMut.isPending || revisionTrackMut.isPending;

  function openModal(state: NotesModalState) {
    setNotesModal(state);
    setNotesError(null);
  }

  function closeModal() {
    setNotesModal(null);
    setNotesError(null);
  }

  function submitNotes(notes: string) {
    if (!notesModal) return;
    const { entityType, entityId, intent } = notesModal;
    const args = { id: entityId, notes };
    if (entityType === 'artist') {
      if (intent === 'reject') rejectArtistMut.mutate(args);
      else revisionArtistMut.mutate(args);
    } else if (entityType === 'album') {
      if (intent === 'reject') rejectAlbumMut.mutate(args);
      else revisionAlbumMut.mutate(args);
    } else {
      if (intent === 'reject') rejectTrackMut.mutate(args);
      else revisionTrackMut.mutate(args);
    }
  }

  // ── Audio preview ────────────────────────────────────────────────────────────

  async function playPreview(track: StagingTrack) {
    if (!track.outputStorageUrl) return;

    if (playerRef.current) {
      playerRef.current.remove();
      playerRef.current = null;
      if (previewTrackId === track.id) {
        setPreviewTrackId(null);
        return;
      }
    }

    try {
      const { API_BASE_URL } = await import('@/src/lib/env');
      const proxyUrl = `${API_BASE_URL}/v1/internal/music/file?storageUrl=${encodeURIComponent(track.outputStorageUrl)}`;
      const player = createAudioPlayer({ uri: proxyUrl, headers: { Authorization: `Bearer ${accessToken ?? ''}` } });
      playerRef.current = player;
      player.play();
      setPreviewTrackId(track.id);
    } catch {
      Alert.alert('Preview failed', 'Could not load the audio file.');
    }
  }

  useEffect(() => {
    return () => { playerRef.current?.remove(); };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScreenView bottomInset={120}>
      <StudioHeader subtitle="Staging" />

      {/* Context card */}
      <GlassSurface style={{ padding: 16, gap: 6 }}>
        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
          {isReviewer
            ? 'You can approve, reject, or request revisions on any item.'
            : 'Your submissions appear here. A reviewer will action them.'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          Approved content goes live in the Music Player. Rejected items move to the archive.
        </Text>
      </GlassSurface>

      {stagingQuery.isLoading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : totalAll === 0 ? (
        <GlassSurface style={{ padding: 24, alignItems: 'center' }}>
          <SymbolView name="tray" size={32} tintColor={theme.colors.textSubtle} />
          <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginTop: 8 }}>
            Staging queue is empty.
          </Text>
        </GlassSurface>
      ) : null}

      {/* Artists */}
      {artists.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Artists" count={stagingQuery.data?.totalArtists ?? 0} />
          {artists.map((artist) => (
            <GlassSurface key={artist.id} style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>{artist.name}</Text>
                  <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>{artist.slug}</Text>
                  {artist.bio ? <Text style={{ color: theme.colors.textMuted, fontSize: 13 }} numberOfLines={2}>{artist.bio}</Text> : null}
                  <Text style={{ color: theme.colors.textSubtle, fontSize: 12, marginTop: 2 }}>
                    by {artist.createdByName} · <Text style={{ textTransform: 'capitalize' }}>{humanizeRole(artist.createdByRole)}</Text>
                  </Text>
                </View>
              </View>
              {artist.latestReview ? (
                <View style={{ gap: 4 }}>
                  <ReviewBadge action={artist.latestReview.action} />
                  {artist.latestReview.notes ? (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={3}>
                      {artist.latestReview.notes}
                    </Text>
                  ) : null}
                  <Text style={{ color: theme.colors.textSubtle, fontSize: 11 }}>
                    {formatStagingDate(artist.latestReview.createdAt)}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>Awaiting review</Text>
              )}
              <ActionButtons
                isReviewer={isReviewer}
                isLoading={approveArtistMut.isPending}
                hasAudio={false}
                onApprove={() => approveArtistMut.mutate(artist.id)}
                onReject={() => openModal({ entityType: 'artist', entityId: artist.id, entityName: artist.name, intent: 'reject' })}
                onRevision={() => openModal({ entityType: 'artist', entityId: artist.id, entityName: artist.name, intent: 'revision' })}
              />
            </GlassSurface>
          ))}
        </View>
      ) : null}

      {/* Albums */}
      {albums.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Albums" count={stagingQuery.data?.totalAlbums ?? 0} />
          {albums.map((album) => (
            <GlassSurface key={album.id} style={{ padding: 16, gap: 10 }}>
              <View style={{ gap: 3 }}>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>{album.title}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                  {album.artistName} · <Text style={{ textTransform: 'capitalize' }}>{album.albumType}</Text>
                </Text>
                <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>
                  {album.trackCount} track{album.trackCount !== 1 ? 's' : ''} · by {album.createdByName}
                </Text>
              </View>
              {album.latestReview ? (
                <View style={{ gap: 4 }}>
                  <ReviewBadge action={album.latestReview.action} />
                  {album.latestReview.notes ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={3}>{album.latestReview.notes}</Text> : null}
                  <Text style={{ color: theme.colors.textSubtle, fontSize: 11 }}>{formatStagingDate(album.latestReview.createdAt)}</Text>
                </View>
              ) : (
                <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>Awaiting review</Text>
              )}
              <ActionButtons
                isReviewer={isReviewer}
                isLoading={approveAlbumMut.isPending}
                hasAudio={false}
                onApprove={() => approveAlbumMut.mutate(album.id)}
                onReject={() => openModal({ entityType: 'album', entityId: album.id, entityName: album.title, intent: 'reject' })}
                onRevision={() => openModal({ entityType: 'album', entityId: album.id, entityName: album.title, intent: 'revision' })}
              />
            </GlassSurface>
          ))}
        </View>
      ) : null}

      {/* Tracks */}
      {tracks.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Tracks" count={stagingQuery.data?.totalTracks ?? 0} />
          {tracks.map((track) => (
            <GlassSurface key={track.id} style={{ padding: 16, gap: 10 }}>
              <View style={{ gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{track.title}</Text>
                  {track.explicit ? (
                    <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: theme.colors.danger + '28' }}>
                      <Text style={{ color: theme.colors.danger, fontSize: 10, fontWeight: '700' }}>E</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                  {track.primaryArtistName ?? '—'} · {track.albumTitle}
                </Text>
                <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>
                  {formatDurationMs(track.durationMs)} · by {track.createdByName}
                </Text>
              </View>
              {track.latestReview ? (
                <View style={{ gap: 4 }}>
                  <ReviewBadge action={track.latestReview.action} />
                  {track.latestReview.notes ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={3}>{track.latestReview.notes}</Text> : null}
                  <Text style={{ color: theme.colors.textSubtle, fontSize: 11 }}>{formatStagingDate(track.latestReview.createdAt)}</Text>
                </View>
              ) : (
                <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>Awaiting review</Text>
              )}
              <ActionButtons
                isReviewer={isReviewer}
                isLoading={approveTrackMut.isPending}
                hasAudio={!!track.outputStorageUrl}
                onApprove={() => approveTrackMut.mutate(track.id)}
                onReject={() => openModal({ entityType: 'track', entityId: track.id, entityName: track.title, intent: 'reject' })}
                onRevision={() => openModal({ entityType: 'track', entityId: track.id, entityName: track.title, intent: 'revision' })}
                onPreview={() => playPreview(track)}
              />
              {previewTrackId === track.id ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.glassBorder }}>
                  <SymbolView name="waveform" size={16} tintColor={theme.colors.primary} />
                  <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
                    Previewing…
                  </Text>
                  <Pressable onPress={() => { playerRef.current?.remove(); playerRef.current = null; setPreviewTrackId(null); }}>
                    <SymbolView name="stop.circle.fill" size={20} tintColor={theme.colors.danger} />
                  </Pressable>
                </View>
              ) : null}
            </GlassSurface>
          ))}
        </View>
      ) : null}

      {/* Notes modal */}
      {notesModal ? (
        <NotesModal
          state={notesModal}
          onClose={closeModal}
          onSubmit={submitNotes}
          isLoading={isModalPending}
          error={notesError}
        />
      ) : null}
    </ScreenView>
  );
}
