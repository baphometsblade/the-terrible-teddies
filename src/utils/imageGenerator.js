import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const generateTeddyImage = async (teddyName, teddyDescription) => {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a cheeky, adult-themed teddy bear named ${teddyName}. ${teddyDescription}. The image should be hyper-realistic, ultra-detailed, and suitable for a card game. Make it visually striking and slightly provocative, perfect for an adult audience.`,
      n: 1,
      size: "1024x1024",
    });

    return response.data[0].url;
  } catch (error) {
    console.error('Error generating teddy image:', error);
    return null;
  }
};

export const generateBackgroundImage = async (theme) => {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a background image for a card game battle arena with a ${theme} theme. The image should be detailed, atmospheric, and suitable for an adult audience. Make it visually striking and immersive.`,
      n: 1,
      size: "1024x1024",
    });

    return response.data[0].url;
  } catch (error) {
    console.error('Error generating background image:', error);
    return null;
  }
};