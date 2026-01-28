import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.acadex.app',
  appName: 'AcadeX',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  android: {
    // ✅ Helps prevent white flashes & improves input handling
    backgroundColor: "#f8fafc",
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    // ✅ NEW: Fixes the Status Bar (Notch) Issue
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#667eea', // Matches your header color
      overlaysWebView: true,      // 🛑 KEY SETTING: Allows content to go behind the status bar
    },
    // ✅ KEEP: Your existing Push Notification settings
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;