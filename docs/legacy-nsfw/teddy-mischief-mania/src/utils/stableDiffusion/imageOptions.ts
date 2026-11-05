
// Add the getNSFWTeddyPrompt function to the file
export const getNSFWTeddyPrompt = (cardName: string, cardType: string): string => {
  const basePrompt = "fantasy teddy bear, stuffed animal, ";
  
  if (cardType === "naughty") {
    return `${basePrompt} seductive pose, playful, flirty expression, cute, ${cardName}, PG-13, tasteful`;
  } else if (cardType === "nasty") {
    return `${basePrompt} battle-ready, aggressive pose, menacing, fierce, ${cardName}, fantasy battle scene`;
  } else {
    return `${basePrompt} colorful, vibrant, magical, ${cardName}, fantasy setting`;
  }
};

// Add the getParametersForAssetType function
export const getParametersForAssetType = (assetType: string, prompt: string) => {
  const negativePrompt = "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, text, watermark, signature, extra limbs";
  
  let width = 1024;
  let height = 1024;
  let steps = 30;
  let cfg_scale = 7;
  let sampler_name = "DPM++ SDE Karras";
  
  switch (assetType) {
    case 'background':
    case 'backgrounds':
      width = 1024;
      height = 768;
      steps = 40;
      cfg_scale = 7.5;
      break;
    case 'gameboard':
    case 'game-boards':
      width = 1024;
      height = 1024;
      steps = 35;
      sampler_name = "Euler a";
      break;
    case 'card-backs':
      width = 512;
      height = 768;
      steps = 30;
      cfg_scale = 8;
      sampler_name = "DPM++ 2M Karras";
      break;
    case 'ui-elements':
      width = 768;
      height = 768;
      steps = 30;
      cfg_scale = 7;
      sampler_name = "DPM++ SDE Karras";
      break;
  }
  
  return {
    prompt: prompt,
    negative_prompt: negativePrompt,
    steps: steps,
    width: width,
    height: height,
    cfg_scale: cfg_scale,
    sampler_name: sampler_name,
    seed: -1
  };
};
