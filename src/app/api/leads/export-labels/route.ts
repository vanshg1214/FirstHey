import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  BorderStyle,
  convertMillimetersToTwip,
} from 'docx';

export const dynamic = 'force-dynamic';

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const MAX_ADDRESS_LINE_LENGTH = 42;

interface LabelCard {
  name: string;
  company: string;
  addressLines: string[];
  phone: string;
}

/**
 * Wraps a comma-separated address into short centered lines, similar to how
 * a printed mailing label naturally breaks (e.g. "First Floor, Malik Complex,"
 * / "Rohtak, Haryana 124001") rather than one long line per comma segment.
 */
function wrapAddress(address: string): string[] {
  const segments = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const lines: string[] = [];
  let current = '';

  for (const segment of segments) {
    const candidate = current ? `${current}, ${segment}` : segment;
    if (candidate.length > MAX_ADDRESS_LINE_LENGTH && current) {
      lines.push(`${current},`);
      current = segment;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}

function buildCard(lead: any): LabelCard {
  const contact = lead.contact_fields || {};
  const rawName = contact.name || lead.name || null;
  const name = rawName ? `Mr. ${rawName}` : 'Mr. Not publicly available';
  const company = contact.company || lead.company || '';
  const address = contact.address || lead.address || '';
  const phone = contact.phone || lead.phone || '';

  return {
    name,
    company,
    addressLines: address ? wrapAddress(address) : [],
    phone: phone ? `Ph. ${phone}` : '',
  };
}

function cardParagraphs(card: LabelCard): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: card.name, bold: true, size: 22 })],
    }),
  ];

  if (card.company) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: card.company, bold: true, size: 21 })],
      })
    );
  }

  card.addressLines.forEach((line, idx) => {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: idx === card.addressLines.length - 1 ? 40 : 0 },
        children: [new TextRun({ text: line, size: 20 })],
      })
    );
  });

  if (card.phone) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: card.phone, size: 20 })],
      })
    );
  }

  return paragraphs;
}

function emptyCell(): TableCell {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 300, bottom: 300, left: 200, right: 200 },
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
    children: [new Paragraph({ children: [] })],
  });
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { leadIds } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds is required and must be a non-empty array' }, { status: 400 });
    }

    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('id, name, company, phone, address, contact_fields')
      .in('id', leadIds)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);
    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'No matching leads found' }, { status: 404 });
    }

    const cards = leads.map(buildCard);

    const rows: TableRow[] = [];
    for (let i = 0; i < cards.length; i += 2) {
      const left = cards[i];
      const right = cards[i + 1];

      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 300, bottom: 300, left: 200, right: 200 },
              borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
              children: cardParagraphs(left),
            }),
            right ? new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 300, bottom: 300, left: 200, right: 200 },
              borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
              children: cardParagraphs(right),
            }) : emptyCell(),
          ],
        })
      );
    }

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: NO_BORDER,
        bottom: NO_BORDER,
        left: NO_BORDER,
        right: NO_BORDER,
        insideHorizontal: NO_BORDER,
        insideVertical: NO_BORDER,
      },
      rows,
    });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Calibri' },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: convertMillimetersToTwip(210),
                height: convertMillimetersToTwip(297),
              },
              margin: {
                top: convertMillimetersToTwip(15),
                bottom: convertMillimetersToTwip(15),
                left: convertMillimetersToTwip(12),
                right: convertMillimetersToTwip(12),
              },
            },
          },
          children: [table],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([Uint8Array.from(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="lead-labels-${new Date().toISOString().slice(0, 10)}.docx"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating label export:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate label document' }, { status: 500 });
  }
}
