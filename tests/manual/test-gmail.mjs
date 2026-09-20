import nodemailer from 'nodemailer';

async function test() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'avrsmain@gmail.com',
      pass: 'ybcn jkdq lprc vxde',
    },
  });

  try {
    const info = await transporter.sendMail({
      from: 'Sales Team <avrsmain@gmail.com>',
      to: 'avrsmain@gmail.com', // testing to self
      subject: 'Test Nodemailer Gmail SMTP',
      text: 'This is a test from the AI CRM using your new app password!',
    });
    console.log('Success:', info.messageId);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
