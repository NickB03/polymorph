# Gemini Image Generation Prompt

## Instructions

1. Upload `architecture-mermaid.md` (or a rendered screenshot of it) to Gemini as the structural reference
2. Optionally upload `social-preview.png` as a mood/color reference
3. Paste the prompt below

---

## Prompt

Generate a **dark-mode** and a **light-mode** version of an architecture diagram for a GitHub README. Use the uploaded Mermaid diagram as the exact structural layout — same nodes, same connections, same groupings. Do not add or remove any nodes.

### Layout & Structure

Follow the Mermaid diagram's left-to-right flow exactly:

1. **Left:** A minimal user icon labeled "You"
2. **Center:** The "Polymorph Agent" node — this is the visual focal point. Inside it, show "Tool Loop Orchestrator" and "Multi-step Reasoning" as internal layers
3. **Upper right:** "AI Providers" group containing Vercel AI Gateway routing to Gemini, GPT, Claude, and Grok
4. **Middle right:** "Web Search" group containing Brave, Tavily, and Exa
5. **Lower right:** "Streaming Response" group containing Generative UI outputs — Tables, Charts, Timelines, Citations, and Canvas Artifacts
6. **Bottom center:** "Persistence" group containing Supabase PostgreSQL and Phoenix Observability
7. **Connections:** Show labeled edges: "query" from user to agent, "model calls" to providers, "search + fetch" to search, "SSE stream" to response, "persist" to data, "render" looping back from response to user

### Visual Style

**Dark mode:**

- Background: deep navy gradient (not pure black), similar to the social preview image — dark navy (#0a0f1a) with a subtle radial blue glow behind the center agent node
- Agent node: frosted glass card with a blue-to-violet gradient border glow (blue hue ~263, violet hue ~293). This is the hero element — make it slightly larger and more prominent than other nodes
- Group cards: semi-transparent dark cards with subtle rounded borders (1px border, rgba white at ~8% opacity), slight backdrop blur feel
- Sub-items inside groups (Gemini, GPT, etc.): small rounded pills with subtle fill, not outlined — use a slightly lighter shade of the card background
- Connection lines: thin (#1-2px), with a subtle blue glow. Use gentle curves, not sharp right angles. Arrowheads should be small and clean
- Edge labels: small, muted text (~11px equivalent), positioned along the connection lines
- Typography: clean sans-serif (Inter or similar), white text at ~90% opacity for primary labels, ~50% opacity for secondary/edge labels
- Include a small 4-pointed star decorative element in the bottom-right corner (matching the social preview)

**Light mode:**

- Background: clean white (#ffffff) or very light gray (#fafafa)
- Agent node: white card with a soft blue border and subtle blue drop shadow
- Group cards: white cards with light gray borders (#e5e7eb), subtle shadow
- Sub-items: light gray pills (#f3f4f6) with darker text
- Connection lines: medium gray (#9ca3af) with small clean arrowheads, gentle curves
- Edge labels: gray text (#6b7280)
- Typography: same sans-serif, dark text (#111827) for primary, gray (#6b7280) for secondary
- Same star element in bottom-right, in gray

### Technical Requirements

- Output size: 1440 × 900 pixels (16:10 ratio, retina-friendly)
- Keep text large enough to be readable when displayed at 720px width on GitHub (so roughly 24px+ for node titles, 16px+ for sub-items, 12px+ for edge labels at the 1440px native size)
- Ensure high contrast between text and backgrounds for accessibility
- The diagram should feel like a premium product landing page illustration, not a technical whiteboard sketch
- Visual hierarchy: Agent node > Group titles > Sub-items > Edge labels > Decorative elements

### What to Avoid

- Clip art or cartoon-style icons
- Drop shadows that look like early-2000s web design
- Overly complex gradients or textures that distract from the information
- Pure black backgrounds (use navy)
- Neon or overly saturated colors
- 3D perspective or isometric views — keep it flat/2.5D at most
