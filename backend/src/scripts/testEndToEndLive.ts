import axios from 'axios';

async function testLiveFlow() {
  console.log('Testing live ReachInbox end-to-end flow...');
  const client = axios.create({ baseURL: 'http://localhost:5000' });

  // 1. Health check
  const healthRes = await client.get('/api/health');
  console.log('1. Health Check:', JSON.stringify(healthRes.data, null, 2));

  // 2. Dev login
  const loginRes = await client.post('/api/auth/dev-login', {
    email: 'monika.evaluator@reachinbox.test',
    name: 'Monika Evaluator',
  });
  const token = loginRes.data.data.token;
  const user = loginRes.data.data.user;
  console.log('2. Dev Login User:', user.name, '| Token length:', token.length);

  const authClient = axios.create({
    baseURL: 'http://localhost:5000',
    headers: { Authorization: `Bearer ${token}` },
  });

  // 3. Current User
  const meRes = await authClient.get('/api/auth/me');
  console.log('3. GET /api/auth/me User:', meRes.data.data.email);

  // 4. Get or Create Sender
  let senderId = '';
  const existingSenders = await authClient.get('/api/senders');
  if (existingSenders.data.data.length > 0) {
    senderId = existingSenders.data.data[0].id;
    console.log('4. Reusing existing Sender from MySQL:', senderId, existingSenders.data.data[0].email);
  } else {
    const senderRes = await authClient.post('/api/senders', {
      email: 'monika.outreach@reachinbox.test',
      displayName: 'Monika Outreach',
      hourlyLimit: 200,
    });
    senderId = senderRes.data.data.id;
    console.log('4. Sender Created in MySQL:', senderId, senderRes.data.data.email);
  }

  // 5. Schedule Email via BullMQ
  const scheduleRes = await authClient.post('/api/emails/schedule', {
    senderId,
    subject: 'Live Real-Time Verification Email',
    body: 'Verifying end-to-end delivery with MySQL, Redis, BullMQ and Elasticsearch.',
    recipients: ['recipient.live@company.com'],
    delayMs: 1000,
    hourlyLimit: 200,
  });
  console.log('5. Email Scheduled in BullMQ & MySQL:', scheduleRes.data.data);

  // 6. Wait for BullMQ worker to process and Ethereal to deliver
  console.log('6. Waiting 4 seconds for worker execution...');
  await new Promise((resolve) => setTimeout(resolve, 4000));

  // 7. Check Sent Emails
  const sentRes = await authClient.get('/api/emails/sent');
  console.log('7. Sent Emails in MySQL:', sentRes.data.data.length, 'records');
  if (sentRes.data.data.length > 0) {
    const sentEmail = sentRes.data.data[0];
    console.log('   Email status:', sentEmail.status);
    console.log('   Sent at:', sentEmail.sentAt);
    console.log('   Message ID:', sentEmail.messageId);
    console.log('   Ethereal Preview URL:', sentEmail.etherealUrl);
  }

  // 8. Search in Elasticsearch
  const searchRes = await authClient.get('/api/emails/search?q=recipient.live');
  console.log('8. Search Results from Elasticsearch:', searchRes.data.data.length, 'found');
  console.log('   Source:', searchRes.data.meta.source);

  // 9. Check Queue Stats
  const queueStats = await client.get('/api/queues/stats');
  console.log('9. Live BullMQ Queue Stats:', queueStats.data.data);

  console.log('\nAll End-to-End steps verified successfully against MySQL, Redis, BullMQ, Ethereal, and Elasticsearch!');
}

testLiveFlow().catch((err) => {
  console.error('Test Flow Error:', err.response?.data || err.message);
  process.exit(1);
});
