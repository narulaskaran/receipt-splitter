import { type Receipt } from '@/types';

/**
 * Metadata about a parsed receipt that will be sent via webhook
 */
export interface ReceiptWebhookData {
  receipt: Receipt;
  fileUrl: string | null;
  sessionId: string;
  fileName: string;
  mimeType: string;
}

/**
 * Webhook payload formatter interface
 * Implement this to support different webhook formats (Slack, Discord, custom, etc.)
 */
export interface WebhookPayloadFormatter {
  /**
   * Format receipt data into a webhook payload
   */
  format(data: ReceiptWebhookData): Record<string, any>;
}

/**
 * Slack Block Kit payload formatter
 */
class SlackFormatter implements WebhookPayloadFormatter {
  format(data: ReceiptWebhookData): Record<string, any> {
    const { receipt, fileUrl, sessionId, fileName, mimeType } = data;

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📄 Receipt Parsed Successfully',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Restaurant:*\n${receipt.restaurant || 'Unknown'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Date:*\n${receipt.date || 'Unknown'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Total:*\n$${receipt.total?.toFixed(2) || '0.00'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Session ID:*\n\`${sessionId}\``,
          },
        ],
      },
    ];

    // Add breakdown section
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Subtotal:*\n$${receipt.subtotal?.toFixed(2) || '0.00'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Tax:*\n$${receipt.tax?.toFixed(2) || '0.00'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Tip:*\n$${receipt.tip?.toFixed(2) || '0.00'}`,
        },
      ],
    });

    // Add items list
    const itemsText = receipt.items
      .map(
        (item) =>
          `• ${item.name} - $${item.price.toFixed(2)}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`
      )
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Items (${receipt.items.length}):*\n${itemsText}`,
      },
    });

    // Add image if URL available
    if (fileUrl) {
      blocks.push({
        type: 'image',
        image_url: fileUrl,
        alt_text: 'Receipt image',
      });
    } else {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⚠️ _File upload failed - image not available_',
        },
      });
    }

    // Add context footer
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `File: ${fileName} (${mimeType})`,
        },
      ],
    });

    return {
      text: 'Receipt Parsed Successfully', // Fallback text
      blocks,
    };
  }
}

/**
 * Generic JSON payload formatter
 * Simple JSON format that can work with custom webhooks
 */
class GenericJsonFormatter implements WebhookPayloadFormatter {
  format(data: ReceiptWebhookData): Record<string, any> {
    const { receipt, fileUrl, sessionId, fileName, mimeType } = data;

    return {
      event: 'receipt_parsed',
      timestamp: new Date().toISOString(),
      sessionId,
      file: {
        url: fileUrl,
        name: fileName,
        mimeType,
      },
      receipt: {
        restaurant: receipt.restaurant,
        date: receipt.date,
        subtotal: receipt.subtotal,
        tax: receipt.tax,
        tip: receipt.tip,
        total: receipt.total,
        items: receipt.items.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      },
    };
  }
}

/**
 * Available webhook formatters
 */
const FORMATTERS: Record<string, WebhookPayloadFormatter> = {
  slack: new SlackFormatter(),
  json: new GenericJsonFormatter(),
};

/**
 * Webhook type - determines payload format
 */
export type WebhookType = 'slack' | 'json';

/**
 * Send webhook notification with receipt data
 *
 * This is a generic webhook sender that supports multiple formats.
 * Use environment variables to configure:
 * - WEBHOOK_URL: The webhook endpoint URL
 * - WEBHOOK_TYPE: Format type ('slack' or 'json', defaults to 'slack')
 *
 * @param receipt - Parsed receipt data from Claude
 * @param fileUrl - Public URL of uploaded receipt file (or null if upload failed)
 * @param sessionId - UUID session identifier
 * @param fileName - Original file name
 * @param mimeType - File MIME type
 */
export async function sendReceiptParsedNotification(
  receipt: Receipt,
  fileUrl: string | null,
  sessionId: string,
  fileName: string,
  mimeType: string
): Promise<void> {
  try {
    const webhookUrl = process.env.WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn('[Webhook] URL not configured, skipping notification');
      return;
    }

    // Determine webhook type from env var (defaults to 'slack' for backward compatibility)
    const webhookType = (process.env.WEBHOOK_TYPE || 'slack') as WebhookType;
    const formatter = FORMATTERS[webhookType];

    if (!formatter) {
      console.error(`[Webhook] Unknown webhook type: ${webhookType}`);
      return;
    }

    // Format the payload
    const data: ReceiptWebhookData = {
      receipt,
      fileUrl,
      sessionId,
      fileName,
      mimeType,
    };
    const payload = formatter.format(data);

    console.log('[Webhook] Sending notification...', {
      type: webhookType,
      sessionId,
      restaurant: receipt.restaurant,
    });

    // Create timeout signal (with fallback for environments that don't support AbortSignal.timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Webhook request failed: ${response.status} ${response.statusText}`
      );
    }

    console.log('[Webhook] Notification sent successfully');
  } catch (error) {
    console.error('[Webhook] Error sending notification (non-blocking):', error);
    // Fire-and-forget: don't throw
  }
}
