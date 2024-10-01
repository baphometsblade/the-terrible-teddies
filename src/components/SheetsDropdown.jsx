import React, { useEffect, useState } from 'react';

const SheetsDropdown = () => {
  const [sheets, setSheets] = useState([]);

  useEffect(() => {
    const generateSheetsDropdown = (sheetsData) => {
      setSheets(sheetsData);
    };

    // Simulating message receive
    const mockSheetsData = ['Sheet1', 'Sheet2', 'Sheet3'];
    generateSheetsDropdown(mockSheetsData);
  }, []);

  return (
    <select>
      {sheets.map((sheet, index) => (
        <option key={index} value={sheet}>{sheet}</option>
      ))}
    </select>
  );
};

export default SheetsDropdown;