/**
 * Knowledge Base Tab - RAG Document Management UI
 *
 * Owner-only interface for managing knowledge bases and documents
 * Located in Admin Panel > Knowledge Base tab
 */

import { useState } from 'react'
import { Plus, Trash2, FileText, Loader2, Upload, Check, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  useKnowledgeBases,
  useKnowledgeBaseDocuments,
  useCreateKnowledgeBase,
  useDeleteKnowledgeBase,
  useUploadDocument,
  useDeleteDocument,
  useProcessDocument,
  type KnowledgeBase,
  type KnowledgeBaseDocument,
} from '@/hooks/use-knowledge-bases'

export function KnowledgeBaseTab() {
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [kbToDelete, setKbToDelete] = useState<string | null>(null)
  const [deletingDocKey, setDeletingDocKey] = useState<string | null>(null)

  // Queries
  const { data: kbData, isLoading: kbLoading } = useKnowledgeBases()
  const { data: docsData, isLoading: docsLoading } = useKnowledgeBaseDocuments(selectedKB?.id || null)

  // Mutations
  const createKB = useCreateKnowledgeBase()
  const deleteKB = useDeleteKnowledgeBase()
  const uploadDoc = useUploadDocument()
  const deleteDoc = useDeleteDocument()
  const processDoc = useProcessDocument()

  const knowledgeBases = kbData?.knowledgeBases || []
  const documents = docsData?.documents || []

  // Select first KB by default
  if (knowledgeBases.length > 0 && !selectedKB) {
    setSelectedKB(knowledgeBases[0])
  }

  const handleCreateKB = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const description = formData.get('description') as string

    try {
      await createKB.mutateAsync({ name, description })
      toast.success(`Knowledge base "${name}" created successfully`)
      setIsCreateDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create knowledge base')
    }
  }

  const handleDeleteKB = async () => {
    if (!kbToDelete) return

    try {
      await deleteKB.mutateAsync(kbToDelete)
      toast.success('Knowledge base deleted - All documents and embeddings removed')
      setIsDeleteDialogOpen(false)
      setKbToDelete(null)
      if (selectedKB?.id === kbToDelete) {
        setSelectedKB(null)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete knowledge base')
    }
  }

  const handleUploadDocument = async (file: File) => {
    if (!selectedKB) return

    try {
      const result = await uploadDoc.mutateAsync({
        knowledgeBaseId: selectedKB.id,
        file,
      })

      toast.success(`${file.name} uploaded successfully - Processing started`)

      // Auto-process the document
      if (result.document?.id) {
        handleProcessDocument(result.document.id)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload document')
    }
  }

  const handleProcessDocument = async (documentId: string) => {
    if (!selectedKB) return

    try {
      const result = await processDoc.mutateAsync({
        knowledgeBaseId: selectedKB.id,
        documentId,
      })

      toast.success(`Document processed: ${result.chunkCount} chunks (${result.tokenCount.toLocaleString()} tokens)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process document')
    }
  }

  const handleDeleteDocument = async (filename: string) => {
    if (!selectedKB) return

    setDeletingDocKey(filename)

    try {
      await deleteDoc.mutateAsync({
        knowledgeBaseId: selectedKB.id,
        documentKey: filename, // Just the filename, API will construct full path
      })

      toast.success('Document deleted - AI Search will remove it from the index')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete document')
    } finally {
      setDeletingDocKey(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Knowledge Base</h2>
          <p className="text-muted-foreground">
            Upload documents to provide context for AI agents (RAG)
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Knowledge Base
        </Button>
      </div>

      {/* AI Search Setup Notice */}
      <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 dark:text-orange-100">AI Search Not Configured</h3>
              <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                Documents are uploaded to R2 storage but not indexed for semantic search yet.
                To enable RAG (Retrieval Augmented Generation), you need to:
              </p>
              <ol className="text-sm text-orange-800 dark:text-orange-200 mt-2 ml-4 list-decimal space-y-1">
                <li>Authenticate wrangler: <code className="bg-orange-100 dark:bg-orange-900 px-1 py-0.5 rounded">wrangler login</code></li>
                <li>Create AI Search index in Cloudflare Dashboard (name: <code className="bg-orange-100 dark:bg-orange-900 px-1 py-0.5 rounded">soloo-rag-store</code>)</li>
                <li>Remove <code className="bg-orange-100 dark:bg-orange-900 px-1 py-0.5 rounded">--local</code> flag from package.json dev:backend script</li>
                <li>Restart dev servers</li>
              </ol>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-3">
                💡 For now, you can upload and manage documents. They'll be automatically indexed once AI Search is configured.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {kbLoading && (
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading knowledge bases...</p>
        </Card>
      )}

      {/* Empty State */}
      {!kbLoading && knowledgeBases.length === 0 && (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No knowledge bases yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first knowledge base to start adding documents for AI agents
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Knowledge Base
          </Button>
        </Card>
      )}

      {/* Knowledge Bases Grid */}
      {!kbLoading && knowledgeBases.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - KB List */}
          <div className="lg:col-span-1 space-y-3">
            {knowledgeBases.map((kb) => (
              <Card
                key={kb.id}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedKB?.id === kb.id ? 'border-primary bg-accent' : 'hover:bg-accent'
                }`}
                onClick={() => setSelectedKB(kb)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{kb.name}</h3>
                    {kb.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {kb.description}
                      </p>
                    )}
                    <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                      <span>{kb.documentCount} {kb.documentCount === 1 ? 'document' : 'documents'}</span>
                      <span className="text-orange-600 dark:text-orange-400">⚠️ Setup AI Search to enable RAG</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setKbToDelete(kb.id)
                      setIsDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Main Content - Documents */}
          <div className="lg:col-span-2 space-y-4">
            {selectedKB && (
              <>
                {/* Upload Area */}
                <DocumentUploadCard
                  knowledgeBaseId={selectedKB.id}
                  onUpload={handleUploadDocument}
                  isUploading={uploadDoc.isPending}
                />

                {/* Documents List */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Documents ({documents.length})
                  </h3>

                  {docsLoading && (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  )}

                  {!docsLoading && documents.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No documents uploaded yet
                    </p>
                  )}

                  {!docsLoading && documents.length > 0 && (
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <DocumentCard
                          key={doc.key}
                          document={doc}
                          onProcess={() => {}} // No-op: AI Search auto-processes
                          onDelete={() => handleDeleteDocument(doc.filename)}
                          isProcessing={false}
                          isDeleting={deletingDocKey === doc.filename}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create KB Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateKB}>
            <DialogHeader>
              <DialogTitle>Create Knowledge Base</DialogTitle>
              <DialogDescription>
                Create a new collection for organizing related documents
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., James' Library, Product Docs, etc."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="What kind of documents will this contain?"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createKB.isPending}>
                {createKB.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete KB Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Base?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the knowledge base and all its documents and embeddings.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKB}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteKB.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Document Upload Card Component
 */
interface DocumentUploadCardProps {
  knowledgeBaseId: string
  onUpload: (file: File) => void
  isUploading: boolean
}

function DocumentUploadCard({ onUpload, isUploading }: DocumentUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      onUpload(file)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
    }
  }

  return (
    <Card
      className={`p-8 border-2 border-dashed transition-colors ${
        isDragging ? 'border-primary bg-accent' : 'border-muted'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="text-center">
        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Upload Document</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Drag and drop a file here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Supported formats: TXT, MD (PDF and DOCX coming soon)
        </p>

        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".txt,.md,.markdown"
          onChange={handleFileInput}
          disabled={isUploading}
        />
        <Button
          variant="outline"
          onClick={() => document.getElementById('file-upload')?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            'Browse Files'
          )}
        </Button>
      </div>
    </Card>
  )
}

/**
 * Document Card Component
 */
interface DocumentCardProps {
  document: KnowledgeBaseDocument
  onProcess: () => void
  onDelete: () => void
  isProcessing: boolean
  isDeleting: boolean
}

function DocumentCard({ document, onProcess, onDelete, isProcessing, isDeleting }: DocumentCardProps) {
  // Format upload date
  const uploadDate = document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : 'Unknown'

  // Get file extension from filename
  const fileExt = document.filename?.split('.').pop()?.toUpperCase() || 'FILE'

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{document.filename}</p>
          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Upload className="h-3 w-3 text-blue-500" />
              <span className="text-blue-600 dark:text-blue-400">Uploaded to R2</span>
            </span>
            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
              <AlertCircle className="h-3 w-3" />
              Not indexed yet
            </span>
            <span>{fileExt}</span>
            <span>{(document.size / 1024).toFixed(1)} KB</span>
            <span>Uploaded {uploadDate}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-destructive" />
          )}
        </Button>
      </div>
    </div>
  )
}
