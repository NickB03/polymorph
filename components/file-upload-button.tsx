'use client'

import { useRef, useState } from 'react'

import { Paperclip } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  isAllowedUploadType,
  MAX_UPLOAD_SIZE_BYTES
} from '@/lib/utils/file-validation'

import { Button } from './ui/button'

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

    const validFiles = fileArray.filter(f => isAllowedUploadType(f.type))
    const rejected = fileArray.filter(f => !isAllowedUploadType(f.type))

    if (rejected.length > 0) {
      toast.error(
        'Some files were not accepted: ' + rejected.map(f => f.name).join(', ')
      )
    }

    const sizeValid = validFiles.filter(f => f.size <= MAX_UPLOAD_SIZE_BYTES)
    const tooLarge = validFiles.filter(f => f.size > MAX_UPLOAD_SIZE_BYTES)

    if (tooLarge.length > 0) {
      toast.error(
        'Files too large (max 5 MB): ' + tooLarge.map(f => f.name).join(', ')
      )
    }

    if (sizeValid.length > 0) {
      if (isGuest && onGuestFileSelect) {
        Promise.all(
          sizeValid.map(async file => ({
            file,
            dataUrl: await readFileAsDataUrl(file)
          }))
        ).then(onGuestFileSelect)
      } else {
        onFileSelect(sizeValid)
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
