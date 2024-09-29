import React from 'react';
import { Button } from "@/components/ui/button";

const SaveDeckButton = ({ onSave, isLoading }) => {
  return (
    <Button onClick={onSave} className="mt-4" disabled={isLoading}>
      {isLoading ? 'Saving...' : 'Save Deck'}
    </Button>
  );
};

export default SaveDeckButton;