import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../config/env.dart';
import '../storage/secure_vault.dart';

class RateLimitedException implements Exception {
  final String message;

  const RateLimitedException(this.message);

  @override
  String toString() => 'RateLimitedException: $message';
}

class UnauthorizedSessionException implements Exception {
  final String message;

  const UnauthorizedSessionException(this.message);

  @override
  String toString() => 'UnauthorizedSessionException: $message';
}

class ConflictMutationException implements Exception {
  final String message;

  const ConflictMutationException(this.message);

  @override
  String toString() => 'ConflictMutationException: $message';
}

class ApiValidationException implements Exception {
  final String message;

  const ApiValidationException(this.message);

  @override
  String toString() => 'ApiValidationException: $message';
}

class NetworkOfflineException implements Exception {
  final String message;

  const NetworkOfflineException(this.message);

  @override
  String toString() => 'NetworkOfflineException: $message';
}

class ApiClient {
  static const Set<String> _authBypassRefreshPaths = {
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/biometric/verify',
    '/api/auth/biometric/challenge',
    '/api/auth/pin/verify',
    '/api/auth/sso/exchange',
    '/api/auth/demo-login',
  };

  final Dio _dio;
  final Dio _refreshDio;
  final SecureVault vault;
  final String devicePlatform;
  final VoidCallback? onSessionExpired;
  final Uuid _uuid = const Uuid();

  Completer<String?>? _refreshCompleter;

  ApiClient({
    required this.vault,
    String baseUrl = AppEnv.apiBaseUrl,
    HttpClientAdapter? adapter,
    String? devicePlatform,
    this.onSessionExpired,
  })  : devicePlatform = devicePlatform ?? _detectPlatform(),
        _dio = Dio(_baseOptions(baseUrl)),
        _refreshDio = Dio(_baseOptions(baseUrl)) {
    if (adapter != null) {
      _dio.httpClientAdapter = adapter;
      _refreshDio.httpClientAdapter = adapter;
    }

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          options.headers.remove('x-user-id');
          options.headers.remove('X-User-Id');
          options.headers['X-Request-Id'] = _uuid.v4();
          options.headers['X-Device-Id'] = await vault.getOrCreateDeviceId();
          options.headers['X-Device-Platform'] = this.devicePlatform;
          options.headers['X-App-Version'] = '1.0.0';

          final token = await vault.readAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (err, handler) async {
          final status = err.response?.statusCode;
          if (status == 429) {
            handler.reject(
              DioException(
                requestOptions: err.requestOptions,
                response: err.response,
                type: err.type,
                error: const RateLimitedException(
                  'Too many failed attempts. Wait 15 minutes before retrying.',
                ),
              ),
            );
            return;
          }

          final reqPath = err.requestOptions.path;
          final alreadyRetried =
              err.requestOptions.extra['_retriedAfterRefresh'] == true;
          if (status == 401 &&
              !alreadyRetried &&
              !_authBypassRefreshPaths.contains(reqPath)) {
            final newToken = await _singleFlightRefresh();
            if (newToken != null && newToken.isNotEmpty) {
              final retryOpts = err.requestOptions;
              retryOpts.headers['Authorization'] = 'Bearer $newToken';
              retryOpts.extra['_retriedAfterRefresh'] = true;
              try {
                final response = await _dio.fetch(retryOpts);
                handler.resolve(response);
                return;
              } on DioException catch (retryErr) {
                handler.next(retryErr);
                return;
              }
            }
          }

          handler.next(err);
        },
      ),
    );
  }

  static BaseOptions _baseOptions(String baseUrl) => BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      );

  static String _detectPlatform() {
    if (kIsWeb) return 'WEB';
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return 'IOS';
      case TargetPlatform.android:
        return 'ANDROID';
      default:
        return 'ANDROID';
    }
  }

  Future<String?> _singleFlightRefresh() async {
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    final completer = Completer<String?>();
    _refreshCompleter = completer;

    try {
      final refreshToken = await vault.readRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        await _handleExpiredSession();
        completer.complete(null);
        return null;
      }

      final deviceId = await vault.getOrCreateDeviceId();
      final response = await _refreshDio.post<Map<String, dynamic>>(
        '/api/auth/refresh',
        data: {
          'refreshToken': refreshToken,
          'deviceId': deviceId,
          'platform': devicePlatform,
        },
        options: Options(
          headers: {
            'X-Request-Id': _uuid.v4(),
            'X-Device-Id': deviceId,
            'X-Device-Platform': devicePlatform,
            'X-App-Version': '1.0.0',
          },
        ),
      );

      final data = response.data ?? const {};
      final newAccess = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      final newSid = data['sessionId'] as String?;

      if (newAccess == null || newAccess.isEmpty) {
        await _handleExpiredSession();
        completer.complete(null);
        return null;
      }

      await vault.saveSessionTokens(
        accessToken: newAccess,
        refreshToken: newRefresh,
        sessionId: newSid,
      );
      completer.complete(newAccess);
      return newAccess;
    } catch (_) {
      await _handleExpiredSession();
      completer.complete(null);
      return null;
    } finally {
      _refreshCompleter = null;
    }
  }

  Future<void> _handleExpiredSession() async {
    await vault.clearSession();
    onSessionExpired?.call();
  }

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      return await _dio.get<T>(path, queryParameters: queryParameters);
    } on DioException catch (err) {
      _rethrowTyped(err);
    }
  }

  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    String? idempotencyKey,
  }) async {
    try {
      return await _dio.post<T>(
        path,
        data: data,
        options: idempotencyKey != null
            ? Options(headers: {'Idempotency-Key': idempotencyKey})
            : null,
      );
    } on DioException catch (err) {
      _rethrowTyped(err);
    }
  }

  Future<Response<ResponseBody>> postStream(
    String path, {
    Object? data,
  }) async {
    try {
      return await _dio.post<ResponseBody>(
        path,
        data: data,
        options: Options(
          responseType: ResponseType.stream,
          headers: const {
            'Accept': 'application/x-ndjson, application/json',
          },
          receiveTimeout: const Duration(seconds: 90),
        ),
      );
    } on DioException catch (err) {
      _rethrowTyped(err);
    }
  }

  Future<Response<T>> patch<T>(
    String path, {
    Object? data,
    String? idempotencyKey,
  }) async {
    try {
      return await _dio.patch<T>(
        path,
        data: data,
        options: idempotencyKey != null
            ? Options(headers: {'Idempotency-Key': idempotencyKey})
            : null,
      );
    } on DioException catch (err) {
      _rethrowTyped(err);
    }
  }

  Future<Response<T>> delete<T>(String path) async {
    try {
      return await _dio.delete<T>(path);
    } on DioException catch (err) {
      _rethrowTyped(err);
    }
  }

  Never _rethrowTyped(DioException err) {
    final inner = err.error;
    if (inner is RateLimitedException) {
      throw inner;
    }

    final status = err.response?.statusCode;
    final serverMessage = _extractErrorMessage(err.response?.data);

    if (status == 429) {
      throw RateLimitedException(
        serverMessage ??
            'Too many failed attempts. Wait 15 minutes before retrying.',
      );
    }
    if (status == 401) {
      throw UnauthorizedSessionException(
        serverMessage ?? 'Session expired or invalid credentials.',
      );
    }
    if (status == 409) {
      throw ConflictMutationException(
        serverMessage ?? 'Conflicting request detected.',
      );
    }
    if (status == 400 || status == 422) {
      throw ApiValidationException(
        serverMessage ?? 'Check your entered values and retry.',
      );
    }
    if (err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout) {
      throw const NetworkOfflineException(
        'Connection interrupted. Check internet access and retry.',
      );
    }
    throw err;
  }

  static String? _extractErrorMessage(dynamic data) {
    if (data is Map) {
      final msg = data['message'];
      if (msg is List && msg.isNotEmpty) return msg.first.toString();
      if (msg != null) return msg.toString();
    }
    return null;
  }
}
