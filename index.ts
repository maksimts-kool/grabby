// Unistyles must be configured before any component module is evaluated,
// so the theme is registered first and expo-router's entry is loaded last.
import './src/theme/unistyles';
// Background tasks must be defined at module scope on every launch, including headless
// launches by WorkManager when the app isn't open.
import './src/services/background';
import 'expo-router/entry';
