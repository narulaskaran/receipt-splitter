import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST } from './route';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      constructor() {}
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                restaurant: 'Test Restaurant',
                date: '2023-01-01',
                total: 125,
                subtotal: 100,
                tax: 10,
                tip: 15,
                items: [
                  {
                    name: 'Item 1',
                    price: 20,
                    quantity: 1
                  },
                  {
                    name: 'Item 2',
                    price: 30,
                    quantity: 1
                  }
                ]
              })
            }
          ]
        })
      }
    }
  };
});

// Mock environment
vi.mock('process', () => {
  return {
    env: {
      ANTHROPIC_API_KEY: 'test-api-key'
    }
  };
});

describe('Parse Receipt API Route', () => {
  let mockFormData: FormData;
  let mockFile: File;
  
  beforeEach(() => {
    // Create a mock file
    mockFile = new File(['mock file content'], 'receipt.jpg', { type: 'image/jpeg' });
    
    // Create FormData and append file
    mockFormData = new FormData();
    mockFormData.append('file', mockFile);
    
    // Mock formData method on NextRequest
    vi.spyOn(NextRequest.prototype, 'formData').mockResolvedValue(mockFormData);
  });
  
  it('should successfully parse a receipt', async () => {
    // Create mock request
    const req = new NextRequest('http://localhost/api/parse-receipt', {
      method: 'POST',
    });
    
    // Call API route
    const response = await POST(req);
    
    // Verify response
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    
    const responseData = await response.json();
    expect(responseData).toEqual({
      restaurant: 'Test Restaurant',
      date: '2023-01-01',
      total: 125,
      subtotal: 100,
      tax: 10,
      tip: 15,
      items: [
        {
          name: 'Item 1',
          price: 20,
          quantity: 1
        },
        {
          name: 'Item 2',
          price: 30,
          quantity: 1
        }
      ]
    });
  });
  
  it('should return an error when no file is provided', async () => {
    // Create empty FormData
    const emptyFormData = new FormData();
    vi.spyOn(NextRequest.prototype, 'formData').mockResolvedValueOnce(emptyFormData);
    
    // Create mock request
    const req = new NextRequest('http://localhost/api/parse-receipt', {
      method: 'POST',
    });
    
    // Call API route
    const response = await POST(req);
    
    // Verify response
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(400);
    
    const responseData = await response.json();
    expect(responseData).toEqual({ error: 'No file provided' });
  });
  
  it('should return an error when API key is not configured', async () => {
    // Temporarily mock missing API key
    const originalEnv = process.env;
    vi.stubGlobal('process', { env: {} });
    
    // Create mock request
    const req = new NextRequest('http://localhost/api/parse-receipt', {
      method: 'POST',
    });
    
    // Call API route
    const response = await POST(req);
    
    // Verify response
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(500);
    
    const responseData = await response.json();
    expect(responseData).toEqual({ error: 'Anthropic API key is not configured' });
    
    // Restore original env
    vi.stubGlobal('process', { env: originalEnv });
  });
});