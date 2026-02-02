import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.acadex.app',
  appName: 'AcadeX',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  android: {
    // ✅ Keeps the background clean during transitions
    backgroundColor: "#f8fafc",
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    // ✅ STATUS BAR FIX (Top Notch)
    StatusBar: {
      style: 'DARK',
      // ⚠️ IMPORTANT: We set this to transparent so your CSS background shows through!
      // If you set a solid color here, it might block your beautiful gradient.
      backgroundColor: '#00000000', // Transparent Hex Code
      overlaysWebView: true,         // Allows content to go BEHIND the bar
    },
    // ✅ PUSH NOTIFICATIONS (Keep as is)
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;