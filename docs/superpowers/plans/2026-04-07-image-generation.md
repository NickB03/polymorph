# Image Generation Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image generation as a tool the researcher agent can invoke, using Gemini 2.5 Flash Image via the Vercel AI Gateway, so users can request images without leaving the research flow.

**Architecture:** The researcher model (Gemini 3 Flash / Grok 4.1) stays in control of the conversation. When the user asks for an image, the researcher calls a `generateImage` tool. The tool internally calls `generateText()` on `gateway:google/gemini-2.5-flash-image`, which returns images in `result.files[]`. The tool uploads the image to Supabase Storage and returns a URL. `toModelOutput` sends only a text description back to the researcher (no base64 bloat). The UI renders the image via a registered tool component. Image editing is supported by passing a source image URL back to the Gemini image model.

**Tech Stack:** AI SDK 6 (`generateText`, `tool`, `toModelOutput`), Vercel AI Gateway (`google/gemini-2.5-flash-image`), Supabase Storage, Zod, React

---

## File Map

| Action | File                                                         | Responsibility                                  |
| ------ | ------------------------------------------------------------ | ----------------------------------------------- |
| Create | `lib/supabase/server-storage.ts`                             | Server-side image upload to Supabase Storage    |
| Create | `lib/tools/generate-image.ts`                                | Tool definition: schema, execute, toModelOutput |
| Modify | `lib/types/agent.ts`                                         | Add `generateImage` to `ResearcherTools`        |
| Modify | `lib/agents/researcher.ts`                                   | Register tool, pass context to factory          |
| Modify | `lib/streaming/create-chat-stream-response.ts`               | Build image tool context, pass to researcher    |
| Modify | `lib/agents/prompts/search-mode-prompts.ts`                  | Add image generation guidance to system prompt  |
| Create | `components/tool-ui/generate-image/schema.ts`                | UI-side Zod schema + safe parser                |
| Create | `components/tool-ui/generate-image/generate-image.tsx`       | React component rendering generated images      |
| Create | `components/tool-ui/generate-image/index.tsx`                | Barrel export                                   |
| Modify | `components/tool-ui/registry.tsx`                            | Register `generateImage` in tool UI entries     |
| Create | `lib/tools/__tests__/generate-image.test.ts`                 | Unit tests for tool logic                       |
| Create | `components/tool-ui/generate-image/__tests__/schema.test.ts` | Tests for UI schema parsing                     |

---

### Task 1: Server-Side Image Upload Utility

**Files:**

- Create: `lib/supabase/server-storage.ts`
- Reference: `lib/supabase/storage.ts` (existing browser-side upload pattern)

- [ ] **Step 1: Write the test**

Create `lib/supabase/__tests__/server-storage.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'

import { buildGeneratedImagePath } from '../server-storage'

describe('buildGeneratedImagePath', () => {
  it('constructs path from userId, chatId, and extension', () => {
    const path = buildGeneratedImagePath('user-1', 'chat-1', 'image/png')
    expect(path).toMatch(/^user-1\/chats\/chat-1\/generated-\d+\.png$/)
  })

  it('extracts extension from mediaType', () => {
    const path = buildGeneratedImagePath('u', 'c', 'image/webp')
    expect(path).toEndWith('.webp')
  })

  it('defaults to png for unknown mediaType', () => {
    const path = buildGeneratedImagePath('u', 'c', 'image/unknown')
    expect(path).toEndWith('.unknown')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- lib/supabase/__tests__/server-storage.test.ts`
Expected: FAIL — `buildGeneratedImagePath` not found

- [ ] **Step 3: Write the implementation**

Create `lib/supabase/server-storage.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

import { SUPABASE_STORAGE_BUCKET } from './storage'

/**
 * Lazily-created admin client for server-side storage operations.
 * Uses the service role key to bypass RLS — only call from trusted
 * server code where the userId has already been authenticated.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server-side storage uploads'
    )
  }
  return createClient(url, key)
}

export function buildGeneratedImagePath(
  userId: string,
  chatId: string,
  mediaType: string
): string {
  const ext = mediaType.split('/')[1] || 'png'
  return `${userId}/chats/${chatId}/generated-${Date.now()}.${ext}`
}

export async function uploadGeneratedImage(
  imageData: Uint8Array,
  mediaType: string,
  userId: string,
  chatId: string
): Promise<{ url: string; filename: string }> {
  const admin = getAdminClient()
  const filePath = buildGeneratedImagePath(userId, chatId, mediaType)

  const { error } = await admin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(filePath, imageData, {
      contentType: mediaType,
      upsert: false
    })

  if (error) {
    console.error('[uploadGeneratedImage] Storage upload failed:', error)
    throw new Error('Image upload failed: ' + error.message)
  }

  const {
    data: { publicUrl }
  } = admin.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(filePath)

  const filename = filePath.split('/').pop() ?? 'generated.png'
  return { url: publicUrl, filename }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- lib/supabase/__tests__/server-storage.test.ts`
Expected: PASS

- [ ] **Step 5: Verify `SUPABASE_SERVICE_ROLE_KEY` is available**

Check `.env.local` for `SUPABASE_SERVICE_ROLE_KEY`. If missing, add it:

- Local dev: get it from `npx supabase status` (service_role key)
- Production: add to Vercel environment variables

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/server-storage.ts lib/supabase/__tests__/server-storage.test.ts
git commit -m "feat: add server-side image upload utility for generated images"
```

---

### Task 2: Generate Image Tool Definition

**Files:**

- Create: `lib/tools/generate-image.ts`
- Reference: `lib/tools/fetch.ts` (streaming tool pattern), `lib/tools/display-chart.ts` (schema pattern)

- [ ] **Step 1: Write the test**

Create `lib/tools/__tests__/generate-image.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'

// Mock the AI SDK generateText before importing the tool
vi.mock('ai', async importOriginal => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateText: vi.fn()
  }
})

// Mock server storage
vi.mock('@/lib/supabase/server-storage', () => ({
  uploadGeneratedImage: vi.fn().mockResolvedValue({
    url: 'https://storage.example.com/generated-123.png',
    filename: 'generated-123.png'
  })
}))

// Mock registry
vi.mock('@/lib/utils/registry', () => ({
  getModel: vi.fn().mockReturnValue('mock-model')
}))

import { generateText } from 'ai'

import { createGenerateImageTool } from '../generate-image'

const mockGenerateText = vi.mocked(generateText)

describe('createGenerateImageTool', () => {
  const context = { userId: 'user-1', chatId: 'chat-1' }
  const tool = createGenerateImageTool(context)

  it('has a description', () => {
    expect(tool.description).toBeTruthy()
  })

  it('calls generateText with the image model and returns upload URL', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      files: [
        {
          mediaType: 'image/png',
          base64: 'iVBOR...',
          uint8Array: new Uint8Array([137, 80, 78, 71])
        }
      ]
    } as any)

    const execute = tool.execute!
    const result = await execute(
      { prompt: 'a sunset over mountains', aspectRatio: '16:9' },
      { abortSignal: undefined as any, toolCallId: 'tc-1', messages: [] }
    )

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'a sunset over mountains'
      })
    )
    expect(result).toEqual(
      expect.objectContaining({
        imageUrl: 'https://storage.example.com/generated-123.png',
        mediaType: 'image/png',
        description: 'a sunset over mountains'
      })
    )
  })

  it('returns error when no image is generated', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Sorry, I cannot generate that image.',
      files: []
    } as any)

    const execute = tool.execute!
    const result = await execute(
      { prompt: 'something' },
      { abortSignal: undefined as any, toolCallId: 'tc-2', messages: [] }
    )

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('No image')
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- lib/tools/__tests__/generate-image.test.ts`
Expected: FAIL — `createGenerateImageTool` not found

- [ ] **Step 3: Write the tool implementation**

Create `lib/tools/generate-image.ts`:

```typescript
import { generateText, tool } from 'ai'
import { z } from 'zod'

import { uploadGeneratedImage } from '@/lib/supabase/server-storage'
import { getModel } from '@/lib/utils/registry'

const IMAGE_MODEL = 'gateway:google/gemini-2.5-flash-image'

const GenerateImageSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      'Detailed description of the image to generate. Be specific about subject, style, composition, lighting, and mood.'
    ),
  aspectRatio: z
    .enum(['1:1', '16:9', '9:16', '4:3', '3:4'])
    .optional()
    .describe(
      'Aspect ratio for the generated image. Defaults to model default if not specified.'
    ),
  sourceImageUrl: z
    .string()
    .url()
    .optional()
    .describe(
      'URL of an existing image to edit. When provided, the prompt describes the desired changes to this image.'
    )
})

export type GenerateImageInput = z.infer<typeof GenerateImageSchema>

export type GenerateImageOutput = {
  imageUrl: string
  filename: string
  mediaType: string
  description: string
  aspectRatio?: string
}

export type GenerateImageError = {
  error: string
}

type ImageToolContext = {
  userId: string
  chatId: string
}

export function createGenerateImageTool(context: ImageToolContext) {
  return tool({
    description:
      'Generate or edit an image from a text description. Use for visual content the user requests: illustrations, diagrams, photos, concept art, UI mockups, etc. For editing, provide the sourceImageUrl of a previously generated image along with the edit instructions in the prompt.',
    inputSchema: GenerateImageSchema,
    execute: async ({
      prompt,
      aspectRatio,
      sourceImageUrl
    }): Promise<GenerateImageOutput | GenerateImageError> => {
      try {
        const model = getModel(IMAGE_MODEL)

        // Build messages: text-only for generation, text+image for editing
        const content: Array<
          { type: 'text'; text: string } | { type: 'image'; image: URL }
        > = [{ type: 'text', text: prompt }]

        if (sourceImageUrl) {
          content.push({ type: 'image', image: new URL(sourceImageUrl) })
        }

        const result = await generateText({
          model,
          messages: [{ role: 'user', content }],
          providerOptions: {
            google: {
              ...(aspectRatio && { aspectRatio })
            }
          }
        })

        const imageFile = result.files.find(f =>
          f.mediaType?.startsWith('image/')
        )

        if (!imageFile) {
          return {
            error:
              'No image was generated. The model may have declined the request. Text response: ' +
              (result.text || '(none)')
          }
        }

        const { url, filename } = await uploadGeneratedImage(
          imageFile.uint8Array,
          imageFile.mediaType ?? 'image/png',
          context.userId,
          context.chatId
        )

        return {
          imageUrl: url,
          filename,
          mediaType: imageFile.mediaType ?? 'image/png',
          description: prompt,
          aspectRatio
        }
      } catch (err) {
        console.error('[generateImage] Failed:', err)
        return {
          error:
            'Image generation failed: ' +
            (err instanceof Error ? err.message : String(err))
        }
      }
    },
    toModelOutput: ({ output }) => {
      if ('error' in output) {
        return {
          type: 'text' as const,
          value: `Image generation failed: ${output.error}`
        }
      }
      const parts = [`Image generated successfully: "${output.description}"`]
      if (output.aspectRatio) parts.push(`(${output.aspectRatio})`)
      parts.push(`— URL: ${output.imageUrl}`)
      return { type: 'text' as const, value: parts.join(' ') }
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- lib/tools/__tests__/generate-image.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/tools/generate-image.ts lib/tools/__tests__/generate-image.test.ts
git commit -m "feat: add generateImage tool using Gemini 2.5 Flash Image"
```

---

### Task 3: Type System Updates

**Files:**

- Modify: `lib/types/agent.ts:1-145`

- [ ] **Step 1: Add import for the new tool**

In `lib/types/agent.ts`, add after the existing tool imports (after line 22, the `updateCanvasArtifactTool` import):

```typescript
import type { createGenerateImageTool } from '../tools/generate-image'
```

- [ ] **Step 2: Add `generateImage` to `ResearcherTools`**

In the `ResearcherTools` type (around line 26-41), add before the `& ReturnType<typeof createTodoTools>` intersection:

```typescript
generateImage: ReturnType<typeof createGenerateImageTool>
```

- [ ] **Step 3: Add tool invocation type**

After the `ReadCanvasArtifactToolInvocation` type (around line 94), add:

```typescript
export type GenerateImageToolInvocation = UIToolInvocation<
  ResearcherTools['generateImage']
>
```

- [ ] **Step 4: Add to the union type**

In the `ResearcherToolInvocation` union type (around line 97-112), add:

```typescript
  | GenerateImageToolInvocation
```

- [ ] **Step 5: Run typecheck**

Run: `bun typecheck`
Expected: PASS (may have errors from researcher.ts not yet updated — that's expected, we fix it in Task 4)

- [ ] **Step 6: Commit**

```bash
git add lib/types/agent.ts
git commit -m "feat: add generateImage to ResearcherTools type system"
```

---

### Task 4: Researcher Agent Integration

**Files:**

- Modify: `lib/agents/researcher.ts:1-269`
- Modify: `lib/streaming/create-chat-stream-response.ts:1-365`

- [ ] **Step 1: Add import in researcher.ts**

In `lib/agents/researcher.ts`, add after the existing tool imports (after `import { updateCanvasArtifactTool }`, around line 27):

```typescript
import { createGenerateImageTool } from '../tools/generate-image'
```

- [ ] **Step 2: Add `imageToolContext` parameter to `createResearcher`**

Add to the function parameter type (around line 98):

```typescript
  imageToolContext?: { userId: string; chatId: string }
```

- [ ] **Step 3: Build the image tool and register it**

After the canvas tools block (around line 211), add:

```typescript
// Build image generation tool when context is available
const imageTools = imageToolContext
  ? {
      generateImage: createGenerateImageTool(imageToolContext)
    }
  : {}

if (imageToolContext) {
  activeToolsList.push('generateImage' as keyof ResearcherTools)
}
```

- [ ] **Step 4: Spread image tools into the tools object**

In the tools object (around line 214-228), add `...imageTools` alongside `...canvasTools`:

```typescript
const tools: ResearcherTools = {
  search: searchTool,
  fetch: fetchTool,
  displayPlan: displayPlanTool,
  displayTable: displayTableTool,
  displayChart: displayChartTool,
  displayCitations: displayCitationsTool,
  displayLinkPreview: displayLinkPreviewTool,
  displayOptionList: displayOptionListTool,
  displayQuestionWizard: displayQuestionWizardTool,
  displayCallout: displayCalloutTool,
  displayTimeline: displayTimelineTool,
  ...todoTools,
  ...canvasTools,
  ...imageTools
} as ResearcherTools
```

- [ ] **Step 5: Pass imageToolContext from the streaming handler**

In `lib/streaming/create-chat-stream-response.ts`, update the `researcher()` call (around line 202-210). Add `imageToolContext`:

```typescript
const researchAgent = researcher({
  model: context.modelId,
  modelConfig: model,
  writer,
  parentTraceId,
  searchMode,
  modelType,
  canvasToolContext,
  imageToolContext: { userId, chatId }
})
```

- [ ] **Step 6: Run typecheck**

Run: `bun typecheck`
Expected: PASS

- [ ] **Step 7: Run lint**

Run: `bun lint`
Expected: PASS (fix any import order issues)

- [ ] **Step 8: Commit**

```bash
git add lib/agents/researcher.ts lib/streaming/create-chat-stream-response.ts
git commit -m "feat: register generateImage tool in researcher agent"
```

---

### Task 5: System Prompt Update

**Files:**

- Modify: `lib/agents/prompts/search-mode-prompts.ts`

- [ ] **Step 1: Add image generation guidance**

In `lib/agents/prompts/search-mode-prompts.ts`, add a new function that returns the image generation prompt section. Place it near the other prompt helper functions (e.g., near `getCanvasArtifactsPrompt()`):

```typescript
function getImageGenerationPrompt(): string {
  return `
IMAGE GENERATION:
You have a \`generateImage\` tool that creates or edits images using an AI image model.

**When to use:**
- The user asks you to create, generate, draw, illustrate, or visualize an image
- The user wants a visual representation of something (diagram, mockup, concept art, photo, etc.)
- The user asks to modify or edit a previously generated image

**How to use:**
- Provide a detailed, descriptive prompt — the more specific, the better the result
- Include details about: subject, style, composition, lighting, colors, mood, perspective
- Set aspectRatio when the user specifies a format or when the content has a natural shape (landscape → 16:9, portrait → 9:16, square → 1:1)
- For image editing: pass the sourceImageUrl of a previously generated image along with edit instructions in the prompt

**Important:**
- Do NOT search the web before generating an image unless the user needs reference information
- Generate the image directly when the request is clear
- After generating, continue your response naturally — reference the image in your text
- If the user asks to modify a generated image, use the same tool with the sourceImageUrl parameter
`
}
```

- [ ] **Step 2: Include it in both chat and research mode prompts**

In `getChatModePrompt()`, add the image generation section. Insert `${getImageGenerationPrompt()}` in the prompt template, after the canvas artifacts section (before the closing backtick of the function return).

Do the same in `getResearchModePrompt()`.

- [ ] **Step 3: Update intent routing in chat mode**

In the `getChatModePrompt()` function, update the INTENT ROUTING section (around line 127) to add an image generation route. Add after the BUILD/CREATE entry:

```
- **IMAGE request** — the user wants you to generate, draw, create, illustrate, or visualize an image/picture/photo/illustration → **Call \`generateImage\` tool directly.** Do NOT search first unless the user needs factual reference.
```

- [ ] **Step 4: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/agents/prompts/search-mode-prompts.ts
git commit -m "feat: add image generation guidance to researcher system prompts"
```

---

### Task 6: UI Schema

**Files:**

- Create: `components/tool-ui/generate-image/schema.ts`
- Reference: `components/tool-ui/chart/schema.ts` (existing schema pattern)

- [ ] **Step 1: Write the test**

Create `components/tool-ui/generate-image/__tests__/schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import {
  safeParseSerializableGenerateImage,
  parseSerializableGenerateImage
} from '../schema'

describe('safeParseSerializableGenerateImage', () => {
  it('parses valid output with all fields', () => {
    const result = safeParseSerializableGenerateImage({
      imageUrl: 'https://example.com/image.png',
      filename: 'generated-123.png',
      mediaType: 'image/png',
      description: 'a sunset',
      aspectRatio: '16:9'
    })
    expect(result).toEqual({
      imageUrl: 'https://example.com/image.png',
      filename: 'generated-123.png',
      mediaType: 'image/png',
      description: 'a sunset',
      aspectRatio: '16:9'
    })
  })

  it('parses valid output without optional fields', () => {
    const result = safeParseSerializableGenerateImage({
      imageUrl: 'https://example.com/image.png',
      filename: 'generated-123.png',
      mediaType: 'image/png',
      description: 'a sunset'
    })
    expect(result).not.toBeNull()
    expect(result?.aspectRatio).toBeUndefined()
  })

  it('returns null for error output', () => {
    const result = safeParseSerializableGenerateImage({
      error: 'something failed'
    })
    expect(result).toBeNull()
  })

  it('returns null for invalid input', () => {
    expect(safeParseSerializableGenerateImage(null)).toBeNull()
    expect(safeParseSerializableGenerateImage({})).toBeNull()
    expect(safeParseSerializableGenerateImage('string')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/tool-ui/generate-image/__tests__/schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the schema**

Create `components/tool-ui/generate-image/schema.ts`:

```typescript
import { z } from 'zod'

import { defineToolUiContract } from '../shared/contract'

export const GenerateImagePropsSchema = z.object({
  imageUrl: z.string().url(),
  filename: z.string().min(1),
  mediaType: z.string().min(1),
  description: z.string().min(1),
  aspectRatio: z.string().optional()
})

export type GenerateImageProps = z.infer<typeof GenerateImagePropsSchema>

export const SerializableGenerateImageSchema = GenerateImagePropsSchema

export type SerializableGenerateImage = z.infer<
  typeof SerializableGenerateImageSchema
>

const SerializableGenerateImageContract = defineToolUiContract(
  'GenerateImage',
  SerializableGenerateImageSchema
)

export const parseSerializableGenerateImage: (
  input: unknown
) => SerializableGenerateImage = SerializableGenerateImageContract.parse

export const safeParseSerializableGenerateImage: (
  input: unknown
) => SerializableGenerateImage | null =
  SerializableGenerateImageContract.safeParse
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- components/tool-ui/generate-image/__tests__/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/tool-ui/generate-image/schema.ts components/tool-ui/generate-image/__tests__/schema.test.ts
git commit -m "feat: add UI schema for generateImage tool output"
```

---

### Task 7: UI Component

**Files:**

- Create: `components/tool-ui/generate-image/generate-image.tsx`
- Create: `components/tool-ui/generate-image/index.tsx`
- Reference: `components/tool-ui/chart/chart.tsx` (component pattern)

- [ ] **Step 1: Create the component**

Create `components/tool-ui/generate-image/generate-image.tsx`:

```tsx
'use client'

import { Download, Maximize2, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

import type { GenerateImageProps } from './schema'

export function GenerateImage({
  imageUrl,
  description,
  aspectRatio
}: GenerateImageProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <figure className="group relative my-3 w-fit max-w-full overflow-hidden rounded-xl border border-border/50 bg-muted/30">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="block cursor-zoom-in"
        >
          <img
            src={imageUrl}
            alt={description}
            className="max-h-[400px] w-auto max-w-full rounded-xl object-contain"
            loading="lazy"
          />
        </button>
        <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span className="line-clamp-1">{description}</span>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {aspectRatio && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {aspectRatio}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={e => {
                e.stopPropagation()
                setExpanded(true)
              }}
            >
              <Maximize2 className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6" asChild>
              <a href={imageUrl} download onClick={e => e.stopPropagation()}>
                <Download className="size-3" />
              </a>
            </Button>
          </div>
        </figcaption>
      </figure>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image view"
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-white/10"
            onClick={() => setExpanded(false)}
          >
            <X className="size-5" />
          </Button>
          <img
            src={imageUrl}
            alt={description}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Create the barrel export**

Create `components/tool-ui/generate-image/index.tsx`:

```typescript
export { GenerateImage } from './generate-image'
export {
  type GenerateImageProps,
  safeParseSerializableGenerateImage,
  parseSerializableGenerateImage
} from './schema'
```

- [ ] **Step 3: Run typecheck**

Run: `bun typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/tool-ui/generate-image/generate-image.tsx components/tool-ui/generate-image/index.tsx
git commit -m "feat: add GenerateImage UI component with lightbox and download"
```

---

### Task 8: Register in Tool UI Registry

**Files:**

- Modify: `components/tool-ui/registry.tsx:1-206`

- [ ] **Step 1: Add imports**

In `components/tool-ui/registry.tsx`, add after the existing imports (after the `ToolErrorBoundary` import, around line 24):

```typescript
import { GenerateImage } from './generate-image/generate-image'
import { safeParseSerializableGenerateImage } from './generate-image/schema'
```

- [ ] **Step 2: Add entry to the `entries` array**

Add before the closing `]` of the `entries` array (before the `canvasArtifactCard` entry, around line 155):

```typescript
  {
    name: 'generateImage',
    tryRender: output => {
      const parsed = safeParseSerializableGenerateImage(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="GenerateImage">
          <GenerateImage {...parsed} />
        </ToolErrorBoundary>
      )
    }
  },
```

- [ ] **Step 3: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/tool-ui/registry.tsx
git commit -m "feat: register generateImage in tool UI registry"
```

---

### Task 9: Lint, Typecheck, and Verification

- [ ] **Step 1: Full lint check**

Run: `bun lint`
Expected: PASS — fix any issues

- [ ] **Step 2: Full typecheck**

Run: `bun typecheck`
Expected: PASS — fix any issues

- [ ] **Step 3: Run all tests**

Run: `bun run test`
Expected: All tests pass including new ones

- [ ] **Step 4: Manual smoke test**

Start dev server (`bun dev`) and test:

1. Ask the researcher to generate an image (e.g., "Generate an image of a mountain landscape at sunset")
2. Verify the tool is called in the streaming output
3. Verify the image renders in the chat UI
4. Verify the lightbox opens on click
5. Verify the download button works
6. Test image editing: "Make the sky more dramatic" (should pass sourceImageUrl)

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint/typecheck issues from image generation integration"
```

---

## Future Enhancements (Not In Scope)

- **Supabase Storage optimization:** If base64-in-JSON proves too heavy, migrate to uploading images to Supabase Storage and storing only URLs in tool output.
- **Guest support:** Enable image generation for guest/ephemeral sessions (currently skipped — no `userId` available for storage path).
- **Image model selection:** Allow users to choose between image models (Gemini, DALL-E, Flux) via model settings.
- **Streaming preview:** Show a loading placeholder in the UI while the image generates (the tool currently blocks until complete).
- **Rate limiting:** Add per-user rate limits for image generation (expensive operation).
