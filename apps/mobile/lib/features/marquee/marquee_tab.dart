import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import 'marquee_models.dart';
import 'marquee_provider.dart';

class MarqueeTab extends ConsumerStatefulWidget {
  const MarqueeTab({super.key});

  @override
  ConsumerState<MarqueeTab> createState() => _MarqueeTabState();
}

class _MarqueeTabState extends ConsumerState<MarqueeTab> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _sendCurrent() {
    final text = _inputController.text.trim();
    if (text.isEmpty) return;
    _inputController.clear();
    ref.read(marqueeProvider.notifier).sendPrompt(text);
  }

  Future<void> _openMemorySheet(BuildContext context, AppStrings strings) async {
    ErpHaptics.light();
    ref.read(marqueeProvider.notifier).loadMemoryRules();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
        side: BorderSide(color: AppColors.border),
      ),
      builder: (_) => Consumer(
        builder: (sheetCtx, ref, _) {
          final state = ref.watch(marqueeProvider);
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    strings.marqueeMemoryTitle,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (state.isLoadingMemory)
                    const ErpSkeletonBox(height: 56, radius: 8)
                  else if (state.memoryRules.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        'No saved rules yet.',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    )
                  else
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 280),
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: state.memoryRules.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, idx) {
                          final rule = state.memoryRules[idx];
                          return Material(
                            color: AppColors.surfaceSubtle,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                              side: const BorderSide(color: AppColors.border),
                            ),
                            child: ListTile(
                              dense: true,
                              title: Text(
                                rule.ruleText,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              subtitle: rule.defaultInstrument != null
                                  ? Text(
                                      rule.defaultInstrument!,
                                      style: const TextStyle(
                                        fontFamily: 'monospace',
                                        fontSize: 10,
                                        color: AppColors.textTertiary,
                                      ),
                                    )
                                  : null,
                              trailing: IconButton(
                                icon: const Icon(
                                  Icons.close,
                                  size: 18,
                                  color: AppColors.textSecondary,
                                ),
                                onPressed: () => ref
                                    .read(marqueeProvider.notifier)
                                    .deleteMemoryRule(rule.id),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<MarqueeState>(marqueeProvider, (prev, next) {
      if ((prev?.messages.length ?? 0) != next.messages.length ||
          (prev?.liveStatusSteps.length ?? 0) != next.liveStatusSteps.length) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollController.hasClients) {
            _scrollController.animateTo(
              _scrollController.position.maxScrollExtent,
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
            );
          }
        });
      }
    });

    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final state = ref.watch(marqueeProvider);

    final quickPrompts = state.proactiveReminders.isNotEmpty
        ? state.proactiveReminders.map((r) => r.prompt).toList()
        : const [
            'Check my safe-to-spend balance today',
            'When do my active installments finish?',
            'Simulate 3x installment for Rp 1.500.000',
          ];

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: const BoxDecoration(
            color: AppColors.surfaceSubtle,
            border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
          ),
          child: Row(
            children: [
              const Icon(Icons.terminal, size: 15, color: AppColors.positive),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  strings.marqueeTabLabel,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => _openMemorySheet(context, strings),
                icon: const Icon(Icons.bookmarks_outlined, size: 18),
                tooltip: strings.marqueeMemoryTitle,
                constraints: const BoxConstraints(minWidth: 44, minHeight: 40),
              ),
              if (state.messages.isNotEmpty)
                IconButton(
                  onPressed: () =>
                      ref.read(marqueeProvider.notifier).clearConversation(),
                  icon: const Icon(Icons.delete_sweep_outlined, size: 18),
                  constraints: const BoxConstraints(minWidth: 44, minHeight: 40),
                ),
            ],
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            itemCount: quickPrompts.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, idx) {
              final prompt = quickPrompts[idx];
              return ActionChip(
                label: Text(
                  prompt,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
                backgroundColor: AppColors.surface,
                side: const BorderSide(color: AppColors.border),
                onPressed: state.isStreaming
                    ? null
                    : () => ref.read(marqueeProvider.notifier).sendPrompt(prompt),
              );
            },
          ),
        ),
        Expanded(
          child: state.messages.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        strings.marqueeEmptyPrompt,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13,
                          height: 1.45,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  itemCount: state.messages.length,
                  itemBuilder: (context, idx) {
                    final msg = state.messages[idx];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: msg.isUser
                          ? _UserBubble(text: msg.summary)
                          : _AssistantCard(
                              message: msg,
                              strings: strings,
                              isBusy: state.isStreaming,
                              onConfirm: msg.pendingAction == null
                                  ? null
                                  : () => ref
                                      .read(marqueeProvider.notifier)
                                      .confirmPendingAction(
                                        msg.id,
                                        msg.pendingAction!,
                                      ),
                            ),
                    );
                  },
                ),
        ),
        if (state.errorMessage != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: ErpErrorBanner(message: state.errorMessage!),
          ),
        if (state.isStreaming)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: const BoxDecoration(
              color: AppColors.surfaceSubtle,
              border: Border(top: BorderSide(color: AppColors.borderSubtle)),
            ),
            child: Row(
              children: [
                const SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.8,
                    color: AppColors.positive,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    state.liveStatusSteps.isNotEmpty
                        ? '${state.liveStatusSteps.last.label} • ${state.liveStatusSteps.last.detail}'
                        : 'Thinking...',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          decoration: const BoxDecoration(
            color: AppColors.surfaceSubtle,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _inputController,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _sendCurrent(),
                  decoration: InputDecoration(
                    hintText: strings.marqueeInputHint,
                    hintStyle: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textTertiary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 48,
                height: 48,
                child: IconButton.filled(
                  onPressed: state.isStreaming ? null : _sendCurrent,
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.positive,
                    foregroundColor: AppColors.canvas,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.arrow_upward, size: 20),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _UserBubble extends StatelessWidget {
  final String text;

  const _UserBubble({required this.text});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 300),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceActive,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderStrong),
        ),
        child: Text(
          text,
          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
        ),
      ),
    );
  }
}

class _AssistantCard extends StatelessWidget {
  final MarqueeMessage message;
  final AppStrings strings;
  final bool isBusy;
  final VoidCallback? onConfirm;

  const _AssistantCard({
    required this.message,
    required this.strings,
    required this.isBusy,
    this.onConfirm,
  });

  Color _toneColor(String tone) {
    switch (tone.toLowerCase()) {
      case 'positive':
        return AppColors.positive;
      case 'caution':
        return AppColors.caution;
      case 'urgency':
        return AppColors.urgency;
      default:
        return AppColors.textPrimary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = message.pendingAction;

    return Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          _MarkdownInlineText(text: message.summary),
          if (message.cards.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final card in message.cards)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.borderSubtle),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          card.label.toUpperCase(),
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 9,
                            letterSpacing: 0.7,
                            color: AppColors.textTertiary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          card.value,
                          style: AppTheme.tabularMono.copyWith(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: _toneColor(card.tone),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
          if (message.agentSteps.isNotEmpty) ...[
            const SizedBox(height: 8),
            Theme(
              data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                tilePadding: EdgeInsets.zero,
                childrenPadding: const EdgeInsets.only(bottom: 4),
                dense: true,
                title: Text(
                  '${message.agentSteps.length} checks completed',
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: AppColors.textTertiary,
                  ),
                ),
                children: [
                  for (final step in message.agentSteps)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.check,
                            size: 13,
                            color: AppColors.positive,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              step.label,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                          if (step.durationMs != null)
                            Text(
                              '${step.durationMs}ms',
                              style: AppTheme.tabularMono.copyWith(
                                fontSize: 10,
                                color: AppColors.textTertiary,
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
          if (pending != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceSubtle,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: message.actionExecuted
                      ? AppColors.positive.withValues(alpha: 0.4)
                      : AppColors.borderStrong,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    pending.title ?? pending.type,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (message.actionExecuted)
                    Text(
                      strings.marqueeExecutedBadge,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.positive,
                      ),
                    )
                  else
                    SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        onPressed: isBusy ? null : onConfirm,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.positive,
                          foregroundColor: AppColors.canvas,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: Text(
                          strings.marqueeExecuteAction,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}


class _MarkdownInlineText extends StatelessWidget {
  final String text;

  const _MarkdownInlineText({required this.text});

  @override
  Widget build(BuildContext context) {
    final tokenRegex = RegExp(r'(\*\*[^*]+\*\*|`[^`]+`)');
    final spans = <InlineSpan>[];
    var cursor = 0;

    for (final match in tokenRegex.allMatches(text)) {
      if (match.start > cursor) {
        spans.add(TextSpan(text: text.substring(cursor, match.start)));
      }
      final raw = match.group(0)!;
      if (raw.startsWith('**') && raw.endsWith('**') && raw.length > 4) {
        spans.add(
          TextSpan(
            text: raw.substring(2, raw.length - 2),
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        );
      } else if (raw.startsWith('`') && raw.endsWith('`') && raw.length > 2) {
        spans.add(
          TextSpan(
            text: raw.substring(1, raw.length - 1),
            style: AppTheme.tabularMono.copyWith(
              fontSize: 12,
              color: AppColors.positive,
            ),
          ),
        );
      } else {
        spans.add(TextSpan(text: raw));
      }
      cursor = match.end;
    }

    if (cursor < text.length) {
      spans.add(TextSpan(text: text.substring(cursor)));
    }

    return Text.rich(
      TextSpan(
        style: const TextStyle(
          fontSize: 13,
          height: 1.48,
          color: AppColors.textSecondary,
        ),
        children: spans.isEmpty ? [TextSpan(text: text)] : spans,
      ),
    );
  }
}
