# 7-Step AI Drip Sequence Architecture

## Overview
This document outlines the proposed architecture for implementing a 7-step follow-up sequence where:
1. Every email touch (1 through 7) is uniquely written by the Apexora AI.
2. The sequence progresses based on **Email Open** behavior (e.g., only send Email 2 if Email 1 was opened).

There are two primary ways to architect this system alongside Zoho Campaigns.

---

## Option 1: Pre-generation Strategy (Recommended for simplicity)
*The AI writes all 7 emails at the moment the lead is captured, and Zoho handles the routing.*

### How it works:
1. **Lead Capture**: The user scans a card and uploads audio notes in Apexora.
2. **AI Processing**: Instead of generating just one `AI_Email_Body`, the system is instructed to instantly draft the entire 7-step sequence at once based on the context.
3. **Database Update**: The 7 emails are saved to Supabase (e.g., `ai_email_body_1`, `ai_email_body_2`, ..., `ai_email_body_7`).
4. **Zoho Sync**: All 7 text fields are synced to the contact in Zoho CRM.
5. **Zoho Campaigns Workflow**:
   - Send Email 1 (using Merge Tag `$[UD:AI_EMAIL_BODY_1]$`)
   - Wait [X] Days
   - **Condition**: Did the contact open Email 1?
     - *If Yes*: Send Email 2 (using Merge Tag `$[UD:AI_EMAIL_BODY_2]$`)
     - *If No*: Move to a different path or end sequence.
   - Wait [X] Days
   - **Condition**: Did the contact open Email 2?
     - *If Yes*: Send Email 3... (and so on).

### Pros:
- **Zero latency**: Because all emails are pre-written, there is no delay when Zoho is ready to send the next touch.
- **Visual Management**: The entire flow (waits and conditions) is built visually inside Zoho Campaigns, making it easy for non-developers to adjust timing and rules.

### Cons:
- **Compute Heavy**: The AI has to generate 7 emails for every single lead upfront, which uses more tokens and API time even if the lead never opens Email 1.

---

## Option 2: Dynamic Webhook Strategy (Advanced)
*The AI writes the next email "on the fly" only when it receives a signal that the previous email was opened.*

### How it works:
1. **Initial Send**: Apexora generates Email 1, pushes to Zoho, and Zoho sends it.
2. **Open Event**: The lead opens Email 1. Zoho Campaigns triggers a Webhook hitting our Apexora API (`/api/webhooks/zoho/campaigns`).
3. **AI Generation**: The Apexora webhook receives the "Opened" signal, looks up the lead, and the AI drafts Email 2 on the fly (knowing they just opened Email 1).
4. **Push to Zoho**: Apexora updates the Zoho CRM contact with `AI_Email_Body_2` and signals Zoho to send the next email in the workflow.

### Pros:
- **Cost Efficient**: You only spend AI tokens/API calls if the person actually opens the email.
- **Contextually Aware**: The AI can write the email knowing exactly *when* the user opened the previous one.

### Cons:
- **Complex Logic**: Requires writing and maintaining custom webhook receivers in Apexora.
- **Timing Risks**: If the AI API (Gemini/Claude) takes too long or errors out when the webhook fires, the next email might get delayed or sent blank.

---

## Next Steps for Implementation
When ready to build this:
1. Decide between Option 1 (Pre-generation) or Option 2 (Dynamic).
2. If Option 1: We will need to update the Supabase schema and Zoho CRM field mapping to support 7 custom email fields.
3. If Option 2: We will need to build the `process-followups` endpoint to securely receive Zoho webhook payloads and trigger the `sequencePersonalization` AI agent.
