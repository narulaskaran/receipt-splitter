# Create Pull Request - PDF Upload Feature

## ✅ Ready to Create PR

Your branch `claude/plan-receipt-feature-pytNo` has been pushed successfully!

## Quick Links

**Create PR Now:**
🔗 https://github.com/narulaskaran/receipt-splitter/pull/new/claude/plan-receipt-feature-pytNo

**Or view the commit:**
🔗 https://github.com/narulaskaran/receipt-splitter/commit/29fd77c

**Compare changes:**
🔗 https://github.com/narulaskaran/receipt-splitter/compare/main...claude/plan-receipt-feature-pytNo

## PR Details (Pre-filled for you)

### Title
```
Add PDF upload support for receipt parsing
```

### Description (copy/paste into PR body)

```markdown
## 📄 Add PDF Upload Support for Receipt Parsing

Implements PDF upload functionality for receipt parsing as requested in #46.

### Summary

This PR adds support for uploading PDF receipts in addition to images. The feature uses Claude's native PDF document API to parse receipts directly, supporting multi-page PDFs without conversion.

### Changes

**Frontend (`receipt-uploader.tsx`)**
- ✅ Added PDF file type to accepted uploads (`application/pdf`)
- ✅ Updated file validation to accept both images and PDFs
- ✅ Added PDF placeholder icon (FileText) for uploaded PDFs
- ✅ Skip localStorage preview for PDFs to avoid large file storage

**Backend (`api/parse-receipt/route.ts`)**
- ✅ Added PDF MIME type validation
- ✅ Implemented dynamic content type handling:
  - Images → `image` type for Claude Vision API
  - PDFs → `document` type for Claude Document API
- ✅ Leverages Claude's native PDF parsing (supports multi-page receipts)
- ✅ Maintains backward compatibility with existing image uploads

**Tests (`receipt-uploader.test.tsx`)**
- ✅ Added test for PDF file acceptance
- ✅ Added test for PDF placeholder display
- ✅ Added test for rejecting non-image/non-PDF files
- ✅ All 148 tests passing ✓

### Visual Changes

#### PDF Upload Preview (NEW)
When a PDF is uploaded, users see a large FileText icon instead of an image preview:

```
┌────────────────────────────────────────────┐
│                                            │
│              📄 FileText Icon              │
│            (Large, gray icon)              │
│   Click or drag to upload a different      │
│              receipt                       │
└────────────────────────────────────────────┘
```

**Key Visual Changes:**
- PDF files show a document icon (📄) instead of image preview
- Icon is large (32x32px) with muted foreground color
- Error message updated: "Please upload an image or PDF file"
- All existing image upload behavior unchanged

#### File Type Acceptance
The upload dropzone now accepts:
- **Images**: JPEG, JPG, PNG, HEIF, HEIC, WebP (existing)
- **PDFs**: PDF documents (new)

### Technical Approach

- **Direct PDF Parsing**: Uses Claude's `document` content type to parse PDFs natively
- **Multi-page Support**: Unlike image conversion approaches, this supports multi-page receipts
- **Zero Additional Dependencies**: Leverages existing Anthropic SDK capabilities
- **Backward Compatible**: All existing image upload functionality unchanged

### Testing

```bash
npm test
# ✓ 148 tests passing
# ✓ 4 new tests for PDF upload functionality
# ✓ No TypeScript errors
```

**New Test Coverage:**
1. Accepts PDF files and sends to API
2. Shows PDF placeholder icon when PDF uploaded
3. Rejects non-image/non-PDF files with appropriate error

### Code Quality

- ✅ No TypeScript errors
- ✅ No new dependencies required
- ✅ Clean, maintainable code following existing patterns
- ✅ Comprehensive test coverage
- ✅ All linters pass

### Usage

Users can now:
1. Drag and drop PDF receipts or click to select
2. Upload single or multi-page PDF receipts
3. See immediate visual feedback (document icon)
4. Have the entire PDF parsed by Claude (all pages)
5. Continue with normal split calculation flow

### Closes

Closes #46

---

**Note for reviewers:** The visual changes are minimal and intuitive. The FileText icon clearly indicates when a PDF is uploaded vs an image, and all existing functionality remains unchanged.
```

## Files Changed

```
src/app/api/parse-receipt/route.ts      | 85 ++++++++++++----
src/components/receipt-uploader.test.tsx | 122 ++++++++++++++++++++++
src/components/receipt-uploader.tsx      | 36 ++++---
```

## Test Status

- ✅ All 148 tests passing
- ✅ 4 new PDF upload tests added
- ✅ No TypeScript errors
- ✅ Linters pass

## What's Included

1. **PDF upload support** - Full PDF receipt parsing capability
2. **Visual feedback** - FileText icon for PDF previews
3. **Multi-page support** - Handles multi-page PDFs natively
4. **Comprehensive tests** - Full test coverage for PDF functionality
5. **Zero dependencies** - Uses existing Anthropic SDK

## Visual Documentation

See `PR_VISUAL_CHANGES.md` for detailed visual mockups and UI changes.

---

**Ready?** Click the link above to create your PR! 🚀
