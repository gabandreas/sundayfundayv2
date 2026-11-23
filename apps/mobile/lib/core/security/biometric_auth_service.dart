import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:local_auth/local_auth.dart';

import '../storage/secure_vault.dart';

abstract interface class BiometricGateway {
  Future<bool> isAvailable();
  Future<bool> authenticate(String reason);
}

class LocalAuthBiometricGateway implements BiometricGateway {
  final LocalAuthentication _auth;

  LocalAuthBiometricGateway([LocalAuthentication? auth])
      : _auth = auth ?? LocalAuthentication();

  @override
  Future<bool> isAvailable() async {
    try {
      final supported = await _auth.isDeviceSupported();
      if (!supported) return false;
      final canCheck = await _auth.canCheckBiometrics;
      return canCheck;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        biometricOnly: true,
        persistAcrossBackgrounding: true,
      );
    } catch (_) {
      return false;
    }
  }
}

class DeviceKeyManager {
  // RFC 8410 Ed25519 SPKI DER prefix before the 32-byte raw public key
  static final Uint8List _ed25519SpkiPrefix = Uint8List.fromList([
    0x30,
    0x2a,
    0x30,
    0x05,
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70,
    0x03,
    0x21,
    0x00,
  ]);

  final SecureVault vault;
  final Ed25519 _algorithm = Ed25519();

  DeviceKeyManager({required this.vault});

  Future<String> generateAndStoreKeyPair() async {
    final keyPair = await _algorithm.newKeyPair();
    final privateSeed = await keyPair.extractPrivateKeyBytes();
    final publicKey = await keyPair.extractPublicKey();

    await vault.saveBiometricSeed(base64Encode(privateSeed));

    final der = Uint8List(_ed25519SpkiPrefix.length + publicKey.bytes.length);
    der.setRange(0, _ed25519SpkiPrefix.length, _ed25519SpkiPrefix);
    der.setRange(_ed25519SpkiPrefix.length, der.length, publicKey.bytes);

    final b64 = base64Encode(der);
    return _wrapSpkiPem(b64);
  }

  Future<String> signChallengePayload(String signingPayload) async {
    final seedB64 = await vault.readBiometricSeed();
    if (seedB64 == null || seedB64.isEmpty) {
      throw StateError('Biometric device key is not enrolled in vault.');
    }

    final seedBytes = base64Decode(seedB64);
    final keyPair = await _algorithm.newKeyPairFromSeed(seedBytes);
    final signature = await _algorithm.sign(
      utf8.encode(signingPayload),
      keyPair: keyPair,
    );
    return base64Encode(signature.bytes);
  }

  static String _wrapSpkiPem(String base64Der) {
    final buffer = StringBuffer('-----BEGIN PUBLIC KEY-----\n');
    for (var i = 0; i < base64Der.length; i += 64) {
      final end = (i + 64 < base64Der.length) ? i + 64 : base64Der.length;
      buffer.writeln(base64Der.substring(i, end));
    }
    buffer.write('-----END PUBLIC KEY-----');
    return buffer.toString();
  }
}
