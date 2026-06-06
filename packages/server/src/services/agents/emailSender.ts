interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  from: string;
}

export async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean; previewUrl?: string }> {
  const border = "─".repeat(60);
  console.log(`\n${border}`);
  console.log(`📧 TO:     ${msg.to}`);
  console.log(`   FROM:   ${msg.from}`);
  console.log(`   SUBJECT ${msg.subject}`);
  console.log(`${border}`);
  console.log(msg.body);
  console.log(`${border}\n`);
  return { sent: true };
}
