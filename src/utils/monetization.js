import { supabase } from '../lib/supabase';

export const purchaseBearPack = async (userId, packType) => {
  // Simulate a purchase transaction
  // In a real app, you'd integrate with a payment gateway like Stripe
  const packPrices = {
    standard: 4.99,
    premium: 9.99,
  };

  const price = packPrices[packType];
  if (!price) throw new Error('Invalid pack type');

  // Deduct coins or process payment here

  // Generate new bears for the pack
  const newBears = await generateBearsForPack(packType);

  // Add bears to user's collection
  const { data, error } = await supabase
    .from('player_bears')
    .insert(newBears.map(bear => ({ user_id: userId, bear_id: bear.id })));

  if (error) throw error;

  return newBears;
};

const generateBearsForPack = async (packType) => {
  const bearCount = packType === 'premium' ? 5 : 3;
  return generateInitialBears(bearCount);
};

export const purchaseSubscription = async (userId, tier) => {
  // Simulate a subscription purchase
  // In a real app, you'd integrate with a recurring payment system
  const subscriptionPrices = {
    gold: 4.99,
    platinum: 9.99,
  };

  const price = subscriptionPrices[tier];
  if (!price) throw new Error('Invalid subscription tier');

  // Process payment and update user's subscription status
  const { data, error } = await supabase
    .from('player_subscriptions')
    .upsert({ user_id: userId, tier, active: true })
    .select();

  if (error) throw error;

  return data[0];
};

export const getSubscriptionBenefits = (tier) => {
  const benefits = {
    gold: [
      'Exclusive bear packs',
      'Custom card frames',
      'Priority support',
    ],
    platinum: [
      'All Gold perks',
      'Faster event access',
      'Early bear releases',
      'Exclusive cosmetics',
    ],
  };

  return benefits[tier] || [];
};