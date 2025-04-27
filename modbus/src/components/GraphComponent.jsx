import React, { useState, useEffect } from 'react';

const GraphComponent = ({ graphType, data }) => {
  const [plotImage, setPlotImage] = useState(null); // Состояние для хранения base64-кода изображения
  // Load ports from environment variables
  const FLASK_PORT = import.meta.env.VITE_FLASK_PORT || 5000;
  const FLASK_IP = import.meta.env.VITE_FLASK_IP || '192.168.1.72';
  const FLASK_URL = `http://${FLASK_IP}:${FLASK_PORT}`;
  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpointMap = {
          Hodograph: '/hodograph',
          'Vector Graph': '/vector-graph', 
        };
      
        const endpoint = endpointMap[graphType];
        if (!endpoint) {
          throw new Error(`Unknown graph type: ${graphType}`);
        }
      
        let requestBody= {
            "Ia": data.map((row) => parseFloat(row.Ia)),
            "Ib": data.map((row) => parseFloat(row.Ib)),
            "Ic": data.map((row) => parseFloat(row.Ic)),
            "Ua": data.map((row) => parseFloat(row.Ua)),
            "Ub": data.map((row) => parseFloat(row.Ub)),
            "Uc": data.map((row) => parseFloat(row.Uc)),
        };
        console.log('REQUEST BODY:',requestBody)

        const response = await fetch(`${FLASK_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      
        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${graphType}`);
        }
      
        const responseData = await response.json();
        console.log('ResponseData:',responseData)
      

        if (responseData.plot) {
          return responseData.plot; 
        }
      
        for (let key in responseData) {
          if (Array.isArray(responseData[key])) {
            responseData[key] = responseData[key].map(v => Number.isFinite(v) ? v : null);
          }
        }
        const plotBase64 = responseData;
        setPlotImage(plotBase64); 
      } catch (error) {
        console.error('Error fetching graph data:', error);
      }
    };

    fetchData();
  }, [graphType, data]);

  return (
    <div>
      <h2>{graphType}</h2>
      {plotImage ? (
        <img
          src={`data:image/png;base64,${plotImage}`} // Отображаем изображение
          alt={`${graphType} Plot`}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      ) : (
        <p>Loading plot...</p>
      )}
    </div>
  );
};

export default GraphComponent;