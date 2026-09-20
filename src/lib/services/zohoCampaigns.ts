// ZohoCampaigns service stub — Zoho integration is disabled in FirstHey.
// This file exists only to prevent build errors from legacy imports.
export class ZohoCampaignsService {
  static async getMailingLists(_credentials: any): Promise<any[]> {
    console.warn('[ZohoCampaigns] Zoho integration is disabled.');
    return [];
  }
  static async getTopics(_credentials: any): Promise<any[]> {
    return [];
  }
  static async createCampaign(_credentials: any, _payload: any): Promise<null> {
    return null;
  }
  static async addContactToCampaign(_credentials: any, _campaignKey: string, _contact: any): Promise<void> {}
  static async sendCampaign(_credentials: any, _campaignKey: string): Promise<void> {}
  static async fetchCampaignAnalytics(_credentials: any, _campaignName: string): Promise<any> {
    return null;
  }
  static async fetchCampaignRecipients(_credentials: any, _campaignKey: string, _type: 'open' | 'click'): Promise<any[]> {
    return [];
  }
}
