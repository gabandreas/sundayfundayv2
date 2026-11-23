import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/core/network/api_client.dart';

import '../helpers/in_memory_vault.dart';

class _StubAdapter implements HttpClientAdapter {
  final Future<ResponseBody> Function(RequestOptions options) onRequest;

  _StubAdapter(this.onRequest);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) =>
      onRequest(options);

  @override
  void close({bool force = false}) {}
}

void main() {
  test('single-flight 401 refresh lock executes exactly one /api/auth/refresh across 5 concurrent calls', () async {
    final vault = InMemorySecureVault(
      accessToken: 'expired-jwt-1',
      refreshToken: 'sf_rt_initial_1234',
      sessionId: 'sid-1',
      deviceId: 'pixel-9-pro',
    );

    var refreshCount = 0;
    final seenDeviceIds = <String>{};

    final adapter = _StubAdapter((options) async {
      final devHeader = options.headers['X-Device-Id']?.toString();
      if (devHeader != null) seenDeviceIds.add(devHeader);

      if (options.path == '/api/auth/refresh') {
        refreshCount++;
        await Future<void>.delayed(const Duration(milliseconds: 25));
        return ResponseBody.fromString(
          jsonEncode({
            'accessToken': 'fresh-jwt-2',
            'refreshToken': 'sf_rt_rotated_5678',
            'sessionId': 'sid-2',
          }),
          200,
          headers: {Headers.contentTypeHeader: ['application/json']},
        );
      }

      if (options.headers['Authorization'] == 'Bearer expired-jwt-1') {
        return ResponseBody.fromString(
          jsonEncode({'message': 'Expired'}),
          401,
          headers: {Headers.contentTypeHeader: ['application/json']},
        );
      }

      expect(options.headers['Authorization'], 'Bearer fresh-jwt-2');
      return ResponseBody.fromString(
        jsonEncode({'ok': true, 'path': options.path}),
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });

    final client = ApiClient(vault: vault, adapter: adapter, devicePlatform: 'ANDROID');

    final results = await Future.wait<Response<Map<String, dynamic>>>([
      client.get<Map<String, dynamic>>('/api/finance/mobile-boot'),
      client.get<Map<String, dynamic>>('/api/finance/pacing'),
      client.get<Map<String, dynamic>>('/api/credit/line-items'),
      client.get<Map<String, dynamic>>('/api/auth/sessions'),
      client.get<Map<String, dynamic>>('/api/auth/me'),
    ]);

    expect(refreshCount, 1);
    expect(results.length, 5);
    for (final res in results) {
      expect(res.data?['ok'], isTrue);
    }
    expect(seenDeviceIds.contains('pixel-9-pro'), isTrue);
    expect(await vault.readAccessToken(), 'fresh-jwt-2');
    expect(await vault.readRefreshToken(), 'sf_rt_rotated_5678');
    expect(await vault.readSessionId(), 'sid-2');
  });

  test('clears vault session and invokes onSessionExpired when /api/auth/refresh returns 401', () async {
    final vault = InMemorySecureVault(
      accessToken: 'revoked-jwt',
      refreshToken: 'sf_rt_compromised',
      sessionId: 'sid-revoked',
    );
    var expiredCallbackFired = false;

    final adapter = _StubAdapter((options) async {
      return ResponseBody.fromString(
        jsonEncode({'message': 'Token reuse detected'}),
        401,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });

    final client = ApiClient(
      vault: vault,
      adapter: adapter,
      onSessionExpired: () => expiredCallbackFired = true,
    );

    await expectLater(
      client.get('/api/finance/mobile-boot'),
      throwsA(isA<UnauthorizedSessionException>()),
    );

    expect(expiredCallbackFired, isTrue);
    expect(await vault.readAccessToken(), isNull);
    expect(await vault.readRefreshToken(), isNull);
  });

  test('maps HTTP 409 Conflict into ConflictMutationException', () async {
    final vault = InMemorySecureVault(accessToken: 'valid-jwt');
    final adapter = _StubAdapter((options) async {
      return ResponseBody.fromString(
        jsonEncode({'message': 'Idempotency-Key reuse with different payload'}),
        409,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });

    final client = ApiClient(vault: vault, adapter: adapter);
    await expectLater(
      client.post(
        '/api/finance/transactions',
        data: {'amount': 99999},
        idempotencyKey: 'dup-key',
      ),
      throwsA(isA<ConflictMutationException>()),
    );
  });
}
