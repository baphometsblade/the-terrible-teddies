# Card art

Drop generated card illustrations here as `<cardId>.webp` (player cards use
their `ALL_CARDS` ids 1–43; Chuck's goons use their opponent ids 101–108).
`TeddyCard`'s `ArtOrEmoji` slot picks them up automatically — any card without
a file here (or whose image fails to load) falls back to the emoji cast, so
partial art is safe to ship.

Style contract for generated art (keep the cast coherent):

> Flat stylized illustration of a single plush teddy bear character, chest-up,
> facing viewer, on a plain dark plum background (#2a1b3d), moody amber rim
> light, worn fabric texture, visible stitches, [CHARACTER], thick clean
> outlines, high contrast, no text, no watermark, children's-book style gone
> noir.

Traps and specials get object-centric art (the trap/item itself, same style).
Target ≤512px on the long edge, ≤60 KB per file, aspect ratio 3:4.
