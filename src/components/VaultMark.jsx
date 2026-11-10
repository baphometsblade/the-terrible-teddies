import { vaultOf, VAULT_BADGE, VAULT_LINE } from '@/lib/seasons';

/** The collection's mark on a card whose season has ended. */
const VaultMark = ({ cardId, seasons }) => {
  const vault = vaultOf(cardId, seasons);
  if (!vault) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-red-950 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-red-100 ring-1 ring-red-300/50">
        {VAULT_BADGE}
      </span>
      <span className="text-sm text-plush-200">{VAULT_LINE}</span>
    </span>
  );
};

export default VaultMark;
