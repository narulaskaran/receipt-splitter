## Overview

This PR implements the foundation for sharing receipt splits via URLs by creating utility functions to serialize and deserialize split data into URL-safe parameters.

## Changes Made

### New Files
- `src/lib/split-sharing.ts` - Core serialization utilities
- `src/lib/split-sharing.test.ts` - Comprehensive test coverage

### Key Features
- **SharedSplitData interface** - Minimal data structure for sharing
- **serializeSplitData()** - Encodes people, amounts, and metadata to URL params
- **deserializeSplitData()** - Decodes URL params back to split data
- **generateShareableUrl()** - Creates complete shareable URLs
- **validateSplitData()** - Ensures data integrity and validation

### URL Format
```
?names=Jon,Jane&amounts=30.00,40.00&total=70.00&restaurant=RestaurantName&phone=5551234567
```

## Testing

- ✅ 27 passing tests covering all serialization scenarios
- ✅ Tests for special characters, edge cases, and validation
- ✅ Round-trip serialization integrity verification
- ✅ URL encoding/decoding with proper parameter handling

## Quality Gates

- ✅ All tests pass (`npm test`)
- ✅ ESLint clean (`npm run lint`)  
- ✅ TypeScript compilation successful (`npm run build`)

## Dependencies

None - This is the foundation PR for the sharing feature stack.

## What Works After This PR

- Utility functions to convert split data to/from URL parameters
- Data validation for sharing scenarios
- Foundation for building shareable URLs (no UI changes yet)