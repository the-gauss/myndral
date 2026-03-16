import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { ModalSheet } from '@/src/components/ModalSheet';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useTheme } from '@/src/providers/ThemeProvider';
import type { Track } from '@/src/types/domain';

interface TrackActionSheetProps {
  open: boolean;
  track: Track;
  isFavorite: boolean;
  isInLibrary: boolean;
  onClose: () => void;
  onPlayNow: () => void;
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: () => void;
  onToggleFavorite: () => void;
  onToggleLibrary: () => void;
}

function ActionRow({
  label,
  symbol,
  onPress,
}: {
  label: string;
  symbol: SymbolViewProps['name'];
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: theme.colors.surfaceRaised,
        borderWidth: 1,
        borderColor: theme.colors.surfaceBorder,
      }}
    >
      <SymbolView name={symbol} tintColor={theme.colors.textMuted} size={18} />
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 15,
          fontWeight: '600',
          fontFamily: theme.typography.bodyFontFamily,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TrackActionSheet({
  open,
  track,
  isFavorite,
  isInLibrary,
  onClose,
  onPlayNow,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onToggleFavorite,
  onToggleLibrary,
}: TrackActionSheetProps) {
  const router = useRouter();

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={track.title}
      subtitle={`${track.artist.name} · ${track.album.title}`}
    >
      <View style={{ gap: 10 }}>
        <ActionRow label="Play now" symbol="play.fill" onPress={onPlayNow} />
        <ActionRow label="Play next" symbol="forward.end.fill" onPress={onPlayNext} />
        <ActionRow label="Add to queue" symbol="text.badge.plus" onPress={onAddToQueue} />
        <ActionRow label="Add to playlist" symbol="music.note.list" onPress={onAddToPlaylist} />
        <ActionRow
          label={isInLibrary ? 'Remove from library' : 'Add to library'}
          symbol={isInLibrary ? 'bookmark.slash' : 'bookmark'}
          onPress={onToggleLibrary}
        />
        <ActionRow
          label={isFavorite ? 'Remove favorite' : 'Add to favorites'}
          symbol={isFavorite ? 'heart.slash' : 'heart'}
          onPress={onToggleFavorite}
        />
        <ActionRow
          label="Open artist"
          symbol="music.mic"
          onPress={() => {
            onClose();
            router.push(`/artist/${track.artistId}`);
          }}
        />
        <ActionRow
          label="Open album"
          symbol="square.stack"
          onPress={() => {
            onClose();
            router.push(`/album/${track.albumId}`);
          }}
        />
      </View>
      <PrimaryButton label="Done" onPress={onClose} variant="secondary" />
    </ModalSheet>
  );
}
