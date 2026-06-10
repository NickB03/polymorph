# Design Workflow (Pencil Wireframes)

Polymorph uses Pencil (`.pen` files) for wireframing UI before implementation. The primary wireframe file is `polymorph.pen` at the project root.

## When to wireframe first

- **New pages or major UI sections** — always wireframe before writing code
- **Complex layouts** (multi-panel views, dashboards, dense information displays) — wireframe to resolve layout decisions cheaply
- **Significant redesigns** of existing screens — wireframe the target state

## When to skip wireframes

- Small tweaks, bug fixes, or adjustments to existing UI
- Non-visual work (API routes, data logic, tooling)
- Component-level changes where the layout is already established

## Workflow

1. **Open the wireframe:** Use `get_editor_state()` to check if a `.pen` file is active, or `open_document()` to open `polymorph.pen`
2. **Pull design context:** Use `get_guidelines(topic)` for layout patterns and `get_style_guide()` for visual direction. The project's design system lives in `DESIGN.md`
3. **Read the wireframe:** Use `batch_get()` and `snapshot_layout()` to understand the layout structure. Use `get_screenshot()` to see the visual result
4. **Implement from the wireframe:** Translate the wireframe layout, spacing, hierarchy, and component choices into React code. The wireframe is the spec — match it
5. **Validate visually:** After implementation, compare the browser output against the wireframe. Use `webapp-testing` for screenshot verification when precision matters

## Wireframe maintenance

Wireframes are **planning tools, not documentation**. Once code ships, the wireframe's job is done.

- **Don't back-port small changes.** If you remove a button, adjust spacing, or swap a component in code, the code is the updated design. Don't touch the wireframe.
- **Update the wireframe when redesigning.** Before a significant change to an existing screen, update the relevant frame to reflect the _new_ target state, then implement from it.
- **Wireframes naturally drift from the live app — that's fine.** They represent decisions already made. Only bring them current when actively using them to plan the next change.
- **Color, typography, and token changes don't go in wireframes.** That's `DESIGN.md` territory.

## Rules

- **Wireframe is the source of truth for layout — during implementation.** While building from a wireframe, don't improvise layout decisions it already specifies. If the wireframe is wrong, update it first, then update the code. After implementation, the code becomes the source of truth.
- **Design tokens come from `DESIGN.md`.** The wireframe defines _where_; the design system defines _how_.
- **The user has no design or development background.** Wireframes are their primary tool for communicating visual intent. Read them carefully and ask clarifying questions if the wireframe is ambiguous rather than guessing.
