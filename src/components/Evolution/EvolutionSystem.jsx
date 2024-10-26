import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Sparkles, Star, Zap } from 'lucide-react';

const EvolutionSystem = ({ teddy, onEvolution }) => {
  const [isEvolving, setIsEvolving] = useState(false);
  const { toast } = useToast();

  const { data: evolutionPaths } = useQuery({
    queryKey: ['evolutionPaths', teddy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evolution_paths')
        .select('*')
        .eq('base_teddy_id', teddy.id);
      if (error) throw error;
      return data;
    },
  });

  const evolutionMutation = useMutation({
    mutationFn: async (evolutionPath) => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .update({
          name: evolutionPath.evolved_name,
          attack: teddy.attack * 1.5,
          defense: teddy.defense * 1.5,
          evolution_level: (teddy.evolution_level || 0) + 1,
          special_ability: evolutionPath.new_ability,
        })
        .eq('id', teddy.id);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Evolution Complete!",
        description: `Your teddy has evolved into a more powerful form!`,
        variant: "success",
      });
      onEvolution(data);
    },
  });

  const checkEvolutionRequirements = (path) => {
    return (
      teddy.level >= path.required_level &&
      teddy.battles_won >= path.required_battles &&
      teddy.special_moves_used >= path.required_special_moves
    );
  };

  const handleEvolution = async (path) => {
    setIsEvolving(true);
    await evolutionMutation.mutateAsync(path);
    setIsEvolving(false);
  };

  return (
    <div className="evolution-system p-4">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Star className="text-yellow-500" />
        Evolution Paths
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {evolutionPaths?.map((path) => (
          <motion.div
            key={path.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="text-purple-500" />
                  {path.evolved_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Required Level</p>
                    <Progress 
                      value={(teddy.level / path.required_level) * 100} 
                      className="mt-1"
                    />
                    <p className="text-xs text-right">{teddy.level}/{path.required_level}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Battles Won</p>
                    <Progress 
                      value={(teddy.battles_won / path.required_battles) * 100} 
                      className="mt-1"
                    />
                    <p className="text-xs text-right">{teddy.battles_won}/{path.required_battles}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Special Moves Used</p>
                    <Progress 
                      value={(teddy.special_moves_used / path.required_special_moves) * 100} 
                      className="mt-1"
                    />
                    <p className="text-xs text-right">{teddy.special_moves_used}/{path.required_special_moves}</p>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Zap className="text-yellow-500" />
                      New Special Ability
                    </h4>
                    <p className="text-sm text-gray-600">{path.new_ability.name}</p>
                    <p className="text-xs text-gray-500">{path.new_ability.description}</p>
                  </div>
                  <Button
                    onClick={() => handleEvolution(path)}
                    disabled={!checkEvolutionRequirements(path) || isEvolving}
                    className="w-full mt-4"
                  >
                    {isEvolving ? "Evolving..." : "Evolve"}
                  </Button>
                </div>
              </CardContent>
              {isEvolving && (
                <motion.div
                  className="absolute inset-0 bg-purple-500 bg-opacity-30 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-12 h-12 text-white" />
                  </motion.div>
                </motion.div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default EvolutionSystem;