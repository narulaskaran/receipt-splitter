# Visual Changes - PDF Upload Feature

## Overview
This PR adds support for uploading PDF receipts in addition to images. Below are the visual changes to the UI.

## Before & After Comparison

### Upload Component - Accepted File Types

**Before:**
- Only accepted image files: JPEG, JPG, PNG, HEIF, HEIC, WebP
- File validation: `file.type.startsWith("image/")`

**After:**
- Now accepts both images AND PDFs
- File validation: `file.type.startsWith("image/") || file.type === "application/pdf"`
- Error message updated: "Please upload an image or PDF file"

### Visual Representation

#### 1. Empty Upload State (No Change)
```
┌────────────────────────────────────────────┐
│                                            │
│              ☁️ Upload Icon                │
│                                            │
│          Upload your receipt               │
│      Drag and drop or click to select      │
│                                            │
└────────────────────────────────────────────┘
```

#### 2. Image Preview (Existing Behavior - No Change)
```
┌────────────────────────────────────────────┐
│                                            │
│         ┌──────────────────────┐           │
│         │                      │           │
│         │   [Receipt Image]    │           │
│         │                      │           │
│         └──────────────────────┘           │
│                                            │
│   Click or drag to upload a different      │
│              receipt                       │
│                                            │
└────────────────────────────────────────────┘
```

#### 3. PDF Preview (NEW - This PR)
```
┌────────────────────────────────────────────┐
│                                            │
│                                            │
│              📄 FileText Icon              │
│            (Large 32x32px)                 │
│                                            │
│                                            │
│   Click or drag to upload a different      │
│              receipt                       │
│                                            │
└────────────────────────────────────────────┘
```

#### 4. Loading State (Updated Text)
```
┌────────────────────────────────────────────┐
│                                            │
│         [Image or PDF Preview]             │
│                                            │
│          ⟳ Parsing receipt...              │
│                                            │
└────────────────────────────────────────────┘
```

## Code Changes Affecting UI

### 1. Import FileText Icon
```tsx
import { UploadCloud, Loader2, FileText } from "lucide-react";
```

### 2. Conditional Rendering for PDF
```tsx
{previewUrl === "pdf-placeholder" ? (
  <FileText className="h-32 w-32 mb-4 text-muted-foreground" />
) : (
  <img
    src={previewUrl}
    alt="Receipt preview"
    className="max-h-64 max-w-full mb-4 rounded-md"
  />
)}
```

### 3. Dropzone Configuration
```tsx
accept: {
  "image/*": [".jpeg", ".jpg", ".png", ".heif", ".heic", ".webp"],
  "application/pdf": [".pdf"],  // NEW
}
```

## User Experience Flow

### Uploading a PDF Receipt

1. **User drags PDF file or clicks to select**
   - File picker now shows "PDF Documents" in addition to image types
   - Accepts `.pdf` files

2. **PDF is dropped/selected**
   - Large FileText icon (📄) appears immediately
   - No image preview is shown (PDFs don't render in localStorage)
   - File is uploaded to API endpoint

3. **Processing**
   - Loading spinner appears: "Parsing receipt..."
   - Backend sends PDF to Claude's document API
   - Claude parses entire PDF (multi-page support)

4. **Success**
   - Receipt data populates the form
   - FileText icon remains visible
   - User can proceed with split calculation

### Error Handling

**Unsupported File Type:**
- User tries to upload `.txt`, `.docx`, or other non-image/PDF file
- Toast notification: "Please upload an image or PDF file"
- File is rejected, no API call made

## Accessibility

- **Icon**: FileText icon uses `text-muted-foreground` class for proper contrast
- **Alt text**: Image previews maintain "Receipt preview" alt text
- **ARIA**: Upload area uses proper `role="presentation"` for dropzone
- **Keyboard**: All interactions remain keyboard accessible

## Browser Compatibility

- **PDF Upload**: Supported in all modern browsers (Chrome, Firefox, Safari, Edge)
- **File API**: Uses standard FileReader API (widely supported)
- **Visual**: Lucide React icons render consistently across browsers

## Mobile Considerations

- **File Picker**: Mobile devices show native file picker with "Documents" option
- **PDF Preview**: FileText icon scales appropriately on mobile (h-32 w-32)
- **Touch**: Drag-and-drop works with mobile touch events via react-dropzone

## Dark Mode

The FileText icon respects the theme:
- **Light mode**: `text-muted-foreground` → Gray icon
- **Dark mode**: `text-muted-foreground` → Light gray icon (automatic via Tailwind)

No additional dark mode styles needed; the component inherits theme colors.

---

## Testing Screenshots Would Show

If this were running in a browser, screenshots would capture:

1. ✅ Empty upload state (unchanged)
2. ✅ Image preview with actual receipt photo (unchanged)
3. ✅ **PDF preview with large FileText icon** (new)
4. ✅ Loading state while parsing PDF (new)
5. ✅ Error toast for invalid file type (updated message)
6. ✅ File picker showing PDF option in file type filter (new)

## Summary

The visual changes are **minimal and intuitive**:
- Users see a clear document icon when uploading PDFs
- The icon is large and recognizable (32x32px)
- All existing image upload behavior remains unchanged
- The UI clearly indicates a PDF was uploaded vs an image
