import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const ImageGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const generateImage = async () => {
    setLoading(true);
    try {
      const response = await fetch("https://backend.buildpicoapps.com/aero/run/image-generation-api?pk=v1-Z0FBQUFBQm1zN3RVWDV1dk5hY3hkaV9JZ05fR3BlN1dvMzdsMDVvampPVHBfcGhPS1J0eGE5aEs0cFdCY3ptU2VqVW8ya3ZEdWMxZE9FZkVXVGR5ZTAxQ2pZM3liT2x2OFE9PQ==", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setImageUrl(data.imageUrl);
      } else {
        console.error('Error generating image:', data);
        alert('Failed to generate image. Please try again.');
      }
    } catch (error) {
      console.log('Error fetching images:', error);
      alert('Error fetching images. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        type="text"
        placeholder="Enter image description"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <Button onClick={generateImage} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Image'}
      </Button>
      {imageUrl && (
        <img src={imageUrl} alt="Generated image" className="w-full h-auto rounded-lg shadow-md" />
      )}
    </div>
  );
};
