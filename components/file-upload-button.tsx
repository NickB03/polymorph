'use client'

import { useRef, useState } from 'react'

import { Paperclip } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'

const allowedImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const allowedOtherTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

const isAllowedFileType = (file: File) =>
  allowedImageTypes.includes(file.type) || allowedOtherTypes.includes(file.type)

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function FileUploadButton({
  onFileSelect,
  isGuest = false,
  onGuestFileSelect
}: {
  onFileSelect: (files: File[]) => void
  isGuest?: boolean
  onGuestFileSelect?: (files: { file: File; dataUrl: string }[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files).slice(0, 3)

    const validFiles = fileArray.filter(isAllowedFileType)
    const rejected = fileArray.filter(f => !isAllowedFileType(f))

    if (rejected.length > 0) {
      toast.error(
        'Some files were not accepted: ' + rejected.map(f => f.name).join(', ')
      )
    }

    if (validFiles.length > 0) {
      if (isGuest && onGuestFileSelect) {
        Promise.all(
          validFiles.map(async file => ({
            file,
            dataUrl: await readFileAsDataUrl(file)
          }))
        ).then(onGuestFileSelect)
      } else {
        onFileSelect(validFiles)
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-full',
        isDragging && 'ring-2 ring-accent-blue ring-offset-2'
      )}
      title="Drag and drop or click to upload"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        hidden
        multiple
        onChange={e => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Attach file"
      >
        <Paperclip size={18} />
      </Button>
    </div>
  )
}
