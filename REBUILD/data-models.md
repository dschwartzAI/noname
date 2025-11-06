# Data Models & Schemas

> **Related Docs**: [Architecture](./architecture.md) | [API Endpoints](./api-endpoints.md) | [Features](./features.md) | [Migration Plan](./migration-plan.md)

## Current System (MongoDB)

### Core Models

#### User
```javascript
// api/models/User.js
{
  _id: ObjectId,
  email: String,
  password: String (hashed),
  name: String,
  username: String,
  avatar: String,
  role: String, // 'user' | 'admin'
  tier: String, // 'free' | 'pro' | 'admin'
  provider: String, // 'local' | 'google' | 'discord' | 'github'
  emailVerified: Boolean,
  
  // Preferences
  preferences: {
    fontSize: String,
    theme: String,
    language: String
  },
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

#### Conversation
```javascript
// api/models/Conversation.js
{
  _id: ObjectId,
  conversationId: String, // UUID
  user: ObjectId → User,
  title: String,
  
  // AI Configuration
  endpoint: String, // 'openAI' | 'anthropic' | 'agents' | 'assistants'
  model: String,
  agentId: String,
  assistant_id: String,
  
  // Settings
  chatGptLabel: String,
  modelLabel: String,
  promptPrefix: String,
  temperature: Number,
  top_p: Number,
  presence_penalty: Number,
  frequency_penalty: Number,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

#### Message
```javascript
// api/models/Message.js
{
  _id: ObjectId,
  messageId: String, // UUID
  conversationId: String,
  user: ObjectId → User,
  
  // Content
  sender: String, // 'User' | 'AI'
  text: String,
  isCreatedByUser: Boolean,
  
  // Message Tree (branching)
  parentMessageId: String,
  children: [String], // Array of messageIds
  
  // Status
  error: Boolean,
  unfinished: Boolean,
  cancelled: Boolean,
  
  // AI Metadata
  model: String,
  endpoint: String,
  finish_reason: String,
  
  // File attachments
  files: [ObjectId → File],
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

#### Agent
```javascript
// api/models/Agent.js
{
  _id: ObjectId,
  id: String, // 'agent_abc123'
  author: ObjectId → User,
  
  // Configuration
  name: String,
  description: String,
  instructions: String,
  model: String,
  provider: String, // 'openai' | 'anthropic' | 'bedrock'
  
  // Tools
  tools: [String], // ['file_search', 'execute_code', 'web_search']
  tool_resources: {
    file_search: {
      vector_store_ids: [String]
    },
    code_interpreter: {
      file_ids: [String]
    }
  },
  
  // Model Parameters
  model_parameters: {
    temperature: Number,
    top_p: Number,
    max_tokens: Number
  },
  
  // Metadata
  avatar: {
    source: String,
    filepath: String
  },
  version: Number,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

#### File
```javascript
// api/models/File.js
{
  _id: ObjectId,
  file_id: String, // UUID
  user: ObjectId → User,
  
  // File Info
  filename: String,
  filepath: String,
  type: String, // MIME type
  bytes: Number,
  
  // Storage
  source: String, // 'local' | 's3' | 'azure' | 'firebase'
  file_path: String, // Full path/URL
  
  // Vector DB (for RAG)
  embedded: Boolean,
  vectorStoreId: String,
  
  // Metadata
  context: String,
  metadata: Object,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

### LMS Models

#### Course
```javascript
// api/models/Course.js
{
  _id: ObjectId,
  title: String,
  description: String,
  instructor: String,
  instructorBio: String,
  thumbnailUrl: String,
  tier: String, // 'free' | 'pro'
  published: Boolean,
  order: Number,
  
  modules: [ObjectId → Module],
  
  createdAt: Date,
  updatedAt: Date
}
```

#### Module
```javascript
// api/models/Module.js
{
  _id: ObjectId,
  courseId: ObjectId → Course,
  
  title: String,
  description: String,
  
  // Video
  videoUrl: String,
  videoProvider: String, // 'youtube' | 'vimeo' | 'custom'
  streamRecordingId: String,
  duration: Number, // seconds
  
  // Content
  transcript: String,
  transcriptUrl: String,
  thumbnail: String,
  
  // Metadata
  videoMetadata: {
    isRecording: Boolean,
    recordingDate: Date,
    isEvergreen: Boolean,
    storage: String
  },
  
  order: Number,
  published: Boolean,
  
  subModules: [ObjectId → SubModule],
  
  createdAt: Date,
  updatedAt: Date
}
```

### Other Models

#### Recording (Supabase/Postgres - not MongoDB)
```sql
-- Stored in Supabase, not MongoDB
recordings (
  id UUID PRIMARY KEY,
  stream_call_id TEXT,
  stream_recording_url TEXT,
  do_spaces_url TEXT,
  do_spaces_key TEXT,
  duration INTEGER,
  participants JSONB,
  transcript_text TEXT,
  transcript_url TEXT,
  thumbnail_url TEXT,
  posted_to_academy BOOLEAN,
  academy_module_id TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### Transaction
```javascript
// api/models/Transaction.js
{
  _id: ObjectId,
  user: ObjectId → User,
  
  // Stripe
  stripeSessionId: String,
  stripeCustomerId: String,
  
  // Transaction details
  amount: Number,
  currency: String,
  status: String,
  type: String, // 'subscription' | 'one_time'
  
  // Product
  productId: String,
  productName: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## Target System (Postgres + Drizzle)

### Core Tables

#### tenants
```typescript
// db/schema/tenants.ts
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subdomain: text('subdomain').unique().notNull(),
  customDomain: text('custom_domain'),
  
  // White-label config
  branding: jsonb('branding').$type<{
    logo: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  }>(),
  
  config: jsonb('config').$type<{
    allowedProviders: string[];
    defaultModel: string;
    maxUsers: number;
  }>(),
  
  // Billing
  stripeCustomerId: text('stripe_customer_id'),
  plan: tierEnum('plan').default('free'),
  
  // Status
  status: text('status').default('active'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### users
```typescript
// db/schema/users.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Auth
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  password: text('password'), // Nullable for OAuth
  
  // Profile
  name: text('name'),
  username: text('username'),
  avatar: text('avatar'),
  
  // Access
  tier: tierEnum('tier').default('free').notNull(),
  role: roleEnum('role').default('user').notNull(),
  
  // OAuth
  provider: text('provider'), // 'local' | 'google' | 'github'
  providerId: text('provider_id'),
  
  // Preferences
  preferences: jsonb('preferences').$type<{
    fontSize: string;
    theme: string;
    language: string;
  }>(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
});

// Indexes for performance
export const usersByTenant = index('users_tenant_id_idx').on(users.tenantId);
export const usersByEmail = uniqueIndex('users_email_idx').on(users.email);
```

#### conversations
```typescript
// db/schema/conversations.ts
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  title: text('title'),
  
  // AI Configuration
  provider: text('provider').notNull(), // 'openai' | 'anthropic' | 'xai'
  model: text('model').notNull(),
  agentId: text('agent_id'), // References agents.id
  
  // Model parameters
  parameters: jsonb('parameters').$type<{
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  }>(),
  
  // Status
  archived: boolean('archived').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastMessageAt: timestamp('last_message_at'),
});

// Indexes
export const conversationsByUser = index('conversations_user_id_idx').on(conversations.userId);
export const conversationsByTenant = index('conversations_tenant_id_idx').on(conversations.tenantId);
export const conversationsByAgent = index('conversations_agent_id_idx').on(conversations.agentId);
```

#### messages
```typescript
// db/schema/messages.ts
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  content: text('content').notNull(),
  role: roleEnum('role').notNull(), // 'user' | 'assistant' | 'system'
  
  // Message tree (for branching)
  parentId: uuid('parent_id').references(() => messages.id),
  
  // AI metadata
  model: text('model'),
  provider: text('provider'),
  finishReason: text('finish_reason'),
  
  // Token usage
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  
  // Status
  error: boolean('error').default(false),
  errorMessage: text('error_message'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const messagesByConversation = index('messages_conversation_id_idx').on(messages.conversationId);
export const messagesByParent = index('messages_parent_id_idx').on(messages.parentId);

// Full-text search
export const messagesSearchIndex = index('messages_search_idx')
  .using('gin', sql`to_tsvector('english', ${messages.content})`);
```

#### agents
```typescript
// db/schema/agents.ts
export const agents = pgTable('agents', {
  id: text('id').primaryKey(), // 'agent_abc123'
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  createdBy: uuid('created_by')
    .references(() => users.id)
    .notNull(),
  
  // Configuration
  name: text('name').notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  
  // AI settings
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  
  // Tools
  tools: jsonb('tools').$type<string[]>().default([]),
  toolResources: jsonb('tool_resources').$type<{
    fileSearch?: { fileIds: string[] };
    codeInterpreter?: { fileIds: string[] };
  }>(),
  
  // Model parameters
  parameters: jsonb('parameters').$type<{
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  }>(),
  
  // Metadata
  icon: text('icon'),
  tier: tierEnum('tier').default('free').notNull(),
  published: boolean('published').default(false),
  version: integer('version').default(1),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const agentsByTenant = index('agents_tenant_id_idx').on(agents.tenantId);
export const agentsByCreator = index('agents_created_by_idx').on(agents.createdBy);
```

#### files
```typescript
// db/schema/files.ts
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // File info
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  
  // Storage
  storageProvider: text('storage_provider').notNull(), // 'vercel_blob' | 'r2'
  storageKey: text('storage_key').notNull(),
  url: text('url').notNull(),
  
  // RAG / Vector
  embedded: boolean('embedded').default(false),
  vectorStoreId: text('vector_store_id'),
  
  // Metadata
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const filesByUser = index('files_user_id_idx').on(files.userId);
export const filesByTenant = index('files_tenant_id_idx').on(files.tenantId);
```

#### document_chunks (for RAG)
```typescript
// db/schema/rag.ts
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id')
    .references(() => files.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  content: text('content').notNull(),
  
  // Vector embedding (pgvector)
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI embedding size
  
  // Metadata
  metadata: jsonb('metadata').$type<{
    page?: number;
    section?: string;
    startIndex?: number;
    endIndex?: number;
  }>(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Vector similarity search index
export const embeddingIndex = index('document_chunks_embedding_idx')
  .using('ivfflat', documentChunks.embedding);

// Tenant isolation
export const chunksByTenant = index('document_chunks_tenant_id_idx').on(documentChunks.tenantId);
```

#### memories
```typescript
// db/schema/memories.ts
export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Memory content
  key: text('key').notNull(),
  value: text('value').notNull(),
  category: text('category'),
  
  // Source
  source: text('source'), // 'conversation' | 'manual' | 'import'
  sourceId: uuid('source_id'), // conversationId if from conversation
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const memoriesByUser = index('memories_user_id_idx').on(memories.userId);
export const memoriesByKey = index('memories_key_idx').on(memories.key);
export const memoriesFullText = index('memories_search_idx')
  .using('gin', sql`to_tsvector('english', ${memories.value})`);
```

### LMS Tables

#### courses
```typescript
// db/schema/courses.ts
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  title: text('title').notNull(),
  description: text('description'),
  thumbnail: text('thumbnail'),
  
  // Instructor
  instructor: text('instructor').notNull(),
  instructorBio: text('instructor_bio'),
  
  // Access
  tier: tierEnum('tier').default('free').notNull(),
  published: boolean('published').default(false),
  
  // Order
  order: integer('order').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const coursesByTenant = index('courses_tenant_id_idx').on(courses.tenantId);
```

#### modules
```typescript
// db/schema/modules.ts
export const modules = pgTable('modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Content
  title: text('title').notNull(),
  description: text('description'),
  
  // Video
  videoUrl: text('video_url'),
  videoProvider: text('video_provider'), // 'youtube' | 'vimeo' | 'custom'
  duration: integer('duration'), // seconds
  thumbnail: text('thumbnail'),
  
  // Transcript
  transcript: text('transcript'),
  transcriptUrl: text('transcript_url'),
  
  // Recording metadata
  recordingMetadata: jsonb('recording_metadata').$type<{
    streamRecordingId?: string;
    recordingDate?: string;
    isEvergreen?: boolean;
  }>(),
  
  // Access
  published: boolean('published').default(false),
  order: integer('order').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const modulesByCourse = index('modules_course_id_idx').on(modules.courseId);
```

### Payment Tables

#### transactions
```typescript
// db/schema/transactions.ts
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Stripe
  stripeSessionId: text('stripe_session_id').unique(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  
  // Transaction details
  amount: integer('amount').notNull(), // in cents
  currency: text('currency').default('usd').notNull(),
  status: text('status').notNull(), // 'pending' | 'completed' | 'failed'
  type: text('type').notNull(), // 'subscription' | 'one_time'
  
  // Product
  productId: text('product_id'),
  productName: text('product_name'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transactionsByUser = index('transactions_user_id_idx').on(transactions.userId);
```

---

## Key Improvements

### 1. Multi-Tenancy Built-In

**Every table has `tenantId`**:
```typescript
tenantId: uuid('tenant_id')
  .references(() => tenants.id, { onDelete: 'cascade' })
  .notNull()
```

**Row-Level Security**:
```sql
-- Automatic tenant isolation
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversations
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 2. Better Relationships

**Current (MongoDB)**:
```javascript
// Weak references
message.conversationId = "some-string"
// No FK constraints, can be orphaned
```

**Target (Postgres)**:
```typescript
// Strong references with FK constraints
conversationId: uuid('conversation_id')
  .references(() => conversations.id, { onDelete: 'cascade' })
  .notNull()
// Automatic cleanup, data integrity
```

### 3. Built-in Search

**Current**: Requires MeiliSearch (external service)

**Target**: Built-in Postgres full-text search
```typescript
// Full-text search index
export const messagesSearchIndex = index('messages_search_idx')
  .using('gin', sql`to_tsvector('english', ${messages.content})`);

// Query
const results = await db.select()
  .from(messages)
  .where(sql`to_tsvector('english', ${messages.content}) @@ to_tsquery('business')`);
```

### 4. Built-in Vector Search

**Current**: Requires external RAG API

**Target**: Built-in pgvector
```typescript
// Store embeddings directly
embedding: vector('embedding', { dimensions: 1536 })

// Vector similarity search
const similar = await db.execute(sql`
  SELECT * FROM document_chunks
  WHERE tenant_id = ${tenantId}
  ORDER BY embedding <=> ${queryEmbedding}
  LIMIT 5
`);
```

### 5. Type Safety

**Current (Mongoose)**:
```javascript
// No compile-time safety
const user = await User.findOne({ _id: id });
user.email // string | undefined - runtime check needed
```

**Target (Drizzle)**:
```typescript
// Full type safety
const user = await db.query.users.findFirst({
  where: eq(users.id, id)
});
user?.email // string - TypeScript knows the shape
```

---

## Migration Strategy

### Data Mapping

| MongoDB Collection | Postgres Table | Notes |
|-------------------|----------------|-------|
| `users` | `users` | Add `tenantId`, convert `_id` to UUID |
| `conversations` | `conversations` | Add `tenantId`, normalize config |
| `messages` | `messages` | Add `tenantId`, simplify structure |
| `agents` | `agents` | Add `tenantId`, normalize tools |
| `files` | `files` | Add `tenantId`, update storage references |
| `courses` | `courses` | Add `tenantId`, minimal changes |
| `modules` | `modules` | Add `tenantId`, minimal changes |
| `transactions` | `transactions` | Add `tenantId`, minimal changes |

### Migration Script Pattern

```typescript
// Example: Migrate users
async function migrateUsers() {
  const mongoUsers = await mongoDb.collection('users').find().toArray();
  
  for (const mongoUser of mongoUsers) {
    await db.insert(users).values({
      id: mongoUser._id.toString(),
      tenantId: DEFAULT_TENANT_ID, // All existing users go to default tenant
      email: mongoUser.email,
      name: mongoUser.name,
      tier: mongoUser.tier || 'free',
      role: mongoUser.role || 'user',
      provider: mongoUser.provider,
      preferences: mongoUser.preferences,
      createdAt: mongoUser.createdAt,
      updatedAt: mongoUser.updatedAt,
    });
  }
}
```

---

## Related Documentation

| Document | What It Covers | Read Next If... |
|----------|----------------|-----------------|
| **[API Endpoints](./api-endpoints.md)** | How to interact with these models | You're building API routes |
| **[Architecture](./architecture.md)** | Database architecture and queries | You want to see query patterns |
| **[Features](./features.md)** | How features use these models | You need implementation context |
| **[Starter Integration](./starter-integration.md)** | Step-by-step schema creation | You're ready to build |
| **[Migration Plan](./migration-plan.md)** | Data migration strategy | You're planning the cutover |

**Next**: Review [API Endpoints](./api-endpoints.md) for complete API documentation.

