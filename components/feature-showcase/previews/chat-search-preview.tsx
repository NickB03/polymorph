import { ChevronDown, Globe } from 'lucide-react'

import { BrowserFrame } from '../browser-frame'

export function ChatSearchPreview() {
  return (
    <BrowserFrame url="https://polymorph.ai" className="h-full">
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
              How does retrieval augmented generation (RAG) improve AI accuracy?
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div
                className="size-5 rounded-full bg-foreground/10"
                aria-hidden
              />
              <span>Polymorph</span>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
              Thought process · 4s
              <ChevronDown className="size-3" aria-hidden />
            </span>

            <p className="text-sm leading-relaxed text-foreground">
              RAG improves accuracy by shifting the model from a sole source of
              knowledge to an informed researcher. Standard LLMs rely entirely
              on their training data; a RAG pipeline retrieves fresh,
              source-grounded passages at query time and conditions the response
              on them.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                {
                  host: 'arxiv.org',
                  title:
                    'Retrieval-Augmented Generation for Knowledge-Intensive NLP'
                },
                {
                  host: 'pinecone.io',
                  title: 'What is Retrieval Augmented Generation?'
                },
                {
                  host: 'huggingface.co',
                  title: 'RAG: knowledge-grounded generation'
                },
                {
                  host: 'aws.amazon.com',
                  title: 'Why RAG reduces hallucination'
                }
              ].map(src => (
                <div
                  key={src.host}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs"
                >
                  <Globe
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {src.title}
                    </div>
                    <div className="truncate text-muted-foreground">
                      {src.host}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between rounded-full border border-border bg-background px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Ask anything…</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Send
            </span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}
