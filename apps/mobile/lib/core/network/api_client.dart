import 'package:dio/dio.dart';

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

class ApiClient {
  final Dio _dio;
  final SecureVault vault;

  ApiClient({
    required this.vault,
    String baseUrl = AppEnv.apiBaseUrl,
    HttpClientAdapter? adapter,
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          ),
        ) {
    if (adapter != null) {
      _dio.httpClientAdapter = adapter;
    }

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          options.headers.remove('x-user-id');
          options.headers.remove('X-User-Id');
          final token = await vault.readAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (err, handler) {
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
          handler.next(err);
        },
      ),
    );
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

  Never _rethrowTyped(DioException err) {
    final inner = err.error;
    if (inner is RateLimitedException) {
      throw inner;
    }
    if (err.response?.statusCode == 429) {
      throw const RateLimitedException(
        'Too many failed attempts. Wait 15 minutes before retrying.',
      );
    }
    if (err.response?.statusCode == 401) {
      throw const UnauthorizedSessionException(
        'Session expired or invalid credentials.',
      );
    }
    throw err;
  }
}
