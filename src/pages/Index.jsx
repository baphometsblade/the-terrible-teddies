import React from 'react';
import TerribleTeddies from '../components/TerribleTeddies';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-200 flex items-center justify-center">
      <div className="container mx-auto p-8 max-w-4xl bg-white bg-opacity-90 rounded-lg shadow-xl">
        <TerribleTeddies />
      </div>
    </div>
  );
};

export default Index;