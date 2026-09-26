import { esClient, EMAIL_INDEX, getEsStatus } from '../config/elasticsearch';
import { prisma } from '../config/db';

export interface EmailDoc {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  messageId?: string | null;
  createdAt: string;
}

export class ElasticService {
  /**
   * Index or update an email document in Elasticsearch
   */
  public static async indexEmail(doc: EmailDoc): Promise<void> {
    try {
      await esClient.index({
        index: EMAIL_INDEX,
        id: doc.id,
        body: doc,
        refresh: 'wait_for',
      });
    } catch (error) {
      if (getEsStatus()) {
        console.warn(`[Elasticsearch] Failed to index email ${doc.id}:`, (error as Error).message);
      }
    }
  }

  /**
   * Search emails in Elasticsearch across recipient, subject, body, status for a user
   */
  public static async searchEmails(
    userId: string,
    query: string,
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<{ emails: any[]; total: number; source: 'elasticsearch' | 'database' }> {
    const trimmedQuery = query.trim();

    if (getEsStatus()) {
      try {
        const mustClauses: any[] = [{ term: { userId: userId } }];

        if (status) {
          mustClauses.push({ term: { status: status.toUpperCase() } });
        }

        if (trimmedQuery) {
          mustClauses.push({
            bool: {
              should: [
                { match: { recipientEmail: { query: trimmedQuery, boost: 3 } } },
                { match: { subject: { query: trimmedQuery, boost: 2 } } },
                { match: { body: { query: trimmedQuery } } },
                { match: { senderEmail: { query: trimmedQuery } } },
                { wildcard: { recipientEmail: `*${trimmedQuery.toLowerCase()}*` } },
                { wildcard: { subject: `*${trimmedQuery.toLowerCase()}*` } },
              ],
              minimum_should_match: 1,
            },
          });
        }

        const response = await esClient.search({
          index: EMAIL_INDEX,
          from: offset,
          size: limit,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          sort: [{ scheduledAt: { order: 'desc' } }],
        });

        const hits = response.hits?.hits || [];
        const total = typeof response.hits?.total === 'number' ? response.hits.total : (response.hits?.total as any)?.value || 0;

        const emailIds = hits.map((h: any) => h._id);

        if (emailIds.length === 0) {
          return { emails: [], total: 0, source: 'elasticsearch' };
        }

        // Fetch full relational records from DB in the same order
        const dbEmails = await prisma.scheduledEmail.findMany({
          where: { id: { in: emailIds } },
          include: { sender: true, campaign: true },
        });

        // Preserve Elasticsearch sort order
        const emailMap = new Map(dbEmails.map((e) => [e.id, e]));
        const sorted = emailIds.map((id) => emailMap.get(id)).filter(Boolean);

        return {
          emails: sorted,
          total,
          source: 'elasticsearch',
        };
      } catch (err) {
        console.warn('[Elasticsearch] Search query failed, falling back to database query:', (err as Error).message);
      }
    }

    // Graceful fallback to database query if Elasticsearch is unavailable
    const whereClause: any = {
      userId,
      ...(status ? { status: status as any } : {}),
      ...(trimmedQuery
        ? {
            OR: [
              { recipientEmail: { contains: trimmedQuery, mode: 'insensitive' } },
              { subject: { contains: trimmedQuery, mode: 'insensitive' } },
              { body: { contains: trimmedQuery, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [emails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where: whereClause,
        include: { sender: true, campaign: true },
        orderBy: { scheduledAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.scheduledEmail.count({ where: whereClause }),
    ]);

    return {
      emails,
      total,
      source: 'database',
    };
  }
}
