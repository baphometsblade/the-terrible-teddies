
import { useState } from "react";
import { useSuggestiveThreshold, SuggestiveThreshold } from "@/hooks/use-suggestive-threshold";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { AlertTriangle, ThermometerSun, HeartIcon, FlameIcon, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export const AdultContentSettings = () => {
  const { threshold, setThreshold } = useSuggestiveThreshold();
  const [tempThreshold, setTempThreshold] = useState<SuggestiveThreshold>(threshold);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const handleSave = () => {
    setThreshold(tempThreshold);
    toast.success("Adult content settings updated", {
      description: `Suggestive content level set to ${tempThreshold}`
    });
    setIsDialogOpen(false);
  };
  
  // Map threshold to numerical values for slider
  const thresholdToValue: Record<SuggestiveThreshold, number> = {
    'mild': 25,
    'moderate': 50,
    'spicy': 75,
    'explicit': 100
  };
  
  // Map numerical values back to threshold
  const valueToThreshold = (value: number): SuggestiveThreshold => {
    if (value <= 25) return 'mild';
    if (value <= 50) return 'moderate';
    if (value <= 75) return 'spicy';
    return 'explicit';
  };
  
  const getThresholdDescription = (level: SuggestiveThreshold): string => {
    switch (level) {
      case 'mild':
        return "Playful and suggestive themes with mild innuendo. Suitable for most adults.";
      case 'moderate':
        return "More direct suggestive content and moderate adult themes. Some suggestive language.";
      case 'spicy':
        return "Strong adult themes with explicit suggestive content. Frequent adult language.";
      case 'explicit':
        return "Very explicit adult content with no holds barred. Extremely suggestive themes and language.";
    }
  };
  
  const getThresholdIcon = (level: SuggestiveThreshold) => {
    switch (level) {
      case 'mild':
        return <HeartIcon className="w-5 h-5 text-blue-400" />;
      case 'moderate':
        return <ThermometerSun className="w-5 h-5 text-yellow-400" />;
      case 'spicy':
        return <FlameIcon className="w-5 h-5 text-orange-500" />;
      case 'explicit':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
  };
  
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 bg-rose-950/10 text-rose-200 hover:bg-rose-950/20 border-rose-800/30"
        >
          <ShieldAlert className="w-4 h-4" />
          Adult Content Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adult Content Settings</DialogTitle>
          <DialogDescription>
            Adjust the level of suggestive content in the game to match your comfort level.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Suggestive Content Level</Label>
              <span className={cn(
                "px-2 py-0.5 rounded text-xs font-medium",
                tempThreshold === 'mild' ? "bg-blue-500/20 text-blue-300" :
                tempThreshold === 'moderate' ? "bg-yellow-500/20 text-yellow-300" :
                tempThreshold === 'spicy' ? "bg-orange-500/20 text-orange-300" :
                "bg-red-500/20 text-red-300"
              )}>
                {tempThreshold.charAt(0).toUpperCase() + tempThreshold.slice(1)}
              </span>
            </div>
            
            <Slider
              value={[thresholdToValue[tempThreshold]]}
              onValueChange={(values) => setTempThreshold(valueToThreshold(values[0]))}
              max={100}
              step={1}
            />
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Mild</span>
              <span>Moderate</span>
              <span>Spicy</span>
              <span>Explicit</span>
            </div>
          </div>
          
          <RadioGroup 
            value={tempThreshold} 
            onValueChange={(value) => setTempThreshold(value as SuggestiveThreshold)}
            className="space-y-3"
          >
            {(['mild', 'moderate', 'spicy', 'explicit'] as SuggestiveThreshold[]).map((level) => (
              <div 
                key={level}
                className={cn(
                  "flex items-start space-x-3 rounded-lg border p-4",
                  tempThreshold === level ? "bg-primary/5 border-primary/30" : "border-muted"
                )}
              >
                <RadioGroupItem value={level} id={level} className="mt-1" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center">
                    {getThresholdIcon(level)}
                    <Label 
                      htmlFor={level} 
                      className="ml-2 font-medium"
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getThresholdDescription(level)}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className={cn(
              tempThreshold === 'mild' ? "bg-blue-600 hover:bg-blue-700" :
              tempThreshold === 'moderate' ? "bg-yellow-600 hover:bg-yellow-700" :
              tempThreshold === 'spicy' ? "bg-orange-600 hover:bg-orange-700" :
              "bg-red-600 hover:bg-red-700"
            )}
          >
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
