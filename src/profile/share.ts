import { Platform, Share } from 'react-native';

/** Hands the file text to the person: a download on web, the share sheet on phones. Nothing is uploaded by CAN. */
export async function exportText(text: string): Promise<void> {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'can-profile.json';
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    await Share.share({ message: text });
  }
}

/** Web only: choose a file and read it. Resolves null if cancelled. */
export function pickTextFile(): Promise<string | null> {
  return new Promise((ok) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = 'application/json,.json';
    i.onchange = () => (i.files?.[0] ? i.files[0].text().then(ok, () => ok(null)) : ok(null));
    i.click();
  });
}
