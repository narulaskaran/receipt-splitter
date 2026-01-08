# Mobile Tab Navigation Testing Guide

## Issue #76: Tab Navigation Text Truncated on Small Mobile Screens

### Changes Made

#### 1. **Added Icons to Tab Navigation**
   - Upload Receipt → Upload icon
   - Add People → Users icon
   - Assign Items → ListChecks icon
   - Results → DollarSign icon

#### 2. **Implemented Responsive Labels**
   - **< 380px (very small screens)**: Icons only (no text)
   - **380px - 639px**: Icons + short labels ("Upload", "People", "Items", "Results")
   - **≥ 640px (sm breakpoint)**: Icons + full labels ("Upload Receipt", "Add People", "Assign Items", "Results")

#### 3. **Enhanced Mobile Styling**
   - Added `xs` breakpoint at 380px for fine-grained mobile control
   - Reduced font size on screens < 380px (`text-xs` → `text-sm` at 380px+)
   - Added `scrollbar-hide` utility for cleaner horizontal scrolling
   - Made icons `flex-shrink-0` to prevent compression

#### 4. **Files Modified**
   - `src/app/page.tsx`: Updated tab triggers with icons and responsive labels
   - `src/components/ui/tabs.tsx`: Added responsive font sizing
   - `src/app/globals.css`: Added custom `xs` breakpoint and scrollbar utilities

### Testing Instructions

#### Test Devices/Viewports

1. **iPhone SE (375px width)** - Should show icons + short labels
2. **Small Android (360px width)** - Should show icons + short labels
3. **Very Small (< 380px width)** - Should show icons only
4. **Tablet/Desktop (≥ 640px)** - Should show icons + full labels

#### Using Chrome DevTools

1. Open the application in Chrome
2. Press `F12` to open DevTools
3. Click the device toolbar icon (or press `Ctrl+Shift+M`)
4. Test each viewport size:
   - 360px x 640px (Galaxy S5)
   - 375px x 667px (iPhone SE)
   - 320px x 568px (iPhone 5/SE - very small)
   - 640px x 1138px (iPad Mini)
   - 1024px x 768px (iPad)

#### What to Verify

✅ **At 360px and 375px:**
- All tab labels are fully visible (not truncated)
- Labels show short form: "Upload", "People", "Items", "Results"
- Icons are visible and aligned
- No horizontal overflow or cut-off text

✅ **At < 380px (e.g., 320px):**
- Only icons are visible (no text labels)
- All tabs fit without truncation
- Navigation is clear with icon-only display

✅ **At ≥ 640px (desktop):**
- Full labels visible: "Upload Receipt", "Add People", "Assign Items", "Results"
- Icons and text properly aligned

✅ **General:**
- Tabs can scroll horizontally if needed (smooth scrolling)
- Active tab is clearly highlighted
- Disabled tabs appear grayed out
- Touch targets are adequately sized for mobile

### Screenshots to Capture

Please capture screenshots at these key breakpoints:
1. **320px width** - Icon-only mode
2. **360px width** - Short labels (Galaxy S5)
3. **375px width** - Short labels (iPhone SE)
4. **640px width** - Full labels start appearing
5. **1024px width** - Desktop view

### Expected Results

- ✅ No text truncation at any viewport size
- ✅ Professional, clear navigation on all devices
- ✅ Icons provide visual clarity even without labels
- ✅ Smooth transition between responsive states
- ✅ Maintains accessibility and usability

### Notes

- The custom `xs` breakpoint (380px) provides fine-grained control between very small and small mobile devices
- Icons are from `lucide-react` and match the app's existing design language
- The solution is progressive - icons only on tiniest screens, then adds labels as space allows
