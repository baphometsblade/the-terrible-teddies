import { completion } from 'litellm';

export const getAICompletion = async (messages) => {
  try {
    const response = await completion({
      model: "perplexity/claude-3.5-sonnet",
      messages: messages,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error getting AI completion:', error);
    throw error;
  }
};