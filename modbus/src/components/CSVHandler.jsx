import React, { useState } from 'react';
import Papa from 'papaparse';

const CSVHandler = ({ onCSVLoad }) => {
  const handleLoad = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvContent = e.target.result;
        const parsedData = Papa.parse(csvContent, { header: true }).data;
        onCSVLoad(parsedData.slice(0, 501)); // Load only the first n rows
      };
      reader.readAsText(file);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleLoad} accept=".csv" />
    </div>
  );
};

export default CSVHandler;
