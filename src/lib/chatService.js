import { supabase } from '../lib/supabase';

/**
 * Get or create a conversation between two users.
 * Checks both participant orderings to avoid duplicates.
 */
export const getOrCreateConversation = async ({
  lostItemId,
  foundItemId,
  participant1,
  participant2,
}) => {
  try {
    // Search for existing conversation between these two users (either direction)
    const { data: existing, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${participant1},participant_1.eq.${participant2}`)
      .or(`participant_2.eq.${participant1},participant_2.eq.${participant2}`);

    if (fetchError) throw fetchError;

    // Find one where both participants match (either order)
    const found = (existing || []).find(c =>
      (c.participant_1 === participant1 && c.participant_2 === participant2) ||
      (c.participant_1 === participant2 && c.participant_2 === participant1)
    );

    if (found) return found;

    // Create new conversation
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert([{
        lost_item_id: lostItemId || null,
        found_item_id: foundItemId || null,
        participant_1: participant1,
        participant_2: participant2,
        last_message: null,
        last_message_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (createError) throw createError;
    return newConv;
  } catch (err) {
    console.error('[chatService] getOrCreateConversation error:', err);
    throw err;
  }
};

/**
 * Fetch all conversations for the logged-in user
 */
export const fetchMyConversations = async (userId) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const otherUserIds = [...new Set(data.map(c =>
    c.participant_1 === userId ? c.participant_2 : c.participant_1
  ))];
  const lostIds = [...new Set(data.map(c => c.lost_item_id).filter(Boolean))];
  const foundIds = [...new Set(data.map(c => c.found_item_id).filter(Boolean))];

  const [usersRes, lostRes, foundRes] = await Promise.all([
    supabase.from('users').select('id, name, email').in('id', otherUserIds),
    lostIds.length > 0 ? supabase.from('lost_items').select('id, title, image_url').in('id', lostIds) : { data: [] },
    foundIds.length > 0 ? supabase.from('found_items').select('id, title, image_url').in('id', foundIds) : { data: [] },
  ]);

  const usersMap = Object.fromEntries((usersRes.data || []).map(u => [u.id, u]));
  const lostMap = Object.fromEntries((lostRes.data || []).map(i => [i.id, i]));
  const foundMap = Object.fromEntries((foundRes.data || []).map(i => [i.id, i]));

  return data.map(conv => ({
    ...conv,
    otherUser: usersMap[conv.participant_1 === userId ? conv.participant_2 : conv.participant_1] || {},
    lostItem: lostMap[conv.lost_item_id] || null,
    foundItem: foundMap[conv.found_item_id] || null,
  }));
};

/**
 * Fetch messages for a specific conversation
 */
export const fetchMessages = async (conversationId) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Send a message and update conversation preview
 */
export const sendMessage = async ({ conversationId, senderId, receiverId, message }) => {
  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert([{
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      message,
      is_read: false,
    }])
    .select()
    .single();

  if (msgError) throw msgError;

  // Update conversation last message preview
  await supabase
    .from('conversations')
    .update({ last_message: message, last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  // Send a notification to the receiver
  await supabase.from('notifications').insert([{
    user_id: receiverId,
    message: `💬 New message: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`,
    is_read: false,
  }]);

  return msg;
};

/**
 * Mark all messages in a conversation as read
 */
export const markMessagesAsRead = async (conversationId, userId) => {
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .eq('receiver_id', userId)
    .eq('is_read', false);
};

/**
 * Get total unread message count for a user
 */
export const getUnreadMessageCount = async (userId) => {
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('is_read', false);
  return count || 0;
};
