// Suggestive adult plush, drawn in the card so Last Orders never waits on a
// photo file. The age gate still decides whether this mounts: ArtOrEmoji
// keeps it off while data-content is sfw, same as the photographic cards.

const LOOKS = {
  'lo-velvet-rope': { bg: '#3b1020', fur: '#7a2438', cloth: '#4a1024', lip: '#e11d48', prop: 'rope' },
  'lo-two-for-one': { bg: '#3a2410', fur: '#c4893a', cloth: '#7c2d12', lip: '#fb7185', prop: 'pair' },
  'lo-last-pour': { bg: '#3f1d12', fur: '#b45309', cloth: '#44403c', lip: '#e11d48', prop: 'pour' },
  'lo-on-the-house': { bg: '#3b1228', fur: '#be185d', cloth: '#4c1d95', lip: '#fb7185', prop: 'wink' },
  'lo-firm-hand': { bg: '#1c1917', fur: '#44403c', cloth: '#1f2937', lip: '#fda4af', prop: 'palm' },
  'lo-sorry-mate': { bg: '#292018', fur: '#a16207', cloth: '#44403c', lip: '#fb7185', prop: 'sorry' },
  'lo-lights-down': { bg: '#0c0a1a', fur: '#312e81', cloth: '#831843', lip: '#f472b6', prop: 'dark' },
  'lo-cut-the-line': { bg: '#3f0d12', fur: '#7f1d1d', cloth: '#292524', lip: '#fb7185', prop: 'cut' },
  'lo-still-standing': { bg: '#450a0a', fur: '#b91c1c', cloth: '#4a044e', lip: '#fecdd3', prop: 'stand' },
  'lo-owners-round': { bg: '#1c1408', fur: '#292524', cloth: '#7c2d12', lip: '#fda4af', prop: 'round' },
};

const Prop = ({ kind }) => {
  if (kind === 'rope') {
    return (
      <g>
        <rect x="18" y="150" width="8" height="78" rx="2" fill="#d6b25e" />
        <path d="M26 168 H150" stroke="#d6b25e" strokeWidth="6" />
      </g>
    );
  }
  if (kind === 'pair') {
    return (
      <g>
        <rect x="28" y="168" width="16" height="26" rx="4" fill="#fde68a" stroke="#b45309" />
        <rect x="50" y="160" width="16" height="26" rx="4" fill="#fde68a" stroke="#b45309" />
      </g>
    );
  }
  if (kind === 'pour') {
    return <rect x="132" y="150" width="18" height="30" rx="4" fill="#fbbf24" stroke="#b45309" />;
  }
  if (kind === 'palm') {
    return <ellipse cx="148" cy="168" rx="22" ry="18" fill="#d6b08a" stroke="#292524" />;
  }
  if (kind === 'sorry') {
    return <ellipse cx="150" cy="200" rx="14" ry="8" fill="#1c1917" opacity="0.7" />;
  }
  if (kind === 'dark') {
    return <circle cx="156" cy="48" r="10" fill="#fbcfe8" opacity="0.85" />;
  }
  if (kind === 'cut') {
    return <path d="M20 176 H100" stroke="#d6b25e" strokeWidth="5" strokeDasharray="10 6" />;
  }
  if (kind === 'stand') {
    return <path d="M70 214 H122" stroke="#fecdd3" strokeWidth="4" />;
  }
  return (
    <g>
      <rect x="128" y="146" width="22" height="36" rx="4" fill="#7f1d1d" />
      <circle cx="150" cy="168" r="6" fill="#d6b25e" />
    </g>
  );
};

export const hasLastOrdersArt = (id) => Object.prototype.hasOwnProperty.call(LOOKS, id);

export const LastOrdersFigure = ({ id, className = '' }) => {
  const look = LOOKS[id];
  if (!look) return null;
  const wink = look.prop === 'wink';
  return (
    <svg
      data-last-orders-art={id}
      viewBox="0 0 192 256"
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none h-full w-full ${className}`}
      aria-hidden="true"
    >
      <rect width="192" height="256" fill={look.bg} />
      <ellipse cx="96" cy="228" rx="62" ry="14" fill="#000" opacity="0.28" />
      <circle cx="58" cy="74" r="22" fill={look.fur} />
      <circle cx="134" cy="74" r="22" fill={look.fur} />
      <circle cx="58" cy="74" r="10" fill="#3f1d2a" />
      <circle cx="134" cy="74" r="10" fill="#3f1d2a" />
      <ellipse cx="96" cy="108" rx="48" ry="44" fill={look.fur} />
      <ellipse cx="96" cy="124" rx="24" ry="16" fill="#f3d5b5" />
      <ellipse cx="96" cy="118" rx="8" ry="5" fill="#2a2118" />
      <ellipse cx="78" cy="100" rx="6" ry={wink ? 1.2 : 3.4} fill="#1a120c" />
      <ellipse cx="114" cy="100" rx="6" ry="3.4" fill="#1a120c" />
      <path d="M80 132 q16 8 32 0" fill="none" stroke="#2a2118" strokeWidth="1.4" />
      <ellipse cx="70" cy="116" rx="7" ry="4" fill={look.lip} opacity="0.85" />
      <ellipse cx="96" cy="188" rx="50" ry="42" fill={look.fur} />
      <path d={`M64 158 L96 214 L128 158`} fill={look.cloth} />
      <path d="M80 166 L96 204 L112 166" fill="#f3d5b5" />
      <ellipse cx="96" cy="186" rx="12" ry="8" fill="#fff" opacity="0.28" />
      <Prop kind={look.prop} />
    </svg>
  );
};
