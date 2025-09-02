import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.5f518127fd784bb4ba3f9a1f9bb88f3a',
  appName: 'attendance-guardian-ai',
  webDir: 'dist',
  server: {
    url: "https://5f518127-fd78-4bb4-ba3f-9a1f9bb88f3a.lovableproject.com?forceHideBadge=true",
    cleartext: true
  }
};

export default config;