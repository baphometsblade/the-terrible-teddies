import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useGameStore, SHOP_ITEMS } from '../stores/gameStore';
import confetti from 'canvas-confetti';
import analytics from '../utils/analytics';
import { redirectToStripeCheckout } from '../utils/stripe';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';

const GEM_BUNDLES = [
  { id: 'gems_small', gems: 50, price: 0.99, bonus: 0, popular: false },
  { id: 'gems_medium', gems: 150, price: 2.99, bonus: 10, popular: false },
  { id: 'gems_large', gems: 500, price: 9.99, bonus: 50, popular: true },
  { id: 'gems_huge', gems: 1200, price: 19.99, bonus: 200, popular: false },
  { id: 'gems_mega', gems: 3000, price: 49.99, bonus: 750, popular: false },
];

const Shop = ({ onClose }) => {
  const { coins, gems, cardPacks, buyShopItem } = useGameStore();
  const { session } = useSupabaseAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('packs');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    analytics.trackShopView(activeTab);
  }, [activeTab]);

  const handleBuyItem = (item) => {
    const result = buyShopItem(item.id);
    if (result.success) {
      analytics.trackInGamePurchase({
        itemId: item.id,
        itemName: item.name,
        cost: item.price,
        currency: item.currency,
      });
      toast({ title: "Purchase Successful!", description: result.message });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } else {
      toast({ title: "Purchase Failed", description: result.message, variant: "destructive" });
    }
  };

  const handleGemPurchase = async (bundle) => {
    if (!session?.user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to purchase gems.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      await redirectToStripeCheckout(bundle.id);
      // Browser navigates away — no further code runs here
    } catch (err) {
      analytics.trackError(err, 'gem_purchase');
      setProcessing(false);
      toast({
        title: "Checkout Failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const PackCard = ({ item, featured = false }) => (
    <motion.div
      whileHover={{ scale: 1.03, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className={`relative rounded-xl overflow-hidden cursor-pointer ${featured ? 'col-span-2 row-span-2' : ''}`}
      onClick={() => handleBuyItem(item)}
    >
      <div className={`p-4 h-full flex flex-col items-center justify-center text-center
        ${item.type === 'legendary' ? 'bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-600' :
          item.type === 'premium' ? 'bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500' :
          'bg-gradient-to-br from-blue-600 to-indigo-700'}
        ${featured ? 'min-h-[280px]' : 'min-h-[160px]'}`}>
        {item.type === 'legendary' && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          />
        )}
        <div className={`${featured ? 'text-6xl' : 'text-4xl'} mb-2`}>{item.icon}</div>
        <h3 className={`font-bold text-white ${featured ? 'text-2xl' : 'text-lg'}`}>{item.name}</h3>
        <p className={`text-white/80 ${featured ? 'text-base' : 'text-xs'} mb-3`}>{item.description}</p>
        <div className={`flex items-center gap-1 px-4 py-2 rounded-full font-bold
          ${item.currency === 'gems' ? 'bg-purple-900/50 text-purple-200' : 'bg-yellow-900/50 text-yellow-200'}`}>
          <span>{item.currency === 'gems' ? '💎' : '🪙'}</span>
          <span>{item.price}</span>
        </div>
      </div>
    </motion.div>
  );

  const GemBundle = ({ bundle }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => !processing && handleGemPurchase(bundle)}
      className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all
        ${bundle.popular ? 'border-yellow-400 shadow-lg shadow-yellow-500/30' : 'border-white/20 hover:border-white/40'}
        bg-gradient-to-br from-purple-900/80 to-indigo-900/80`}
    >
      {bundle.popular && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-black text-xs font-bold py-1 text-center">BEST VALUE</div>
      )}
      <div className={`p-4 text-center ${bundle.popular ? 'pt-8' : ''}`}>
        <div className="text-4xl mb-2">💎</div>
        <div className="text-2xl font-bold text-white">{bundle.gems.toLocaleString()}</div>
        {bundle.bonus > 0 && <div className="text-green-400 text-sm font-semibold">+{bundle.bonus} BONUS</div>}
        <div className="text-purple-300 text-xs mt-1">{bundle.bonus > 0 ? `${bundle.gems + bundle.bonus} total` : ''}</div>
        <div className="mt-3 bg-white text-purple-900 px-4 py-2 rounded-full font-bold">${bundle.price.toFixed(2)}</div>
      </div>
    </motion.div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-b from-indigo-900 via-purple-900 to-black rounded-2xl max-w-4xl w-full shadow-2xl border border-white/10 my-4"
      >
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">🏪</span> Shop
          </h2>
          <div className="flex items-center gap-4">
            <div className="bg-yellow-500/20 px-3 py-1 rounded-full flex items-center gap-2">
              <span>🪙</span><span className="text-yellow-400 font-bold">{coins.toLocaleString()}</span>
            </div>
            <div className="bg-purple-500/20 px-3 py-1 rounded-full flex items-center gap-2">
              <span>💎</span><span className="text-purple-300 font-bold">{gems}</span>
            </div>
            <div className="bg-blue-500/20 px-3 py-1 rounded-full flex items-center gap-2">
              <span>📦</span><span className="text-blue-300 font-bold">{cardPacks}</span>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl ml-2" aria-label="Close shop">×</button>
          </div>
        </div>

        <div className="flex border-b border-white/10">
          {[
            { id: 'packs', label: 'Card Packs', icon: '📦' },
            { id: 'gems', label: 'Buy Gems', icon: '💎' },
            { id: 'special', label: 'Special Offers', icon: '⭐' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 text-center font-semibold transition-all ${
                activeTab === tab.id ? 'text-white bg-white/10 border-b-2 border-purple-400' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'packs' && (
              <motion.div key="packs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {SHOP_ITEMS.filter(i => ['pack', 'premium', 'legendary'].includes(i.type)).map(item => (
                  <PackCard key={item.id} item={item} featured={item.type === 'legendary'} />
                ))}
              </motion.div>
            )}

            {activeTab === 'gems' && (
              <motion.div key="gems" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">Get More Gems</h3>
                  <p className="text-white/60">Use gems to buy premium packs with guaranteed rare cards!</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {GEM_BUNDLES.map(bundle => (<GemBundle key={bundle.id} bundle={bundle} />))}
                </div>
                <div className="mt-6 text-center text-white/40 text-sm">
                  <p>Secure payment processing powered by Stripe</p>
                  <p className="mt-1">All purchases are final. See Terms of Service for details.</p>
                </div>
              </motion.div>
            )}

            {activeTab === 'special' && (
              <motion.div key="special" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div className="bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border border-yellow-500/50 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <div className="text-yellow-400 text-sm font-semibold mb-1">LIMITED TIME OFFER</div>
                      <h3 className="text-2xl font-bold text-white mb-2">Starter Bundle</h3>
                      <p className="text-white/70 mb-3">Everything you need to dominate!</p>
                      <ul className="text-white/80 text-sm space-y-1">
                        <li>📦 5 Card Packs</li>
                        <li>💎 100 Gems</li>
                        <li>🪙 1000 Coins</li>
                        <li>⭐ 1 Guaranteed Epic Card</li>
                      </ul>
                    </div>
                    <div className="text-center">
                      <div className="text-white/50 line-through text-lg">$14.99</div>
                      <div className="text-3xl font-bold text-yellow-400">$4.99</div>
                      <div className="text-green-400 text-sm font-semibold">67% OFF</div>
                      <Button
                        onClick={() => handleGemPurchase({ id: 'starter_bundle', gems: 100, bonus: 0, price: 4.99 })}
                        disabled={processing}
                        className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                      >
                        {processing ? '…' : 'Buy Now'}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-purple-600/30 to-pink-600/30 border border-purple-500/50 rounded-xl p-4">
                    <h4 className="font-bold text-white mb-2">💎 Weekly Gem Pass</h4>
                    <p className="text-white/60 text-sm mb-3">50 gems daily for 7 days!</p>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-300">350 gems total</span>
                      <Button
                        size="sm"
                        onClick={() => handleGemPurchase({ id: 'weekly_gem_pass', gems: 350, bonus: 0, price: 1.99 })}
                        disabled={processing}
                        className="bg-purple-500 hover:bg-purple-600"
                      >
                        $1.99
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-600/30 to-teal-600/30 border border-green-500/50 rounded-xl p-4">
                    <h4 className="font-bold text-white mb-2">🪙 Coin Doubler</h4>
                    <p className="text-white/60 text-sm mb-3">Double coins from battles for 24h!</p>
                    <div className="flex justify-between items-center">
                      <span className="text-green-300">Worth 500+ coins</span>
                      <Button size="sm" className="bg-green-500 hover:bg-green-600 text-black">💎 25</Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {processing && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="text-5xl"
          >
            💎
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Shop;
