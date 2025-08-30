# PR #29 Visual Examples - Payment Card Components

## 🎯 What This PR Adds

Individual payment cards for each person with mobile-friendly design and touch interactions. These components will be used on the `/split` page to show each person's payment details.

## 📱 Component Design

### **PaymentCard Component**
Each person gets their own payment card with:

**Visual Elements:**
- **Person Icon**: Circular background with User icon in primary color
- **Name Section**: Large, bold name with "Amount owed" subtitle
- **Amount Display**: 
  - Large dollar amount in primary color (3xl on mobile, 2xl on desktop)
  - Dollar sign icon
  - "Including tax & tip" subtitle
- **Payment Button** (when enabled):
  - Full width on mobile, auto width on desktop
  - Credit card icon
  - Customizable text ("Pay Now", "Pay with Venmo", etc.)
  - Disabled/enabled states
- **Status Bar**: 
  - "Payment for [Name]" 
  - Green pulsing dot + "Ready to pay" status

**Responsive Design:**
- **Mobile**: Stacked layout, larger touch targets (h-12), centered text
- **Desktop**: Side-by-side layout, compact design
- **Animations**: Hover shadow effects, active scale transforms

### **PaymentCardsList Component**
Container for multiple payment cards with:

**Visual Elements:**
- **Header**: Credit card icon + "Individual Payments" title
- **Card Grid**: Vertical stack of PaymentCard components
- **Summary Footer**: 
  - Gradient background (muted tones)
  - Total amount calculation
  - Explanatory text about individual payments

**Features:**
- Error handling for mismatched data
- Empty state support
- Payment click handler delegation
- Button state management

## 🎨 Design System Integration

- **Colors**: Uses primary, muted, and accent colors from design system
- **Typography**: Proper hierarchy with font weights and sizes
- **Spacing**: Consistent padding and margins (p-4 sm:p-6)
- **Icons**: Lucide icons (User, DollarSign, CreditCard)
- **Animations**: Smooth transitions (duration-200, duration-300)
- **Touch Targets**: 44px+ minimum for mobile accessibility

## 🔄 State Management

- **Payment Buttons**: Can be enabled/disabled globally
- **Custom Text**: Button text can be customized per use case
- **Click Handlers**: Passes name and amount to parent component
- **Loading States**: Ready for integration with payment processing

## 📊 Test Coverage

18 comprehensive tests covering:
- ✅ Basic rendering with all props
- ✅ Payment button interactions and states
- ✅ Responsive design elements
- ✅ Error handling for edge cases
- ✅ Custom styling and props
- ✅ Mobile-optimized design verification

## 🏗️ Usage Example

```tsx
<PaymentCardsList 
  names={['Alice', 'Bob', 'Charlie']}
  amounts={[32.50, 19.50, 13.00]}
  onPaymentClick={(name, amount) => handlePayment(name, amount)}
  isPaymentEnabled={true}
  paymentButtonText="Pay with Venmo"
/>
```

## 🔗 Integration Ready

These components are designed to integrate seamlessly with:
- **PR #27**: Split page route (will display these cards)
- **Future Venmo PR**: Payment functionality (will handle button clicks)
- **Mobile UX PR**: Enhanced responsive design

The cards provide a beautiful, touch-friendly interface for users to see their amounts and initiate payments.