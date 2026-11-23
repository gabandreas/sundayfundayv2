import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/core/config/env.dart';
import 'package:sundayfunday_mobile/core/network/api_client.dart';

import '../helpers/in_memory_vault.dart';

class _FakeHttpAdapter implements HttpClientAdapter {
  final Future<ResponseBody> Function(RequestOptions options) onRequest;
  final List<RequestOptions> captured = [];

  _FakeHttpAdapter(this.onRequest);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    captured.add(options);
    return onRequest(options);
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('defaults API base URL to verified Vercel production endpoint', () {
    expect(AppEnv.apiBaseUrl, 'https://sundayfunday-api.vercel.app');
  });

  test('attaches Bearer JWT without static x-user-id and passes Idempotency-Key', () async {
    final vault = InMemorySecureVault(accessToken: 'jwt-abc-123');
    final adapter = _FakeHttpAdapter((options) async {
      return ResponseBody.fromString(
        jsonEncode({'ok': true}),
        201,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });

    final client = ApiClient(vault: vault, adapter: adapter);
    final res = await client.post<Map<String, dynamic>>(
      '/api/finance/transactions',
      data: {'label': 'Kopi', 'amount': 32000},
      idempotencyKey: 'idem-tx-001',
    );

    expect(res.data?['ok'], isTrue);
    final reqHeaders = adapter.captured.single.headers;
    expect(reqHeaders['Authorization'], 'Bearer jwt-abc-123');
    expect(reqHeaders['Idempotency-Key'], 'idem-tx-001');
    expect(reqHeaders.containsKey('x-user-id'), isFalse);
    expect(reqHeaders.containsKey('X-User-Id'), isFalse);
  });

  test('maps HTTP 429 Too Many Requests into typed RateLimitedException', () async {
    final vault = InMemorySecureVault();
    final adapter = _FakeHttpAdapter((options) async {
      return ResponseBody.fromString(
        jsonEncode({'message': 'Too many failed authentication attempts.'}),
        429,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });

    final client = ApiClient(vault: vault, adapter: adapter);
    await expectLater(
      client.post('/api/auth/login', data: {'username': 'u', 'password': 'p'}),
      throwsA(isA<RateLimitedException>()),
    );
  });
}
