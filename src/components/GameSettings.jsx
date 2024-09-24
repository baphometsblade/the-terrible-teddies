import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export const GameSettings = ({ settings, onSettingsChange, onBack }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-purple-800 mb-4">Game Settings</h2>
      
      <div className="space-y-2">
        <Label htmlFor="difficulty">Difficulty</Label>
        <Select
          id="difficulty"
          value={settings.difficulty}
          onValueChange={(value) => onSettingsChange({ ...settings, difficulty: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="sound"
          checked={settings.soundEnabled}
          onCheckedChange={(checked) => onSettingsChange({ ...settings, soundEnabled: checked })}
        />
        <Label htmlFor="sound">Enable Sound</Label>
      </div>

      <Button onClick={onBack} className="mt-4">Back to Menu</Button>
    </div>
  );
};