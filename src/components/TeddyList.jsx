import React, { useEffect, useState } from 'react';
import { getAllDataFromTable } from '../utils/supabaseClient';

const TeddyList = () => {
  const [teddies, setTeddies] = useState([]);

  useEffect(() => {
    const fetchTeddies = async () => {
      try {
        const data = await getAllDataFromTable('terrible_teddies');
        setTeddies(data);
      } catch (error) {
        console.error('Failed to fetch teddies:', error);
      }
    };

    fetchTeddies();
  }, []);

  return (
    <div>
      <h2>All Teddy Bears</h2>
      <ul>
        {teddies.map(teddy => (
          <li key={teddy.id}>{teddy.name} - {teddy.title}</li>
        ))}
      </ul>
    </div>
  );
};

export default TeddyList;