import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import type { AxiosError } from 'axios';
import { GlassSurface } from '@/src/components/GlassSurface';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { shareAlbumExport, shareTrackExport } from '@/src/services/exports';
import { useTheme } from '@/src/providers/ThemeProvider';

type ExportTarget =
  | { kind: 'track'; id: string; title: string }
  | { kind: 'album'; id: string; title: string };

interface ExportSheetProps {
  open: boolean;
  target: ExportTarget;
  onClose: () => void;
}

function asErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ detail?: string }>;
  return axiosError.response?.data?.detail ?? 'Export failed. Please try again.';
}

export function ExportSheet({ open, target, onClose }: ExportSheetProps) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<'personal' | 'business'>('personal');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleDownload() {
    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      if (target.kind === 'track') {
        await shareTrackExport(target.id, target.title);
        setSuccess('Track export is ready in the iOS share sheet.');
      } else {
        await shareAlbumExport(target.id, target.title);
        setSuccess('Album ZIP is ready in the iOS share sheet.');
      }
    } catch (caughtError) {
      setError(asErrorMessage(caughtError));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.38)',
        }}
      >
        <GlassSurface style={{ padding: 18, gap: 18 }}>
          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 19,
                fontWeight: '700',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              Export {target.kind === 'album' ? 'Album' : 'Track'}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                color: theme.colors.textMuted,
                fontSize: 14,
                lineHeight: 21,
                fontFamily: theme.typography.bodyFontFamily,
              }}
            >
              {target.title}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
            }}
          >
            {(['personal', 'business'] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={{
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    tab === value ? theme.colors.primaryDim : theme.colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor:
                    tab === value ? theme.colors.primary : theme.colors.surfaceBorder,
                }}
              >
                <Text
                  style={{
                    color: tab === value ? theme.colors.primary : theme.colors.textMuted,
                    fontSize: 13,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                  }}
                >
                  {value === 'personal' ? 'Personal' : 'Business'}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'personal' ? (
            <View style={{ gap: 14 }}>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 14,
                  lineHeight: 21,
                  fontFamily: theme.typography.bodyFontFamily,
                }}
              >
                Premium listeners can export copyright-safe personal-use audio. Track exports open
                directly in the iOS share sheet, and albums are bundled as a ZIP first.
              </Text>
              {error ? (
                <Text style={{ color: theme.colors.danger, fontSize: 14 }}>{error}</Text>
              ) : null}
              {success ? (
                <Text style={{ color: theme.colors.success, fontSize: 14 }}>{success}</Text>
              ) : null}
              <PrimaryButton
                label={
                  isWorking
                    ? 'Preparing Export...'
                    : target.kind === 'album'
                      ? 'Share Album ZIP'
                      : 'Share Track'
                }
                onPress={handleDownload}
                disabled={isWorking}
              />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 14,
                  lineHeight: 21,
                  fontFamily: theme.typography.bodyFontFamily,
                }}
              >
                Business licensing is wired on the backend as a future flow, but checkout is still
                coming soon.
              </Text>
              <GlassSurface
                style={{
                  padding: 14,
                  borderRadius: 18,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.warning,
                    fontSize: 13,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                  }}
                >
                  Coming soon
                </Text>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 14,
                    lineHeight: 20,
                    marginTop: 6,
                    fontFamily: theme.typography.bodyFontFamily,
                  }}
                >
                  Track licensing will support commercial usage once payments are integrated.
                </Text>
              </GlassSurface>
            </View>
          )}

          <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
        </GlassSurface>
      </View>
    </Modal>
  );
}
