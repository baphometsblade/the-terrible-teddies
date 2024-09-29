import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import TeddyCard from "./TeddyCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const fetchTeddies = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("player_teddies")
    .select(`
      id,
      teddy_id,
      terrible_teddies (*)
    `)
    .eq("player_id", user.id);

  if (error) throw error;
  return data.map(item => item.terrible_teddies);
};

const TeddyCollection = () => {
  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ["player_teddies"],
    queryFn: fetchTeddies,
  });

  if (isLoading) return <div className="text-center mt-8">Loading your collection...</div>;
  if (error) return <div className="text-center mt-8 text-red-500">Error loading collection: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Your Teddy Collection</h2>
      {teddies && teddies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teddies.map((teddy) => (
            <TeddyCard key={teddy.id} teddy={teddy} />
          ))}
        </div>
      ) : (
        <div className="text-center">
          <p className="mb-4">You don't have any teddies yet. Visit the shop to get some!</p>
          <Link to="/shop">
            <Button>Go to Shop</Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default TeddyCollection;