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


  // Логирование для отладки
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

  const getAxisDomain = (data, keyX, keyY) => {
    // Если данные для Hodograph или Vector Graph, они будут объектами, а не массивами
    if (graphType === 'Hodograph' || graphType === 'Vector Graph') {
        if (!data || !data.currents || !data.voltages) {
            console.log('Invalid data structure for Hodograph/Vector Graph:', data);
            return { x: [-1, 1], y: [-1, 1] };
        }

        let xValues, yValues;

        if (graphType === 'Hodograph') {
            // Для Hodograph данные имеют структуру { currents: { Xi, Yi }, voltages: { Xu, Yu } }
            xValues = [data.currents.Xi, data.voltages.Xu];
            yValues = [data.currents.Yi, data.voltages.Yu];
        } else if (graphType === 'Vector Graph') {
            // Для Vector Graph данные имеют структуру { currents: { Ui, Vi }, voltages: { Uu, Vu } }
            xValues = [...data.currents.Ui, ...data.voltages.Uu];
            yValues = [...data.currents.Vi, ...data.voltages.Vu];
        }

        const minX = Math.min(...xValues.filter(Number.isFinite));
        const maxX = Math.max(...xValues.filter(Number.isFinite));
        const minY = Math.min(...yValues.filter(Number.isFinite));
        const maxY = Math.max(...yValues.filter(Number.isFinite));

        const xOffset = (maxX - minX) * 0.1 || 1;
        const yOffset = (maxY - minY) * 0.1 || 1;

        return {
            x: [parseFloat((minX - xOffset).toFixed(4)), parseFloat((maxX + xOffset).toFixed(4))],
            y: [parseFloat((minY - yOffset).toFixed(4)), parseFloat((maxY + yOffset).toFixed(4))],
        };
    }

    // Для остальных типов графиков data должен быть массивом
    if (!Array.isArray(data) || data.length === 0) {
        console.log('Data is not array or empty:', data);
        return { x: [-1, 1], y: [-1, 1] };
    }

    let xValues = data.map((row) => parseFloat(row[keyX] || row['frequency'] || row['time'] || row['scale'] || 0));
    let yValues = data.flatMap((row) =>
        labels.map((label) => parseFloat(row[label.key]) || 0)
    );

    const minX = Math.min(...xValues.filter(Number.isFinite));
    const maxX = Math.max(...xValues.filter(Number.isFinite));
    const minY = Math.min(...yValues.filter(Number.isFinite));
    const maxY = Math.max(...yValues.filter(Number.isFinite));

    const xOffset = (maxX - minX) * 0.1 || 1;
    const yOffset = (maxY - minY) * 0.1 || 1;

    return {
        x: [parseFloat((minX - xOffset).toFixed(4)), parseFloat((maxX + xOffset).toFixed(4))],
        y: [parseFloat((minY - yOffset).toFixed(4)), parseFloat((maxY + yOffset).toFixed(4))],
    };
};

const axisDomains = getAxisDomain(data, 'x', 'y');

// Проверка данных
if (!data || (graphType === 'Hodograph' && (!data.currents || !data.voltages))) {
  return <div>No data available</div>;
}

return (
  <div className="graph-wrapper">
    <h3 className="graph-title">{title}</h3>

    <div className="chart-container">
      <ResponsiveContainer width="100%" height={300}>
        {graphType === 'Hodograph' ? (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name="Real"
              domain={axisDomains.x}
              label={{ value: 'Real', position: 'insideBottom', dy: 10 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Imaginary"
              domain={axisDomains.y}
              label={{ value: 'Imaginary', position: 'insideLeft', angle: -90, dy: -10 }}
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend
              onClick={selectBar}
              onMouseOver={handleLegendMouseEnter}
              onMouseOut={handleLegendMouseLeave}
            />
            <Scatter
              name="Currents"
              data={data.currents} // Передаем массив точек токов
              fill="red"
              shape="circle"
            />
            <Scatter
              name="Voltages"
              data={data.voltages} // Передаем массив точек напряжений
              fill="blue"
              shape="circle"
            />
          </ScatterChart>
        ) : graphType === 'Vector Graph' ? (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name="Real"
              domain={axisDomains.x}
              label={{ value: 'Real', position: 'insideBottom', dy: 10 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Imaginary"
              domain={axisDomains.y}
              label={{ value: 'Imaginary', position: 'insideLeft', angle: -90, dy: -10 }}
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend
              onClick={selectBar}
              onMouseOver={handleLegendMouseEnter}
              onMouseOut={handleLegendMouseLeave}
            />
            {data.currents.map((point, index) => (
              <Scatter
                key={`current-${index}`}
                name={`Current ${index + 1}`}
                data={[{ x: 0, y: 0 }, { x: point.x, y: point.y }]} // Вектор из начала координат в точку
                fill="red"
                line={{ stroke: 'red' }}
                shape="arrow"
              />
            ))}
            {data.voltages.map((point, index) => (
              <Scatter
                key={`voltage-${index}`}
                name={`Voltage ${index + 1}`}
                data={[{ x: 0, y: 0 }, { x: point.x, y: point.y }]} // Вектор из начала координат в точку
                fill="blue"
                line={{ stroke: 'blue' }}
                shape="arrow"
              />
            ))}
          </ScatterChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={
                graphType === 'FFT' || graphType === 'RFFT'
                  ? 'frequency'
                  : graphType === 'Wavelet'
                  ? 'scale'
                  : 'Time'
              }
              label={{
                value:
                  graphType === 'FFT' || graphType === 'RFFT'
                    ? 'Частота, Гц'
                    : graphType === 'Wavelet'
                    ? 'Масштаб'
                    : 'Время, с',
                position: 'insideBottom',
                dy: 9,
              }}
              tickFormatter={(value) => {
                if (typeof value === 'number' && !isNaN(value)) {
                  return parseFloat(value.toFixed(4)); 
                }
                return value; 
              }}
            />
            <YAxis domain={axisDomains.y} />
            <Tooltip />
            <Legend
              onClick={selectBar}
              onMouseOver={handleLegendMouseEnter}
              onMouseOut={handleLegendMouseLeave}
            />
            {labels.map((label, index) => (
              <Line
                key={label.key || index}
                dataKey={label.key}
                stroke={label.color}
                isAnimationActive={false}
                hide={barProps[label.key] === true}
                strokeOpacity={
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
}
export default CustomRecharts;