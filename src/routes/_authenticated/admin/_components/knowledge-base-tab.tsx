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
import { useToast } from '@/hooks/use-toast'
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
  const { toast } = useToast()
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [kbToDelete, setKbToDelete] = useState<string | null>(null)

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
      toast({
        title: 'Knowledge base created',
        description: `"${name}" has been created successfully`,
      })
      setIsCreateDialogOpen(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create knowledge base',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteKB = async () => {
    if (!kbToDelete) return

    try {
      await deleteKB.mutateAsync(kbToDelete)
      toast({
        title: 'Knowledge base deleted',
        description: 'All documents and embeddings have been removed',
      })
      setIsDeleteDialogOpen(false)
      setKbToDelete(null)
      if (selectedKB?.id === kbToDelete) {
        setSelectedKB(null)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete knowledge base',
        variant: 'destructive',
      })
    }
  }

  const handleUploadDocument = async (file: File) => {
    if (!selectedKB) return

    try {
      const result = await uploadDoc.mutateAsync({
        knowledgeBaseId: selectedKB.id,
        file,
      })

      toast({
        title: 'Document uploaded',
        description: `${file.name} has been uploaded. Click "Process" to chunk and embed.`,
      })

      // Auto-process the document
      if (result.document?.id) {
        handleProcessDocument(result.document.id)
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive',
      })
    }
  }

  const handleProcessDocument = async (documentId: string) => {
    if (!selectedKB) return

    try {
      const result = await processDoc.mutateAsync({
        knowledgeBaseId: selectedKB.id,
        documentId,
      })

      toast({
        title: 'Document processed',
        description: `Generated ${result.chunkCount} chunks (${result.tokenCount.toLocaleString()} tokens)`,
      })
    } catch (error) {
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Failed to process document',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedKB) return

    try {
      await deleteDoc.mutateAsync({
        knowledgeBaseId: selectedKB.id,
        documentId,
      })

      toast({
        title: 'Document deleted',
        description: 'Document and its embeddings have been removed',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete document',
        variant: 'destructive',
      })
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
                      <span>{kb.documentCount} docs</span>
                      <span>{kb.totalChunks} chunks</span>
                      <span>{kb.totalTokens.toLocaleString()} tokens</span>
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
                          key={doc.id}
                          document={doc}
                          onProcess={() => handleProcessDocument(doc.id)}
                          onDelete={() => handleDeleteDocument(doc.id)}
                          isProcessing={processDoc.isPending}
                          isDeleting={deleteDoc.isPending}
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
  const statusIcon = {
    pending: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    processing: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    completed: <Check className="h-4 w-4 text-green-500" />,
    failed: <X className="h-4 w-4 text-red-500" />,
  }[document.status]

  const statusText = {
    pending: 'Pending',
    processing: 'Processing...',
    completed: 'Ready',
    failed: 'Failed',
  }[document.status]

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{document.filename}</p>
          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              {statusIcon}
              {statusText}
            </span>
            {document.status === 'completed' && (
              <>
                <span>{document.chunkCount} chunks</span>
                <span>{document.tokenCount.toLocaleString()} tokens</span>
              </>
            )}
            <span>{(document.size / 1024).toFixed(1)} KB</span>
          </div>
          {document.status === 'failed' && document.errorMessage && (
            <p className="text-xs text-destructive mt-1">{document.errorMessage}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {document.status === 'pending' && (
          <Button size="sm" onClick={onProcess} disabled={isProcessing}>
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Process'
            )}
          </Button>
        )}
        {document.status === 'failed' && (
          <Button size="sm" variant="outline" onClick={onProcess} disabled={isProcessing}>
            Retry
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}
