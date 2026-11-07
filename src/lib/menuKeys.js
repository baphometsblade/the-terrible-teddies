// Arrow keys across the main menu's tile grid. Tab still visits every tile;
// the arrows are the extra step a grid owes, and they stop at the edge
// rather than wrapping (wrapping hides the boundary from a keyboard).

/**
 * The tile an arrow leaves `index` for, or null when the arrow leaves the grid.
 * `columns` is the row width the layout is using (2 on a phone, 4 from sm).
 * @param {number} index
 * @param {string} key
 * @param {number} columns
 * @param {number} count
 * @returns {number | null}
 */
export function neighborIndex(index, key, columns, count) {
  if (!Number.isInteger(index) || index < 0 || index >= count) return null;
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(count) || count < 1) return null;
  const col = index % columns;
  const row = Math.floor(index / columns);
  let nextCol = col;
  let nextRow = row;
  if (key === 'ArrowRight') nextCol += 1;
  else if (key === 'ArrowLeft') nextCol -= 1;
  else if (key === 'ArrowDown') nextRow += 1;
  else if (key === 'ArrowUp') nextRow -= 1;
  else return null;
  if (nextCol < 0 || nextCol >= columns || nextRow < 0) return null;
  const next = nextRow * columns + nextCol;
  return next < count ? next : null;
}
