import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.acadex.app',
  appName: 'AcadeX',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  android: {
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;