// Turns booth sessions into the pictures the big screens show (wall + slideshow).

/** Sessions → tiles. "raw" = each unframed shot on its own tile; "framed" = the finished post. */
export function tilesFrom(sessions, show) {
  return sessions.flatMap((s) =>
    show !== "framed" && s.hasRaw
      ? [0, 1, 2].map((part) => ({ id: `${s.token}-${part}`, src: `/img/${s.token}/raw.jpg`, part }))
      : [{ id: s.token, src: `/img/${s.token}/feed.jpg` }],
  );
}

/** Raw tiles show one third of the 3-shot strip: slide the picture across to the right part. */
export function cropFor(tile) {
  return tile.part === undefined ? "" : `object-position:${tile.part * 50}% 50%`;
}
