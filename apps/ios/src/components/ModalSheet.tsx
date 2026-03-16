import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { GlassSurface } from '@/src/components/GlassSurface';
import { useTheme } from '@/src/providers/ThemeProvider';

interface ModalSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export function ModalSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: ModalSheetProps) {
  const { theme } = useTheme();

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          padding: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.32)',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <GlassSurface style={{ padding: 18, gap: 18, borderRadius: 30 }}>
          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 20,
                fontWeight: '700',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 14,
                  lineHeight: 21,
                  fontFamily: theme.typography.bodyFontFamily,
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {children}
        </GlassSurface>
      </View>
    </Modal>
  );
}
