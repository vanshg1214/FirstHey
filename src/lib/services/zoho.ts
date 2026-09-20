// Zoho service stub — Zoho integration is disabled in FirstHey.
// This file exists only to prevent build errors from legacy imports.
export class ZohoService {
  static async authenticate(_credentials: any): Promise<any> { return null; }
  static async createContact(_credentials: any, _contact: any): Promise<any> { return null; }
  static async updateContact(_credentials: any, _contactId: string, _data: any): Promise<any> { return null; }
}

export default ZohoService;
