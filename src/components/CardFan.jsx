import { motion } from 'framer-motion';
import TeddyCard from './TeddyCard';

// Fan geometry, fixed per slot (left, centre, right): the outer two tilt out
// and sit a little lower, the centre card sits on top.
const FAN = [
  { rotate: -12, x: -58, y: 10, z: 1 },
  { rotate: 0, x: 0, y: 0, z: 3 },
  { rotate: 12, x: 58, y: 10, z: 2 },
];

/**
 * Three cards fanned over a pool of brass light: the main menu's hero (the
 * player's own rarest three) and the sign-in screen's key art. One component
 * so the two screens show the same object.
 *
 * Decorative, and hidden from assistive tech: the cards repeat what the
 * Collection shows. With three cards the middle one is the centre card, so
 * pass the one to feature second. One or two cards stack in the centre slot.
 *
 * `className` sizes the box (the fan is centred in it) and `cardClassName`
 * scales each card from hand size; both are the caller's, because the menu
 * steps them down on a short screen and the sign-in screen does not.
 *
 * Centring is plain CSS on a wrapper and Framer Motion animates only numeric
 * x / y / rotate on the layer inside it: Framer owns the transform of what it
 * animates, and it cannot interpolate a '-50%' into a calc() string.
 */
export default function CardFan({
  cards, cosmeticBorder = null, className = '', cardClassName = '', artVariant = 'responsive', artLoading = 'lazy',
}) {
  if (!cards?.length) return null;
  return (
    <div className={`relative pointer-events-none select-none ${className}`} aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 w-56 h-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass-400/20 blur-3xl" />
      {cards.map((card, i) => {
        const f = cards.length === 3 ? FAN[i] : FAN[1];
        return (
          <div
            key={card.id}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ zIndex: f.z }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, rotate: 0, x: 0 }}
              animate={{ opacity: 1, y: f.y, rotate: f.rotate, x: f.x }}
              transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 160, damping: 20 }}
            >
              <div className={`origin-center drop-shadow-[0_18px_24px_rgba(0,0,0,0.6)] ${cardClassName}`}>
                {/* Drawn larger than hand size, so `responsive` art takes the
                    full image where the screen's density calls for it and the
                    thumbnail where it does not. */}
                <TeddyCard teddy={card} cosmeticBorder={cosmeticBorder} artVariant={artVariant} artLoading={artLoading} />
              </div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
