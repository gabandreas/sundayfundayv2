import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/core/security/biometric_auth_service.dart';

import '../helpers/in_memory_vault.dart';

void main() {
  test('DeviceKeyManager generates Ed25519 SPKI PEM compatible with Node crypto and signs challenges', () async {
    final vault = InMemorySecureVault(deviceId: 'huawei-mate60');
    final keyManager = DeviceKeyManager(vault: vault);

    final spkiPem = await keyManager.generateAndStoreKeyPair();
    expect(spkiPem, startsWith('-----BEGIN PUBLIC KEY-----'));
    expect(spkiPem, endsWith('-----END PUBLIC KEY-----'));

    // Extract base64 DER body and verify exact RFC 8410 Ed25519 SPKI prefix + 32-byte pubkey = 44 bytes
    final b64 = spkiPem
        .replaceAll('-----BEGIN PUBLIC KEY-----', '')
        .replaceAll('-----END PUBLIC KEY-----', '')
        .replaceAll(RegExp(r'\s+'), '');
    final der = base64Decode(b64);
    expect(der.length, 44);
    expect(
      der.sublist(0, 12),
      Uint8List.fromList([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]),
    );

    const challengePayload = 'abc123nonce:huawei-mate60';
    final sigBase64 = await keyManager.signChallengePayload(challengePayload);
    final sigBytes = base64Decode(sigBase64);
    expect(sigBytes.length, 64);

    // Cryptographically verify signature against extracted 32-byte public key
    final algorithm = Ed25519();
    final pubKey = SimplePublicKey(der.sublist(12), type: KeyPairType.ed25519);
    final isValid = await algorithm.verify(
      utf8.encode(challengePayload),
      signature: Signature(sigBytes, publicKey: pubKey),
    );
    expect(isValid, isTrue);
  });
}
