interface SheetLeadFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  description?: string;
  leadId?: string;
}

export class SheetsService {
  /**
   * Appends lead fields to the Google Sheet using a Google Apps Script Webhook.
   * This avoids needing complex Google Cloud Service Accounts.
   */
  public static async appendLead(fields: SheetLeadFields): Promise<{ crmRecordId: string }> {
    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error('GOOGLE_SHEET_WEBHOOK_URL is missing in environment variables. Please deploy the Apps Script and add the URL.');
    }

    const payload = {
      leadId: fields.leadId || '',
      timestamp: new Date().toISOString(),
      firstName: fields.firstName || '',
      lastName: fields.lastName || '',
      email: fields.email || '',
      phone: fields.phone || '',
      company: fields.company || '',
      title: fields.title || '',
      description: fields.description || '',
    };

    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Webhook returned status: ${response.status}`);
        }

        const data = await response.json().catch(() => ({}));
        
        if (data.status !== 'success') {
           throw new Error(data.message || 'Webhook did not return success status');
        }

        return { crmRecordId: `sheets:webhook-${Date.now()}` };
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw new Error('Failed to append lead to Google Sheet webhook after 3 retries.');
  }
}
