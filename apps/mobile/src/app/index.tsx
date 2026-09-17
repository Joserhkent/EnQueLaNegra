import { Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Image source={require('@/assets/images/logo.jpg')} style={styles.logo} resizeMode="contain" />

        <ThemedText type="smallBold" style={styles.eyebrow}>
          App móvil próximamente
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
          Por ahora, el punto de venta y la gestión de mesas se manejan desde la versión web del POS.
          Esta app se construirá en la siguiente fase.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  logo: {
    width: '100%',
    maxWidth: 340,
    height: 170,
    marginBottom: Spacing.two,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  description: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
