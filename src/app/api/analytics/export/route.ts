import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getCurrentUserOrgId } from '@/lib/auth';
import { EngagementService, SCORE_POINTS, type LeadEngagement } from '@/lib/services/engagement';

export const dynamic = 'force-dynamic';

const HEADER_FILL = 'FF1E293B'; // slate-800
const DATE_FMT = 'dd mmm yyyy, hh:mm';

const LEVEL_FILL: Record<string, { fill: string; font: string }> = {
  Hot: { fill: 'FFFEE2E2', font: 'FFB91C1C' },
  Warm: { fill: 'FFFEF3C7', font: 'FFB45309' },
  Interested: { fill: 'FFDBEAFE', font: 'FF1D4ED8' },
  'No activity': { fill: 'FFF1F5F9', font: 'FF64748B' },
};

const toDate = (iso: string | null) => (iso ? new Date(iso) : null);
const yesNo = (v: boolean) => (v ? 'Yes' : 'No');

function styleHeader(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });
}

function touchLabel(l: LeadEngagement, n: number): string {
  const t = l.touches[n];
  if (!t || !t.sentAt) return '';
  if (t.clicked) return 'Clicked';
  if (t.opened) return 'Opened';
  return 'Sent';
}

export async function GET(req: NextRequest) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const exhibition = new URL(req.url).searchParams.get('exhibition');
    const scope = exhibition && exhibition !== 'all' ? exhibition : 'All exhibitions';
    const report = await EngagementService.buildReport(orgId, { exhibition });
    const { summary } = report;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'FirstHey';
    wb.created = new Date();

    // ------------------------------------------------------------------ Leads
    const ws = wb.addWorksheet('Leads', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });

    const maxTouch = Math.min(
      27,
      report.leads.reduce((m, l) => Math.max(m, ...Object.keys(l.touches).map(Number), 0), 0)
    );

    // Lead details first, then engagement from most to least important.
    const columns: { header: string; width: number; value: (l: LeadEngagement) => any; fmt?: string }[] = [
      { header: 'Name', width: 22, value: l => l.name },
      { header: 'Company', width: 28, value: l => l.company },
      { header: 'Title', width: 22, value: l => l.title },
      { header: 'Email', width: 30, value: l => l.email },
      { header: 'Phone', width: 16, value: l => l.phone },
      { header: 'Exhibition', width: 24, value: l => l.exhibition },
      { header: 'Stall', width: 10, value: l => l.stall },
      { header: 'Interest', width: 13, value: l => l.level },
      { header: 'Score', width: 8, value: l => l.score },
      { header: 'Emails Sent', width: 11, value: l => l.emailsSent },
      { header: 'Emails Opened', width: 13, value: l => l.uniqueOpens },
      { header: 'Emails Clicked', width: 14, value: l => l.uniqueClicks },
      { header: 'Replied', width: 9, value: l => yesNo(l.replied) },
      { header: 'Last Activity', width: 20, value: l => toDate(l.lastActivityAt), fmt: DATE_FMT },
      { header: 'Sequence', width: 13, value: l => l.sequenceStatus },
      { header: 'First Email Sent', width: 20, value: l => toDate(l.firstSentAt), fmt: DATE_FMT },
      { header: 'Last Email Sent', width: 20, value: l => toDate(l.lastSentAt), fmt: DATE_FMT },
      { header: 'First Open', width: 20, value: l => toDate(l.firstOpenAt), fmt: DATE_FMT },
      { header: 'Total Opens', width: 11, value: l => l.opens },
      { header: 'Total Clicks', width: 11, value: l => l.clicks },
      { header: 'Captured On', width: 20, value: l => toDate(l.capturedAt), fmt: DATE_FMT },
      { header: 'Lead Status', width: 14, value: l => l.status },
      { header: 'Notes', width: 40, value: l => l.notes },
    ];
    for (let n = 1; n <= maxTouch; n++) {
      columns.push({ header: `Email ${n}`, width: 11, value: l => touchLabel(l, n) });
    }

    ws.columns = columns.map(c => ({ header: c.header, width: c.width }));
    styleHeader(ws.getRow(1));

    const ranked = [...report.leads].sort(
      (a, b) => b.score - a.score || (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '')
    );
    for (const lead of ranked) {
      const row = ws.addRow(columns.map(c => c.value(lead)));
      row.alignment = { vertical: 'middle' };
      columns.forEach((c, i) => {
        if (c.fmt) row.getCell(i + 1).numFmt = c.fmt;
      });

      const interest = row.getCell(columns.findIndex(c => c.header === 'Interest') + 1);
      const style = LEVEL_FILL[lead.level];
      interest.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
      interest.font = { bold: true, color: { argb: style.font } };

      for (let n = 1; n <= maxTouch; n++) {
        const cell = row.getCell(columns.findIndex(c => c.header === `Email ${n}`) + 1);
        const v = String(cell.value || '');
        if (v === 'Clicked') cell.font = { bold: true, color: { argb: 'FFB91C1C' } };
        else if (v === 'Opened') cell.font = { color: { argb: 'FF1D4ED8' } };
        else if (v === 'Sent') cell.font = { color: { argb: 'FF94A3B8' } };
      }
    }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

    // --------------------------------------------------------------- Summary
    const sm = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
    sm.columns = [{ width: 34 }, { width: 16 }, { width: 60 }];
    sm.getCell('A1').value = 'FirstHey Campaign Report';
    sm.getCell('A1').font = { bold: true, size: 16, color: { argb: HEADER_FILL } };
    sm.getCell('A2').value = `${scope}  ·  Generated ${new Date().toLocaleString('en-GB')}`;
    sm.getCell('A2').font = { color: { argb: 'FF64748B' } };

    const metrics: [string, number | string, string?][] = [
      ['Total leads', summary.totalLeads],
      ['Leads emailed', summary.emailed],
      ['Emails sent', summary.emailsSent],
      ['Leads who opened', summary.openedLeads, 'Open rate'],
      ['Leads who clicked the demo', summary.clickedLeads, 'Click rate'],
      ['Leads who replied', summary.repliedLeads, 'Reply rate'],
      ['Hot leads', summary.hot],
      ['Warm leads', summary.warm],
      ['Unsubscribed', summary.unsubscribed],
      ['Bounced', summary.bounced],
    ];
    sm.addRow([]);
    const mh = sm.addRow(['Metric', 'Value', 'Note']);
    styleHeader(mh);
    const rates: Record<string, number> = {
      'Leads who opened': summary.openRate,
      'Leads who clicked the demo': summary.clickRate,
      'Leads who replied': summary.replyRate,
    };
    for (const [label, value, rateLabel] of metrics) {
      const r = sm.addRow([label, value, rateLabel ? `${rateLabel}: ${rates[label]}% of leads emailed` : '']);
      r.getCell(2).alignment = { horizontal: 'left' };
      r.getCell(3).font = { color: { argb: 'FF64748B' } };
    }

    sm.addRow([]);
    const sh = sm.addRow(['How the interest score works', 'Points', '']);
    styleHeader(sh);
    sm.addRow(['Opened an email (once per email)', SCORE_POINTS.open, '']);
    sm.addRow(['Clicked the demo link (once per email)', SCORE_POINTS.click, '']);
    sm.addRow(['Replied', SCORE_POINTS.reply, '']);
    const note = sm.addRow([
      'Hot: 10+   Warm: 5 to 9   Interested: 1 to 4. Opens can be overcounted because mail apps pre-load images; clicks are the most reliable signal.',
    ]);
    sm.mergeCells(`A${note.number}:C${note.number}`);
    note.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    note.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
    note.height = 34;

    // ---------------------------------------------------------- By exhibition
    const bx = wb.addWorksheet('By Exhibition', { views: [{ state: 'frozen', ySplit: 1 }] });
    bx.columns = [
      { header: 'Exhibition', width: 30 },
      { header: 'Leads', width: 9 },
      { header: 'Emailed', width: 10 },
      { header: 'Emails Sent', width: 12 },
      { header: 'Opened', width: 10 },
      { header: 'Clicked', width: 10 },
      { header: 'Replied', width: 10 },
      { header: 'Hot Leads', width: 11 },
      { header: 'Open Rate', width: 11 },
      { header: 'Click Rate', width: 11 },
      { header: 'Reply Rate', width: 11 },
      { header: 'Avg Score', width: 11 },
    ];
    styleHeader(bx.getRow(1));
    for (const e of report.byExhibition) {
      const r = bx.addRow([
        e.name, e.leads, e.emailed, e.emailsSent, e.opened, e.clicked, e.replied, e.hot,
        e.openRate / 100, e.clickRate / 100, e.replyRate / 100, e.avgScore,
      ]);
      [9, 10, 11].forEach(c => (r.getCell(c).numFmt = '0%'));
    }

    // ----------------------------------------------------------------- By email
    const be = wb.addWorksheet('By Email', { views: [{ state: 'frozen', ySplit: 1 }] });
    be.columns = [
      { header: 'Email', width: 12 },
      { header: 'Sent', width: 10 },
      { header: 'Opened', width: 10 },
      { header: 'Clicked', width: 10 },
      { header: 'Open Rate', width: 12 },
      { header: 'Click Rate', width: 12 },
    ];
    styleHeader(be.getRow(1));
    for (const t of report.byTouch) {
      const r = be.addRow([`Email ${t.touch}`, t.sent, t.opened, t.clicked, t.openRate / 100, t.clickRate / 100]);
      [5, 6].forEach(c => (r.getCell(c).numFmt = '0%'));
    }

    const buffer = await wb.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10);
    const safeScope = scope.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    return new NextResponse(new Blob([buffer as ArrayBuffer]), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="firsthey-report-${safeScope}-${stamp}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating analytics export:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate report' }, { status: 500 });
  }
}
