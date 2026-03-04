1.) Semantic surfaces + data-role hooks are stable API. Don’t rename without updating selectors map.

2.) State is classes + event bus. No inline styles for state. No cross-calling UI modules.

3.) Pure analysis vs effects. Parsing/rhyme logic never touches DOM/GSAP/audio.
