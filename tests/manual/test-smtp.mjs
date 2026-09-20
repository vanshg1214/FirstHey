import nodemailer from 'nodemailer';

async function test() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: process.env.RESEND_API_KEY || 'your-resend-api-key-here',
    },
  });

  try {
    const info = await transporter.sendMail({
      from: 'Sales Team <onboarding@resend.dev>',
      to: 'avrsmain@gmail.com',
      subject: 'Test Nodemailer Resend SMTP',
      text: 'This is a test.',
    });
    console.log('Success:', info.messageId);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
