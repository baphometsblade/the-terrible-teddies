
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PromptTemplatesProps {
  onSelect: (prompt: string, negativePrompt: string) => void;
  category: "naughty" | "nasty" | "regular";
  onCategoryChange: (category: "naughty" | "nasty" | "regular") => void;
}

// Define our template categories
const templates = {
  naughty: [
    {
      name: "Flirty Teddy",
      prompt: "Cute teddy bear in a seductive pose, flirty expression, soft lighting, bedroom setting, NSFW, adult-themed",
      negative: "deformed, ugly, bad anatomy, extra limbs, disfigured, poorly drawn face, poorly drawn hands"
    },
    {
      name: "Bedroom Eyes",
      prompt: "Teddy bear with bedroom eyes, suggestive pose, soft plush fur, intimate setting, romantic lighting, NSFW themed",
      negative: "deformed, ugly, bad anatomy, blurry, amateur"
    },
    {
      name: "Teddy Lingerie",
      prompt: "Teddy bear wearing lacy lingerie, posed seductively, soft lighting, intimate setting, NSFW, adult content",
      negative: "deformed, ugly, bad anatomy, poor composition, low quality, text, watermark"
    },
    {
      name: "Suggestive Pose",
      prompt: "Cuddly teddy bear in suggestive pose, soft plush texture, intimate bedroom setting, romantic mood, subtle NSFW elements",
      negative: "deformed, ugly, bad anatomy, poor drawing, amateur, text in image"
    }
  ],
  nasty: [
    {
      name: "Battle Damaged",
      prompt: "Battle-damaged teddy bear, torn stuffing, aggressive pose, dark atmosphere, intense expression, adult themed, NSFW",
      negative: "cute, childish, family friendly, bright colors, happy, deformed, bad anatomy"
    },
    {
      name: "Fierce Fighter",
      prompt: "Fierce fighting teddy bear, aggressive stance, battle-scarred, menacing expression, adult card game character, NSFW elements",
      negative: "deformed, ugly, bad anatomy, childish, cute, family friendly"
    },
    {
      name: "Dominance",
      prompt: "Dominant teddy bear, powerful stance, intense gaze, dark themed, adult content, NSFW card game character",
      negative: "deformed, childish, family friendly, cute, happy, bright colors"
    },
    {
      name: "Ripped Teddy",
      prompt: "Muscular teddy bear, ripped fabric showing stuffing underneath, aggressive pose, adult-themed card game character, NSFW",
      negative: "deformed, childish, amateur drawing, poor quality, text, watermark"
    }
  ],
  regular: [
    {
      name: "Fantasy Bear",
      prompt: "Fantasy teddy bear character, magical aura, mystical setting, high quality, detailed, card game art",
      negative: "deformed, ugly, bad anatomy, blurry, amateur, NSFW, adult content"
    },
    {
      name: "Warrior Teddy",
      prompt: "Teddy bear warrior, battle armor, fantasy setting, heroic pose, detailed texture, card game character",
      negative: "deformed, ugly, bad anatomy, poor quality, amateur, NSFW, inappropriate"
    },
    {
      name: "Magician Bear",
      prompt: "Teddy bear magician, casting spell, magic wand, mystical effects, fantasy setting, card game character",
      negative: "deformed, ugly, bad anatomy, low quality, blurry, text, NSFW"
    },
    {
      name: "Royal Teddy",
      prompt: "Royal teddy bear, crown, royal robes, throne room, regal pose, high quality, detailed, card game character",
      negative: "deformed, ugly, bad anatomy, poor composition, amateur, NSFW, adult content"
    }
  ]
};

export const PromptTemplates: React.FC<PromptTemplatesProps> = ({ 
  onSelect, 
  category,
  onCategoryChange
}) => {
  return (
    <div className="space-y-4">
      <Tabs value={category} onValueChange={(value) => onCategoryChange(value as any)}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="naughty">Naughty</TabsTrigger>
          <TabsTrigger value="nasty">Nasty</TabsTrigger>
          <TabsTrigger value="regular">Regular</TabsTrigger>
        </TabsList>
        
        <TabsContent value={category} className="pt-2">
          <ScrollArea className="h-64">
            <div className="grid grid-cols-1 gap-2">
              {templates[category].map((template, index) => (
                <Card key={index} className="hover:bg-accent/5 cursor-pointer">
                  <CardContent 
                    className="p-3"
                    onClick={() => onSelect(template.prompt, template.negative)}
                  >
                    <div className="font-medium text-sm mb-1">{template.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {template.prompt}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(template.prompt, template.negative);
                      }}
                    >
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
