import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'YOUR_RESEND_KEY_HERE');

async function testEmail() {
  console.log("Connecting to Resend API...");
  try {
    const data = await resend.emails.send({
      from: "Sales Team <onboarding@resend.dev>",
      to: "avrsmain@gmail.com",
      subject: "Test from AI CRM",
      text: "If you get this, the API works!",
    });
    console.log("Success! ID:", data);
  } catch (error) {
    console.error("Resend API failed:", error);
  }
}

testEmail();
