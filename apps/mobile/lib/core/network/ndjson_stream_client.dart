import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'api_client.dart';

/// Streams newline-delimited JSON (`application/x-ndjson`) responses line by line.
class NdjsonStreamClient {
  final ApiClient apiClient;

  const NdjsonStreamClient(this.apiClient);

  /// Safely decodes raw TCP byte chunks into JSON objects even when multi-byte UTF-8
  /// characters or JSON lines are split across network packet boundaries.
  static Stream<Map<String, dynamic>> parseByteStream(
    Stream<List<int>> byteStream,
  ) async* {
    final lineStream = byteStream
        .transform(utf8.decoder)
        .transform(const LineSplitter());

    await for (final rawLine in lineStream) {
      final line = rawLine.trim();
      if (line.isEmpty) continue;
      final decoded = jsonDecode(line);
      if (decoded is Map<String, dynamic>) {
        yield decoded;
      } else if (decoded is Map) {
        yield Map<String, dynamic>.from(decoded);
      }
    }
  }

  Stream<Map<String, dynamic>> streamPost(
    String path, {
    Object? data,
  }) async* {
    final response = await apiClient.postStream(path, data: data);
    final body = response.data;
    if (body == null) return;

    final Stream<Uint8List> rawStream = body.stream;
    yield* parseByteStream(rawStream.map<List<int>>((chunk) => chunk));
  }
}
