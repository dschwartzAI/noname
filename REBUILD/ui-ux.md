# UI/UX Design Guide for Rebuild

> **Purpose**: This document captures the current LibreChat UI/UX patterns to guide the rebuild. Use this to understand what to keep (✅ KEEP), enhance (🔧 ENHANCE), or remove (❌ STRIP) in the new implementation.

---

## Table of Contents

1. [Overall Layout Architecture](#overall-layout-architecture)
2. [Navigation & Shell](#navigation--shell)
3. [Chat Interface](#chat-interface)
4. [Agent Builder](#agent-builder)
5. [RAG/File Management](#ragfile-management)
6. [LMS Overlays](#lms-overlays)
7. [Group Chat (CometChat)](#group-chat-cometchat)
8. [Settings & Configuration](#settings--configuration)
9. [Mobile Responsiveness](#mobile-responsiveness)
10. [Design System](#design-system)
11. [Recommendations Summary](#recommendations-summary)

---

## Overall Layout Architecture

### Current Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [☰] Logo          [Model Selector ▼]      [User Menu ⚙︎]  │  ← Header
├──────────┬──────────────────────────────────────────────────┤
│          │                                                   │
│  Side    │                                                   │
│  Panel   │            Main Content Area                      │
│          │                                                   │
│  - New   │                                                   │
│  - Convos│                                                   │
│  - Search│                                                   │
│  - Tags  │                                                   │
│          │                                                   │
│          │                                                   │
│          │                                                   │
├──────────┴──────────────────────────────────────────────────┤
│  [Message Input with Attachments]                      [→]  │  ← Input Bar
└─────────────────────────────────────────────────────────────┘
```

### Decision Matrix

| Element | Keep/Strip | Notes |
|---------|-----------|-------|
| **Three-column layout** | 🔧 ENHANCE | Keep, but make collapsible. Add better responsive behavior |
| **Fixed header** | ✅ KEEP | Essential for navigation |
| **Collapsible sidebar** | ✅ KEEP | Critical for conversation history |
| **Bottom input bar** | ✅ KEEP | Industry standard (ChatGPT, Claude) |
| **Right sidebar** (current: empty) | ❌ STRIP | Not used, wastes space |

---

## Navigation & Shell

### 1. Top Navigation Bar

**Current Implementation:**

```tsx
// Current: Header Component
<Header>
  <MenuToggle />              // Hamburger menu (mobile)
  <Logo />                    // Brand logo
  <ModelSelector />           // Dropdown: GPT-4, Claude, etc.
  <NotificationBell />        // (if any notifications)
  <UserMenu>                  // Avatar dropdown
    - Profile
    - Settings
    - Logout
  </UserMenu>
</Header>
```

**Visual Example:**

```
┌────────────────────────────────────────────────────────────┐
│ [☰]  LibreChat    [GPT-4 Turbo ▼]      [🔔]  [Avatar ▼]  │
└────────────────────────────────────────────────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Hamburger menu | ✅ KEEP | Mobile navigation essential |
| Logo | ✅ KEEP | Branding (white-label ready) |
| Model selector | 🔧 ENHANCE | Move to conversation settings (per-chat model) |
| Notification bell | ❌ STRIP | Not currently functional, add back if needed later |
| User menu | ✅ KEEP | Essential for settings/logout |

**Enhancement Notes:**
- Make model selector **per-conversation** instead of global
- Add workspace/tenant switcher (for multi-tenancy)
- Add "breadcrumb" navigation for nested views (e.g., LMS course → module)

---

### 2. Left Sidebar (Conversation History)

**Current Implementation:**

```tsx
// Current: Sidebar Component
<Sidebar collapsed={isSidebarCollapsed}>
  <NewChatButton />           // "+ New Chat"
  
  <SearchBar />               // Search conversations
  
  <ConversationList>
    <TimeGroup label="Today">
      <ConversationItem 
        title="Marketing strategy..."
        timestamp="2:34 PM"
        active={true}
      />
      <ConversationItem />
    </TimeGroup>
    
    <TimeGroup label="Yesterday">
      ...
    </TimeGroup>
    
    <TimeGroup label="Last 7 Days">
      ...
    </TimeGroup>
  </ConversationList>
  
  <TagFilter />               // Filter by tags
  
  <SidebarFooter>
    <Settings />
    <Help />
  </SidebarFooter>
</Sidebar>
```

**Visual Example:**

```
┌──────────────────┐
│  + New Chat      │
├──────────────────┤
│  [Search...]     │
├──────────────────┤
│  Today           │
│  • Marketing...  │ ← Active
│  • Debug issue   │
│                  │
│  Yesterday       │
│  • Weekly plan   │
│  • Code review   │
│                  │
│  Last 7 Days     │
│  • Brainstorm    │
│  ...             │
├──────────────────┤
│  Tags: ▼         │
│  #work #personal │
└──────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| New Chat button | ✅ KEEP | Core action, keep prominent |
| Search bar | ✅ KEEP | Essential for finding conversations |
| Time-grouped list | 🔧 ENHANCE | Keep, but add folder/project grouping |
| Tag filtering | ✅ KEEP | Good for organization |
| Conversation previews | 🔧 ENHANCE | Show first message snippet |
| Edit/delete on hover | ✅ KEEP | Context menu pattern works |
| Sidebar collapse | ✅ KEEP | Critical for screen real estate |

**Enhancement Notes:**
- Add **folder/project** organization (not just time-based)
- Add **pinned conversations** at the top
- Add **shared conversations** section (for team chats)
- Add **archive** option (hide old convos without deleting)
- Add **bulk actions** (select multiple, delete, tag, move)

---

### 3. Right Sidebar (Currently Unused)

**Current State:** Empty or minimal usage

**Decision:** ❌ **STRIP** - Reclaim space for main content

**Alternative Uses (if needed later):**
- Context panel (show agent tools, RAG sources)
- Collaboration panel (see who's viewing/editing)
- Assistant details (model, temperature, system prompt)

---

## Chat Interface

### 1. Message Display Area

**Current Implementation:**

```tsx
// Current: Messages Container
<MessagesContainer>
  <MessageGroup role="user">
    <Avatar user={currentUser} />
    <MessageBubble>
      <MessageContent>
        How do I implement rate limiting in Node.js?
      </MessageContent>
      <MessageActions>
        <Copy />
        <Edit />
        <Delete />
      </MessageActions>
    </MessageBubble>
    <Timestamp>2:34 PM</Timestamp>
  </MessageGroup>
  
  <MessageGroup role="assistant">
    <Avatar model="gpt-4" />
    <MessageBubble>
      <MessageContent markdown={true}>
        Here are several approaches to rate limiting...
        
        ```javascript
        const rateLimit = require('express-rate-limit');
        ```
      </MessageContent>
      <MessageActions>
        <Copy />
        <Regenerate />
        <ThumbsUp />
        <ThumbsDown />
      </MessageActions>
    </MessageBubble>
    <ModelBadge>GPT-4</ModelBadge>
  </MessageGroup>
  
  {/* Streaming message */}
  <MessageGroup role="assistant" streaming={true}>
    <Avatar model="claude" />
    <MessageBubble>
      <MessageContent>
        To implement rate limiting▊
      </MessageContent>
      <StopButton />
    </MessageBubble>
  </MessageGroup>
</MessagesContainer>
```

**Visual Example:**

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  [👤] You                               2:34 PM       │
│  ┌──────────────────────────────────────────────┐    │
│  │ How do I implement rate limiting in Node.js? │    │
│  └──────────────────────────────────────────────┘    │
│       [📋 Copy] [✏️ Edit] [🗑️ Delete]                │
│                                                        │
│  [🤖] GPT-4                             2:34 PM       │
│  ┌──────────────────────────────────────────────┐    │
│  │ Here are several approaches...               │    │
│  │                                               │    │
│  │ ```javascript                                 │    │
│  │ const rateLimit = require('express-rate..    │    │
│  │ ```                                           │    │
│  └──────────────────────────────────────────────┘    │
│       [📋 Copy] [🔄 Regenerate] [👍] [👎]            │
│                                                        │
│  [🤖] Claude                            2:35 PM       │
│  ┌──────────────────────────────────────────────┐    │
│  │ To implement rate limiting▊                  │    │
│  └──────────────────────────────────────────────┘    │
│       [⏹️ Stop]                                       │
└────────────────────────────────────────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Message bubbles | 🔧 ENHANCE | Keep, but improve contrast/shadows |
| User/AI avatars | ✅ KEEP | Visual distinction is important |
| Markdown rendering | ✅ KEEP | Essential for code, lists, formatting |
| Code syntax highlighting | ✅ KEEP | Core feature for dev chat |
| Copy button | ✅ KEEP | High usage feature |
| Edit message | ✅ KEEP | Allows message refinement |
| Regenerate | ✅ KEEP | Core feature for iterating responses |
| Thumbs up/down | ❌ STRIP | Low usage, add back if training models |
| Timestamp | ✅ KEEP | Context is useful |
| Model badge | ✅ KEEP | Shows which model answered |
| Stop button | ✅ KEEP | Critical for long responses |

**Enhancement Notes:**
- Add **streaming indicators** (typewriter effect, word-by-word reveal)
- Add **message threading** (reply to specific message)
- Add **collapsible code blocks** (for long code)
- Add **"branch from here"** option (fork conversation at any message)
- Add **inline edits** (click to edit without modal)

---

### 2. Artifacts (Generated Content)

**Current Implementation:**

```tsx
// Current: Artifact Display
<MessageBubble>
  <ArtifactPreview type="code">
    <ArtifactHeader>
      <Icon type="code" />
      <Title>rate-limiter.js</Title>
      <Actions>
        <OpenInNew />      // Open in full view
        <Download />
        <Copy />
      </Actions>
    </ArtifactHeader>
    
    <ArtifactContent>
      <CodeEditor 
        language="javascript"
        readonly={true}
        code={artifactCode}
      />
    </ArtifactContent>
    
    <ArtifactFooter>
      <DeployToVercel />   // ← Custom action
      <PushToGithub />     // ← Custom action
    </ArtifactFooter>
  </ArtifactPreview>
</MessageBubble>
```

**Visual Example:**

```
┌────────────────────────────────────────────────────────┐
│  [🤖] GPT-4                             2:35 PM       │
│  ┌──────────────────────────────────────────────┐    │
│  │ I've created a rate limiter for you:        │    │
│  │                                               │    │
│  │ ┌─────────────────────────────────────────┐ │    │
│  │ │ 📄 rate-limiter.js     [⤢] [↓] [📋]   │ │    │
│  │ ├─────────────────────────────────────────┤ │    │
│  │ │ const rateLimit = require('express-..   │ │    │
│  │ │ const limiter = rateLimit({             │ │    │
│  │ │   windowMs: 15 * 60 * 1000,             │ │    │
│  │ │   max: 100                               │ │    │
│  │ │ });                                      │ │    │
│  │ ├─────────────────────────────────────────┤ │    │
│  │ │ [🚀 Deploy to Vercel] [📤 Push to GH]  │ │    │
│  │ └─────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Artifact inline preview | ✅ KEEP | Core feature, high value |
| Full-screen artifact view | ✅ KEEP | For complex artifacts |
| Syntax highlighting | ✅ KEEP | Essential for code |
| Download button | ✅ KEEP | Common user action |
| Copy button | ✅ KEEP | Quick action |
| **Deploy to Vercel** | ✅ KEEP | **High-value differentiator** |
| **Push to GitHub** | ✅ KEEP | **High-value differentiator** |
| **Push to Google Docs** | ✅ KEEP | **High-value differentiator** |
| Edit artifact | 🔧 ENHANCE | Add inline editing |
| Version history | 🔧 ENHANCE | Show previous versions |

**New Actions to Add:**
- **Deploy to Cloudflare Workers**
- **Create Gist**
- **Share as link** (public artifact URL)
- **Add to project** (save to workspace)
- **Run in sandbox** (for code execution)

**Enhancement Notes:**
- Add **artifact library** (view all generated artifacts)
- Add **artifact search** (find past artifacts)
- Add **artifact tagging** (organize artifacts)
- Add **artifact versioning** (track changes)
- Add **artifact templates** (reuse patterns)

---

### 3. Message Input Bar

**Current Implementation:**

```tsx
// Current: Input Bar Component
<InputBar>
  <AttachmentButton>
    <FileUpload />        // Upload docs for RAG
    <ImageUpload />       // Upload images
  </AttachmentButton>
  
  <TextArea 
    placeholder="Message LibreChat..."
    autoResize={true}
    maxRows={6}
    onSubmit={handleSubmit}
  />
  
  <AttachmentPreview>
    {files.map(file => (
      <FileChip 
        name={file.name}
        size={file.size}
        onRemove={() => removeFile(file.id)}
      />
    ))}
  </AttachmentPreview>
  
  <InputActions>
    <CharacterCount>450 / 32,000</CharacterCount>
    <SendButton disabled={!message.trim()} />
  </InputActions>
</InputBar>
```

**Visual Example:**

```
┌────────────────────────────────────────────────────────┐
│  [📎] [Message LibreChat...                      ] [→] │
│                                                        │
│  Attachments: [📄 doc.pdf ✕] [🖼️ image.png ✕]        │
│                                      450 / 32,000      │
└────────────────────────────────────────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Auto-resizing textarea | ✅ KEEP | Better UX than fixed height |
| Attachment button | ✅ KEEP | Essential for RAG/vision |
| File preview chips | ✅ KEEP | Show what's attached |
| Character count | ❌ STRIP | Token count more useful |
| Send button | ✅ KEEP | Clear action, mobile-friendly |
| Shift+Enter for newline | ✅ KEEP | Standard behavior |

**Enhancement Notes:**
- Add **token count** (replace character count)
- Add **@ mentions** (reference agents, files, people)
- Add **/ commands** (/web, /code, /image)
- Add **voice input** button
- Add **quick actions** (suggest common prompts)
- Add **prompt templates** (load saved prompts)

---

## Agent Builder

### Current Implementation

**Layout:**

```tsx
// Current: Agent Builder Modal/Page
<AgentBuilder>
  <Header>
    <BackButton />
    <Title>Create Agent</Title>
    <SaveButton />
  </Header>
  
  <Form>
    <Section title="Basic Info">
      <Input label="Name" placeholder="Marketing Assistant" />
      <Textarea label="Description" />
      <IconPicker label="Icon" />
    </Section>
    
    <Section title="Instructions">
      <Textarea 
        label="System Prompt"
        placeholder="You are a helpful marketing assistant..."
        rows={8}
      />
    </Section>
    
    <Section title="Model Configuration">
      <Select label="Model" options={models} />
      <Slider label="Temperature" min={0} max={2} step={0.1} />
      <Slider label="Max Tokens" min={100} max={4000} />
    </Section>
    
    <Section title="Tools">
      <ToolSelector>
        <ToolCard name="Web Search" enabled={true} />
        <ToolCard name="Code Interpreter" enabled={false} />
        <ToolCard name="Image Generation" enabled={true} />
      </ToolSelector>
    </Section>
    
    <Section title="Knowledge Base">
      <FileUploader 
        accept=".pdf,.txt,.docx"
        multiple={true}
      />
      <FileList>
        {files.map(file => (
          <FileItem file={file} onDelete={deleteFile} />
        ))}
      </FileList>
    </Section>
    
    <Section title="Actions">
      <ActionBuilder>
        <ActionCard 
          name="Search Notion"
          endpoint="/api/notion/search"
        />
        <AddActionButton />
      </ActionBuilder>
    </Section>
  </Form>
</AgentBuilder>
```

**Visual Example:**

```
┌────────────────────────────────────────────────────────┐
│  [←] Create Agent                            [Save]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Basic Info                                            │
│  ┌──────────────────────────────────────────────┐    │
│  │ Name:        [Marketing Assistant          ] │    │
│  │ Description: [Helps with marketing...      ] │    │
│  │ Icon:        [🎯] [Change]                  │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  Instructions                                          │
│  ┌──────────────────────────────────────────────┐    │
│  │ You are a helpful marketing assistant...    │    │
│  │                                               │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  Model Configuration                                   │
│  ┌──────────────────────────────────────────────┐    │
│  │ Model:       [GPT-4 Turbo ▼]                │    │
│  │ Temperature: [========o-----] 0.7            │    │
│  │ Max Tokens:  [============o-] 2000           │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  Tools                                                 │
│  ┌────────────┬────────────┬────────────┐           │
│  │ ✓ Web     │ ✗ Code     │ ✓ Image   │           │
│  │   Search   │   Interp.  │   Gen      │           │
│  └────────────┴────────────┴────────────┘           │
│                                                        │
│  Knowledge Base                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │ [+ Upload Files]                             │    │
│  │                                               │    │
│  │ • marketing-guide.pdf          [🗑️]         │    │
│  │ • brand-guidelines.docx        [🗑️]         │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  Actions                                               │
│  ┌──────────────────────────────────────────────┐    │
│  │ • Search Notion  [⚙️]                        │    │
│  │ [+ Add Action]                                │    │
│  └──────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Basic info section | ✅ KEEP | Essential metadata |
| Icon picker | ✅ KEEP | Visual distinction for agents |
| System prompt editor | ✅ KEEP | Core agent configuration |
| Model configuration | ✅ KEEP | Per-agent model settings |
| Temperature/token sliders | 🔧 ENHANCE | Add preset buttons (Creative, Balanced, Precise) |
| Tool selector | ✅ KEEP | Enable/disable agent capabilities |
| Knowledge base uploader | ✅ KEEP | RAG per agent |
| Custom actions | ✅ KEEP | Differentiator (oRPC) |
| Save/delete buttons | ✅ KEEP | Standard CRUD |

**Enhancement Notes:**
- Add **agent templates** (start from Marketing, Code, Research presets)
- Add **test mode** (test agent before saving)
- Add **version history** (track changes to agent config)
- Add **agent marketplace** (share/discover agents)
- Add **usage analytics** (show agent performance metrics)
- Add **collaborative editing** (team can edit agents)

---

## RAG/File Management

### Current Implementation

**Upload Flow:**

```tsx
// Current: File Upload Interface
<RAGUploader>
  <DropZone 
    onDrop={handleFileDrop}
    accept=".pdf,.txt,.docx,.md"
  >
    <Icon>📁</Icon>
    <Text>Drop files here or click to browse</Text>
    <Text secondary>PDF, TXT, DOCX, MD (Max 10MB)</Text>
  </DropZone>
  
  <FileQueue>
    {uploads.map(file => (
      <FileUploadItem>
        <FileIcon type={file.extension} />
        <FileName>{file.name}</FileName>
        <ProgressBar progress={file.progress} />
        <Status>{file.status}</Status>
        <CancelButton />
      </FileUploadItem>
    ))}
  </FileQueue>
</RAGUploader>
```

**File Library:**

```tsx
// Current: File Management View
<FileLibrary>
  <Toolbar>
    <SearchBar placeholder="Search files..." />
    <FilterDropdown>
      <Option>All Files</Option>
      <Option>PDFs</Option>
      <Option>Documents</Option>
      <Option>Images</Option>
    </FilterDropdown>
    <SortDropdown>
      <Option>Recent</Option>
      <Option>Name</Option>
      <Option>Size</Option>
    </SortDropdown>
    <UploadButton />
  </Toolbar>
  
  <FileGrid>
    {files.map(file => (
      <FileCard>
        <FileThumbnail src={file.thumbnail} />
        <FileName>{file.name}</FileName>
        <FileMetadata>
          <Size>{file.size}</Size>
          <Date>{file.uploadedAt}</Date>
        </FileMetadata>
        <FileActions>
          <View />
          <Download />
          <Delete />
        </FileActions>
      </FileCard>
    ))}
  </FileGrid>
</FileLibrary>
```

**Visual Example:**

```
┌────────────────────────────────────────────────────────┐
│  [Search files...]  [All ▼]  [Recent ▼]  [+ Upload]  │
├────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │   PDF    │  │   TXT    │  │   DOCX   │           │
│  │          │  │          │  │          │           │
│  │ guide.pdf│  │ notes.txt│  │ doc.docx │           │
│  │ 2.4 MB   │  │ 45 KB    │  │ 1.2 MB   │           │
│  │ 2 days ago│  │ Today    │  │ Yesterday│           │
│  │ [👁️][↓][🗑️]│  │ [👁️][↓][🗑️]│  │ [👁️][↓][🗑️]│           │
│  └──────────┘  └──────────┘  └──────────┘           │
└────────────────────────────────────────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Drag-and-drop upload | ✅ KEEP | Modern, intuitive |
| File type restrictions | ✅ KEEP | Important for processing |
| Upload progress | ✅ KEEP | Good feedback |
| File library/grid view | ✅ KEEP | Organize uploads |
| Search/filter | ✅ KEEP | Find files quickly |
| Thumbnail previews | 🔧 ENHANCE | Generate thumbnails server-side |
| File metadata | ✅ KEEP | Useful context |
| View/download/delete | ✅ KEEP | Standard file actions |

**Enhancement Notes:**
- Add **vector search** (semantic file search)
- Add **file tagging** (organize by project/topic)
- Add **file sharing** (share with team members)
- Add **file versioning** (track updates)
- Add **OCR support** (extract text from images/scans)
- Add **batch operations** (select multiple, delete, tag)
- Add **storage quota indicator** (show usage)

---

## LMS Overlays

### Current Implementation

**Course List View:**

```tsx
// Current: LMS Course Listing
<LMSView>
  <Header>
    <Title>Academy</Title>
    <SearchBar />
    <FilterTabs>
      <Tab active>All Courses</Tab>
      <Tab>In Progress</Tab>
      <Tab>Completed</Tab>
    </FilterTabs>
  </Header>
  
  <CourseGrid>
    {courses.map(course => (
      <CourseCard>
        <CourseThumbnail src={course.image} />
        <CourseInfo>
          <CourseTitle>{course.name}</CourseTitle>
          <CourseInstructor>{course.instructor}</CourseInstructor>
          <CourseProgress value={course.progress} />
          <CourseMeta>
            <Duration>{course.duration}</Duration>
            <ModuleCount>{course.modules.length} modules</ModuleCount>
          </CourseMeta>
        </CourseInfo>
        <CourseActions>
          <ContinueButton />
        </CourseActions>
      </CourseCard>
    ))}
  </CourseGrid>
</LMSView>
```

**Course Detail View:**

```tsx
// Current: Course Page
<CoursePage>
  <CourseHeader>
    <BackButton />
    <CourseBanner src={course.banner} />
    <CourseTitle>{course.name}</CourseTitle>
    <CourseDescription>{course.description}</CourseDescription>
    <EnrollButton />
  </CourseHeader>
  
  <CourseContent>
    <Sidebar>
      <ModuleList>
        {course.modules.map(module => (
          <ModuleItem active={module.id === currentModule}>
            <ModuleTitle>{module.name}</ModuleTitle>
            <LessonCount>{module.lessons.length} lessons</LessonCount>
            <ProgressIndicator value={module.progress} />
          </ModuleItem>
        ))}
      </ModuleList>
    </Sidebar>
    
    <MainContent>
      {/* Video Player */}
      <VideoPlayer 
        src={currentLesson.videoUrl}
        onComplete={markComplete}
      />
      
      {/* Lesson Content */}
      <LessonContent>
        <LessonTitle>{currentLesson.title}</LessonTitle>
        <LessonDescription>{currentLesson.description}</LessonDescription>
        
        {/* Transcript */}
        <Transcript>
          {currentLesson.transcript}
        </Transcript>
      </LessonContent>
      
      {/* Navigation */}
      <LessonNavigation>
        <PreviousButton />
        <NextButton />
      </LessonNavigation>
    </MainContent>
  </CourseContent>
</CoursePage>
```

**Visual Example (Course List):**

```
┌────────────────────────────────────────────────────────┐
│  Academy                              [Search...]      │
│  [All] [In Progress] [Completed]                      │
├────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ [Image]  │  │ [Image]  │  │ [Image]  │           │
│  │          │  │          │  │          │           │
│  │ Marketing│  │ Sales    │  │ Product  │           │
│  │ 101      │  │ Mastery  │  │ Strategy │           │
│  │          │  │          │  │          │           │
│  │ By John  │  │ By Sarah │  │ By Mike  │           │
│  │ ████░░░  │  │ ██░░░░░  │  │ ██████░  │           │
│  │ 40%      │  │ 20%      │  │ 60%      │           │
│  │ 8 modules│  │ 12 module│  │ 6 modules│           │
│  │ [Continue]│  │ [Continue]│  │ [Continue]│           │
│  └──────────┘  └──────────┘  └──────────┘           │
└────────────────────────────────────────────────────┘
```

**Visual Example (Course Detail):**

```
┌────────────────────────────────────────────────────────┐
│  [←] Marketing 101                                     │
│  ┌──────────────────────────────────────────────┐    │
│  │          [Course Banner Image]               │    │
│  └──────────────────────────────────────────────┘    │
│  Learn the fundamentals of digital marketing...      │
│  [Enroll Now]                                         │
├────────────┬───────────────────────────────────────────┤
│ Modules    │  [Video Player]                          │
│            │  ┌─────────────────────────────────┐    │
│ • Intro ✓  │  │      [▶️ Play]                  │    │
│ • Basics ◉ │  │                                 │    │
│ • Advanced │  └─────────────────────────────────┘    │
│ • Project  │                                          │
│            │  Lesson 1: Understanding Your Audience   │
│            │  In this lesson, we'll cover...          │
│            │                                          │
│            │  Transcript:                             │
│            │  "Welcome to Marketing 101..."           │
│            │                                          │
│            │  [← Previous]            [Next →]       │
└────────────┴───────────────────────────────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Course grid layout | ✅ KEEP | Standard LMS pattern |
| Course thumbnails | ✅ KEEP | Visual appeal |
| Progress indicators | ✅ KEEP | Shows completion |
| Module sidebar | ✅ KEEP | Easy navigation |
| Video player | ✅ KEEP | Core LMS feature |
| Transcript | ✅ KEEP | Accessibility + searchability |
| Lesson navigation | ✅ KEEP | Standard UX |
| Enroll button | 🔧 ENHANCE | Make more prominent |

**Enhancement Notes:**
- Add **video recording integration** (from Stream/custom)
- Add **playback speed control**
- Add **video bookmarks** (save specific timestamps)
- Add **notes section** (take notes while watching)
- Add **discussion forum** (per lesson/module)
- Add **quiz/assessment** system
- Add **certificate generation** (on completion)
- Add **download for offline** viewing

---

## Group Chat (CometChat)

### Current Implementation

**Group Chat Layout:**

```tsx
// Current: CometChat Integration
<GroupChatView>
  <Header>
    <BackButton />
    <GroupInfo>
      <GroupAvatar src={group.avatar} />
      <GroupName>{group.name}</GroupName>
      <MemberCount>{group.memberCount} members</MemberCount>
    </GroupInfo>
    <GroupActions>
      <SearchMessages />
      <GroupSettings />
    </GroupActions>
  </Header>
  
  <MessagesContainer>
    {messages.map(msg => (
      <GroupMessage>
        <Avatar src={msg.sender.avatar} />
        <MessageContent>
          <SenderName>{msg.sender.name}</SenderName>
          <MessageText>{msg.text}</MessageText>
          <Timestamp>{msg.timestamp}</Timestamp>
        </MessageContent>
        <MessageReactions>
          {msg.reactions.map(reaction => (
            <Reaction emoji={reaction.emoji} count={reaction.count} />
          ))}
        </MessageReactions>
      </GroupMessage>
    ))}
  </MessagesContainer>
  
  <TypingIndicator>
    {typingUsers.map(user => `${user.name} is typing...`)}
  </TypingIndicator>
  
  <InputBar>
    <EmojiPicker />
    <TextArea placeholder="Type a message..." />
    <SendButton />
  </InputBar>
  
  <MembersSidebar>
    <MemberList>
      {members.map(member => (
        <MemberItem>
          <Avatar src={member.avatar} online={member.online} />
          <MemberName>{member.name}</MemberName>
          <MemberRole>{member.role}</MemberRole>
        </MemberItem>
      ))}
    </MemberList>
  </MembersSidebar>
</GroupChatView>
```

**Visual Example:**

```
┌────────────────────────────────────────────────────────┐
│  [←] [👥] Team Chat            🔍  ⚙️                  │
│       12 members online                                │
├────────────────────────────────────┬───────────────────┤
│  [Avatar] Alice                    │ Members           │
│  Hey team, here's the update...    │ ┌───────────────┐ │
│  2:34 PM                           │ │ 🟢 Alice      │ │
│  👍 3  🎉 1                        │ │    Admin      │ │
│                                    │ ├───────────────┤ │
│  [Avatar] Bob                      │ │ 🟢 Bob        │ │
│  Thanks! Looking good              │ │    Member     │ │
│  2:35 PM                           │ ├───────────────┤ │
│                                    │ │ ⚪ Charlie    │ │
│  [Avatar] Charlie                  │ │    Member     │ │
│  I'll review by EOD                │ └───────────────┘ │
│  2:36 PM                           │                   │
│                                    │                   │
│  Alice is typing...                │                   │
├────────────────────────────────────┴───────────────────┤
│  [😊] [Type a message...]                         [→]  │
└────────────────────────────────────────────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Group header with info | ✅ KEEP | Context for conversation |
| Member list sidebar | ✅ KEEP | See who's in the group |
| Message threading | 🔧 ENHANCE | Add reply-to functionality |
| Reactions | ✅ KEEP | Quick feedback mechanism |
| Typing indicator | ✅ KEEP | Real-time feedback |
| Emoji picker | ✅ KEEP | Expressive communication |
| File sharing | ✅ KEEP | Essential for collaboration |
| Voice messages | 🔧 ENHANCE | Add if not present |
| Video calls | 🔧 ENHANCE | Integration with Stream (later) |

**Replacement Strategy (Durable Objects):**

Since you're replacing CometChat with in-house WebSocket chat:

**New Architecture:**

```typescript
// NEW: Custom WebSocket Chat
<GroupChatView>
  {/* Same UI layout */}
  {/* But powered by Cloudflare Durable Objects */}
  {/* See features.md for implementation */}
</GroupChatView>
```

**What to Keep from CometChat UI:**
- ✅ Group chat layout (header, messages, members, input)
- ✅ Real-time message updates
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Message reactions
- ✅ File attachments

**What to Improve:**
- 🔧 Add **message search** (full-text search in Postgres)
- 🔧 Add **message pinning** (pin important messages)
- 🔧 Add **threaded replies** (reply to specific message)
- 🔧 Add **@mentions** (notify specific users)
- 🔧 Add **rich embeds** (unfurl links, show previews)

---

## Settings & Configuration

### Current Implementation

**Settings Modal/Page:**

```tsx
// Current: Settings Interface
<SettingsPage>
  <Sidebar>
    <SettingsNav>
      <NavItem active>General</NavItem>
      <NavItem>Account</NavItem>
      <NavItem>Appearance</NavItem>
      <NavItem>Data & Privacy</NavItem>
      <NavItem>API Keys</NavItem>
      <NavItem>Billing</NavItem>
    </SettingsNav>
  </Sidebar>
  
  <SettingsContent>
    {/* General Settings */}
    <Section title="General">
      <Setting>
        <Label>Language</Label>
        <Select options={languages} />
      </Setting>
      
      <Setting>
        <Label>Default Model</Label>
        <Select options={models} />
      </Setting>
      
      <Setting>
        <Label>Send Messages with Enter</Label>
        <Toggle />
      </Setting>
    </Section>
    
    {/* Account Settings */}
    <Section title="Account">
      <Setting>
        <Label>Email</Label>
        <Input value={user.email} />
      </Setting>
      
      <Setting>
        <Label>Password</Label>
        <Button>Change Password</Button>
      </Setting>
    </Section>
    
    {/* Appearance Settings */}
    <Section title="Appearance">
      <Setting>
        <Label>Theme</Label>
        <ThemeSelector>
          <ThemeOption value="light">Light</ThemeOption>
          <ThemeOption value="dark">Dark</ThemeOption>
          <ThemeOption value="auto">Auto</ThemeOption>
        </ThemeSelector>
      </Setting>
      
      <Setting>
        <Label>Font Size</Label>
        <Slider min={12} max={20} />
      </Setting>
    </Section>
    
    {/* API Keys */}
    <Section title="API Keys">
      <ApiKeyList>
        {apiKeys.map(key => (
          <ApiKeyItem>
            <KeyName>{key.name}</KeyName>
            <KeyValue masked>{key.value}</KeyValue>
            <RevokeButton />
          </ApiKeyItem>
        ))}
      </ApiKeyList>
      <CreateKeyButton />
    </Section>
  </SettingsContent>
</SettingsPage>
```

**Visual Example:**

```
┌────────────────────────────────────────────────────────┐
│  Settings                                              │
├────────────┬───────────────────────────────────────────┤
│ General ◉  │  General Settings                         │
│ Account    │  ┌──────────────────────────────────┐    │
│ Appearance │  │ Language:  [English ▼]          │    │
│ Data       │  │ Default:   [GPT-4 ▼]            │    │
│ API Keys   │  │ Enter key: [ON]                 │    │
│ Billing    │  └──────────────────────────────────┘    │
│            │                                          │
│            │  Account Settings                        │
│            │  ┌──────────────────────────────────┐    │
│            │  │ Email: [user@email.com         ] │    │
│            │  │ Password: [Change Password]      │    │
│            │  └──────────────────────────────────┘    │
│            │                                          │
│            │  Appearance                              │
│            │  ┌──────────────────────────────────┐    │
│            │  │ Theme: [☀️ Light] [🌙 Dark] [🔄 Auto]│    │
│            │  │ Font:  [──────o──] 16px          │    │
│            │  └──────────────────────────────────┘    │
└────────────┴───────────────────────────────────────────┘
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Sidebar navigation | ✅ KEEP | Organizes many settings |
| Grouped sections | ✅ KEEP | Logical organization |
| Theme switcher | ✅ KEEP | Common user preference |
| Font size control | ✅ KEEP | Accessibility |
| API key management | ✅ KEEP | Developer feature |
| Billing section | 🔧 ENHANCE | Critical for SaaS (add Stripe) |
| Data export | ✅ KEEP | GDPR compliance |

**Enhancement Notes:**
- Add **workspace settings** (multi-tenant management)
- Add **team management** (invite users, assign roles)
- Add **usage analytics** (token usage, costs)
- Add **notification preferences** (email, push, in-app)
- Add **integrations** (connect third-party services)
- Add **security settings** (2FA, sessions, audit log)

---

## Mobile Responsiveness

### Current Behavior

**Breakpoints:**

```css
/* Current responsive breakpoints */
mobile: 0-640px       /* Stack everything vertically */
tablet: 641-1024px    /* Collapsible sidebar */
desktop: 1025px+      /* Full three-column layout */
```

**Mobile Layout:**

```
Mobile (Portrait)
┌────────────────┐
│ [☰]  [⚙️]      │  ← Compact header
├────────────────┤
│                │
│    Messages    │
│    (Full       │
│     width)     │
│                │
│                │
├────────────────┤
│ [📎] [Input]   │  ← Bottom bar
└────────────────┘

Sidebar Hidden (Overlay)
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Hamburger menu | ✅ KEEP | Standard mobile pattern |
| Overlay sidebar | ✅ KEEP | Saves screen space |
| Bottom input bar | ✅ KEEP | Thumb-friendly |
| Swipe gestures | 🔧 ENHANCE | Add swipe to go back, open sidebar |
| Touch targets | 🔧 ENHANCE | Ensure 44x44px minimum |
| Pull to refresh | 🔧 ENHANCE | Update conversation list |

**Enhancement Notes:**
- Add **bottom navigation** (Home, Agents, Files, Settings)
- Add **haptic feedback** (button presses, actions)
- Add **offline support** (PWA, cache messages)
- Add **mobile-optimized input** (auto-zoom disabled, proper keyboards)

---

## Design System

### Colors

**Current Palette:**

```css
/* Light Mode */
--background: #ffffff
--foreground: #000000
--primary: #3b82f6      /* Blue */
--secondary: #6b7280    /* Gray */
--accent: #8b5cf6       /* Purple */
--muted: #f3f4f6
--border: #e5e7eb

/* Dark Mode */
--background: #0f172a
--foreground: #f1f5f9
--primary: #3b82f6
--secondary: #64748b
--accent: #8b5cf6
--muted: #1e293b
--border: #334155
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Blue primary | ✅ KEEP | Trust, professionalism |
| Purple accent | ✅ KEEP | AI/tech association |
| Dark mode | ✅ KEEP | User preference essential |
| Muted backgrounds | ✅ KEEP | Reduces eye strain |

**Enhancement Notes:**
- Add **brand colors** (customizable for white-label)
- Add **semantic colors** (success, warning, error, info)
- Add **syntax highlighting theme** (for code blocks)

---

### Typography

**Current Fonts:**

```css
--font-sans: 'Inter', sans-serif      /* UI text */
--font-mono: 'Fira Code', monospace   /* Code blocks */
```

**Decisions:**

| Element | Keep/Strip | Reasoning |
|---------|-----------|-----------|
| Inter font | ✅ KEEP | Clean, readable, modern |
| Fira Code | ✅ KEEP | Great for code (ligatures) |
| Font size scale | ✅ KEEP | Consistent hierarchy |

**Enhancement Notes:**
- Add **variable font support** (Inter Variable)
- Add **font loading strategy** (FOUT prevention)

---

### Components

**Current Component Library:**

| Component | Keep/Strip | Notes |
|-----------|-----------|-------|
| Button | ✅ KEEP | Primary, secondary, ghost variants |
| Input | ✅ KEEP | Text, textarea, number, file |
| Select | ✅ KEEP | Dropdown, multi-select |
| Modal | ✅ KEEP | For dialogs, forms |
| Toast | ✅ KEEP | Notifications |
| Tooltip | ✅ KEEP | Contextual help |
| Tabs | ✅ KEEP | Organize content |
| Card | ✅ KEEP | Content containers |
| Avatar | ✅ KEEP | User/agent representation |
| Badge | ✅ KEEP | Status indicators |
| Skeleton | ✅ KEEP | Loading states |
| Progress | ✅ KEEP | Show completion |
| Slider | ✅ KEEP | Numeric input (temperature, etc.) |

**Enhancement Notes:**
- Add **command palette** (keyboard shortcuts)
- Add **context menus** (right-click actions)
- Add **drag and drop** components
- Add **virtualized lists** (performance for long lists)

---

## Recommendations Summary

### ✅ KEEP (Core Features)

**Layout & Navigation:**
- Three-column layout (collapsible)
- Fixed header with user menu
- Left sidebar with conversation history
- Bottom input bar

**Chat Interface:**
- Message bubbles with avatars
- Markdown rendering
- Code syntax highlighting
- Streaming responses with stop button
- Message actions (copy, edit, regenerate)

**Artifacts:**
- Inline preview
- Full-screen view
- Deploy to Vercel
- Push to GitHub/Google Docs
- Syntax highlighting

**Agent Builder:**
- Visual agent creation
- System prompt editor
- Tool selector
- Knowledge base uploader
- Custom actions (oRPC)

**RAG/Files:**
- Drag-and-drop upload
- File library
- Search and filter
- File metadata

**LMS:**
- Course grid layout
- Video player
- Module navigation
- Progress tracking
- Transcripts

**Group Chat:**
- Real-time messaging
- Typing indicators
- Reactions
- Member list

**Settings:**
- Sidebar navigation
- Theme switcher
- API key management

---

### 🔧 ENHANCE (Improvements)

**Layout:**
- Better responsive breakpoints
- Swipe gestures for mobile
- Persistent state (remember sidebar collapse)

**Chat:**
- Message threading
- Branch conversations
- Inline message editing
- Voice input
- Quick prompts/templates

**Artifacts:**
- Artifact library/search
- Version history
- More deployment options (Cloudflare Workers)
- Artifact templates

**Agent Builder:**
- Agent templates (presets)
- Test mode
- Usage analytics
- Marketplace

**RAG:**
- Vector search (semantic)
- File tagging
- Batch operations
- Storage quota indicator

**LMS:**
- Video bookmarks
- Note-taking
- Discussion forums
- Quizzes/assessments
- Certificates

**Group Chat:**
- Message search
- Threaded replies
- @mentions
- Rich embeds
- Message pinning

**Settings:**
- Workspace management (multi-tenant)
- Team management
- Usage analytics
- Security settings (2FA)

---

### ❌ STRIP (Remove)

**Layout:**
- Right sidebar (unused)

**Chat:**
- Thumbs up/down (unless training models)

**UI:**
- Notification bell (not functional)
- Character count (replace with token count)

---

## Implementation Priority

### Phase 1: Core UI (Weeks 1-2)
1. Layout shell (header, sidebar, main)
2. Chat interface (messages, input)
3. Basic responsive design
4. Theme switcher

### Phase 2: Chat Features (Weeks 3-4)
1. Markdown rendering
2. Code highlighting
3. Streaming responses
4. Message actions

### Phase 3: Advanced Features (Weeks 5-8)
1. Artifacts system
2. Agent builder
3. File management
4. Settings

### Phase 4: LMS & Chat (Weeks 9-12)
1. LMS interface
2. Video player
3. Group chat (Durable Objects)
4. Mobile optimization

### Phase 5: Polish (Weeks 13-16)
1. Animations
2. Loading states
3. Error handling
4. Accessibility
5. Performance optimization

---

## Design Principles for Rebuild

1. **Simplicity First** - Remove clutter, keep only essential elements
2. **Speed Matters** - Fast interactions, instant feedback, no loading delays
3. **Mobile-First** - Design for mobile, enhance for desktop
4. **Accessibility** - WCAG 2.1 AA compliance
5. **Consistency** - Use design system components everywhere
6. **White-Label Ready** - Customizable colors, logos, branding
7. **AI-Native** - Design for streaming, artifacts, agents
8. **Progressive Disclosure** - Show advanced features only when needed

---

## Cross-References

- [Architecture](./architecture.md) - System design and data flow
- [Features](./features.md) - Feature implementation details
- [Tech Stack](./tech-stack.md) - Technology choices
- [Starter Integration](./starter-integration.md) - Implementation guide

---

**Next Steps:**
1. Share this guide with your rebuild team
2. Use it to audit the ShadFlareAi starter repo
3. Create component inventory (what's missing vs. what's there)
4. Build UI mockups for new features
5. Implement systematically, phase by phase


