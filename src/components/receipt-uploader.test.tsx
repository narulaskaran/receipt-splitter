import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReceiptUploader } from './receipt-uploader';

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn().mockReturnValue({
    getRootProps: vi.fn().mockReturnValue({}),
    getInputProps: vi.fn().mockReturnValue({}),
    isDragActive: false,
  }),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('ReceiptUploader', () => {
  it('renders the uploader component', () => {
    render(
      <ReceiptUploader 
        onReceiptParsed={() => {}}
        isLoading={false}
        setIsLoading={() => {}}
      />
    );
    
    expect(screen.getByText('Upload your receipt')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop or click to select')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(
      <ReceiptUploader 
        onReceiptParsed={() => {}}
        isLoading={true}
        setIsLoading={() => {}}
      />
    );
    
    expect(screen.getByText('Parsing receipt...')).toBeInTheDocument();
  });

  it('calls onReceiptParsed when receipt is successfully parsed', async () => {
    // Mock successful fetch response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ 
        restaurant: 'Test Restaurant',
        items: []
      }),
    });

    // Setup URL.createObjectURL mock
    global.URL.createObjectURL = vi.fn().mockReturnValue('mock-url');
    
    const onReceiptParsed = vi.fn();
    const setIsLoading = vi.fn();
    
    render(
      <ReceiptUploader 
        onReceiptParsed={onReceiptParsed}
        isLoading={false}
        setIsLoading={setIsLoading}
      />
    );
    
    // Simulate file drop by calling the mocked onDrop function directly
    const { useDropzone } = require('react-dropzone');
    const { onDrop } = useDropzone.mock.calls[0][0];
    
    // Create mock file
    const file = new File(['mock content'], 'receipt.jpg', { type: 'image/jpeg' });
    
    // Trigger drop
    await onDrop([file]);
    
    // Verify loading states were set
    expect(setIsLoading).toHaveBeenCalledWith(true);
    
    // Verify API was called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/parse-receipt', expect.any(Object));
      expect(onReceiptParsed).toHaveBeenCalledWith({ 
        restaurant: 'Test Restaurant',
        items: []
      });
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });
  });
});