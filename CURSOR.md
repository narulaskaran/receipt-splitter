# Receipt Splitter - Cursor Project Guide

This project is a receipt splitting web application built with Next.js, TypeScript, and shadcn/ui components. It allows users to upload a photo of a receipt, parse it using Claude AI, and split expenses among multiple people with advanced group management and sharing capabilities.

## Project Structure

- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components including UI components and business logic
- `src/lib/` - Utility functions for business logic, validation, and integrations
- `src/types/` - TypeScript type definitions
- `src/test/` - Test utilities and mock data

## Key Files

### Core Application

- `src/app/page.tsx` - Main application page with tabbed interface

  - Implements session caching in localStorage with automatic restoration
  - New Split button for clearing session and resetting app state
  - Responsive design with mobile-first approach
  - Tab-based workflow: Upload → People → Groups → Assignment → Results

- `src/app/layout.tsx` - Root layout with theme provider and analytics

  - Vercel Web Analytics integration
  - Vercel SpeedInsights for performance monitoring
  - Theme management with system preference detection

- `src/app/globals.css` - Global styles with Tailwind CSS and custom CSS variables

### API Routes

- `src/app/api/parse-receipt/route.ts` - Anthropic Claude API integration for receipt parsing

### Split Sharing Route

- `src/app/split/page.tsx` - Split sharing page for recipients
  - Displays individual payment amounts from shared URLs
  - Mobile-optimized design with loading states
  - Error handling for invalid or corrupted links
- `src/app/split/error.tsx` - Error boundary for split page failures

### Core Components

#### Receipt Management

- `src/components/receipt-uploader.tsx` - Receipt image upload with drag & drop

  - Image preview and validation
  - Loading states and error handling
  - Mobile-optimized touch interactions

- `src/components/receipt-details.tsx` - Receipt information display and editing
  - Editable restaurant name and date
  - Tax and tip adjustment capabilities
  - Real-time validation and formatting

#### People & Group Management

- `src/components/people-manager.tsx` - Add/remove people from the split

  - Name input with validation
  - Delete functionality with confirmation
  - Mobile-responsive design

- `src/components/group-manager.tsx` - Advanced group management system

  - Create, edit, and delete groups
  - Assign people to groups with visual feedback
  - Random emoji assignment for group identification
  - Bulk operations for group management

- `src/components/person-items.tsx` - Display items assigned to a person
  - Item breakdown with quantities and amounts
  - Tax and tip calculations per person
  - Responsive grid layout

#### Item Assignment & Results

- `src/components/item-assignment.tsx` - Core item assignment interface

  - Drag & drop assignment (desktop)
  - Touch-friendly mobile interface
  - Percentage-based splitting
  - Group-based assignment with emoji indicators
  - Real-time validation and error handling

- `src/components/results-summary.tsx` - Final results with sharing capabilities

  - Individual payment amounts
  - Venmo integration with phone number input
  - Share split functionality for URL generation
  - Mobile-optimized payment buttons
  - Copy to clipboard and native sharing

- `src/components/split-summary.tsx` - Shared split display component

  - Used on the `/split` route
  - Individual payment cards
  - Verification that amounts add up correctly

- `src/components/payment-card.tsx` - Individual payment display
  - Person name and amount
  - Payment button integration
  - Responsive design for mobile and desktop

#### UI & Theme

- `src/components/theme-provider.tsx` - Theme management

### Core Application

- `src/app/page.tsx` - Main application page with tabbed interface

  - Implements session caching in localStorage with automatic restoration
  - New Split button for clearing session and resetting app state
  - Responsive design with mobile-first approach
  - Tab-based workflow: Upload → People → Groups → Assignment → Results

- `src/app/layout.tsx` - Root layout with theme provider and analytics

  - Vercel Web Analytics integration
  - Vercel SpeedInsights for performance monitoring
  - Theme management with system preference detection

- `src/app/globals.css` - Global styles with Tailwind CSS and custom CSS variables

### API Routes

- `src/app/api/parse-receipt/route.ts` - Anthropic Claude API integration for receipt parsing

### Split Sharing Route

- `src/app/split/page.tsx` - Split sharing page for recipients
  - Displays individual payment amounts from shared URLs
  - Mobile-optimized design with loading states
  - Error handling for invalid or corrupted links
- `src/app/split/error.tsx` - Error boundary for split page failures

### Core Components

#### Receipt Management

- `src/components/receipt-uploader.tsx` - Receipt image upload with drag & drop

  - Image preview and validation
  - Loading states and error handling
  - Mobile-optimized touch interactions

- `src/components/receipt-details.tsx` - Receipt information display and editing
  - Editable restaurant name and date
  - Tax and tip adjustment capabilities
  - Real-time validation and formatting

#### People & Group Management

- `src/components/people-manager.tsx` - Add/remove people from the split

  - Name input with validation
  - Delete functionality with confirmation
  - Mobile-responsive design

- `src/components/group-manager.tsx` - Advanced group management system

  - Create, edit, and delete groups
  - Assign people to groups with visual feedback
  - Random emoji assignment for group identification
  - Bulk operations for group management

- `src/components/person-items.tsx` - Display items assigned to a person
  - Item breakdown with quantities and amounts
  - Tax and tip calculations per person
  - Responsive grid layout

#### Item Assignment & Results

- `src/components/item-assignment.tsx` - Core item assignment interface

  - Drag & drop assignment (desktop)
  - Touch-friendly mobile interface
  - Percentage-based splitting
  - Group-based assignment with emoji indicators
  - Real-time validation and error handling

- `src/components/results-summary.tsx` - Final results with sharing capabilities

  - Individual payment amounts
  - Venmo integration with phone number input
  - Share split functionality for URL generation
  - Mobile-optimized payment buttons
  - Copy to clipboard and native sharing

- `src/components/split-summary.tsx` - Shared split display component

  - Used on the `/split` route
  - Individual payment cards
  - Verification that amounts add up correctly

- `src/components/payment-card.tsx` - Individual payment display
  - Person name and amount
  - Payment button integration
  - Responsive design for mobile and desktop

#### UI & Theme

- `src/components/theme-provider.tsx` - Theme management

  - Light/dark mode switching
  - System preference detection
  - Persistent theme selection

- `src/components/kofi-button.tsx` - Ko-fi donation integration
  - Support the project button
  - Responsive design

### Utility Libraries

#### Core Business Logic

- `src/lib/receipt-utils.ts` - Receipt calculation utilities

  - Tax and tip distribution
  - Person total calculations
  - Assignment validation
  - Currency formatting

- `src/lib/split-sharing.ts` - Advanced split sharing system

  - URL serialization/deserialization
  - Comprehensive data validation
  - Error handling with detailed messages
  - Phone number and date validation
  - Security limits and constraints

- `src/lib/venmo-utils.ts` - Venmo payment integration

  - Payment link generation
  - Parameter validation
  - Amount and note limits
  - Error handling for failed payments

- `src/lib/emoji-utils.ts` - Group emoji management

  - Curated emoji selection
  - Random assignment with collision avoidance
  - Group identification system

- `src/lib/utils.ts` - General utility functions
  - Common helper functions
  - Type guards and validators

### Test Infrastructure

- `src/test/test-utils.ts` - Centralized test utilities
  - Mock data for Person, Receipt, and assignments
  - Global mocks for crypto.randomUUID, sonner.toast, window.matchMedia
  - Common test setup and teardown

## Environment Setup

The application requires an Anthropic API key to function. Add this to your `.env.local` file:

```
ANTHROPIC_API_KEY=your_api_key_here
```

## Core Functionality

### 1. Receipt Parsing & Management

- **AI-Powered Parsing**: Upload receipt images and automatically extract items, prices, tax, and tip using Claude AI
- **Manual Editing**: Adjust parsed data with real-time validation
- **Image Persistence**: Receipt images are cached in localStorage for session restoration

### 2. Advanced People & Group Management

- **Individual People**: Add/remove people with unique names and IDs
- **Group Organization**: Create named groups with emoji identifiers
- **Flexible Assignment**: Assign people to groups or keep them ungrouped
- **Visual Feedback**: Emoji-based group identification system

### 3. Intelligent Item Assignment

- **Multiple Assignment Modes**:
  - Individual assignment (one person per item)
  - Percentage-based splitting (multiple people share an item)
  - Group-based assignment (assign items to entire groups)
- **Real-time Validation**: Ensure all items are properly assigned
- **Mobile Optimization**: Touch-friendly interface with responsive design

### 4. Advanced Expense Calculation

- **Proportional Distribution**: Tax and tip calculated based on item costs
- **Group Calculations**: Automatic distribution within groups
- **Precision Handling**: Uses Decimal.js for accurate financial calculations
- **Validation**: Ensures amounts add up correctly with tolerance for rounding

### 5. Enhanced Receipt Sharing System

- **URL-Based Sharing**: Generate shareable links from the results summary
- **Comprehensive Data**: Include names, amounts, totals, notes, phone numbers, and dates
- **Enhanced Validation**: Detailed error reporting and data integrity checks
- **Mobile-Optimized**: Responsive design for all device types

### 6. Split Payment Page (`/split` Route)

- **Individual View**: Each person sees only their payment amount
- **Payment Integration**: Direct Venmo payment links with full functionality
- **Error Handling**: Graceful fallbacks for invalid or corrupted links
- **Loading States**: Smooth user experience with visual feedback

### 7. Venmo Payment Integration

- **Direct Payment Links**: Generate Venmo payment URLs for each person
- **Phone Number Validation**: US phone number format validation
- **Note Management**: Automatic note truncation to meet Venmo limits
- **Amount Validation**: Ensures amounts are within Venmo transaction limits
- **Split Page Integration**: Full Venmo payment functionality in shared split pages
- **Individual Payment Cards**: Each person gets their own payment button with Venmo integration

### 8. Session & State Management

- **Automatic Persistence**: Session data saved to localStorage on every change
- **Tab Restoration**: Active tab is remembered and restored
- **Image Caching**: Receipt images cached for seamless restoration
- **Reset Functionality**: Clear session and start over with New Split button

### 9. Mobile-First Responsive Design

- **Touch Optimization**: Large touch targets and gesture support
- **Responsive Layouts**: Adapts to all screen sizes
- **Mobile Navigation**: Tab-based interface optimized for mobile
- **Performance**: Optimized for mobile devices with efficient rendering

### 10. Advanced Validation & Error Handling

- **Input Validation**: Real-time validation for all user inputs
- **Data Integrity**: Comprehensive checks for split data consistency
- **Error Messages**: User-friendly error descriptions with actionable guidance
- **Fallback Handling**: Graceful degradation when features fail

## Analytics & Performance

### Vercel Web Analytics

- **Privacy-First**: Cookieless analytics with GDPR compliance
- **Page Tracking**: Automatic page view and user interaction tracking
- **Performance Metrics**: Core Web Vitals and user experience data

### Vercel SpeedInsights

- **Real User Monitoring**: Performance data from actual users
- **Performance Metrics**: Load times, interaction delays, and optimization opportunities
- **Dashboard Integration**: View data in Vercel dashboard

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run lint` - Run ESLint checks

## Technology Stack

- **Framework**: Next.js 15.3.1 with App Router
- **Language**: TypeScript with strict type checking
- **Styling**: Tailwind CSS with custom CSS variables
- **UI Components**: shadcn/ui component library
- **AI Integration**: Anthropic Claude API for receipt parsing
- **State Management**: React hooks with localStorage persistence
- **Validation**: Custom validation with detailed error reporting
- **Payment Integration**: Venmo payment link generation
- **Testing**: Jest with React Testing Library
- **Deployment**: Vercel with automatic deployments
- **Analytics**: Vercel Web Analytics and SpeedInsights

## Deployment

The application is configured for automatic deployment on Vercel. Any code pushed to the main branch will be automatically deployed with:

- **Automatic Builds**: Next.js optimization and static generation
- **Environment Variables**: Secure API key management
- **Performance Monitoring**: Real-time performance insights
- **Global CDN**: Fast loading worldwide

## Continuous Integration

GitHub Actions workflow runs on every push and pull request to ensure code quality:

- **Dependency Installation**: Secure npm ci with caching
- **Linting**: ESLint checks for code quality
- **Build Verification**: Production build validation
- **Test Execution**: Full test suite validation
- **Quality Gates**: All checks must pass before merging

## Test Coverage

Comprehensive test coverage including:

- **Unit Tests**: Individual function and component testing
- **Integration Tests**: Component interaction testing
- **Mock Data**: Centralized test utilities and mock data
- **Global Mocks**: Browser API and utility function mocking
- **Test Utilities**: Common setup and assertion helpers

## Security & Validation

- **Input Sanitization**: All user inputs are validated and sanitized
- **Data Validation**: Comprehensive validation for shared data
- **Phone Number Security**: Secure phone number handling for payments
- **URL Safety**: Secure URL generation and parameter handling
- **Error Boundaries**: Graceful error handling throughout the application

## Mobile Optimization

- **Touch Interface**: Optimized for touch devices with large targets
- **Responsive Design**: Adapts to all screen sizes and orientations
- **Performance**: Optimized rendering and efficient state management
- **Accessibility**: Screen reader support and keyboard navigation
- **Progressive Enhancement**: Core functionality works on all devices
