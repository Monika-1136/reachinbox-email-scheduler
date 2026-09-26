import { Client } from '@elastic/elasticsearch';
import { config } from './env';

export const EMAIL_INDEX = 'reachinbox-emails';

export const esClient = new Client({
  node: config.elasticsearchUrl,
  maxRetries: 3,
  requestTimeout: 5000,
});

let isEsAvailable = false;

export async function initElasticsearch(): Promise<boolean> {
  try {
    const health = await esClient.ping();
    if (health) {
      isEsAvailable = true;
      console.log('[Elasticsearch] Connected successfully at', config.elasticsearchUrl);
      await ensureEmailIndex();
      return true;
    }
  } catch (error) {
    isEsAvailable = false;
    console.warn('[Elasticsearch] Not reachable currently (' + (error as Error).message + '). Search will gracefully use database fallback.');
  }
  return false;
}

export function getEsStatus(): boolean {
  return isEsAvailable;
}

async function ensureEmailIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              senderEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text', analyzer: 'standard' },
              body: { type: 'text', analyzer: 'standard' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              messageId: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Index '${EMAIL_INDEX}' verified/created`);
    }
  } catch (err) {
    console.warn('[Elasticsearch] Could not create index:', (err as Error).message);
  }
}
