# 📸 Screenshot Generation for PR #27

## 🚀 Quick Setup

1. **Start dev server**: `npm run dev` 
2. **Open these URLs** in your browser
3. **Take full-page screenshots** 
4. **Save as PNG files** with the names below
5. **Replace this file** with actual screenshots

## 📱 URLs to Screenshot

### 1. Loading State
```
http://localhost:3000/split?names=Alice&amounts=25.00&total=25.00&note=Test&phone=5551234567
```
*Capture quickly while loading - save as: `split-page-loading.png`*

### 2. Success State - Desktop
```
http://localhost:3000/split?names=Alice%20Johnson%2CBob%20Smith%2CCharlie%20Brown&amounts=32.50%2C19.50%2C13.00&total=65.00&note=Delicious%20Pizza%20Palace&phone=5551234567&date=2024-01-15
```
*Desktop browser - save as: `split-page-success-desktop.png`*

### 3. Success State - Mobile
*Same URL as above, mobile viewport (375px width) - save as: `split-page-success-mobile.png`*

### 4. Error State
```
http://localhost:3000/split?names=Alice&amounts=invalid
```
*Any browser - save as: `split-page-error.png`*

### 5. Minimal Data
```
http://localhost:3000/split?names=Alice&amounts=32.50&total=32.50&note=Coffee&phone=5551234567
```
*Desktop browser - save as: `split-page-minimal.png`*

## ✨ Expected Results

Once screenshots are added, they'll automatically appear in the PR description showing:
- Beautiful loading animations
- Clean split summary layout  
- Individual amount cards
- Error handling with helpful tips
- Mobile responsive design
- Phone number integration