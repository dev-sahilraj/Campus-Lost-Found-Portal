/**
 * Agent Pipeline Orchestrator — with full AgentBus instrumentation
 */
import { runItemAnalysisAgent } from './itemAnalysisAgent';
import { runMatchingAgent }     from './matchingAgent';
import { runNotificationAgent } from './notificationAgent';
import { agentBus, AGENT_STATUS } from './agentBus';

const emit = (agent, status, message, data) =>
  agentBus.emit({ agent, status, message, data });

export const runAgentPipeline = async (newItem, itemType, onProgress, sessionId) => {
  const results = { analysis: null, matches: [], notifications: [], errors: [] };
  const session = sessionId || `session_${Date.now()}`;

  const progress = (msg, step) => {
    console.log(`[Pipeline] ${msg}`);
    if (onProgress) onProgress({ message: msg, step });
  };

  try {
    // ── PIPELINE START ──────────────────────────────────────────────────
    emit('Pipeline', AGENT_STATUS.START,
      `🧠 Agentic pipeline started for "${newItem.title}"`, { itemType, session });
    progress('🤖 Agent pipeline started...', 0);

    // ── Step 1: Item Analysis Agent ─────────────────────────────────────
    progress('🤖 Agent 1: Analyzing item with AI...', 1);
    emit('ItemAnalysisAgent', AGENT_STATUS.RUNNING,
      `Analyzing item: "${newItem.title}" — extracting category, color, keywords...`);

    const analysisResult = await runItemAnalysisAgent(newItem.title, newItem.description || '');

    if (analysisResult.success) {
      results.analysis = analysisResult.data;
      emit('ItemAnalysisAgent', AGENT_STATUS.SUCCESS,
        `Extracted: Category=${analysisResult.data.category}, Color=${analysisResult.data.color}, Keywords=[${(analysisResult.data.keywords||[]).join(', ')}]`,
        analysisResult.data);
      progress(`✅ Analysis complete: ${analysisResult.data.category}`, 1);
    } else {
      emit('ItemAnalysisAgent', AGENT_STATUS.WARNING,
        `Analysis skipped — ${analysisResult.error}. Pipeline continues.`);
      results.errors.push(`ItemAnalysisAgent: ${analysisResult.error}`);
      progress('⚠️ Item analysis skipped', 1);
    }

    // ── Step 2: Matching Agent ──────────────────────────────────────────
    progress('🔍 Agent 2: Searching for matching items...', 2);
    emit('MatchingAgent', AGENT_STATUS.RUNNING,
      `Scanning ${itemType === 'lost' ? 'found_items' : 'lost_items'} database for matches...`);

    const matches = await runMatchingAgent(newItem, itemType);
    results.matches = matches;

    if (matches.length > 0) {
      const top = matches[0];
      emit('MatchingAgent', AGENT_STATUS.SUCCESS,
        `Found ${matches.length} potential match(es)! Top match: "${top.candidate?.title}" at ${top.confidence_score}% confidence.`,
        { matchCount: matches.length, topScore: top.confidence_score });
      progress(`✅ Found ${matches.length} match(es)!`, 2);
    } else {
      emit('MatchingAgent', AGENT_STATUS.INFO,
        'No matches found in current database. Will re-check when new items are added.');
      progress('ℹ️ No matches found.', 2);
    }

    // ── Step 3: Notification Agent ──────────────────────────────────────
    if (matches.length > 0) {
      const highConf = matches.filter(m => m.confidence_score >= 80);
      progress('🔔 Agent 3: Sending notifications...', 3);
      emit('NotificationAgent', AGENT_STATUS.RUNNING,
        `Processing ${matches.length} match(es). Sending alerts for ${highConf.length} high-confidence match(es) (≥80%)...`);

      const notifications = await runNotificationAgent(matches, newItem, itemType);
      results.notifications = notifications;

      if (notifications.length > 0) {
        emit('NotificationAgent', AGENT_STATUS.SUCCESS,
          `Sent ${notifications.length} real-time notification(s) to item owners.`,
          { notificationCount: notifications.length });
      } else {
        emit('NotificationAgent', AGENT_STATUS.INFO,
          'No high-confidence matches (≥80%) — notifications skipped to avoid false alerts.');
      }
      progress(`✅ Sent ${notifications.length} notification(s).`, 3);
    }

    // ── PIPELINE COMPLETE ───────────────────────────────────────────────
    emit('Pipeline', AGENT_STATUS.SUCCESS,
      `✅ Pipeline complete! ${results.matches.length} match(es) found, ${results.notifications.length} notification(s) sent.`,
      { matches: results.matches.length, notifications: results.notifications.length });
    progress('🎉 AI pipeline complete!', 4);

    return results;
  } catch (error) {
    emit('Pipeline', AGENT_STATUS.ERROR, `Fatal pipeline error: ${error.message}`);
    console.error('[Pipeline] Fatal error:', error);
    results.errors.push(`Pipeline: ${error.message}`);
    return results;
  }
};
