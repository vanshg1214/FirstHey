import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the user's organization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    
    const { data: orgUser } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();
      
    if (!orgUser?.organization_id) throw new Error('Organization not found');

    const orgId = orgUser.organization_id;

    const { searchParams } = new URL(req.url);
    const exhibitionFilter = searchParams.get('exhibition');

    // Fetch all exhibitions for the dropdown — scoped to this user's leads
    const { data: allExhibitionData } = await supabase
      .from('leads')
      .select('exhibition')
      .eq('captured_by', user.id)
      .not('exhibition', 'is', null);
    const exhibitionsList = Array.from(new Set((allExhibitionData || []).map(l => l.exhibition).filter(Boolean)));

    // Fetch leads for sentiment and volume — scoped to this user only
    let query = supabase
      .from('leads')
      .select('id, created_at, notes, status, open_count, is_opened, exhibition')
      .eq('captured_by', user.id);

    if (exhibitionFilter && exhibitionFilter !== 'all') {
      query = query.eq('exhibition', exhibitionFilter);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) throw leadsError;

    // Removed legacy followups query

    // --- Data Processing ---

    // 1. Leads by Date (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dateCounts: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateCounts[d.toISOString().split('T')[0]] = 0;
    }

    let positiveSentiment = 0;
    let neutralSentiment = 0;
    let negativeSentiment = 0;
    
    let totalHotLeads = 0;

    leads.forEach((lead: any) => {
      // Date grouping
      const dateStr = new Date(lead.created_at).toISOString().split('T')[0];
      if (dateCounts[dateStr] !== undefined) {
        dateCounts[dateStr]++;
      }

      // Sentiment (fallback to basic analysis of notes if needed)
      const sentiment = (lead.notes || '').toLowerCase();
      if (sentiment.includes('positive') || sentiment.includes('interested') || sentiment.includes('hot')) {
        positiveSentiment++;
      } else if (sentiment.includes('negative') || sentiment.includes('not interested') || sentiment.includes('spam')) {
        negativeSentiment++;
      } else if (sentiment) {
        neutralSentiment++;
      }

      if ((lead.open_count || 0) >= 2) totalHotLeads++;
    });

    const leadsByDate = Object.entries(dateCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      }));

    // 2. Email Stats
    // Sent: For now, assuming all captured leads receive an instant email.
    const emailsSent = leads.length;

    // Opened: Count leads where is_opened is true
    const uniqueLeadsOpened = leads.filter((l: any) => l.is_opened).length;
    const emailsOpened = leads.reduce((sum: number, l: any) => sum + (l.open_count || 0), 0);
    
    // Open rate = unique leads that opened / total leads
    const openRate = emailsSent > 0 ? Math.round((uniqueLeadsOpened / Math.max(emailsSent, 1)) * 100) : 0;

    return NextResponse.json({
      data: {
        totalLeads: leads.length,
        hotLeads: totalHotLeads,
        leadsByDate,
        availableExhibitions: exhibitionsList,
        sentiment: [
          { name: 'Positive', value: positiveSentiment, color: '#10b981' },
          { name: 'Neutral', value: neutralSentiment, color: '#94a3b8' },
          { name: 'Negative', value: negativeSentiment, color: '#ef4444' },
        ],
        emailStats: {
          sent: emailsSent,
          opened: emailsOpened,
          openRate
        }
      },
      error: null
    });
  } catch (error: any) {
    console.error('Analytics Error:', error);
    return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  }
}
