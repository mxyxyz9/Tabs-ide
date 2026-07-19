---
name: ui-ux
description: Strict design protocol to ensure all generated UI is shippable, premium, and not hallucinated.
---

# UI/UX & Design Guardrails

**WARNING TO AGENT:** You are operating under strict UI/UX guidelines. The user demands that all user interfaces built by agents be **production-ready and shippable**. "Dummy" placeholders, lazy styling, and hallucinated generic layouts are strictly forbidden.

## Core Design Directives

### 1. Shippable Quality Only
- Any UI component you write must be 100% production-ready.
- **NO DUMMY CODE:** Never use placeholder text (like "Lorem Ipsum"), empty grey boxes, or unstyled native buttons.
- Every element must have proper padding, margins, hover states, and structural alignment. If a component looks like an MVP or a prototype, you have failed the task.

### 2. Premium Aesthetics Protocol
- Avoid raw browser defaults and primary colors (plain red, plain blue). Use curated, subtle color palettes (like Tailwind's slate/zinc or the project's CSS variables).
- Implement modern design standards:
  - Use subtle borders (`border-border/50`) and glassmorphism where appropriate.
  - Add micro-animations (e.g., `transition-all duration-200`, `hover:bg-accent`).
  - Ensure typography is clean and properly hierarchical.

### 3. The Mock-Up Rule (No Blind Hallucination)
- If the user asks for a complex new layout or feature, **DO NOT guess or hallucinate.** 
- You must use your `generate_image` tool to create a visual mock-up of what you intend to build and present it to the user in a plan *before* writing the code.
- This ensures you align on the aesthetic vision before wasting time.

### 4. The Clarification Protocol
- If a UI request is vague ("make this look better", "add a dashboard"), you MUST stop and ask clarifying questions. 
- Do not build entire screens based on assumptions. Ask about their layout preferences, data density needs, and visual inspiration first.
