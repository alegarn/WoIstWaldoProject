export function resolveDefaultLanguage() {
  try {
    return (Intl.DateTimeFormat().resolvedOptions().locale || 'en').split('-')[0];
  } catch {
    return 'en';
  }
}
