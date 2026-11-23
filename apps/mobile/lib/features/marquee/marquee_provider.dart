import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/network/api_client.dart';
import '../../core/network/ndjson_stream_client.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../bills_radar/radar_provider.dart';
import '../cockpit/cockpit_provider.dart';
import 'marquee_models.dart';

class MarqueeState {
  final List<MarqueeMessage> messages;
  final List<MarqueeStatusFrame> liveStatusSteps;
  final List<MarqueeProactiveReminder> proactiveReminders;
  final List<MarqueeMemoryRule> memoryRules;
  final bool isStreaming;
  final bool isLoadingMemory;
  final String? errorMessage;

  const MarqueeState({
    this.messages = const [],
    this.liveStatusSteps = const [],
    this.proactiveReminders = const [],
    this.memoryRules = const [],
    this.isStreaming = false,
    this.isLoadingMemory = false,
    this.errorMessage,
  });

  MarqueeState copyWith({
    List<MarqueeMessage>? messages,
    List<MarqueeStatusFrame>? liveStatusSteps,
    List<MarqueeProactiveReminder>? proactiveReminders,
    List<MarqueeMemoryRule>? memoryRules,
    bool? isStreaming,
    bool? isLoadingMemory,
    String? errorMessage,
    bool clearError = false,
  }) {
    return MarqueeState(
      messages: messages ?? this.messages,
      liveStatusSteps: liveStatusSteps ?? this.liveStatusSteps,
      proactiveReminders: proactiveReminders ?? this.proactiveReminders,
      memoryRules: memoryRules ?? this.memoryRules,
      isStreaming: isStreaming ?? this.isStreaming,
      isLoadingMemory: isLoadingMemory ?? this.isLoadingMemory,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class MarqueeNotifier extends Notifier<MarqueeState> {
  final MarqueeState? _initialOverride;
  static const _uuid = Uuid();

  MarqueeNotifier([this._initialOverride]);

  @override
  MarqueeState build() => _initialOverride ?? const MarqueeState();

  Future<void> sendPrompt(
    String rawText, {
    int? month,
    int? year,
    AppLanguage? lang,
  }) async {
    final prompt = rawText.trim();
    if (prompt.isEmpty || state.isStreaming) return;

    final cockpitPeriod = ref.read(cockpitProvider).boot?.period;
    final AppLanguage activeLang = lang ?? ref.read(languageProvider);
    final userMsg = MarqueeMessage(
      id: _uuid.v4(),
      isUser: true,
      summary: prompt,
    );

    ErpHaptics.light();
    state = state.copyWith(
      messages: [...state.messages, userMsg],
      liveStatusSteps: const [],
      isStreaming: true,
      clearError: true,
    );

    final streamClient = NdjsonStreamClient(ref.read(apiClientProvider));
    final body = {
      'message': prompt,
      'locale': activeLang.code,
      'activeRoute': '/cockpit',
      'month': month ?? cockpitPeriod?.month,
      'year': year ?? cockpitPeriod?.year,
    };

    try {
      await for (final frame in streamClient.streamPost(
        '/api/marquee/chat/stream',
        data: body,
      )) {
        final type = frame['type']?.toString();
        if (type == 'status') {
          final statusFrame = MarqueeStatusFrame.fromJson(frame);
          state = state.copyWith(
            liveStatusSteps: [...state.liveStatusSteps, statusFrame],
          );
        } else if (type == 'final') {
          final payload = Map<String, dynamic>.from(
            (frame['data'] as Map?) ?? const {},
          );
          final rawReminders = (payload['proactiveReminders'] as List?) ?? const [];
          final reminders = rawReminders
              .whereType<Map>()
              .map((e) => MarqueeProactiveReminder.fromJson(Map<String, dynamic>.from(e)))
              .toList();

          final assistantMsg = MarqueeMessage.fromApiResponse(_uuid.v4(), payload);
          ErpHaptics.medium();
          state = state.copyWith(
            messages: [...state.messages, assistantMsg],
            liveStatusSteps: const [],
            proactiveReminders:
                reminders.isNotEmpty ? reminders : state.proactiveReminders,
            isStreaming: false,
          );
          return;
        } else if (type == 'error') {
          ErpHaptics.error();
          state = state.copyWith(
            isStreaming: false,
            liveStatusSteps: const [],
            errorMessage: frame['message']?.toString() ?? 'Marquee request failed.',
          );
          return;
        }
      }

      if (state.isStreaming) {
        state = state.copyWith(isStreaming: false, liveStatusSteps: const []);
      }
    } on NetworkOfflineException catch (e) {
      state = state.copyWith(
        isStreaming: false,
        liveStatusSteps: const [],
        errorMessage: e.message,
      );
    } on UnauthorizedSessionException catch (e) {
      state = state.copyWith(
        isStreaming: false,
        liveStatusSteps: const [],
        errorMessage: e.message,
      );
    } catch (e) {
      state = state.copyWith(
        isStreaming: false,
        liveStatusSteps: const [],
        errorMessage: e.toString(),
      );
    }
  }

  Future<void> confirmPendingAction(
    String messageId,
    MarqueePendingAction action,
  ) async {
    if (state.isStreaming) return;
    final period = ref.read(cockpitProvider).boot?.period;
    final lang = ref.read(languageProvider);

    state = state.copyWith(isStreaming: true, clearError: true);
    try {
      final res = await ref.read(apiClientProvider).post<Map<String, dynamic>>(
            '/api/marquee/chat',
            idempotencyKey: _uuid.v4(),
            data: {
              'message': action.title ?? action.type,
              'confirm': true,
              'pendingAction': action.toJson(),
              'month': period?.month,
              'year': period?.year,
              'locale': lang.code,
              'activeRoute': '/cockpit',
            },
          );

      final updatedMessages = state.messages
          .map((m) => m.id == messageId ? m.copyWith(actionExecuted: true) : m)
          .toList();
      final resultMsg = MarqueeMessage.fromApiResponse(
        _uuid.v4(),
        res.data ?? const {},
      );

      ErpHaptics.medium();
      state = state.copyWith(
        messages: [...updatedMessages, resultMsg],
        isStreaming: false,
      );

      // Keep Cockpit & Radar synchronized after Ledger/Bill/Budget action confirms
      await ref.read(cockpitProvider.notifier).loadBoot(
            month: period?.month,
            year: period?.year,
          );
      if (ref.read(radarProvider).detail != null) {
        await ref.read(radarProvider.notifier).loadRadar(
              month: period?.month,
              year: period?.year,
            );
      }
    } catch (e) {
      ErpHaptics.error();
      state = state.copyWith(isStreaming: false, errorMessage: e.toString());
    }
  }

  Future<void> loadMemoryRules() async {
    state = state.copyWith(isLoadingMemory: true);
    try {
      final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>(
            '/api/marquee/memory',
          );
      final rawRules = (res.data?['rules'] as List?) ?? const [];
      state = state.copyWith(
        memoryRules: rawRules
            .whereType<Map>()
            .map((e) => MarqueeMemoryRule.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        isLoadingMemory: false,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMemory: false, errorMessage: e.toString());
    }
  }

  Future<void> deleteMemoryRule(String ruleId) async {
    ErpHaptics.selection();
    try {
      await ref.read(apiClientProvider).delete<Map<String, dynamic>>(
            '/api/marquee/memory/$ruleId',
          );
      state = state.copyWith(
        memoryRules: state.memoryRules.where((r) => r.id != ruleId).toList(),
      );
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
    }
  }

  void clearConversation() {
    ErpHaptics.selection();
    state = state.copyWith(messages: const [], clearError: true);
  }
}

final marqueeProvider = NotifierProvider<MarqueeNotifier, MarqueeState>(
  MarqueeNotifier.new,
);
