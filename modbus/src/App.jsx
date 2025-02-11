import React, { useState, useEffect, useRef } from 'react';
import CustomRecharts from './components/CustomRecharts';
import ButtonComponent from './components/ButtonComponent';
import './App.css';

const App = () => {
  const [latestData, setLatestData] = useState([]); //state to store the latest data from the backend
  const prevDataRef = useRef([]);
  const [isAddGraphDisabled, setIsAddGraphDisabled] = useState(true);
  const [isDelayActive, setIsDelayActive] = useState(false);
  const [countdown, setCountdown] = useState(0);

  //state for managing tabs
  const [tabs, setTabs] = useState([
    {
      id: 1,
      name: 'Tab 1',
      graphs: [], 
    },
  ]);
  const [activeTab, setActiveTab] = useState(1); 

  //list of available graph types
  const availableGraphs = [
    'Фазы токов и напряжений',
    'Мощность и время',
    'RFFT',
    'FFT',
    'Wavelet',
    'ACF',
    'Hilbert',
    'Real Imaginary Hilbert',
    'Real Imaginary FFT',
    'Analytic Signal',
  ];

  //function to add a new tab
  const addNewTab = () => {
    const newTabId = tabs.length + 1;
    const newTab = {
      id: newTabId,
      name: `Tab ${newTabId}`,
      graphs: [], //new tab starts with no graphs
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newTabId); //switch to the new tab
  };

  //function to switch between tabs
  const switchTab = (tabId) => {
    setActiveTab(tabId);
  };

  //function to calculate power (I * U) for each phase
  const calculatePowerData = (data) => {
    return data.map((row) => ({
      ...row,
      Pa: parseFloat(row.ia) * parseFloat(row.ua),
      Pb: parseFloat(row.ib) * parseFloat(row.ub),
      Pc: parseFloat(row.ic) * parseFloat(row.uc),
    }));
  };

  //function to fetch transformation data from the Flask server
  const fetchTransformationData = async (graphType, data) => {
    const endpointMap = {
      RFFT: '/rfft',
      FFT: '/fft',
      Wavelet: '/wavelet',
      ACF: '/acf',
      Hilbert: '/hilbert',
      'Real Imaginary Hilbert': '/real_imag_hilbert',
      'Real Imaginary FFT': '/real_imag_fft',
      'Analytic Signal': '/analytic_signal',
    };

    const endpoint = endpointMap[graphType];
    if (!endpoint) {
      throw new Error(`Unknown graph type: ${graphType}`);
    }

    const requestBody = {
      "x": data.map((row) => parseFloat(row.ia)), 
      "y": data.map((row) => parseFloat(row.ua)),   
    };

    const response = await fetch(`http://192.168.1.72:5000${endpoint}`, {
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

    for (let key in responseData) {
        responseData[key] = responseData[key].map(v => Number.isFinite(v) ? v : null);
    }

    return responseData;
  };

  //function to add a graph to the active tab (when clicking on add button)
  const addGraphToActiveTab = async (graphType) => {
    if (!latestData || latestData.length < 2) {
      alert('Not enough data to add a graph. Please wait for more data.');
      return;
    }
    let graphData;
    switch (graphType) {      
      case 'Фазы токов и напряжений':
        graphData = latestData;
        break;
      case 'Мощность и время':
        graphData = calculatePowerData(latestData);
        break;
      case 'RFFT':
        const rfftData = await fetchTransformationData(graphType, latestData);
        graphData = rfftData.frequencies.map((freq, index) => ({
          frequency: freq,
          amplitude: rfftData.amplitudes[index],
        }));
        break;
      case 'FFT':
        const fftData = await fetchTransformationData(graphType, latestData);
        graphData = fftData.frequencies.map((freq, index) => ({
          frequency: freq,
          amplitude: fftData.amplitudes[index],
          phase: fftData.phases[index],
        }));
        break;
      case 'Wavelet':
        const waveletData = await fetchTransformationData(graphType, latestData);
        graphData = waveletData.coefficients_real.map((row, index) => ({
          scale: waveletData.scales[index],
          coefficient_real: row[0], 
        }));
        break;
      case 'ACF':
        const acfData = await fetchTransformationData(graphType, latestData);
        graphData = acfData.lags.map((lag, index) => ({
          lag: lag,
          acf: acfData.acf[index],
        }));
        break;
      case 'Hilbert':
        const hilbertData = await fetchTransformationData(graphType, latestData);
        graphData = hilbertData.imaginary_part.map((im, index) => ({
          time: latestData[index].Time,
          imaginary_part: im,
        }));
        break;
      case 'Real Imaginary Hilbert':
        const realImagHilbertData = await fetchTransformationData(graphType, latestData);
        graphData = realImagHilbertData.real_part.map((re, index) => ({
          real_part: re,
          imaginary_part: realImagHilbertData.imaginary_part[index],
        }));
        break;
      case 'Real Imaginary FFT':
        const realImagFftData = await fetchTransformationData(graphType, latestData);
        graphData = realImagFftData.real.map((re, index) => ({
          real: re,
          imaginary: realImagFftData.imaginary[index],
        }));
        break;
      case 'Analytic Signal':
        const analyticSignalData = await fetchTransformationData(graphType, latestData);
        graphData = analyticSignalData.amplitude.map((amp, index) => ({
          time: latestData[index].Time,
          amplitude: amp,
        }));
        break;
      default:
        graphData = [];
        break;
    }

    const updatedTabs = tabs.map((tab) => {
      if (tab.id === activeTab) {
        return {
          ...tab,
          graphs: [...tab.graphs, { type: graphType, data: graphData }],
        };
      }
      return tab;
    });
    setTabs(updatedTabs);
  };


  const getLabels = (graphType) => {
    switch (graphType) {
      case 'Фазы токов и напряжений':
        return [
          { key: 'Ia', color: '#8884d8' },
          { key: 'Ib', color: '#82ca9d' },
          { key: 'Ic', color: '#ff7300' },
          { key: 'Ua', color: '#8884d8' },
          { key: 'Ub', color: '#82ca9d' },
          { key: 'Uc', color: '#ff7300' },
        ];
      case 'Мощность и время':
        return [
          { key: 'Pa', color: '#8884d8' },
          { key: 'Pb', color: '#82ca9d' },
          { key: 'Pc', color: '#ff7300' },
        ];
      case 'RFFT':
        return [{ key: 'amplitude', color: '#8884d8' }];
      case 'FFT':
        return [
          { key: 'amplitude', color: '#8884d8' },
          { key: 'phase', color: '#82ca9d' },
        ];
      case 'Wavelet':
        return [{ key: 'coefficient_real', color: '#8884d8' }];
      case 'ACF':
        return [{ key: 'acf', color: '#8884d8' }];
      case 'Hilbert':
        return [{ key: 'imaginary_part', color: '#8884d8' }];
      case 'Real Imaginary Hilbert':
        return [
          { key: 'real_part', color: '#8884d8' },
          { key: 'imaginary_part', color: '#82ca9d' },
        ];
      case 'Real Imaginary FFT':
        return [
          { key: 'real', color: '#8884d8' },
          { key: 'imaginary', color: '#82ca9d' },
        ];
      case 'Analytic Signal':
        return [{ key: 'amplitude', color: '#8884d8' }];
      default:
        return [];
    }
  };

  //function to fetch the latest data from the backend
  const fetchLatestData = async () => {
    try {
      const response = await fetch('http://localhost:5001/data'); 
      if (!response.ok) {
        throw new Error('Failed to fetch latest data');
      }
      const data = await response.json();
      if(JSON.stringify(data) !== JSON.stringify(prevDataRef.current)){
        setLatestData((prevData) => [...prevData, data]);
        prevDataRef.current = data;
      }
    } catch (error) {
      console.error('Error fetching latest data:', error);
    }
  };

  //interval for fetching data every second
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLatestData();
    }, 1000); 

    return () => clearInterval(interval); 
  }, []);

  //update existing graphs (when latestData changes)
  useEffect(() =>  {
    const updatedTabs = tabs.map((tab) => ({
      ...tab,
      graphs: tab.graphs.map((graph) => {
        let newData;
        switch (graph.type) {
          case 'Фазы токов и напряжений':
            newData = [...graph.data, ...latestData];
            break;
          case 'Мощность и время':
            newData = calculatePowerData(latestData);
            break;
          case 'RFFT':
            const rfftData = fetchTransformationData(graphType, latestData);
            newData = rfftData.frequencies.map((freq, index) => ({
              frequency: freq,
              amplitude: rfftData.amplitudes[index],
            }));
            break;
          case 'FFT':
            const fftData = fetchTransformationData(graphType, latestData);
            newData = fftData.frequencies.map((freq, index) => ({
              frequency: freq,
              amplitude: fftData.amplitudes[index],
              phase: fftData.phases[index],
            }));
            break;
          case 'Wavelet':
            const waveletData = fetchTransformationData(graphType, latestData);
            newData = waveletData.coefficients_real.map((row, index) => ({
              scale: waveletData.scales[index],
              coefficient_real: row[0], 
            }));
            break;
          case 'ACF':
            const acfData = fetchTransformationData(graphType, latestData);
            newData = acfData.lags.map((lag, index) => ({
              lag: lag,
              acf: acfData.acf[index],
            }));
            break;
          case 'Hilbert':
            const hilbertData = fetchTransformationData(graphType, latestData);
            newData = hilbertData.imaginary_part.map((im, index) => ({
              time: latestData[index].Time,
              imaginary_part: im,
            }));
            break;
          case 'Real Imaginary Hilbert':
            const realImagHilbertData = fetchTransformationData(graphType, latestData);
            newData = realImagHilbertData.real_part.map((re, index) => ({
              real_part: re,
              imaginary_part: realImagHilbertData.imaginary_part[index],
            }));
            break;
          case 'Real Imaginary FFT':
            const realImagFftData = fetchTransformationData(graphType, latestData);
            newData = realImagFftData.real.map((re, index) => ({
              real: re,
              imaginary: realImagFftData.imaginary[index],
            }));

            break;
          case 'Analytic Signal':
            const analyticSignalData = fetchTransformationData(graphType, latestData);
            newData = analyticSignalData.amplitude.map((amp, index) => ({
              time: latestData[index].Time,
              amplitude: amp,
            }));
            break; 
          default:
            newData = graph.data; // keep existing data if no update is needed
            break;
        }
        return { ...graph, data: newData };
      }),
    }));
    setTabs(updatedTabs);
  }, [latestData]); // Re-run this effect when latestData changes
  
  //enable/disable addGraph button
  useEffect(() => {
    setIsAddGraphDisabled(!latestData || latestData.length < 2);

  }, [latestData]);

  //update button disabled state based on data length
  useEffect(() => {
    if (latestData && latestData.length >= 2) {
      setIsDelayActive(true);
      setCountdown(5); // Start the countdown at 5 seconds
  
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === 1) {
            clearInterval(interval);
            setIsDelayActive(false); 
          }
          return prev - 1;
        });
      }, 1000);
  
      // Cleanup the interval on unmount or if latestData changes
      return () => clearInterval(interval);
    } else {
      setIsAddGraphDisabled(true);
    }
  }, [latestData]);

  // Get the active tab's data
  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className="app-container">
      <h1></h1>
      <>
        <div className="tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => switchTab(tab.id)}
            >
              {tab.name}
            </button>
          ))}
          <button className="tab-button add-tab" onClick={addNewTab}>
            +
          </button>
        </div>
      </>
      <div className="graph-container">
        {activeTabData.graphs.map((graph, index) => (
          <CustomRecharts
            key={index}
            data={graph.data}
            labels={getLabels(graph.type)}
            title={`График ${index + 1}: ${graph.type}`}
            graphType={graph.type}
          />
        ))}
          <div className="button-wrapper">

            <ButtonComponent
              onAddGraph={addGraphToActiveTab}
              availableGraphs={availableGraphs}
              isDisabled={isAddGraphDisabled}
            />
            {isDelayActive && <p className="countdown-message">
              <span className="spinner"></span>
              Пожалуйста подождите {countdown} c.
              </p>}
          </div>
        
      </div>
    </div>
  );
};

export default App;