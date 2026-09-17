import { Alert as RNAlert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

// react-native-web implementa Alert.alert como un no-op total (ver
// node_modules/react-native-web/src/exports/Alert): en el build web ningún
// mensaje de error se mostraba nunca, y los diálogos de confirmación
// (ej. "¿Eliminar producto?") jamás aparecían — el botón destructivo dentro
// del Alert no existía en el DOM, así que eliminar era imposible desde web.
// Este helper usa window.confirm/alert en web y el Alert nativo real en
// iOS/Android, con la misma firma que Alert.alert.
export function alert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n\n');

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const confirmButton = buttons.find((b) => b.style !== 'cancel') ?? buttons[0];

  if (window.confirm(text)) {
    confirmButton.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
