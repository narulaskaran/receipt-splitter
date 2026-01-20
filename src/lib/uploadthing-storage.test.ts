// Mock uploadthing/server before importing the module under test
// Using virtual: true to avoid Jest trying to resolve the actual module
// Use global to store mocks since jest.mock is hoisted
interface MockedUTApi {
  uploadFiles: jest.Mock;
  deleteFiles: jest.Mock;
  listFiles: jest.Mock;
}

declare global {
  var __mockUTApi: MockedUTApi | undefined;
}

jest.mock('uploadthing/server', () => {
  // Create mocks inside the factory to avoid hoisting issues
  const mocks: MockedUTApi = {
    uploadFiles: jest.fn(),
    deleteFiles: jest.fn(),
    listFiles: jest.fn(),
  };
  // Store in global for test access
  global.__mockUTApi = mocks;

  return {
    UTApi: jest.fn().mockImplementation(() => mocks),
    UTFile: jest.fn().mockImplementation((chunks: unknown[], name: string, options?: { customId?: string; type?: string }) => ({
      name,
      customId: options?.customId,
      type: options?.type,
    })),
  };
}, { virtual: true });

import {
  uploadReceiptFile,
  deleteReceiptFiles,
  listReceiptFiles,
} from './uploadthing-storage';

// Get mocks from global (set by jest.mock factory)
const getMocks = () => {
  if (!global.__mockUTApi) {
    throw new Error('Mocks not initialized');
  }
  return global.__mockUTApi;
};

describe('uploadthing-storage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.UPLOADTHING_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('uploadReceiptFile', () => {
    const testBuffer = Buffer.from('test file content');
    const testFileName = 'receipt.jpg';
    const testMimeType = 'image/jpeg';
    const testSessionId = 'test-session-123';

    it('returns error when UPLOADTHING_TOKEN is not configured', async () => {
      const result = await uploadReceiptFile(
        testBuffer,
        testFileName,
        testMimeType,
        testSessionId
      );

      expect(result).toEqual({
        success: false,
        url: null,
        key: null,
        error: 'UploadThing not configured',
      });
    });

    it('uploads file successfully and returns URL', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      getMocks().uploadFiles.mockResolvedValue([
        {
          data: {
            key: 'test-file-key',
            ufsUrl: 'https://utfs.io/f/test-file-key',
            size: 100,
          },
          error: null,
        },
      ]);

      const result = await uploadReceiptFile(
        testBuffer,
        testFileName,
        testMimeType,
        testSessionId
      );

      expect(result).toEqual({
        success: true,
        url: 'https://utfs.io/f/test-file-key',
        key: 'test-file-key',
      });

      expect(getMocks().uploadFiles).toHaveBeenCalledTimes(1);
    });

    it('sanitizes filename with special characters', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      getMocks().uploadFiles.mockResolvedValue([
        {
          data: {
            key: 'test-key',
            ufsUrl: 'https://utfs.io/f/test-key',
            size: 100,
          },
          error: null,
        },
      ]);

      await uploadReceiptFile(
        testBuffer,
        'receipt (1) [test].jpg',
        testMimeType,
        testSessionId
      );

      expect(getMocks().uploadFiles).toHaveBeenCalled();
    });

    it('returns error when upload fails', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      getMocks().uploadFiles.mockResolvedValue([
        {
          data: null,
          error: { message: 'Upload failed: file too large' },
        },
      ]);

      const result = await uploadReceiptFile(
        testBuffer,
        testFileName,
        testMimeType,
        testSessionId
      );

      expect(result).toEqual({
        success: false,
        url: null,
        key: null,
        error: 'Upload failed: file too large',
      });
    });

    it('handles unexpected response format', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      getMocks().uploadFiles.mockResolvedValue([
        {
          data: null,
          error: null,
        },
      ]);

      const result = await uploadReceiptFile(
        testBuffer,
        testFileName,
        testMimeType,
        testSessionId
      );

      expect(result).toEqual({
        success: false,
        url: null,
        key: null,
        error: 'Unexpected response format',
      });
    });

    it('handles exceptions gracefully', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      getMocks().uploadFiles.mockRejectedValue(new Error('Network error'));

      const result = await uploadReceiptFile(
        testBuffer,
        testFileName,
        testMimeType,
        testSessionId
      );

      expect(result).toEqual({
        success: false,
        url: null,
        key: null,
        error: 'Network error',
      });
    });
  });

  describe('deleteReceiptFiles', () => {
    it('returns false when UPLOADTHING_TOKEN is not configured', async () => {
      const result = await deleteReceiptFiles(['key1', 'key2']);

      expect(result).toBe(false);
    });

    it('returns true for empty keys array', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      const result = await deleteReceiptFiles([]);

      expect(result).toBe(true);
    });

    it('deletes files successfully', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      getMocks().deleteFiles.mockResolvedValue(undefined);

      const result = await deleteReceiptFiles(['key1', 'key2', 'key3']);

      expect(result).toBe(true);
      expect(getMocks().deleteFiles).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });

    it('returns false when deletion fails', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      getMocks().deleteFiles.mockRejectedValue(new Error('Deletion failed'));

      const result = await deleteReceiptFiles(['key1']);

      expect(result).toBe(false);
    });
  });

  describe('listReceiptFiles', () => {
    it('returns empty array when UPLOADTHING_TOKEN is not configured', async () => {
      const result = await listReceiptFiles();

      expect(result).toEqual([]);
    });

    it('lists files successfully', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      const mockFiles = [
        {
          key: 'key1',
          customId: 'receipts/session1/1234567890',
          name: '1234567890-receipt.jpg',
          uploadedAt: 1704931200000, // timestamp
        },
        {
          key: 'key2',
          customId: 'receipts/session2/1234567891',
          name: '1234567891-receipt.pdf',
          uploadedAt: 1704931300000,
        },
      ];

      getMocks().listFiles.mockResolvedValue({ files: mockFiles });

      const result = await listReceiptFiles(100);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: 'key1',
        customId: 'receipts/session1/1234567890',
        name: '1234567890-receipt.jpg',
        uploadedAt: expect.any(Date),
      });
      expect(result[1].key).toBe('key2');
      expect(getMocks().listFiles).toHaveBeenCalledWith({ limit: 100 });
    });

    it('uses default limit of 500', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      getMocks().listFiles.mockResolvedValue({ files: [] });

      await listReceiptFiles();

      expect(getMocks().listFiles).toHaveBeenCalledWith({ limit: 500 });
    });

    it('returns empty array when listing fails', async () => {
      process.env.UPLOADTHING_TOKEN = 'test-token';

      getMocks().listFiles.mockRejectedValue(new Error('API error'));

      const result = await listReceiptFiles();

      expect(result).toEqual([]);
    });
  });
});
