import React, { useState, useEffect, useRef } from 'react';
import CustomRecharts from './components/CustomRecharts';
import ButtonComponent from './components/ButtonComponent';
import './App.css';
const App = () => {
  const [latestData, setLatestData] = useState([]); 
  const [isAddGraphDisabled, setIsAddGraphDisabled] = useState(true);
  const [isDiagnosticsReady, setIsDiagnosticsReady] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState(null);
  const [isDiagnosticsRunning, setIsDiagnosticsRunning] = useState(false); 
  const latestDataRef = useRef(latestData); 
  const WINDOW_SIZE = 210; 
  const DIAGNOSTICS_WINDOW_SIZE = 200;
  const ws = useRef(null);
  const SOCKET_PORT = import.meta.env.VITE_SOCKET_PORT || 5001;
  const FLASK_PORT = import.meta.env.VITE_FLASK_PORT || 5000;
  const FLASK_IP = import.meta.env.VITE_FLASK_IP || '192.168.1.72';
  const SOCKET_IP = import.meta.env.VITE_SOCKET_IP || 'localhost';
  const FLASK_URL = `http://${FLASK_IP}:${FLASK_PORT}`;
  const SOCKET_URL = `ws://${SOCKET_IP}:${SOCKET_PORT}`
  const [tabs, setTabs] = useState([
    {
      id: 1,
      name: 'Таблица 1',
      graphs: [], 
    },
  ]);
  const [activeTab, setActiveTab] = useState(1); 
  const availableGraphs = ['Фазы токов и напряжений','Мощность и время','RFFT','FFT','ACF','Hilbert','Real Imaginary Hilbert','Real Imaginary FFT','Analytic Signal',];
  const minDataLength = 0;

  // Синхронизация latestDataRef с latestData
  useEffect(() => {
    latestDataRef.current = latestData;
  }, [latestData]);
  //function to add a new tab
  const addNewTab = () => {
    const newTabId = tabs.length + 1;
    const newTab = {
      id: newTabId,
      name: `Таблица ${newTabId}`,
      graphs: [], //new tab starts with no graphs
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newTabId);
  };

  //function to switch between tabs
  const switchTab = (tabId) => {
    setActiveTab(tabId);
  };

  //function to calculate power (I * U) for each phase
  const calculatePowerData = (data) => {
    return data.map((row) => ({
      ...row,
      Pa: parseFloat(row.Ia) * parseFloat(row.Ua),
      Pb: parseFloat(row.Ib) * parseFloat(row.Ub),
      Pc: parseFloat(row.Ic) * parseFloat(row.Uc),
    }));
  };

  // Function to fetch transformation data from the Flask server
  const fetchTransformationData = async (graphType, data) => {
    const endpointMap = {
      RFFT: '/rfft',
      FFT: '/fft',
      ACF: '/acf',
      Hilbert: '/hilbert',
      'Real Imaginary Hilbert': '/real_imag_hilbert',
      'Real Imaginary FFT': '/real_imag_fft',
      'Analytic Signal': '/analytic_signal',
      Hodograph: '/hodograph',
      'Vector Graph': '/vector-graph',
      Analyze: '/analyze',
    };
  
    const endpoint = endpointMap[graphType];
    if (!endpoint) {
      throw new Error(`Unknown graph type: ${graphType}`);
    }
  
    let requestBody;
    if (graphType === 'Hodograph' || graphType === 'Vector Graph') {
      requestBody = {
        "Ia": data.map((row) => parseFloat(row.Ia)),
        "Ib": data.map((row) => parseFloat(row.Ib)),
        "Ic": data.map((row) => parseFloat(row.Ic)),
        "Ua": data.map((row) => parseFloat(row.Ua)),
        "Ub": data.map((row) => parseFloat(row.Ub)),
        "Uc": data.map((row) => parseFloat(row.Uc)),
      };
    } else if (graphType === 'Analyze') {
      requestBody = {
        "data": data.map((row) => ({
          "time": parseFloat(row.Time || row.t || 0),
          "Ia": parseFloat(row.Ia),
          "Ib": parseFloat(row.Ib),
          "Ic": parseFloat(row.Ic),
          "Ua": parseFloat(row.Ua),
          "Ub": parseFloat(row.Ub),
          "Uc": parseFloat(row.Uc),
        })),
      };
    } else {
      requestBody = {
        "x": data.map((row) => parseFloat(row.Ia)),
        "y": data.map((row) => parseFloat(row.Ua)),
      };
    }
  
    try {
      const response = await fetch(`${FLASK_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch data for ${graphType}: ${response.status} - ${errorText}`);
      }
  
      const rawText = await response.text();
      const responseData = JSON.parse(rawText);
      //console.log('ResponseData:', responseData);
  
      return responseData; 
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  };

  const runDiagnostics = async () => {
    if (latestDataRef.current.length < DIAGNOSTICS_WINDOW_SIZE) {
      console.log(`Insufficient data: ${latestDataRef.current.length}/${DIAGNOSTICS_WINDOW_SIZE}`);
      return;
    }

    const diagnosticsData = latestDataRef.current.slice(-DIAGNOSTICS_WINDOW_SIZE);
    console.log('DiagnosticsData (last 5):', diagnosticsData.slice(-5));

    try {
      const result = await fetchTransformationData('Analyze', diagnosticsData);
      if (result.status === 'pending') {
        console.log(result.message);
      } else {
        setDiagnosticsResult(result);
      }
    } catch (error) {
      console.error('Diagnostics error:', error);
    }
  };

  useEffect(() => {
    let timeoutId;
    const runDiagnosticsWithDelay = () => {
      if (isDiagnosticsRunning && ws.current?.readyState === WebSocket.OPEN) {
        runDiagnostics();
        timeoutId = setTimeout(runDiagnosticsWithDelay, 10100); 
      }
    };

    if (isDiagnosticsRunning) {
      runDiagnosticsWithDelay(); 
    }

    return () => clearTimeout(timeoutId); 
  }, [isDiagnosticsRunning]); 
  
  const handleStartDiagnostics = () => {
    setIsDiagnosticsRunning(true);
    runDiagnostics();
  };
  
  const addGraphToActiveTab = async (graphType) => {
    if (!latestData || latestData.length < minDataLength) {
      alert('Not enough data to add a graph. Please wait for more data.');
      return;
    }
    let graphData = [];
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
      case 'Vector Graph':
        return [
          { key: 'Ia', color: '#8884d8' },
          { key: 'Ib', color: '#82ca9d' },
          { key: 'Ic', color: '#ff7300' },
          { key: 'Ua', color: '#d8884d' },
          { key: 'Ub', color: '#9dca82' },
          { key: 'Uc', color: '#7300ff' },
        ];
      case 'Hodograph':
        return [
          { key: 'Ia', color: '#8884d8' },
          { key: 'Ib', color: '#82ca9d' },
          { key: 'Ic', color: '#ff7300' },
          { key: 'Ua', color: '#d8884d' },
          { key: 'Ub', color: '#9dca82' },
          { key: 'Uc', color: '#7300ff' },
        ];
      default:
        return [];
    }
  };

  // WebSocket connection
  useEffect(() => {
    ws.current = new WebSocket(SOCKET_URL);

    // Handle incoming messages from the server
    ws.current.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      setLatestData((prevData) => {
        const updatedData = [...prevData, newData];
        if (updatedData.length > WINDOW_SIZE) {
          return updatedData.slice(-WINDOW_SIZE); 
        }
        return updatedData;
      });
    };

    // Handle WebSocket errors
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Cleanup on unmount
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  //update existing graphs (when latestData changes)
  useEffect(() =>  {
    const updateTabs = async () => {
      const updatedTabs = await Promise.all(
        tabs.map(async (tab) => ({
          ...tab,
          graphs: await Promise.all(
            tab.graphs.map(async (graph) => {
              let newData;
              switch (graph.type) {
                case 'Фазы токов и напряжений':
                  newData = latestData;
                  break;
                case 'Мощность и время':
                  newData = calculatePowerData(latestData);
                  break;
                case 'RFFT':
                  const rfftData = await fetchTransformationData('RFFT', latestData);
                  newData = rfftData.frequencies.map((freq, index) => ({
                    frequency: freq,
                    amplitude: rfftData.amplitudes[index],
                  }));
                  break;
                case 'FFT':
                  const fftData = await fetchTransformationData('FFT', latestData);
                  newData = fftData.frequencies.map((freq, index) => ({
                    frequency: freq,
                    amplitude: fftData.amplitudes[index],
                    phase: fftData.phases[index],
                  }));
                  break;
                case 'ACF':
                  const acfData = await fetchTransformationData('ACF', latestData);
                  newData = acfData.lags.map((lag, index) => ({
                    lag: lag,
                    acf: acfData.acf[index],
                  }));
                  break;
                case 'Hilbert':
                  const hilbertData = await fetchTransformationData('Hilbert', latestData);
                  newData = hilbertData.imaginary_part.map((im, index) => ({
                    time: latestData[index].Time,
                    imaginary_part: im,
                  }));
                  break;
                case 'Real Imaginary Hilbert':
                  const realImagHilbertData = await fetchTransformationData('Real Imaginary Hilbert', latestData);
                  newData = realImagHilbertData.real_part.map((re, index) => ({
                    real_part: re,
                    imaginary_part: realImagHilbertData.imaginary_part[index],
                  }));
                  break;
                case 'Real Imaginary FFT':
                  const realImagFftData = await fetchTransformationData('Real Imaginary FFT', latestData);
                  newData = realImagFftData.real.map((re, index) => ({
                    real: re,
                    imaginary: realImagFftData.imaginary[index],
                  }));
                  break;
                case 'Analytic Signal':
                  const analyticSignalData = await fetchTransformationData('Analytic Signal', latestData);
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
            })
          ),
        }))
      );
      setTabs(updatedTabs);
    };
    updateTabs().catch(error => console.error('Error updating graphs:', error));
  }, [latestData]); 
  
  useEffect(() => {
    setIsAddGraphDisabled(!latestData || latestData.length < minDataLength);
  }, [latestData]);

  useEffect(() => {
    setIsDiagnosticsReady(latestData.length >= DIAGNOSTICS_WINDOW_SIZE);
  }, [latestData]);
  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  
  return (
    <div className="app-container">
      <div className="header">
    {isDiagnosticsReady && !isDiagnosticsRunning && (
      <button className="diagnostics-button" onClick={handleStartDiagnostics}>
        Показать результат диагностики
      </button>
    )}
  </div>
  {diagnosticsResult && diagnosticsResult.diagnosis && (
    <div className="diagnostics-result">
      <h2>Результат диагностики</h2>
      <div
        className={`diagnosis-message ${
          diagnosticsResult.diagnosis.status === 'normal'
            ? 'normal'
            : diagnosticsResult.diagnosis.status === 'warning'
            ? 'warning'
            : 'alert'
        }`}
      >
        {diagnosticsResult.diagnosis.message}
      </div>
      <div className="status-bar-container">
        <div
          className="status-bar"
          style={{
            background: `linear-gradient(to right, #f8d7da ${diagnosticsResult.anomaly_count}%, #d4edda ${diagnosticsResult.anomaly_count}%)`,
          }}
        >
          <span className="status-percentage">
            {100 - diagnosticsResult.anomaly_count}%
          </span>
        </div>
        <p className="defect-count">Дефектов: {diagnosticsResult.anomaly_count}</p>
      </div>
    </div>
    )}
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
        </div>
      </div>
    </div>
  );
};

export default App;