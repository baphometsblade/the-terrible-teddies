
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

interface AnalysisResult {
  containsTeddy: boolean;
  containsNSFWContent: boolean;
  suggestedCardType?: string;
  suggestedCardName?: string;
  suggestedRarity?: string;
  description?: string;
  tags: string[];
  confidence: number;
}

export async function analyzeImageWithAI(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  imagePath: string
): Promise<AnalysisResult> {
  try {
    console.log(`Analyzing image ${bucket}/${imagePath}`);
    
    // Get a public URL for the image
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(imagePath);
    
    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error("Failed to get public URL for image");
    }
    
    const imageUrl = publicUrlData.publicUrl;
    console.log(`Image URL: ${imageUrl}`);
    
    // Perform basic image analysis based on the file name and path
    // This is a fallback when we don't have actual AI analysis
    const analysis = analyzeImageFromFilename(imagePath);
    
    // Store the analysis in the database
    await storeImageAnalysis(supabase, bucket, imagePath, analysis);
    
    return analysis;
  } catch (error) {
    console.error("Error in AI analysis:", error);
    
    // Return a minimal result in case of error
    return {
      containsTeddy: true,
      containsNSFWContent: false,
      tags: ["error", "analysis-failed"],
      confidence: 0.1
    };
  }
}

// Store image analysis in the database
async function storeImageAnalysis(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  imagePath: string,
  analysis: AnalysisResult
) {
  try {
    const storagePath = imagePath;
    const analysisJson = JSON.stringify(analysis);
    
    // Check if analysis already exists
    const { data: existingData } = await supabase
      .from('image_metadata')
      .select('id')
      .eq('storage_path', storagePath)
      .eq('bucket', bucket)
      .maybeSingle();
    
    if (existingData) {
      // Update existing analysis
      await supabase
        .from('image_metadata')
        .update({
          analysis: analysisJson,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id);
    } else {
      // Insert new analysis
      await supabase
        .from('image_metadata')
        .insert({
          bucket,
          storage_path: storagePath,
          analysis: analysisJson,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error("Error storing image analysis:", error);
  }
}

// Analyze image based on filename and patterns
function analyzeImageFromFilename(filename: string): AnalysisResult {
  const normalizedName = filename.toLowerCase();
  
  // Check for teddy bear related terms
  const teddyTerms = ['teddy', 'bear', 'plush', 'stuffed', 'toy', 'fluffy'];
  const containsTeddy = teddyTerms.some(term => normalizedName.includes(term));
  
  // Check for adult content related terms
  const adultTerms = ['naughty', 'nasty', 'flirt', 'seduc', 'adult', 'nsfw', 'xxx', 'mature'];
  const containsNSFWContent = adultTerms.some(term => normalizedName.includes(term));
  
  // Determine suggested card type based on filename patterns
  let suggestedCardType = 'Normal';
  if (normalizedName.includes('attack') || normalizedName.includes('brutal')) {
    suggestedCardType = 'Attack';
  } else if (normalizedName.includes('defend') || normalizedName.includes('shield')) {
    suggestedCardType = 'Defense';
  } else if (normalizedName.includes('special') || normalizedName.includes('magic')) {
    suggestedCardType = 'Special';
  }
  
  // Determine suggested rarity based on filename patterns
  let suggestedRarity = 'Common';
  if (normalizedName.includes('rare') || normalizedName.includes('uncommon')) {
    suggestedRarity = 'Uncommon';
  } else if (normalizedName.includes('epic') || normalizedName.includes('ultra')) {
    suggestedRarity = 'Rare';
  } else if (normalizedName.includes('legendary') || normalizedName.includes('myth')) {
    suggestedRarity = 'Epic';
  }
  
  // Extract potential card name from filename
  let suggestedCardName = '';
  const nameParts = filename.split(/[-_\.\s]/);
  if (nameParts.length >= 2) {
    // Take the first two parts that are long enough to be a name
    const validParts = nameParts.filter(part => part.length >= 3);
    if (validParts.length >= 2) {
      suggestedCardName = `${validParts[0].charAt(0).toUpperCase() + validParts[0].slice(1)} ${validParts[1].charAt(0).toUpperCase() + validParts[1].slice(1)}`;
    } else if (validParts.length === 1) {
      suggestedCardName = validParts[0].charAt(0).toUpperCase() + validParts[0].slice(1);
    }
  }
  
  // Generate appropriate tags
  const tags = [];
  
  if (containsTeddy) tags.push('teddy', 'plush');
  if (containsNSFWContent) tags.push('adult', 'nsfw');
  
  if (normalizedName.includes('fluffy')) tags.push('fluffy');
  if (normalizedName.includes('cute')) tags.push('cute');
  if (normalizedName.includes('angry')) tags.push('angry');
  if (normalizedName.includes('happy')) tags.push('happy');
  
  // Add gameplay related tags
  if (suggestedCardType === 'Attack') tags.push('attack', 'offensive');
  if (suggestedCardType === 'Defense') tags.push('defense', 'protective');
  if (suggestedCardType === 'Special') tags.push('special', 'magical');
  
  // Generate a suggestive description for adult-themed game
  let description = '';
  if (containsNSFWContent && containsTeddy) {
    const descriptionTemplates = [
      "This provocative teddy knows exactly how to get what it wants.",
      "Soft to the touch but hard where it counts.",
      "Not your childhood teddy bear - this one has grown up in all the right ways.",
      "Fluffy on the outside, naughty on the inside.",
      "This teddy's specialty is making you blush in all the right places."
    ];
    description = descriptionTemplates[Math.floor(Math.random() * descriptionTemplates.length)];
  } else if (containsTeddy) {
    const descriptionTemplates = [
      "A teddy bear with attitude and a taste for mischief.",
      "Cute and cuddly, but with a secret wild side.",
      "Don't let the innocent looks fool you - this bear plays rough.",
      "Soft and huggable, but fierce in battle.",
      "This teddy's eyes hide a world of desires."
    ];
    description = descriptionTemplates[Math.floor(Math.random() * descriptionTemplates.length)];
  }
  
  return {
    containsTeddy,
    containsNSFWContent,
    suggestedCardType,
    suggestedCardName,
    suggestedRarity,
    description,
    tags,
    confidence: 0.7 // Moderate confidence since this is based on filename patterns only
  };
}
