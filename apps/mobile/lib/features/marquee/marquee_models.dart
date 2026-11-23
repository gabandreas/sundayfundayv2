class MarqueeStatusFrame {
  final String phase;
  final String label;
  final String detail;
  final String timestamp;

  const MarqueeStatusFrame({
    required this.phase,
    required this.label,
    required this.detail,
    required this.timestamp,
  });

  factory MarqueeStatusFrame.fromJson(Map<String, dynamic> json) {
    return MarqueeStatusFrame(
      phase: json['phase']?.toString() ?? 'THINKING',
      label: json['label']?.toString() ?? 'Processing...',
      detail: json['detail']?.toString() ?? '',
      timestamp: json['timestamp']?.toString() ?? '',
    );
  }
}

class MarqueeAgentStep {
  final String id;
  final String label;
  final String detail;
  final String status;
  final int? durationMs;

  const MarqueeAgentStep({
    required this.id,
    required this.label,
    required this.detail,
    required this.status,
    this.durationMs,
  });

  factory MarqueeAgentStep.fromJson(Map<String, dynamic> json) {
    return MarqueeAgentStep(
      id: json['id']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      detail: json['detail']?.toString() ?? '',
      status: json['status']?.toString() ?? 'done',
      durationMs: (json['durationMs'] as num?)?.round(),
    );
  }
}

class MarqueeCardItem {
  final String label;
  final String value;
  final String tone;

  const MarqueeCardItem({
    required this.label,
    required this.value,
    this.tone = 'default',
  });

  factory MarqueeCardItem.fromJson(Map<String, dynamic> json) {
    return MarqueeCardItem(
      label: json['label']?.toString() ?? '',
      value: json['value']?.toString() ?? '',
      tone: json['tone']?.toString() ?? 'default',
    );
  }
}

class MarqueePendingAction {
  final String type;
  final String? title;
  final Map<String, dynamic> payload;

  const MarqueePendingAction({
    required this.type,
    this.title,
    required this.payload,
  });

  Map<String, dynamic> toJson() => {
        'type': type,
        if (title != null) 'title': title,
        'payload': payload,
      };

  factory MarqueePendingAction.fromJson(Map<String, dynamic> json) {
    return MarqueePendingAction(
      type: json['type']?.toString() ?? 'CONFIRM_EXPENSE',
      title: json['title']?.toString(),
      payload: Map<String, dynamic>.from((json['payload'] as Map?) ?? const {}),
    );
  }
}

class MarqueeProactiveReminder {
  final String id;
  final String tone;
  final String text;
  final String prompt;

  const MarqueeProactiveReminder({
    required this.id,
    required this.tone,
    required this.text,
    required this.prompt,
  });

  factory MarqueeProactiveReminder.fromJson(Map<String, dynamic> json) {
    return MarqueeProactiveReminder(
      id: json['id']?.toString() ?? '',
      tone: json['tone']?.toString() ?? 'default',
      text: json['text']?.toString() ?? '',
      prompt: json['prompt']?.toString() ?? '',
    );
  }
}

class MarqueeMemoryRule {
  final String id;
  final String ruleText;
  final String? merchantPattern;
  final String? defaultInstrument;
  final String createdAt;

  const MarqueeMemoryRule({
    required this.id,
    required this.ruleText,
    this.merchantPattern,
    this.defaultInstrument,
    required this.createdAt,
  });

  factory MarqueeMemoryRule.fromJson(Map<String, dynamic> json) {
    return MarqueeMemoryRule(
      id: json['id']?.toString() ?? '',
      ruleText: json['ruleText']?.toString() ?? '',
      merchantPattern: json['merchantPattern']?.toString(),
      defaultInstrument: json['defaultInstrument']?.toString(),
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }
}

class MarqueeMessage {
  final String id;
  final bool isUser;
  final String summary;
  final List<MarqueeCardItem> cards;
  final List<MarqueeAgentStep> agentSteps;
  final MarqueePendingAction? pendingAction;
  final bool actionExecuted;
  final String? modelLabel;

  const MarqueeMessage({
    required this.id,
    required this.isUser,
    required this.summary,
    this.cards = const [],
    this.agentSteps = const [],
    this.pendingAction,
    this.actionExecuted = false,
    this.modelLabel,
  });

  MarqueeMessage copyWith({bool? actionExecuted}) {
    return MarqueeMessage(
      id: id,
      isUser: isUser,
      summary: summary,
      cards: cards,
      agentSteps: agentSteps,
      pendingAction: pendingAction,
      actionExecuted: actionExecuted ?? this.actionExecuted,
      modelLabel: modelLabel,
    );
  }

  factory MarqueeMessage.fromApiResponse(
    String id,
    Map<String, dynamic> data,
  ) {
    final rawCards = (data['cards'] as List?) ?? const [];
    final rawSteps = (data['agentSteps'] as List?) ?? const [];
    final rawPending = data['pendingAction'];

    return MarqueeMessage(
      id: id,
      isUser: false,
      summary: (data['summary'] ?? data['assistantPrefix'] ?? '').toString(),
      cards: rawCards
          .whereType<Map>()
          .map((e) => MarqueeCardItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      agentSteps: rawSteps
          .whereType<Map>()
          .map((e) => MarqueeAgentStep.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      pendingAction: rawPending is Map
          ? MarqueePendingAction.fromJson(Map<String, dynamic>.from(rawPending))
          : null,
      actionExecuted: false,
      modelLabel: data['model']?.toString(),
    );
  }
}
