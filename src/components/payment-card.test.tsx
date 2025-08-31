import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentCard, PaymentCardsList } from './payment-card';

// Mock the formatCurrency function
jest.mock('@/lib/receipt-utils', () => ({
  formatCurrency: jest.fn((amount: number) => `$${amount.toFixed(2)}`),
}));

describe('PaymentCard', () => {
  const mockProps = {
    name: 'Alice',
    amount: 32.50,
  };

  it('renders person name and amount correctly', () => {
    render(<PaymentCard {...mockProps} />);
    
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Amount owed')).toBeInTheDocument();
    expect(screen.getByText('$32.50')).toBeInTheDocument();
    expect(screen.getByText('Including tax & tip')).toBeInTheDocument();
  });

  it('renders without payment button when onPaymentClick is not provided', () => {
    render(<PaymentCard {...mockProps} />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders payment button when onPaymentClick is provided', () => {
    const mockClick = jest.fn();
    render(
      <PaymentCard 
        {...mockProps} 
        onPaymentClick={mockClick}
        isPaymentEnabled={true}
        paymentButtonText="Pay with Venmo"
      />
    );
    
    const button = screen.getByRole('button', { name: /pay with venmo/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('calls onPaymentClick when button is clicked', () => {
    const mockClick = jest.fn();
    render(
      <PaymentCard 
        {...mockProps} 
        onPaymentClick={mockClick}
        isPaymentEnabled={true}
      />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('disables payment button when isPaymentEnabled is false', () => {
    const mockClick = jest.fn();
    render(
      <PaymentCard 
        {...mockProps} 
        onPaymentClick={mockClick}
        isPaymentEnabled={false}
      />
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('displays custom payment button text', () => {
    render(
      <PaymentCard 
        {...mockProps} 
        onPaymentClick={() => {}}
        paymentButtonText="Custom Pay Text"
      />
    );
    
    expect(screen.getByText('Custom Pay Text')).toBeInTheDocument();
  });

  it('displays payment status indicators', () => {
    render(<PaymentCard {...mockProps} />);
    
    // Payment status indicators have been removed
    // Component now focuses on core payment functionality
  });

  it('applies custom className', () => {
    const { container } = render(
      <PaymentCard {...mockProps} className="custom-class" />
    );
    
    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });
});

describe('PaymentCardsList', () => {
  const mockNames = ['Alice', 'Bob', 'Charlie'];
  const mockAmounts = [32.50, 19.50, 13.00];

  it('renders multiple payment cards correctly', () => {
    render(<PaymentCardsList names={mockNames} amounts={mockAmounts} />);
    
    // Check title
    expect(screen.getByText('Individual Payments')).toBeInTheDocument();
    
    // Check all names are rendered
    mockNames.forEach(name => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
    
    // Check all amounts are rendered
    mockAmounts.forEach(amount => {
      expect(screen.getByText(`$${amount.toFixed(2)}`)).toBeInTheDocument();
    });
  });

  it('renders summary footer with total', () => {
    render(<PaymentCardsList names={mockNames} amounts={mockAmounts} />);
    
    expect(screen.getByText('Total for all payments:')).toBeInTheDocument();
    expect(screen.getByText('$65.00')).toBeInTheDocument(); // Sum of amounts
    expect(screen.getByText('Each person pays their individual amount directly')).toBeInTheDocument();
  });

  it('calls onPaymentClick with correct parameters', () => {
    const mockClick = jest.fn();
    render(
      <PaymentCardsList 
        names={mockNames} 
        amounts={mockAmounts}
        onPaymentClick={mockClick}
        isPaymentEnabled={true}
      />
    );
    
    // Click the first payment button (Alice)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    
    expect(mockClick).toHaveBeenCalledWith('Alice', 32.50);
  });

  it('renders with payment buttons when onPaymentClick is provided', () => {
    render(
      <PaymentCardsList 
        names={mockNames} 
        amounts={mockAmounts}
        onPaymentClick={() => {}}
        isPaymentEnabled={true}
        paymentButtonText="Pay with Venmo"
      />
    );
    
    // Should have one button per person
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(mockNames.length);
    
    // Check button text
    buttons.forEach(button => {
      expect(button).toHaveTextContent('Pay with Venmo');
    });
  });

  it('renders without payment buttons when onPaymentClick is not provided', () => {
    render(<PaymentCardsList names={mockNames} amounts={mockAmounts} />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('handles empty arrays gracefully', () => {
    render(<PaymentCardsList names={[]} amounts={[]} />);
    
    expect(screen.getByText('Individual Payments')).toBeInTheDocument();
    expect(screen.getByText('Total for all payments:')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('handles single person correctly', () => {
    render(<PaymentCardsList names={['Alice']} amounts={[25.00]} />);
    
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // $25.00 appears twice (in individual card and in total), so use getAllByText
    const amounts = screen.getAllByText('$25.00');
    expect(amounts.length).toBe(2); // Once in card, once in total
    expect(screen.getByText('Total for all payments:')).toBeInTheDocument();
  });

  it('returns null and logs error for mismatched arrays', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const { container } = render(
      <PaymentCardsList names={['Alice', 'Bob']} amounts={[25.00]} />
    );
    
    expect(container.firstChild).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('PaymentCardsList: names and amounts arrays must have the same length');
    
    consoleSpy.mockRestore();
  });

  it('passes through payment button props correctly', () => {
    render(
      <PaymentCardsList 
        names={['Alice']} 
        amounts={[25.00]}
        onPaymentClick={() => {}}
        isPaymentEnabled={false}
        paymentButtonText="Custom Button"
      />
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Custom Button');
  });

  it('displays mobile-optimized design elements', () => {
    render(<PaymentCardsList names={['Alice']} amounts={[25.00]} />);
    
    // Check for mobile-friendly elements
    expect(screen.getByText('Individual Payments')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // Payment status indicators have been removed for cleaner design
  });
});