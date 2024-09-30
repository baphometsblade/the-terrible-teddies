import React, { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '../lib/supabase';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const PlayerSubmission = () => {
  const [submission, setSubmission] = useState({
    name: '',
    title: '',
    description: '',
    attack: '',
    defense: '',
    specialMove: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSubmission(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('player_submissions')
        .insert([
          {
            ...submission,
            attack: parseInt(submission.attack),
            defense: parseInt(submission.defense),
          }
        ]);

      if (error) throw error;

      toast({
        title: "Submission Successful",
        description: "Your teddy bear idea has been submitted for review!",
        variant: "success",
      });

      setSubmission({
        name: '',
        title: '',
        description: '',
        attack: '',
        defense: '',
        specialMove: '',
      });
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="player-submission container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Submit Your Teddy Bear Idea</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
          <Input
            type="text"
            id="name"
            name="name"
            value={submission.name}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
          <Input
            type="text"
            id="title"
            name="title"
            value={submission.title}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <Textarea
            id="description"
            name="description"
            value={submission.description}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label htmlFor="attack" className="block text-sm font-medium text-gray-700">Attack</label>
          <Input
            type="number"
            id="attack"
            name="attack"
            value={submission.attack}
            onChange={handleChange}
            required
            min="1"
            max="10"
          />
        </div>
        <div>
          <label htmlFor="defense" className="block text-sm font-medium text-gray-700">Defense</label>
          <Input
            type="number"
            id="defense"
            name="defense"
            value={submission.defense}
            onChange={handleChange}
            required
            min="1"
            max="10"
          />
        </div>
        <div>
          <label htmlFor="specialMove" className="block text-sm font-medium text-gray-700">Special Move</label>
          <Input
            type="text"
            id="specialMove"
            name="specialMove"
            value={submission.specialMove}
            onChange={handleChange}
            required
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Teddy Bear'}
        </Button>
      </form>
    </div>
  );
};

export default PlayerSubmission;