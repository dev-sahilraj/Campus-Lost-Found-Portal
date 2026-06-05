/**
 * Agent 2: Matching Agent
 *
 * Compares a newly submitted item against existing items of the opposite type
 * from Supabase, and generates a weighted confidence score for each potential match.
 *
 * Scoring weights:
 *   - category match:    30 pts
 *   - color match:       20 pts
 *   - location match:    25 pts
 *   - title/keyword:     25 pts
 *
 * Any match scoring ≥ 40 is inserted into the `matches` table.
 */
import { supabase } from '../lib/supabase';

// Normalize strings for comparison
const normalize = (str) => (str || '').toLowerCase().trim();

// Simple keyword overlap score: returns 0–1
const keywordOverlap = (a, b) => {
  const wordsA = normalize(a).split(/\s+/).filter(w => w.length > 2);
  const wordsB = normalize(b).split(/\s+/).filter(w => w.length > 2);
  if (!wordsA.length || !wordsB.length) return 0;
  const intersection = wordsA.filter(w => wordsB.includes(w));
  return intersection.length / Math.max(wordsA.length, wordsB.length);
};

// Check if two location strings share any meaningful words
const locationSimilarity = (locA, locB) => {
  if (!locA || !locB) return 0;
  return keywordOverlap(locA, locB);
};

export const calculateConfidenceScore = (itemA, itemB) => {
  let score = 0;

  // Category match (30 pts)
  if (normalize(itemA.category) === normalize(itemB.category)) {
    score += 30;
  }

  // Color match (20 pts)
  const colorA = normalize(itemA.color);
  const colorB = normalize(itemB.color);
  if (colorA && colorB && (colorA.includes(colorB) || colorB.includes(colorA))) {
    score += 20;
  }

  // Location similarity (25 pts)
  const locSim = locationSimilarity(itemA.location, itemB.location);
  score += Math.round(locSim * 25);

  // Title + description keyword overlap (25 pts)
  const textA = `${itemA.title} ${itemA.description || ''}`;
  const textB = `${itemB.title} ${itemB.description || ''}`;
  const textSim = keywordOverlap(textA, textB);
  score += Math.round(textSim * 25);

  return Math.min(score, 100); // Cap at 100
};

export const runMatchingAgent = async (newItem, newItemType) => {
  try {
    console.log('[MatchingAgent] Starting for:', newItem.title, '| Type:', newItemType);

    // Fetch opposite type items
    const oppositeTable = newItemType === 'lost' ? 'found_items' : 'lost_items';
    const { data: candidates, error } = await supabase
      .from(oppositeTable)
      .select('*')
      .eq('status', 'active');

    if (error) throw error;
    if (!candidates || candidates.length === 0) {
      console.log('[MatchingAgent] No candidates found.');
      return [];
    }

    console.log(`[MatchingAgent] Comparing against ${candidates.length} candidates...`);

    const matches = [];

    for (const candidate of candidates) {
      const score = calculateConfidenceScore(newItem, candidate);
      console.log(`[MatchingAgent] "${newItem.title}" vs "${candidate.title}" → ${score}%`);

      if (score >= 40) {
        const matchRecord = {
          lost_item_id: newItemType === 'lost' ? newItem.id : candidate.id,
          found_item_id: newItemType === 'found' ? newItem.id : candidate.id,
          confidence_score: score,
          status: 'pending',
        };

        // Insert into matches table
        const { data: insertedMatch, error: insertError } = await supabase
          .from('matches')
          .insert([matchRecord])
          .select()
          .single();

        if (insertError) {
          console.error('[MatchingAgent] Failed to insert match:', insertError.message);
        } else {
          console.log(`[MatchingAgent] Match inserted with score ${score}:`, insertedMatch.id);
          matches.push({ ...insertedMatch, candidate });
        }
      }
    }

    console.log(`[MatchingAgent] Done. ${matches.length} match(es) stored.`);
    return matches;
  } catch (error) {
    console.error('[MatchingAgent] Error:', error.message);
    return [];
  }
};
