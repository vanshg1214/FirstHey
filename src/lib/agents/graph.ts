import { StateGraph, Annotation } from '@langchain/langgraph';
import { ContextExtractionAgent } from '@/lib/agents/contextExtraction';
import { CardOcrAgent } from '@/lib/agents/cardOcr';
import { FollowupDraftAgent } from '@/lib/agents/followupDraft';
import { ZohoService } from '@/lib/services/zoho';
import { SheetsService } from '@/lib/services/sheets';
import { LeadsRepository } from '@/lib/repositories/leads';
import { SettingsService } from '@/lib/services/settings';
import { supabaseAdmin } from '@/lib/supabase';

// Define the shared graph state using Annotation API
export const LeadCaptureStateAnnotation = Annotation.Root({
  leadId: Annotation<string | null>(),
  organizationId: Annotation<string>(),
  userId: Annotation<string | null>(),
  audioBuffer: Annotation<Buffer | null>(),
  audioMimeType: Annotation<string | null>(),
  cardImageBase64: Annotation<string | null>(),
  transcript: Annotation<string | null>(),
  context: Annotation<any | null>(),
  contactFields: Annotation<any | null>(),
  emailDraft: Annotation<any | null>(),
  crmRecordId: Annotation<string | null>(),
  syncSystem: Annotation<'zoho' | 'sheets' | 'none' | null>(),
  errorMessage: Annotation<string | null>(),
  settings: Annotation<any | null>(),
});

export type LeadCaptureState = typeof LeadCaptureStateAnnotation.State;

// Node 0: Fetch Organization Settings
async function fetchSettingsNode(state: LeadCaptureState) {
  if (!state.organizationId) {
    return { errorMessage: 'Organization ID is missing' };
  }
  try {
    const settings = await SettingsService.getSettings(state.organizationId);
    return { settings };
  } catch (error: any) {
    return { errorMessage: `Failed to fetch settings: ${error.message}` };
  }
}

// Node 1: Transcribe audio and extract conversation context
async function transcribeAndExtractNode(state: LeadCaptureState) {
  if (!state.audioBuffer || !state.audioMimeType) {
    return { errorMessage: 'Audio buffer or MIME type is missing' };
  }

  const apiKey = state.settings?.gemini_api_key;
  if (!apiKey) return { errorMessage: 'Gemini API key is missing in organization settings.' };

  try {
    const audioBase64 = state.audioBuffer.toString('base64');
    const context = await ContextExtractionAgent.extractContext(apiKey, audioBase64, state.audioMimeType);
    
    return {
      transcript: context.transcript,
      context,
    };
  } catch (error: any) {
    return { errorMessage: `Transcription/Extraction node failed: ${error.message}` };
  }
}

// Node 2: Scan business card using vision OCR
async function ocrCardNode(state: LeadCaptureState) {
  if (!state.cardImageBase64) {
    return { errorMessage: 'Card image data is missing' };
  }

  const apiKey = state.settings?.gemini_api_key;
  if (!apiKey) return { errorMessage: 'Gemini API key is missing in organization settings.' };

  try {
    const ocrResult = await CardOcrAgent.processCard(apiKey, state.cardImageBase64, 'image/jpeg');
    return {
      contactFields: {
        name: ocrResult.name,
        company: ocrResult.company,
        title: ocrResult.title,
        email: ocrResult.email,
        phone: ocrResult.phone,
      },
    };
  } catch (error: any) {
    return { errorMessage: `OCR node failed: ${error.message}` };
  }
}

// Node 3: Generate the first follow-up email draft
async function generateFollowupNode(state: LeadCaptureState) {
  if (!state.contactFields || !state.context) {
    return { errorMessage: 'Cannot generate draft: contact fields or context missing' };
  }

  const apiKey = state.settings?.gemini_api_key;
  if (!apiKey) return { errorMessage: 'Gemini API key is missing in organization settings.' };

  try {
    let exhibitionName = null;
    if (state.leadId) {
      const { data: leadData } = await supabaseAdmin.from('leads').select('exhibition, exhibition_id').eq('id', state.leadId).single();
      if (leadData) {
        exhibitionName = leadData.exhibition || null;
        if (leadData.exhibition_id) {
          const { data: exData } = await supabaseAdmin.from('exhibitions').select('name').eq('id', leadData.exhibition_id).single();
          if (exData) exhibitionName = exData.name;
        }
      }
    }

    const draft = await FollowupDraftAgent.generateDraft(
      apiKey,
      {
        name: state.contactFields.name,
        company: state.contactFields.company,
        title: state.contactFields.title,
      },
      {
        problem: state.context.problem,
        needs: state.context.needs,
        action_items: state.context.action_items || [],
        notable_quotes: state.context.notable_quotes || [],
      },
      'Sales Representative',
      exhibitionName
    );

    return { emailDraft: draft };
  } catch (error: any) {
    return { errorMessage: `Draft generation node failed: ${error.message}` };
  }
}




// Build the LangGraph State Graph
const workflow = new StateGraph(LeadCaptureStateAnnotation)
  .addNode('fetchSettings', fetchSettingsNode)
  .addNode('transcribeAndExtract', transcribeAndExtractNode)
  .addNode('ocrCard', ocrCardNode)
  .addNode('generateFollowup', generateFollowupNode);

// Define edges and transitions
workflow.addEdge('__start__', 'fetchSettings');
workflow.addEdge('fetchSettings', 'transcribeAndExtract');
workflow.addEdge('fetchSettings', 'ocrCard');

// Both OCR and Transcription branches converge on follow-up generation
workflow.addEdge('transcribeAndExtract', 'generateFollowup');
workflow.addEdge('ocrCard', 'generateFollowup');

workflow.addEdge('generateFollowup', '__end__');

// Compile the orchestrator
export const leadCaptureGraph = workflow.compile();
