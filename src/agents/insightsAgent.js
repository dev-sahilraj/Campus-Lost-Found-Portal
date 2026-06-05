/**
 * AI Insights Agent — Upgraded
 * Generates categorized, actionable insights with severity levels.
 */
import { groqChat } from '../lib/groq';

const SYSTEM_PROMPT = `You are a senior data analyst AI for a university campus Lost & Found system.
Analyze the statistics provided and generate exactly 8 categorized insights.

Return a JSON array of exactly 8 objects with this structure:
[
  {
    "category": "hotspot" | "trend" | "performance" | "recommendation" | "warning" | "achievement",
    "title": "short title (3-6 words)",
    "insight": "one punchy, data-driven sentence",
    "severity": "high" | "medium" | "low"
  }
]

Rules:
- Include 2 hotspot insights (location/category patterns)
- Include 2 trend insights (monthly/time-based)
- Include 2 performance insights (recovery rate, match accuracy)
- Include 2 recommendations (what admins should do)
- Be specific with numbers
- Only return the JSON array. No markdown, no extra text.`;

export const runInsightsAgent = async (stats) => {
  const prompt = `Analyze these Lost & Found statistics and generate 8 categorized insights:

OVERVIEW:
- Total Lost Items: ${stats.totalLost}
- Total Found Items: ${stats.totalFound}
- Total AI Matches: ${stats.totalMatches}
- Resolved Cases: ${stats.resolved}
- Active Cases: ${stats.active}
- Recovery Rate: ${stats.recoveryRate}%
- Avg AI Confidence: ${stats.avgConfidence}%
- Confirmed Matches: ${stats.confirmedMatches || 0}
- Approved Claims: ${stats.approvedClaims || 0}
- Pending Claims: ${stats.pendingClaims || 0}

TOP LOST CATEGORIES (by volume):
${(stats.topCategories || []).map((c, i) => `${i + 1}. ${c.name}: ${c.count} items`).join('\n')}

TOP LOSS HOTSPOTS:
${(stats.topLocations || []).map((l, i) => `${i + 1}. ${l.name}: ${l.count} items`).join('\n')}

MONTHLY TREND (last 6 months):
${(stats.monthlyTrend || []).map(m => `${m.month}: ${m.lost} lost, ${m.found} found`).join('\n')}

AI MATCH CONFIDENCE DISTRIBUTION:
${(stats.confBuckets || []).map(b => `${b.range}: ${b.count} matches`).join('\n')}

RESOLUTION TIME:
- Avg Days to Resolve: ${stats.avgResolutionDays || 'N/A'}
- Fast Resolutions (<3 days): ${stats.fastResolutions || 0}
- Slow Resolutions (>7 days): ${stats.slowResolutions || 0}

USER ENGAGEMENT:
- New Users This Month: ${stats.newUsersThisMonth || 0}
- Active Users: ${stats.activeUsers || 0}
- Claim Submission Rate: ${stats.claimRate || 0}%

Return only the JSON array of 8 insight objects.`;

  try {
    const content = await groqChat(
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      'llama3-8b-8192', 0.5
    );
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const insights = JSON.parse(cleaned);
    console.log('[InsightsAgent] Generated', insights.length, 'insights');
    return { success: true, insights };
  } catch (err) {
    console.error('[InsightsAgent] Error:', err.message);
    // Intelligent fallback based on real data
    return {
      success: false,
      insights: [
        { category: 'hotspot', title: 'Top Loss Location', severity: 'high',
          insight: `${stats.topLocations?.[0]?.name || 'Library'} is the #1 loss hotspot with ${stats.topLocations?.[0]?.count || 0} reported items.` },
        { category: 'hotspot', title: 'Dominant Category', severity: 'medium',
          insight: `${stats.topCategories?.[0]?.name || 'Electronics'} leads all lost categories at ${stats.topCategories?.[0]?.count || 0} items.` },
        { category: 'performance', title: 'Recovery Rate', severity: stats.recoveryRate < 30 ? 'high' : 'low',
          insight: `Recovery rate stands at ${stats.recoveryRate}% — ${stats.recoveryRate > 50 ? 'strong performance' : 'significant improvement opportunity'}.` },
        { category: 'performance', title: 'AI Match Accuracy', severity: 'low',
          insight: `AI matching engine maintains ${stats.avgConfidence}% average confidence across ${stats.totalMatches} generated matches.` },
        { category: 'trend', title: 'Recent Activity', severity: 'medium',
          insight: `${(stats.monthlyTrend?.slice(-1)[0]?.lost || 0)} items reported lost in the most recent month with ${(stats.monthlyTrend?.slice(-1)[0]?.found || 0)} found.` },
        { category: 'trend', title: 'Resolution Progress', severity: 'low',
          insight: `${stats.resolved} of ${stats.totalLost + stats.totalFound} cases resolved — ${stats.active} still active awaiting owner action.` },
        { category: 'recommendation', title: 'Claims Need Review', severity: stats.pendingClaims > 5 ? 'high' : 'medium',
          insight: `${stats.pendingClaims || 0} claims are pending admin review — prompt action improves user trust and recovery rate.` },
        { category: 'achievement', title: 'Platform Impact', severity: 'low',
          insight: `${stats.confirmed || stats.confirmedMatches || 0} confirmed matches mean real reunions between owners and their lost belongings.` },
      ]
    };
  }
};
