/**
 * Agent 3: Notification Agent
 *
 * Automatically fires when a match confidence score exceeds 80%.
 * Writes a structured notification to the Supabase `notifications` table
 * for the item owner to review.
 *
 * Notification format is AI-ready — future AI agents can query this table
 * and filter by `metadata->>'source'` = 'ai_matching_agent'.
 */
import { supabase } from '../lib/supabase';

const HIGH_CONFIDENCE_THRESHOLD = 80;

export const runNotificationAgent = async (matches, newItem, newItemType) => {
  const notifications = [];

  for (const match of matches) {
    if (match.confidence_score < HIGH_CONFIDENCE_THRESHOLD) continue;

    try {
      // Determine who to notify: the owner of the OPPOSITE item
      const ownerUserId = match.candidate?.user_id;
      if (!ownerUserId) {
        console.warn('[NotificationAgent] No user_id on candidate, skipping.');
        continue;
      }

      const matchedItemTitle = match.candidate?.title || 'your item';
      const newItemLabel = newItemType === 'lost' ? 'lost item report' : 'found item report';
      const message = `🔍 Possible match found! Your ${newItemLabel} "${matchedItemTitle}" may match a newly reported item: "${newItem.title}" — ${match.confidence_score}% confidence.`;

      const { data, error } = await supabase.from('notifications').insert([{
        user_id: ownerUserId,
        message,
        is_read: false,
        action_link: '/matches',
        action_label: 'View Matches'
      }]).select().single();

      if (error) {
        console.error('[NotificationAgent] Failed to insert notification:', error.message);
      } else {
        console.log(`[NotificationAgent] Notified user ${ownerUserId} with ${match.confidence_score}% match.`);
        notifications.push(data);
      }

      // Also notify the person who just submitted the new item (if they have an ID)
      if (newItem.user_id) {
        const myMessage = `🎯 AI found a potential match for your ${newItemType} item "${newItem.title}" with ${match.confidence_score}% confidence. Check the Match Center!`;
        await supabase.from('notifications').insert([{
          user_id: newItem.user_id,
          message: myMessage,
          is_read: false,
          action_link: '/matches',
          action_label: 'View Matches'
        }]);
      }
    } catch (error) {
      console.error('[NotificationAgent] Error:', error.message);
    }
  }

  console.log(`[NotificationAgent] Sent ${notifications.length} notification(s).`);
  return notifications;
};
