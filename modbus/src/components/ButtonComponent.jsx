import React, { useState } from 'react';

const ButtonComponent = ({ onAddGraph, availableGraphs, isDisabled  }) => {
  const [selectedGraph, setSelectedGraph] = useState(availableGraphs[0]);

  const handleAddGraph = () => {
    onAddGraph(selectedGraph);
  };

  return (
    <div>
      <select onChange={(e) => setSelectedGraph(e.target.value)}>
        {availableGraphs.map((graph, index) => (
          <option key={index} value={graph}>
            {graph}
          </option>
        ))}
      </select>
      <button onClick={handleAddGraph} disabled={isDisabled} >+</button>
    </div>
  );
};

export default ButtonComponent;
