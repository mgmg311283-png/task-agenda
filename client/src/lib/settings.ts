export interface AppSettings {
  notifications: boolean;
  emailNotifications: boolean;
  darkMode: 'auto' | 'light' | 'dark';
  language: 'es' | 'en' | 'pt';
  soundEffects: boolean;
  pomodoroMinutes: number;
  breakMinutes: number;
  autoMarkExpired: boolean;
  showAchievements: boolean;
  compactView: boolean;
  animationsEnabled: boolean;
  theme: 'default' | 'minimal' | 'colorful';
}

export const DEFAULT_SETTINGS: AppSettings = {
  notifications: true,
  emailNotifications: false,
  darkMode: 'auto',
  language: 'es',
  soundEffects: true,
  pomodoroMinutes: 25,
  breakMinutes: 5,
  autoMarkExpired: true,
  showAchievements: true,
  compactView: false,
  animationsEnabled: true,
  theme: 'default',
};

export function loadSettings(): AppSettings {
  const saved = localStorage.getItem('app-settings');
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem('app-settings', JSON.stringify(settings));
}

export function resetSettings(): void {
  localStorage.removeItem('app-settings');
}
