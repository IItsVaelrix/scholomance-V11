# Visual Overhaul Plan: Scholomance Scribe IDE

This document outlines a plan to transform the Scholomance Scribe page into a beautiful, modern, and efficient Integrated Development Environment (IDE) for writing.

## 1. UI Elements

### 1.1. Editor Pane
-   **Syntax Highlighting:** Implement dynamic syntax highlighting for the input text, creating a custom "Scroll" language definition.
-   **Line Numbers:** Add a persistent line number column to the left of the input pane.
-   **Gutter Icons:** Create a gutter area next to the line numbers to display icons for actions, bookmarks, or error indicators.
-   **Minimap:** Integrate a minimap component on the right side of the editor for a high-level overview of the scroll's content.

### 1.2. Sidebar
-   **File Tree:** A hierarchical view to organize, open, and manage scrolls and notes.
-   **Search Panel:** A dedicated panel for quick searching within the current scroll or across all scrolls.
-   **Tools Panel:** A panel to provide quick access to analysis engines (Rhyme, Meter, etc.) with clear icons and status indicators.

### 1.3. Top Bar
-   **Project/Document Title:** Display the title of the current project or active scroll.
-   **Save Status Indicator:** A clear visual indicator (e.g., text, icon) to show "Saved," "Unsaved," or "Saving..." status.
-   **Theme & Layout Controls:** Add controls for switching between dark/light themes and customizing the layout (e.g., toggling sidebar visibility).

### 1.4. Status Bar
-   **Line/Column Indicator:** Display the current line and column number of the editor's cursor.
-   **Encoding/Language Info:** Show static information like "UTF-8" and "Scroll Language."
-   **Progress/Status Messages:** A dedicated area for temporary messages, like notifications from analysis engines or save confirmations.

## 2. Interaction

-   **Keyboard Shortcuts:** Implement standard keyboard shortcuts for common actions (e.g., `Ctrl+S` for save, `Ctrl+F` for search, `Ctrl+N` for new scroll).
-   **Drag-and-Drop:** Enable drag-and-drop functionality within the file tree for reordering and organizing scrolls.
-   **Resizable Panes:** Allow users to resize the editor, sidebar, and any other main panes to customize their workspace.

## 3. Aesthetics

-   **Monochromatic Theme:** Design clean, modern dark and light themes with a monochromatic color palette, using accent colors sparingly for highlights and status indicators.
-   **Subtle Animations:** Use tasteful CSS transitions for actions like opening/closing panels, resizing panes, and hover effects.
-   **Typography:** Select a clean, highly readable monospace font (e.g., Fira Code, Source Code Pro, IBM Plex Mono) to enhance the code-like feel of the editor.

## 4. Implementation Details

### 4.1. Editor Pane
-   **Syntax Highlighting:** Integrate a library like **Prism.js** or **CodeMirror** to create a custom language definition for the "Scroll" language, highlighting literary devices or specific keywords.
-   **Line Numbers & Gutter:** If using an advanced editor component like CodeMirror, these features are often built-in or available as extensions.
-   **Minimap:** Find and integrate a compatible minimap plugin or component for the chosen editor library.

### 4.2. Sidebar
-   **File Tree:** Use a battle-tested tree view component like **react-sortable-tree** or a custom implementation to manage the scroll hierarchy.
-   **Search Panel:** Implement a dedicated search input that filters results in real-time.
-   **Tools Panel:** Create a list of available analysis engines with clickable icons and status lights.

### 4.3. Top Bar & Status Bar
-   **Component Implementation:** These can be implemented as standard React components that receive state from the main application hooks (e.g., `useScrolls`, editor state).
-   **Save Status:** Connect to the `useScrolls` hook to determine if the current scroll has unsaved changes.
-   **Line/Column Indicator:** Listen for cursor change events from the editor component.

### 4.4. Interaction
-   **Keyboard Shortcuts:** Use a library like `react-hotkeys-hook` to declaratively map shortcuts to actions.
-   **Resizable Panes:** Implement using a library such as **react-resizable-panels** to create a flexible and persistent layout.

### 4.5. Aesthetics
-   **Theming:** Define CSS variables for all colors used in both dark and light themes. A single class switch on the root element can toggle between them.
-   **Animations:** Use CSS `transition` properties for smooth visual feedback on interactions.

## 5. Measurable Outcomes

-   **Performance:** Achieve a sub-300ms load time for the editor pane with a large scroll ( > 1000 lines).
-   **Efficiency:** Reduce the number of clicks required for common actions (saving, searching, switching scrolls) by at least 50% through keyboard shortcuts and an improved UI layout.
-   **Consistency:** Ensure a consistent design language (typography, spacing, color) across 100% of UI elements.
