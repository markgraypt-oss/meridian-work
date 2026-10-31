export type WearableProvider = "oura" | "whoop" | "google_fit" | "apple_health";

export interface NormalisedDailyMetrics {
  date: string; // YYYY-MM-DD
  sleepMinutes?: number | null;
  sleepDeepMinutes?: number | null;
  sleepRemMinutes?: number | null;
  sleepLightMinutes?: number | null;
  sleepAwakeMinutes?: number | null;
  sleepScore?: number | null;
  hrvMs?: number | null;
  restingHrBpm?: number | null;
  steps?: number | null;
  activeMinutes?: number | null;
  caloriesBurned?: number | null;
  readinessScore?: number | null;
  strainScore?: number | null;
  workoutCount?: number | null;
  vo2MaxMlKgMin?: number | null;
  raw?: any;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  providerUserId?: string | null;
  scopes?: string[] | null;
}

export interface WearableAdapter {
  provider: WearableProvider;
  isConfigured(): boolean;
  // OAuth providers implement these
  authUrl?(state: string, redirectUri: string): string;
  exchangeCode?(code: string, redirectUri: string): Promise<OAuthTokens>;
  refresh?(refreshToken: string): Promise<OAuthTokens>;
  // All providers (except apple_health) implement this
  // tz: the user's IANA timezone. Providers that return instants (WHOOP) use
  // it to file each record on the user's local day, not the UTC day.
  fetchDaily?(accessToken: string, fromDate: string, toDate: string, tz?: string | null): Promise<NormalisedDailyMetrics[]>;
}
