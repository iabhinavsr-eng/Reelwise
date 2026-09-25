import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Fire-and-forget haptics; silently no-ops where unsupported (web). */
export const haptics = {
  tap() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  select() {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  },
  success() {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error() {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
