import { sendReceiptParsedNotification } from './webhook-notifications';
import { type Receipt } from '@/types';

// Note: global.fetch is mocked in jest.setup.ts

describe('webhook-notifications', () => {
  beforeEach(() => {
    // Reset env vars for each test
    delete process.env.WEBHOOK_URL;
    delete process.env.WEBHOOK_TYPE;
    // Set default mock behavior for this test suite
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  });

  const mockReceipt: Receipt = {
    restaurant: 'Test Restaurant',
    date: '2026-01-10',
    subtotal: 20.0,
    tax: 2.0,
    tip: 3.0,
    total: 25.0,
    items: [
      { name: 'Burger', price: 10.0, quantity: 2 },
      { name: 'Fries', price: 5.0, quantity: 1 },
    ],
  };

  describe('sendReceiptParsedNotification', () => {
    describe('with Slack formatter (default)', () => {
      beforeEach(() => {
        process.env.WEBHOOK_URL = 'https://hooks.slack.com/test';
      });

      it('sends webhook with Slack Block Kit format', async () => {
        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        expect(global.fetch).toHaveBeenCalledWith(
          'https://hooks.slack.com/test',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        expect(callBody.text).toBe('Receipt Parsed Successfully');
        expect(callBody.blocks).toContainEqual(
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: '📄 Receipt Parsed Successfully',
            }),
          })
        );

        // Verify image block exists
        expect(callBody.blocks).toContainEqual(
          expect.objectContaining({
            type: 'image',
            image_url: 'https://example.com/receipt.jpg',
          })
        );

        // Verify items are formatted correctly
        interface SlackBlock {
          text?: { text?: string };
        }
        const itemsBlock = callBody.blocks.find(
          (b: SlackBlock) => b.text?.text?.includes('Items')
        ) as SlackBlock & { text: { text: string } };
        expect(itemsBlock.text.text).toContain('Burger - $10.00 (x2)');
        expect(itemsBlock.text.text).toContain('Fries - $5.00');
      });

      it('handles missing file URL gracefully', async () => {
        await sendReceiptParsedNotification(
          mockReceipt,
          null, // No file URL
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        // Should have warning section instead of image
        expect(callBody.blocks).toContainEqual(
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('File upload failed'),
            }),
          })
        );
      });

      it('shows link instead of image block for PDF files', async () => {
        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.pdf',
          'test-session-id',
          'receipt.pdf',
          'application/pdf',
          null
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        // Should NOT have an image block for PDFs
        expect(callBody.blocks).not.toContainEqual(
          expect.objectContaining({
            type: 'image',
          })
        );

        // Should have a section block with link to the PDF
        expect(callBody.blocks).toContainEqual(
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              type: 'mrkdwn',
              text: expect.stringContaining('View Receipt PDF'),
            }),
          })
        );
      });

      it('includes all receipt fields in Slack format', async () => {
        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        const bodyString = JSON.stringify(callBody);
        expect(bodyString).toContain('Test Restaurant');
        expect(bodyString).toContain('2026-01-10');
        expect(bodyString).toContain('$25.00'); // Total
        expect(bodyString).toContain('$20.00'); // Subtotal
        expect(bodyString).toContain('$2.00'); // Tax
        expect(bodyString).toContain('$3.00'); // Tip
        expect(bodyString).toContain('test-session-id');
      });
    });

    describe('with JSON formatter', () => {
      beforeEach(() => {
        process.env.WEBHOOK_URL = 'https://example.com/webhook';
        process.env.WEBHOOK_TYPE = 'json';
      });

      it('sends webhook with generic JSON format', async () => {
        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/webhook',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        expect(callBody).toMatchObject({
          event: 'receipt_parsed',
          sessionId: 'test-session-id',
          file: {
            url: 'https://example.com/receipt.jpg',
            name: 'receipt.jpg',
            mimeType: 'image/jpeg',
          },
          receipt: {
            restaurant: 'Test Restaurant',
            date: '2026-01-10',
            subtotal: 20.0,
            tax: 2.0,
            tip: 3.0,
            total: 25.0,
            items: [
              { name: 'Burger', price: 10.0, quantity: 2 },
              { name: 'Fries', price: 5.0, quantity: 1 },
            ],
          },
        });

        expect(callBody.timestamp).toBeDefined();
        expect(new Date(callBody.timestamp).getTime()).toBeGreaterThan(0);
      });

      it('handles null file URL in JSON format', async () => {
        await sendReceiptParsedNotification(
          mockReceipt,
          null,
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        expect(callBody.file.url).toBeNull();
      });
    });

    describe('error handling', () => {
      it('skips when webhook URL not configured', async () => {
        delete process.env.WEBHOOK_URL;

        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('handles unknown webhook type gracefully', async () => {
        process.env.WEBHOOK_URL = 'https://example.com/webhook';
        process.env.WEBHOOK_TYPE = 'unknown-type';

        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('handles fetch errors gracefully', async () => {
        process.env.WEBHOOK_URL = 'https://example.com/webhook';
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        // Should not throw
        await expect(
          sendReceiptParsedNotification(
            mockReceipt,
            'https://example.com/receipt.jpg',
            'test-session-id',
            'receipt.jpg',
            'image/jpeg',
            null
          )
        ).resolves.toBeUndefined();
      });

      it('handles HTTP errors gracefully', async () => {
        process.env.WEBHOOK_URL = 'https://example.com/webhook';
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        // Should not throw
        await expect(
          sendReceiptParsedNotification(
            mockReceipt,
            'https://example.com/receipt.jpg',
            'test-session-id',
            'receipt.jpg',
            'image/jpeg',
            null
          )
        ).resolves.toBeUndefined();
      });

      it('respects 5-second timeout', async () => {
        process.env.WEBHOOK_URL = 'https://example.com/webhook';

        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];
        expect(fetchCall.signal).toBeDefined();
        expect(fetchCall.signal.constructor.name).toBe('AbortSignal');
      });
    });

    describe('with geolocation data', () => {
      it('includes geolocation in Slack webhook when provided', async () => {
        process.env.WEBHOOK_URL = 'https://hooks.slack.com/test';

        const geolocation = {
          country: 'US',
          region: 'CA',
          city: 'San Francisco',
          latitude: '37.7749',
          longitude: '-122.4194',
        };

        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          geolocation
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        const bodyString = JSON.stringify(callBody);
        expect(bodyString).toContain('San Francisco, CA, US');
      });

      it('includes geolocation in JSON webhook when provided', async () => {
        process.env.WEBHOOK_URL = 'https://example.com/webhook';
        process.env.WEBHOOK_TYPE = 'json';

        const geolocation = {
          country: 'US',
          region: 'CA',
          city: 'San Francisco',
          latitude: '37.7749',
          longitude: '-122.4194',
        };

        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          geolocation
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        expect(callBody.geolocation).toEqual(geolocation);
      });

      it('handles null geolocation gracefully', async () => {
        process.env.WEBHOOK_URL = 'https://hooks.slack.com/test';

        await sendReceiptParsedNotification(
          mockReceipt,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        // Should not have a location section when geolocation is null
        const bodyString = JSON.stringify(callBody);
        expect(bodyString).not.toContain('*Location:*');
      });
    });

    describe('receipt with null values', () => {
      it('handles null restaurant and date', async () => {
        process.env.WEBHOOK_URL = 'https://hooks.slack.com/test';

        const receiptWithNulls: Receipt = {
          ...mockReceipt,
          restaurant: null,
          date: null,
        };

        await sendReceiptParsedNotification(
          receiptWithNulls,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        const bodyString = JSON.stringify(callBody);
        expect(bodyString).toContain('Unknown'); // Should show "Unknown" for null restaurant
      });

      it('handles null tip', async () => {
        process.env.WEBHOOK_URL = 'https://hooks.slack.com/test';

        const receiptWithNullTip: Receipt = {
          ...mockReceipt,
          tip: null,
        };

        await sendReceiptParsedNotification(
          receiptWithNullTip,
          'https://example.com/receipt.jpg',
          'test-session-id',
          'receipt.jpg',
          'image/jpeg',
          null
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );

        const bodyString = JSON.stringify(callBody);
        expect(bodyString).toContain('$0.00'); // Null tip should show as $0.00
      });
    });
  });
});
