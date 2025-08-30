# PR #27 Screenshot Instructions

## 📸 Screenshots to Capture

1. **split-page-loading.png** - Loading state with spinner
2. **split-page-success-desktop.png** - Success state on desktop
3. **split-page-success-mobile.png** - Success state on mobile  
4. **split-page-error.png** - Error state with helpful tips
5. **split-page-minimal.png** - Minimal data (no date field)

## 🔗 Test URLs

Start dev server first: `npm run dev`

### Success States:
```
# Full data example:
http://localhost:3000/split?names=Alice%20Johnson%2CBob%20Smith%2CCharlie%20Brown&amounts=32.50%2C19.50%2C13.00&total=65.00&note=Delicious%20Pizza%20Palace&phone=5551234567&date=2024-01-15

# Minimal example (no date):
http://localhost:3000/split?names=Alice&amounts=32.50&total=32.50&note=Coffee&phone=5551234567
```

### Error States:
```
# Missing required fields:
http://localhost:3000/split?names=Alice&amounts=25.00&total=25.00

# Invalid data:
http://localhost:3000/split?names=Alice&amounts=invalid&total=50&note=Test&phone=5551234567
```

## 📱 Capture Instructions

1. Open browser to URLs above
2. Take full-page screenshots
3. Save as PNG files with names listed above
4. Replace this instruction file with actual screenshots

The screenshots will show up in the PR description automatically once committed.