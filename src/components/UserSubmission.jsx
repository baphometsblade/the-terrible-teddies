import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '../lib/supabase';
import { getAICompletion } from '../utils/aiCompletion';

const UserSubmission = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ability, setAbility] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('player_submissions')
      .insert([{ name, description, ability }]);

    if (error) {
      console.error('Error submitting teddy:', error);
    } else {
      console.log('Teddy submitted successfully:', data);
      
      // Generate AI response
      const messages = [
        { role: "system", content: "You are an AI assistant for a game called Cheeky Teddy Brawl. Respond to player submissions with enthusiasm and humor." },
        { role: "user", content: `A player has submitted a new teddy bear idea. Name: ${name}, Description: ${description}, Special Ability: ${ability}. What do you think?` }
      ];
      
      try {
        const response = await getAICompletion(messages);
        setAiResponse(response);
      } catch (error) {
        console.error('Error getting AI response:', error);
        setAiResponse('Oops! Our AI teddy got stuck in a honey pot. Please try again later!');
      }

      setName('');
      setDescription('');
      setAbility('');
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Submit Your Teddy</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="ability" className="block text-sm font-medium text-gray-700">Special Ability</label>
          <Input
            id="ability"
            value={ability}
            onChange={(e) => setAbility(e.target.value)}
            required
          />
        </div>
        <Button type="submit">Submit Teddy</Button>
      </form>
      {aiResponse && (
        <div className="mt-4 p-4 bg-purple-100 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">AI Response:</h3>
          <p>{aiResponse}</p>
        </div>
      )}
    </div>
  );
};

export default UserSubmission;