import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrgId } from '@/lib/auth';
import { EngagementService } from '@/lib/services/engagement';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const exhibition = new URL(req.url).searchParams.get('exhibition');
    const report = await EngagementService.buildReport(orgId, { exhibition });
    const { summary, leads } = report;

    // Lead sentiment, read from the notes the sales rep wrote.
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    for (const lead of leads) {
      const text = lead.notes.toLowerCase();
      if (!text) continue;
      if (text.includes('not interested') || text.includes('negative') || text.includes('spam')) negative++;
      else if (text.includes('positive') || text.includes('interested') || text.includes('hot')) positive++;
      else neutral++;
    }

    // Lead capture volume, last 30 days.
    const dateCounts: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateCounts[d.toISOString().split('T')[0]] = 0;
    }
    for (const lead of leads) {
      const key = lead.capturedAt ? new Date(lead.capturedAt).toISOString().split('T')[0] : '';
      if (dateCounts[key] !== undefined) dateCounts[key]++;
    }
    const leadsByDate = Object.entries(dateCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      }));

    const topLeads = [...leads]
      .filter(l => l.score > 0)
      .sort((a, b) => b.score - a.score || (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''))
      .slice(0, 10)
      .map(l => ({
        id: l.id,
        name: l.name,
        company: l.company,
        exhibition: l.exhibition,
        emailsSent: l.emailsSent,
        opens: l.uniqueOpens,
        clicks: l.uniqueClicks,
        replied: l.replied,
        score: l.score,
        level: l.level,
        lastActivityAt: l.lastActivityAt,
      }));

    return NextResponse.json({
      data: {
        totalLeads: summary.totalLeads,
        hotLeads: summary.hot,
        leadsByDate,
        availableExhibitions: report.exhibitions,
        sentiment: [
          { name: 'Positive', value: positive, color: '#10b981' },
          { name: 'Neutral', value: neutral, color: '#94a3b8' },
          { name: 'Negative', value: negative, color: '#ef4444' },
        ],
        emailStats: {
          sent: summary.emailsSent,
          opened: summary.openedLeads,
          openRate: summary.openRate,
        },
        summary,
        byTouch: report.byTouch,
        byExhibition: report.byExhibition,
        daily: report.daily,
        topLeads,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Analytics Error:', error);
    return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  }
}
