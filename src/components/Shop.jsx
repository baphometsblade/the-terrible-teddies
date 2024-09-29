import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { purchaseBearPack, purchaseSubscription } from '../utils/monetization';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Shop = () => {
  const { toast } = useToast();
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const purchasePackMutation = useMutation({
    mutationFn: ({ userId, packType }) => purchaseBearPack(userId, packType),
    onSuccess: () => {
      toast({
        title: "Purchase Successful",
        description: "Your new bears are ready!",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const purchaseSubscriptionMutation = useMutation({
    mutationFn: ({ userId, tier }) => purchaseSubscription(userId, tier),
    onSuccess: () => {
      toast({
        title: "Subscription Activated",
        description: "Enjoy your new benefits!",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Subscription Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePurchasePack = (packType) => {
    if (user) {
      purchasePackMutation.mutate({ userId: user.id, packType });
    } else {
      toast({
        title: "Not Logged In",
        description: "Please log in to make a purchase.",
        variant: "destructive",
      });
    }
  };

  const handlePurchaseSubscription = (tier) => {
    if (user) {
      purchaseSubscriptionMutation.mutate({ userId: user.id, tier });
    } else {
      toast({
        title: "Not Logged In",
        description: "Please log in to subscribe.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Terrible Teddies Shop</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Bear Packs</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Standard Pack</h3>
              <p className="text-gray-600 mb-2">3 new bears - $4.99</p>
              <Button onClick={() => handlePurchasePack('standard')}>Purchase Standard Pack</Button>
            </div>
            <div>
              <h3 className="text-lg font-medium">Premium Pack</h3>
              <p className="text-gray-600 mb-2">5 new bears - $9.99</p>
              <Button onClick={() => handlePurchasePack('premium')}>Purchase Premium Pack</Button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Subscriptions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Gold Tier</h3>
              <p className="text-gray-600 mb-2">$4.99/month</p>
              <ul className="list-disc list-inside mb-2 text-sm">
                <li>Exclusive bears</li>
                <li>Custom card frames</li>
                <li>Priority support</li>
              </ul>
              <Button onClick={() => handlePurchaseSubscription('gold')}>Subscribe to Gold</Button>
            </div>
            <div>
              <h3 className="text-lg font-medium">Platinum Tier</h3>
              <p className="text-gray-600 mb-2">$9.99/month</p>
              <ul className="list-disc list-inside mb-2 text-sm">
                <li>All Gold perks</li>
                <li>Faster event access</li>
                <li>Early bear releases</li>
                <li>Exclusive cosmetics</li>
              </ul>
              <Button onClick={() => handlePurchaseSubscription('platinum')}>Subscribe to Platinum</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;