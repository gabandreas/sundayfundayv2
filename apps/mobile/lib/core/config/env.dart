abstract final class AppEnv {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://sundayfunday-api.vercel.app',
  );
}
