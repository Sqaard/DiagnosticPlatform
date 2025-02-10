import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';

const CustomRecharts = ({ data, labels, title, graphType }) => {

  if (data.length === 0) return null;

  // Log the data being passed to the component
  console.log('Chart Data:', data);
  console.log('Labels:', labels);
  console.log('Graph Type:', graphType);

  const [barProps, setBarProps] = useState(
    labels.reduce(
      (a, { key }) => {
        a[key] = false;
        return a;
      },
      { hover: null }
    )
  );

  const handleLegendMouseEnter = (e) => {
    if (!barProps[e.dataKey]) {
      setBarProps({ ...barProps, hover: e.dataKey });
    }
  };

  const handleLegendMouseLeave = () => {
    setBarProps({ ...barProps, hover: null });
  };

  const selectBar = (e) => {
    setBarProps({
      ...barProps,
      [e.dataKey]: !barProps[e.dataKey],
      hover: null,
    });
  };

  // Adjust Y-axis range with an offset
  const getYAxisDomain = (data, labels) => {
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('data is not array:' + data) // Default domain if data is invalid
    }
    let allValues = data.flatMap((row) =>
      labels.map((label) => parseFloat(row[label.key]))
    );
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const offset = (max - min) * 0.1; // 10% offset
    return [Math.ceil(min - offset), Math.ceil(max + offset)];
  };

  const yAxisDomain = getYAxisDomain(data, labels);

  return (
    <div className="graph-wrapper">
      {/* Graph Title - Centered */}
      <h3 className="graph-title">{title}</h3>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          {graphType === 'Current vs Voltage' ? (
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Current" />
              <YAxis
                type="number"
                dataKey="y"
                name="Voltage"
                domain={yAxisDomain}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend
                onClick={selectBar}
                onMouseOver={handleLegendMouseEnter}
                onMouseOut={handleLegendMouseLeave}
              />
              {labels.map((label, index) => (
                <Scatter
                  key={index}
                  name={label.key}
                  data={data.map((row) => row[label.key])}
                  fill={label.color}
                />
              ))}
            </ScatterChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="Time"
                label={{ value: 'Время, с', position: 'insideBottom', dy: 9 }}
              />
              <YAxis domain={yAxisDomain} />
              <Tooltip />
              <Legend
                onClick={selectBar}
                onMouseOver={handleLegendMouseEnter}
                onMouseOut={handleLegendMouseLeave}
                
              />
              {labels.map((label, index) => (
                <Line
                  key={index}
                  dataKey={label.key}
                  stroke={label.color}
                  isAnimationActive={false}
                  hide={barProps[label.key] === true}
                  fillOpacity={
                    barProps.hover === label.key || !barProps.hover ? 1 : 0.6
                  }
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CustomRecharts;