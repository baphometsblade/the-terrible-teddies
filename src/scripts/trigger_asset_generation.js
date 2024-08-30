export async function triggerAssetGeneration() {
  try {
    const response = await fetch('/api/generate-assets', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let output = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      output += chunk;
      console.log(chunk);
    }

    return output;
  } catch (error) {
    console.error('Error in triggerAssetGeneration:', error);
    throw error;
  }
}
