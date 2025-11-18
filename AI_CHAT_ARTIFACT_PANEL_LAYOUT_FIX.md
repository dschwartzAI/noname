# AI Chat Artifact Panel Layout Fix ✅

## Problem

When the artifact side panel was streaming content, it was pushing down the main chat area, making the text input form disappear off-screen. The artifact panel and main chat area were not independently scrollable.

## Root Cause

The issue was caused by missing `min-h-0` constraints on flexbox containers. In CSS flexbox, flex items have a default `min-height: auto`, which means they will try to expand to fit their content. This caused:

1. The artifact panel content to push against the main chat area
2. The main chat area to expand beyond the viewport
3. The input form to be pushed off-screen

## Solution

Added `min-h-0` to all flex containers to ensure proper height constraints and independent scrolling.

### Changes Made

#### 1. Main Chat Container (`src/routes/_authenticated/ai-chat/$conversationId.tsx`)

**Before:**
```tsx
<div className="flex flex-col h-full overflow-hidden">
  <Conversation className="flex-1 overflow-y-auto">
```

**After:**
```tsx
<div className="flex flex-col h-full min-h-0 overflow-hidden">
  <Conversation className="flex-1 min-h-0 overflow-y-auto">
```

**Why:** `min-h-0` allows the flex child to shrink below its content size, enabling proper scrolling.

#### 2. PanelGroup and Panels

**Before:**
```tsx
<PanelGroup direction="horizontal" className="h-full">
  <Panel defaultSize={55} minSize={30}>
```

**After:**
```tsx
<PanelGroup direction="horizontal" className="h-full min-h-0">
  <Panel defaultSize={55} minSize={30} className="min-h-0">
```

**Why:** Ensures panels don't expand beyond the viewport height.

#### 3. Artifact Side Panel (`src/components/artifacts/artifact-side-panel.tsx`)

**Before:**
```tsx
<div className={cn('flex flex-col h-full bg-background ...', className)}>
  <div className='sticky top-0 z-10 bg-background border-b p-4 space-y-3'>
  <div className='flex-1 overflow-hidden px-4 py-4'>
```

**After:**
```tsx
<div className={cn('flex flex-col h-full min-h-0 bg-background ...', className)}>
  <div className='sticky top-0 z-10 bg-background border-b p-4 space-y-3 flex-shrink-0'>
  <div className='flex-1 min-h-0 overflow-hidden px-4 py-4'>
```

**Why:** 
- `min-h-0` on container allows proper flex behavior
- `flex-shrink-0` on header keeps it fixed at top
- `min-h-0` on content area enables independent scrolling

## How It Works Now

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ PanelGroup (h-full min-h-0)                              │
├──────────────────────────┬──────────────────────────────┤
│ Panel (min-h-0)          │ Panel (min-h-0)              │
│                          │                              │
│ ┌──────────────────────┐ │ ┌────────────────────────┐ │
│ │ Header (flex-shrink-0)│ │ │ Header (flex-shrink-0)│ │
│ ├──────────────────────┤ │ ├────────────────────────┤ │
│ │                      │ │ │                        │ │
│ │ Conversation         │ │ │ Artifact Content      │ │
│ │ (flex-1 min-h-0)     │ │ │ (flex-1 min-h-0)      │ │
│ │ [scrollable]         │ │ │ [scrollable]          │ │
│ │                      │ │ │                        │ │
│ ├──────────────────────┤ │ └────────────────────────┘ │
│ │ Input (flex-shrink-0)│ │                              │
│ └──────────────────────┘ │                              │
└──────────────────────────┴──────────────────────────────┘
```

### Key Principles

1. **`min-h-0` on flex containers** - Allows flex items to shrink below content size
2. **`flex-1` on scrollable areas** - Takes available space
3. **`flex-shrink-0` on fixed elements** - Prevents shrinking (headers, inputs)
4. **`overflow-hidden` on containers** - Prevents content from breaking out
5. **`overflow-y-auto` on scrollable areas** - Enables scrolling

## Result

✅ **Main chat area** stays fixed height, scrolls independently  
✅ **Artifact panel** stays fixed height, scrolls independently  
✅ **Input form** always visible at bottom of main chat  
✅ **No layout shift** when artifact content streams in  
✅ **Both panels** can scroll independently without affecting each other  

## Testing Checklist

✅ Open AI chat conversation  
✅ Generate response with artifact  
✅ Verify artifact panel opens on right side  
✅ Verify main chat area doesn't expand  
✅ Verify input form stays visible at bottom  
✅ Scroll main chat - should scroll independently  
✅ Scroll artifact panel - should scroll independently  
✅ Stream long artifact content - main chat shouldn't move  
✅ Resize panels - both should maintain proper scrolling  

## Technical Notes

### Why `min-h-0` is Critical

In CSS flexbox, the default `min-height: auto` means flex items won't shrink below their content size. This causes:

```css
/* Without min-h-0 */
.flex-item {
  min-height: auto; /* Default - won't shrink below content */
}

/* With min-h-0 */
.flex-item {
  min-height: 0; /* Can shrink below content, enabling scroll */
}
```

### Flexbox Height Calculation

```
Container height: 100vh
├─ Header: auto (content height)
├─ Scrollable area: flex-1 (remaining space)
└─ Footer: auto (content height)
```

With `min-h-0`, the scrollable area can be smaller than its content, enabling scrolling.

---

**Status**: ✅ Complete  
**Date**: 2025-11-17  
**Impact**: Artifact panel and main chat now scroll independently, input always visible

