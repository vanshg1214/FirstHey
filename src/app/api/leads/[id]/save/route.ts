import { NextRequest, NextResponse } from 'next/server';
import { LeadsRepository } from '@/lib/repositories/leads';
import { CampaignsRepository } from '@/lib/repositories/campaigns';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { contactFields, cardImage, confidence, campaignId, exhibition, stall } = body;
    // Use admin client for all database operations to bypass RLS
    const supabase = supabaseAdmin;

    // 0. Update event tracking (E1 S1 feature)
    if (exhibition || stall) {
      await LeadsRepository.updateEventTracking(supabase, id, exhibition || null, stall || null);
    }

    // 1. Update contact fields if provided
    if (contactFields) {
      await LeadsRepository.updateContactFields(supabase, id, contactFields, 'confirmed');
    }

    // 2. Associate card scan if a new business card image is uploaded
    if (cardImage) {
      let imageUrl = cardImage; // Default fallback to base64 data URI
      
      try {
        // Parse base64 string to buffer
        let mimeType = 'image/jpeg';
        let base64Data = cardImage;
        const matches = cardImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const extension = mimeType.split('/')[1] || 'jpg';
        const fileName = `${id}_card.${extension}`;
        
        // Attempt upload to Supabase Storage 'card-scans' bucket
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const { data, error } = await supabaseAdmin.storage
            .from('card-scans')
            .upload(fileName, buffer, {
              contentType: mimeType,
              cacheControl: '3600',
              upsert: true, // Upsert if existing
            });

          if (!error && data) {
            const { data: { publicUrl } } = supabaseAdmin.storage
              .from('card-scans')
              .getPublicUrl(data.path);
            imageUrl = publicUrl;
          }
        }
      } catch (storageError) {
        console.warn('Card upload to Supabase Storage failed. Storing base64 data-URI fallback:', storageError);
      }

      // Save to database card_scans table
      await LeadsRepository.associateCardScan(
        supabase,
        id,
        imageUrl,
        contactFields || {},
        typeof confidence === 'number' ? confidence : 1.0
      );
    }

    // Campaigns removed for FirstHey minimal schema

    return NextResponse.json({
      data: { success: true },
      error: null,
    });
  } catch (error: any) {
    console.error('Error saving lead draft:', error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'SAVE_FAILED',
          message: error.message || 'An error occurred during save.',
        },
      },
      { status: 500 }
    );
  }
}
