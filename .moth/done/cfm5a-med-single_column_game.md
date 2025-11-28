iPlease update Pelican so that the playable bingo card uses a 
(Relatives × phrasesPerRelative) rectangular grid instead of trying to 
create a square-ish grid.

Requirements:
1. If the event selects R relatives and phrasesPerRelative = P,
   the card grid must have exactly R rows and P columns.
   - Example: 1 relative + 3 phrases → 1×3 grid.
   - Example: 4 relatives + 5 phrases → 4×5 grid.

2. The existing logic that builds card.cells can stay exactly as-is,
   but the layout should be rendered as:
      width = phrasesPerRelative
      height = numberOfSelectedRelatives

3. Each row must group phrases by relative:
      Row 0 → all phrases for Relative 0
      Row 1 → all phrases for Relative 1
      ...

4. Update the bingo checking logic accordingly:
   - Bingo still means a fully checked row, column, or diagonal,
     but now based on the rectangular grid.
   - If diagonals are not symmetrical (e.g., 1×3 or 2×5),
     implement diagonal bingo only if the diagonal physically exists.
       • A diagonal exists only if width == height.
       • Otherwise, ignore diagonals.

5. Update pelican.js to use this new layout when generating and rendering cards.

6. Update index.html or styles.css only if needed to make rectangular grids display cleanly.

7. Provide the revised complete file(s) with no placeholders.

Please begin by briefly summarizing your plan and which files you will update.

