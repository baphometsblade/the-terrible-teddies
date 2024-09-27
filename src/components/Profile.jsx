import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const Profile = () => {
  // This would typically come from a database or state management
  const user = {
    name: 'TeddyMaster123',
    level: 10,
    wins: 25,
    losses: 15,
    favoriteBearsIds: [1, 3, 5],
  };

  return (
    <div className="profile">
      <h2 className="text-2xl font-bold mb-4">Player Profile</h2>
      <Card className="bg-purple-700 text-white">
        <CardHeader>
          <h3 className="text-xl font-semibold">{user.name}</h3>
        </CardHeader>
        <CardContent>
          <p>Level: {user.level}</p>
          <p>Wins: {user.wins}</p>
          <p>Losses: {user.losses}</p>
          <p>Win Rate: {((user.wins / (user.wins + user.losses)) * 100).toFixed(2)}%</p>
        </CardContent>
      </Card>
      <h3 className="text-xl font-semibold mt-8 mb-4">Favorite Bears</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {user.favoriteBearsIds.map(id => (
          <Card key={id} className="bg-purple-700 text-white">
            <CardContent>
              <p>Bear #{id}</p>
              {/* We would typically fetch the bear details and display them here */}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Profile;