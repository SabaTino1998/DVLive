import type { ConfigContext, ExpoConfig } from 'expo/config';

// Keep the original environment names without duplicating EXPO_PUBLIC_ aliases.
// Expo exposes this selected configuration to the client through Constants.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || 'DVLive',
  slug: config.slug || 'dvlive',
  extra: {
    ...config.extra,
    dvlive: {
      url: process.env.SUPABASE_URL || '',
      key: process.env.SUPABASE_ANON_KEY || '',
      bearer: process.env.DVLIVE_BEARER_TOKEN || '',
      showUuid: process.env.SHOW_VOTE_UUID || '',
    },
  },
});
