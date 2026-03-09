'use client'

import { Component, type ReactNode } from 'react'

interface ToolErrorBoundaryProps {
  toolName: string
  children: ReactNode
}

interface ToolErrorBoundaryState {
  hasError: boolean
}

export class ToolErrorBoundary extends Component<
  ToolErrorBoundaryProps,
  ToolErrorBoundaryState
> {
  constructor(props: ToolErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ToolErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error(`[ToolErrorBoundary] ${this.props.toolName}:`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/25 px-3 py-2 text-sm text-muted-foreground">
          Failed to render {this.props.toolName}
        </div>
      )
    }
    return this.props.children
  }
}
