import type { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ModalSheet } from '@/src/components/ModalSheet';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { TextField } from '@/src/components/TextField';
import { useEditableUserPlaylists } from '@/src/hooks/useCatalog';
import { useTheme } from '@/src/providers/ThemeProvider';
import { addTracksToPlaylist, createPlaylist } from '@/src/services/catalog';

interface PlaylistSheetProps {
  open: boolean;
  onClose: () => void;
  trackIds?: string[];
  heading?: string;
}

function asErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: unknown }>;
  const detail = axiosError?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback;
}

export function PlaylistSheet({
  open,
  onClose,
  trackIds = [],
  heading = 'Playlist actions',
}: PlaylistSheetProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const editablePlaylists = useEditableUserPlaylists();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const hasSeedTracks = trackIds.length > 0;

  const sortedPlaylists = useMemo(
    () => editablePlaylists.data?.items ?? [],
    [editablePlaylists.data?.items],
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createPlaylist({
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
        trackIds: hasSeedTracks ? trackIds : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist'] });
      queryClient.invalidateQueries({ queryKey: ['user-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['editable-user-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['library-playlists'] });
      setName('');
      setDescription('');
      setIsPublic(true);
      onClose();
    },
  });

  const addMutation = useMutation({
    mutationFn: (playlistId: string) => addTracksToPlaylist(playlistId, trackIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist'] });
      queryClient.invalidateQueries({ queryKey: ['user-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['editable-user-playlists'] });
      onClose();
    },
  });

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={heading}
      subtitle={
        hasSeedTracks
          ? 'Add this track to an existing playlist or create a new public/private mix.'
          : 'Create a playlist for your saved listening flow.'
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
        {hasSeedTracks ? (
          <View style={{ gap: 10 }}>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              Add to existing playlist
            </Text>

            {sortedPlaylists.length > 0 ? (
              sortedPlaylists.map((playlist) => (
                <Pressable
                  key={playlist.id}
                  onPress={() => addMutation.mutate(playlist.id)}
                  disabled={addMutation.isPending}
                  style={{
                    borderRadius: 22,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: theme.colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor: theme.colors.surfaceBorder,
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: 15,
                      fontWeight: '700',
                      fontFamily: theme.typography.displayFontFamily,
                    }}
                  >
                    {playlist.name}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: 13,
                      fontFamily: theme.typography.bodyFontFamily,
                    }}
                  >
                    {(playlist.trackCount ?? playlist.tracks.length)} songs · {playlist.isPublic ? 'Public' : 'Private'}
                  </Text>
                </Pressable>
              ))
            ) : (
              <View
                style={{
                  borderRadius: 22,
                  padding: 16,
                  backgroundColor: theme.colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: theme.colors.surfaceBorder,
                }}
              >
                <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                  No editable playlists yet.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 15,
              fontWeight: '700',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            Create a playlist
          </Text>

          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Late night favorites"
            autoCapitalize="words"
          />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="A private mix for softer synthetic pop."
            autoCapitalize="sentences"
          />

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
              Visibility
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([
                { label: 'Public', value: true },
                { label: 'Private', value: false },
              ] as const).map((option) => (
                <Pressable
                  key={option.label}
                  onPress={() => setIsPublic(option.value)}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      isPublic === option.value ? theme.colors.primaryDim : theme.colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor:
                      isPublic === option.value ? theme.colors.primary : theme.colors.surfaceBorder,
                  }}
                >
                  <Text
                    style={{
                      color: isPublic === option.value ? theme.colors.primary : theme.colors.textMuted,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {(createMutation.isError || addMutation.isError) ? (
          <Text style={{ color: theme.colors.danger, fontSize: 14 }}>
            {asErrorMessage(createMutation.error ?? addMutation.error, 'Could not update the playlist.')}
          </Text>
        ) : null}

        <View style={{ gap: 10 }}>
          <PrimaryButton
            label={createMutation.isPending ? 'Creating Playlist...' : 'Create Playlist'}
            onPress={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
          />
          <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
        </View>
      </ScrollView>
    </ModalSheet>
  );
}
