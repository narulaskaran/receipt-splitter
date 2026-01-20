/**
 * Auto-mock for sonner toast library
 * Jest automatically uses this when any test imports from 'sonner'
 */
export const toast = {
  error: jest.fn(),
  success: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  loading: jest.fn(),
  dismiss: jest.fn(),
  promise: jest.fn(),
};

// Default export for compatibility
export default { toast };
