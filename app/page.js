"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, Zap, Settings, Globe, Cpu, Heart, AlertTriangle, BarChart3, TrendingUp } from 'lucide-react';

// --- CONFIGURATION ---
const REQUEST_RATE_MS = 100; // Time between new requests (DECREASED significantly to increase the concurrent load)
const MAX_LOAD = 20; // Maximum capacity (kept at 20 as requested)
const SIMULATION_DURATION_MS = 3000; // How long a request "takes" to process
const MAX_HISTORY_POINTS = 100; // Keep track of the last 100 steps (10 seconds at 100ms interval)

// Define the LB modes and their details (Architecture mode removed)
const MODES = [
  { id: 'roundRobin', name: 'Round Robin', desc: 'Distributes sequential requests uniformly across servers.' },
  { id: 'weightedRR', name: 'Weighted Round Robin', desc: 'Servers with higher "weight" receive a larger proportion of requests, reflecting greater capacity.' },
  { id: 'leastConnections', name: 'Least Connections', desc: 'Routes new requests to the server with the fewest currently active connections (the "lightest" load).' },
  { id: 'ipHash', name: 'IP Hash (Sticky)', desc: 'Requests from the same simulated client IP are always sent to the same server, ensuring "sticky sessions".' },
];

// Initial state for all servers (Max capacity updated to 20)
const initialServers = [
  { id: 1, name: 'Server A', load: 0, maxCapacity: MAX_LOAD, weight: 1, isAvailable: true, color: '#f87171', top: 30 }, 
  { id: 2, name: 'Server B', load: 0, maxCapacity: MAX_LOAD, weight: 2, isAvailable: true, color: '#34d399', top: 190 }, 
  { id: 3, name: 'Server C', load: 0, maxCapacity: MAX_LOAD, weight: 1, isAvailable: true, color: '#60a5fa', top: 350 }, 
  { id: 4, name: 'Server D', load: 0, maxCapacity: MAX_LOAD, weight: 3, isAvailable: true, color: '#facc15', top: 510 }, 
];

// --- UTILITY COMPONENTS ---

// Function to generate a unique ID for requests
const generateUniqueId = () => Math.random().toString(36).substring(2, 9);

/**
 * Dynamic Real-time Load Chart (Vertical Bar Chart) - Visualizing current state
 */
const LoadChart = React.memo(({ servers, maxLoad }) => {
  const yAxisMarkers = useMemo(() => {
      const step = maxLoad / 4;
      return [0, step, step * 2, step * 3, maxLoad].reverse();
  }, [maxLoad]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-2xl h-[400px] lg:h-[650px] flex flex-col">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center border-b pb-3">
        <BarChart3 className="w-5 h-5 mr-2 text-indigo-500" /> Current Server Load (Connections)
      </h3>
      
      <div className="flex flex-grow relative overflow-hidden px-2 pt-2 pb-6">
        
        {/* Y-Axis Labels and Grid Lines */}
        <div className="absolute inset-y-0 left-0 w-10 text-right text-xs text-gray-500 flex flex-col justify-between py-4 pointer-events-none">
          {yAxisMarkers.map((marker, index) => (
            <div key={index} className="-translate-y-1/2 pr-1">
              {marker}
              {index > 0 && (
                <div 
                    className="absolute inset-x-10 right-0 border-t border-gray-200 z-0" 
                    style={{ top: `${(index / (yAxisMarkers.length - 1)) * 100}%` }}
                ></div>
              )}
            </div>
          ))}
        </div>
        
        {/* Plot Area - Main Bars */}
        <div className="flex flex-grow pl-10 items-end justify-around border-b border-gray-400">
          
          {servers.map(server => {
            const loadPercentage = (server.load / maxLoad) * 100;
            const loadColor = loadPercentage > 85 ? 'bg-red-500' : loadPercentage > 50 ? 'bg-yellow-500' : 'bg-green-500';
            
            return (
              <div key={server.id} className="h-full w-1/6 flex flex-col items-center justify-end relative mx-1">
                <div className="absolute bottom-full mb-1 text-sm font-bold text-gray-700">
                  {server.load}
                </div>
                
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ease-out z-10 ${loadColor} shadow-lg`}
                  style={{ height: `${loadPercentage}%` }}
                  title={`${server.name}: ${server.load} connections`}
                ></div>
                
                <div className="absolute top-full mt-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                  {server.name.replace('Server ', '')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <p className="text-xs text-gray-400 pt-2 text-center border-t mt-8">X-Axis: Server Name | Y-Axis: Active Connections (Max {maxLoad})</p>
    </div>
  );
});

/**
 * Historical Line Chart (Stock Market Style) - Visualizing load trend over time
 */
const LoadHistoryChart = React.memo(({ history, servers, maxLoad }) => {
    if (history.length < 2) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-2xl h-[400px] flex items-center justify-center border border-gray-200">
                <p className="text-gray-500">Run the simulation to generate historical load data...</p>
            </div>
        );
    }

    const SVG_WIDTH = 1000;
    const SVG_HEIGHT = 300;
    const PADDING_X = 50;
    const PADDING_Y = 20;
    const PLOT_WIDTH = SVG_WIDTH - 2 * PADDING_X;
    const PLOT_HEIGHT = SVG_HEIGHT - 2 * PADDING_Y;

    // Scale functions
    const scaleX = (index) => PADDING_X + (index / (history.length - 1)) * PLOT_WIDTH;
    const scaleY = (load) => PADDING_Y + PLOT_HEIGHT - (load / maxLoad) * PLOT_HEIGHT;

    // Generate SVG path for each server
    const serverPaths = servers.map(server => {
        const dataIndex = server.id - 1;
        
        const points = history.map((loads, index) => {
            const x = scaleX(index);
            const y = scaleY(loads[dataIndex]);
            return `${x},${y}`;
        }).join(' L ');
        
        // Start the path from the first point
        const d = `M ${points}`;

        return {
            id: server.id,
            name: server.name,
            color: server.color,
            d: d,
        };
    });

    const yAxisMarkers = useMemo(() => {
        const step = maxLoad / 4;
        return [0, step, step * 2, step * 3, maxLoad].map(value => ({
            value,
            y: scaleY(value)
        }));
    }, [maxLoad]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col mt-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center border-b pb-3">
                <TrendingUp className="w-5 h-5 mr-2 text-indigo-500" /> Server Load Trend (Last {MAX_HISTORY_POINTS * REQUEST_RATE_MS / 1000}s)
            </h3>
            
            <div className="relative overflow-x-auto">
                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-auto">
                    {/* Background Grid Lines (Y-Axis) */}
                    {yAxisMarkers.map(({ value, y }) => (
                        <React.Fragment key={value}>
                            <line 
                                x1={PADDING_X} 
                                y1={y} 
                                x2={SVG_WIDTH - PADDING_X} 
                                y2={y} 
                                stroke={value === maxLoad ? '#f87171' : value === 0 ? '#4b5563' : '#e5e7eb'} 
                                strokeWidth={value === maxLoad ? 2 : 1}
                                strokeDasharray={value === maxLoad ? '4 4' : 'none'}
                            />
                            {/* Y-Axis Label */}
                            <text x={PADDING_X - 5} y={y + 4} textAnchor="end" fontSize="12" fill="#6b7280">
                                {value}
                            </text>
                        </React.Fragment>
                    ))}
                    
                    {/* X-Axis Line */}
                    <line 
                        x1={PADDING_X} 
                        y1={scaleY(0)} 
                        x2={SVG_WIDTH - PADDING_X} 
                        y2={scaleY(0)} 
                        stroke="#4b5563" 
                        strokeWidth="1"
                    />

                    {/* Server Load Paths */}
                    {serverPaths.map(path => (
                        <path
                            key={path.id}
                            d={path.d}
                            fill="none"
                            stroke={path.color}
                            strokeWidth="3"
                            vectorEffect="non-scaling-stroke"
                            className="transition-all duration-100 ease-linear"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ))}
                </svg>
            </div>
            
            {/* Legend */}
            <div className="flex justify-center flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-gray-100">
                {servers.map(server => (
                    <div key={`legend-${server.id}`} className="flex items-center">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: server.color }}></span>
                        <span className="text-sm text-gray-700 font-medium">{server.name}</span>
                        {server.weight > 1 && <span className="text-xs text-gray-500 ml-1">(W: {server.weight})</span>}
                    </div>
                ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Y-Axis: Active Connections | Red Dashed Line: Max Capacity ({maxLoad})</p>
        </div>
    );
});


/**
 * Animated request element moving from source (LB) to target (Server)
 */
const RequestAnimation = React.memo(({ request, setServers }) => {
  const [position, setPosition] = useState(0); // 0 (start) to 1 (end)
  const [isProcessed, setIsProcessed] = useState(false);
  const startTimeRef = useRef(Date.now());
  const serverColor = `bg-indigo-400`; 

  // Request processing logic and animation
  useEffect(() => {
    // Phase 1: Animation (0 to 1)
    const duration = 500; // Time to reach the server
    let frameId;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setPosition(progress);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        // Phase 2: Processing (Server load decreases after duration)
        setIsProcessed(true);

        setTimeout(() => {
          // Decrement load when processing completes
          setServers(prevServers =>
            prevServers.map(s =>
              s.id === request.targetServerId ? { ...s, load: Math.max(0, s.load - 1) } : s
            )
          );
        }, SIMULATION_DURATION_MS);
      }
    };
    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [request.targetServerId, setServers]);

  // Determine the server position (simulated) based on new fixed layout
  const server = initialServers.find(s => s.id === request.targetServerId);
  if (!server) return null; // Safety check
  
  // Center points (must match SVG coordinates)
  const initialX = 260; 
  const initialY = 320; 
  const targetX = 580; 
  const targetY = server.top + 50; // 50 is half the height of the server card (h-24 ~ 96px)

  // Calculate dynamic position
  const currentX = initialX + position * (targetX - initialX);
  const currentY = initialY + position * (targetY - initialY);

  if (isProcessed) return null; // Remove request once it reaches the server

  return (
    <div
      className="absolute w-4 h-4 rounded-full shadow-md z-40 transition-transform duration-500" // Increased Z-index to 40
      style={{
        backgroundColor: serverColor,
        left: `${currentX}px`,
        top: `${currentY}px`,
      }}
      title={`Request ID: ${request.id} -> Server ${request.targetServerId}`}
    >
      <Zap className="w-2 h-2 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
});

/**
 * Individual Server component
 */
const ServerCard = React.memo(({ server, currentMode }) => {
  const loadPercentage = (server.load / server.maxCapacity) * 100;

  let algorithmInfo = '';
  if (currentMode === 'weightedRR') {
    algorithmInfo = `Weight: ${server.weight}`;
  } else if (currentMode === 'leastConnections') {
    algorithmInfo = `Connections: ${server.load}`;
  }

  const loadColor = loadPercentage > 85 ? 'bg-red-500' : loadPercentage > 50 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div
      style={{ top: `${server.top}px`, left: '480px' }}
      className={`absolute w-40 h-24 p-4 rounded-lg shadow-xl transition-all duration-300 transform z-30 // Increased Z-index to 30
        ${server.isAvailable ? 'bg-white hover:shadow-2xl' : 'bg-gray-200 opacity-50 cursor-not-allowed'}
      `}
    >
      <div className="flex items-center justify-between">
        <Cpu className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-bold text-gray-800">{server.name}</h3>
      </div>
      <div className="mt-1">
        <span className="text-xs font-semibold text-indigo-500">{algorithmInfo}</span>
        {/* Load Bar */}
        <div className="h-1.5 bg-gray-200 rounded-full mt-1">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${loadColor}`}
            style={{ width: `${loadPercentage}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-gray-500 mt-1 text-right">
          Load: {server.load} / {server.maxCapacity}
        </p>
      </div>
    </div>
  );
});

/**
 * Main Load Balancer Simulation Component
 */
const LoadBalancerSimulator = () => {
  const [servers, setServers] = useState(initialServers);
  const [requests, setRequests] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentMode, setCurrentMode] = useState(MODES[0].id);
  const [lastServerIndex, setLastServerIndex] = useState(0); // For Round Robin
  const [ipMap, setIpMap] = useState({}); // For IP Hash
  const [message, setMessage] = useState('');
  const [serverHistory, setServerHistory] = useState([]); 

  const currentModeDetails = useMemo(() => MODES.find(m => m.id === currentMode), [currentMode]);

  // Weighted Round Robin Logic Helper
  const wrrServers = useMemo(() => {
    let list = [];
    servers.forEach(s => {
      for (let i = 0; i < s.weight; i++) {
        list.push(s.id);
      }
    });
    return list;
  }, [servers]);

  // Load Balancing Algorithm Picker
  const getTargetServer = useCallback((ip = generateUniqueId()) => {
    const availableAndCapableServers = servers.filter(s => s.isAvailable && s.load < s.maxCapacity);
    if (availableAndCapableServers.length === 0) return null;

    let targetId = null;

    switch (currentMode) {
      case 'roundRobin': {
        const nextIndex = (lastServerIndex) % availableAndCapableServers.length;
        targetId = availableAndCapableServers[nextIndex].id;
        setLastServerIndex(prev => (prev + 1) % availableAndCapableServers.length);
        break;
      }

      case 'weightedRR': {
        let weightedTargetId = wrrServers[lastServerIndex % wrrServers.length];
        setLastServerIndex(prev => (prev + 1) % wrrServers.length);
        
        const actualTarget = availableAndCapableServers.find(s => s.id === weightedTargetId);

        if (actualTarget) {
            targetId = actualTarget.id;
        } else {
            const fallbackIndex = Math.floor(Math.random() * availableAndCapableServers.length);
            targetId = availableAndCapableServers[fallbackIndex].id;
            setMessage(`Weighted server ${weightedTargetId} unavailable, using fallback.`);
        }
        break;
      }

      case 'leastConnections': {
        availableAndCapableServers.sort((a, b) => a.load - b.load);
        targetId = availableAndCapableServers[0].id;
        break;
      }

      case 'ipHash': {
        const clientIpHash = ip.substring(0, 4);

        if (ipMap[ip]) {
          const stickyTarget = availableAndCapableServers.find(s => s.id === ipMap[ip]);
          if (stickyTarget) {
              targetId = stickyTarget.id;
              setMessage(`Client ${clientIpHash} routed to Server ${targetId} (Sticky Session Maintained)`);
          } else {
              const nextIndex = (lastServerIndex) % availableAndCapableServers.length;
              targetId = availableAndCapableServers[nextIndex].id;
              setLastServerIndex(prev => (prev + 1) % availableAndCapableServers.length);
              setIpMap(prev => ({ ...prev, [ip]: targetId }));
              setMessage(`Client ${clientIpHash}: Sticky server failed. Assigned new session to Server ${targetId}.`);
          }

        } else {
          const nextIndex = (lastServerIndex) % availableAndCapableServers.length;
          targetId = availableAndCapableServers[nextIndex].id;
          setLastServerIndex(prev => (prev + 1) % availableAndCapableServers.length);
          setIpMap(prev => ({ ...prev, [ip]: targetId }));
          setMessage(`Client ${clientIpHash} routed to Server ${targetId} (New Sticky Session)`);
        }
        break;
      }

      default:
        const nextIndex = (lastServerIndex) % availableAndCapableServers.length;
        targetId = availableAndCapableServers[nextIndex].id;
        setLastServerIndex(prev => (prev + 1) % availableAndCapableServers.length);
        break;
    }

    return targetId;
  }, [servers, currentMode, lastServerIndex, wrrServers, ipMap]);

  // Main simulation loop
  useEffect(() => {
    let intervalId;

    if (isRunning) {
      intervalId = setInterval(() => {
        const newRequestId = generateUniqueId();
        const clientIp = generateUniqueId(); 
        
        // 1. Record historical load data every interval BEFORE new request is processed
        setServerHistory(prevHistory => {
            const currentLoads = servers.map(s => s.load); 
            const newHistory = [...prevHistory, currentLoads];
            
            if (newHistory.length > MAX_HISTORY_POINTS) {
                newHistory.shift();
            }
            return newHistory;
        });

        // 2. Determine Target Server
        const targetServerId = getTargetServer(clientIp);

        if (targetServerId) {
          // 3. Increase Server Load immediately
          setServers(prevServers =>
            prevServers.map(s =>
              s.id === targetServerId ? { ...s, load: s.load + 1 } : s
            )
          );

          // 4. Add Request for Animation
          setRequests(prevRequests => [
            ...prevRequests,
            { id: newRequestId, targetServerId, ip: clientIp, status: 'connecting', startTime: Date.now() }
          ]);
        } else {
          setMessage('All servers are full or unavailable. Request dropped or queued.');
        }
        
      }, REQUEST_RATE_MS);
    } else {
      clearInterval(intervalId);
    }

    const requestCleanup = setTimeout(() => {
        setRequests(prevRequests => 
            prevRequests.filter(req => {
                return Date.now() < req.startTime + 500 + SIMULATION_DURATION_MS;
            })
        );
    }, SIMULATION_DURATION_MS + 1000); 

    return () => {
        clearInterval(intervalId);
        clearTimeout(requestCleanup);
    }
  }, [isRunning, getTargetServer, servers]);

  // Reset function
  const resetSimulation = () => {
    setIsRunning(false);
    setRequests([]);
    // Ensure 'top' property is kept after reset for correct visual placement
    setServers(initialServers.map(s => ({ ...s, load: 0, top: s.top }))); 
    setLastServerIndex(0);
    setIpMap({});
    setMessage('');
    setServerHistory([]); 
  };

  // Toggle server availability (for resilience demonstration)
  const toggleServerAvailability = (id) => {
    setServers(prevServers =>
      // When a server goes down, its load is reset to 0
      prevServers.map(s => (s.id === id ? { ...s, isAvailable: !s.isAvailable, load: s.isAvailable ? 0 : s.load } : s))
    );
  };

  // Render the core simulation scene (LB and Servers)
  const renderSimulation = () => {
    // Define SVG path coordinates (Centers of the components)
    const serverCenters = servers.map(s => ({ 
        x: 580, 
        y: s.top + 50, 
        id: s.id,
        color: s.color,
        isAvailable: s.isAvailable
    }));

    return (
        <div className="relative flex justify-center items-start pt-4 h-[650px] overflow-hidden bg-gray-50 border border-gray-200 rounded-lg shadow-xl">
            {/* Custom CSS for the Pulsing Traffic Animation */}
            <style jsx="true">{`
                @keyframes pulse-traffic {
                    0% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: -20; }
                }

                .traffic-line {
                    stroke-dasharray: 10 10;
                    animation: pulse-traffic 1.5s linear infinite;
                }
            `}</style>
            
            {/* 0. SVG Overlay for Connecting Lines - Z-index 10 */}
            <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none">
                {/* 1. Client -> Load Balancer */}
                <path 
                    d="M 95, 320 L 260, 320" 
                    fill="none" 
                    stroke="#a5b4fc" // Indigo 300
                    strokeWidth="3" 
                    className="traffic-line"
                />

                {/* 2. Load Balancer -> Servers */}
                {serverCenters.map((target, index) => (
                    <path
                        key={`line-${target.id}`}
                        d={`M 260, 320 L ${target.x}, ${target.y}`}
                        fill="none"
                        stroke={target.isAvailable ? target.color : '#9ca3af'}
                        strokeWidth="3"
                        className="traffic-line transition-all duration-300"
                        style={{
                            opacity: target.isAvailable ? 1 : 0.4,
                        }}
                    />
                ))}
            </svg>

            {/* 1. Client Source (Simulated Internet/WAN) - Z-index 20 */}
            <div
                style={{ top: '275px', left: '50px' }}
                className="absolute w-20 h-20 p-4 rounded-full bg-blue-100 shadow-xl border-4 border-blue-400 flex flex-col items-center justify-center z-20"
            >
                <Globe className="w-8 h-8 text-blue-600" />
                <p className="text-xs font-bold text-blue-800 mt-1">CLIENT</p>
            </div>
            
            {/* 2. The Load Balancer (Central Node) - Z-index 20 */}
            <div
                style={{ top: '260px', left: '200px' }}
                className="absolute w-24 h-24 bg-indigo-600 rounded-xl shadow-2xl flex flex-col items-center justify-center border-4 border-indigo-800 animate-pulse-slow z-20"
            >
                <Settings className="w-8 h-8 text-white" />
                <p className="text-xs font-bold text-white mt-1">LB</p>
                <p className="text-xs font-light text-indigo-200 uppercase">({currentModeDetails.id.slice(0, 10)})</p>
            </div>

            {/* 3. The Backend Server Pool Title (New Top Center Position) */}
            <div 
                style={{ top: '4px', left: '500px' }} 
                className="absolute w-40 text-center z-30" // Increased Z-index to 30
            >
                <p className="font-bold text-gray-700 flex items-center justify-center">
                    <Heart className="w-4 h-4 mr-2 text-red-500" />
                    **Backend Server Pool**
                </p>
            </div>
            
            {/* 4. Individual Server Cards (Z-index 30) */}
            {servers.map(server => (
                <ServerCard key={server.id} server={server} currentMode={currentMode} />
            ))}

            {/* 5. Live Request Animations (Highest Z-index 40) */}
            <div className="absolute inset-0">
                {requests.map(req => (
                    <RequestAnimation key={req.id} request={req} setServers={setServers} />
                ))}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4">
      {/* Project Header added here with new styles */}
      <div className="text-center mb-4 pt-4">
        <h2 className="text-5xl font-extrabold text-indigo-800">
          Cloud Computing Project-Based Learning Code Implementation
        </h2>
        <p className="text-lg text-indigo-600 font-semibold mt-1">
          By : Sam Kamalesan (23WU0101154) , Snigdha Roy (23WU0101159)
        </p>
      </div>

      <header className="text-center py-6 border-b border-indigo-100 mb-6">
        <h1 className="text-4xl font-extrabold text-indigo-800 flex items-center justify-center">
          Load Balancer Algorithm Simulation
        </h1>
        <p className="text-lg text-gray-500 mt-2">Live Demonstration of Traffic Distribution using Load Balancers</p>
      </header>

      {/* Navigation Bar */}
      <nav className="flex flex-wrap justify-center space-x-2 md:space-x-4 mb-8">
        {MODES.map(mode => (
          <button
            key={mode.id}
            onClick={() => {
              setCurrentMode(mode.id);
              resetSimulation(); 
            }}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 shadow-lg ${
              currentMode === mode.id
                ? 'bg-indigo-600 text-white shadow-indigo-400/50'
                : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            {mode.name}
          </button>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto bg-white rounded-xl shadow-2xl p-6 border-t-4 border-indigo-500">
        <h2 className="text-3xl font-bold text-gray-800 mb-3">{currentModeDetails.name}</h2>
        <p className="text-gray-600 border-b pb-4 mb-4">{currentModeDetails.desc}</p>

        {/* Control Panel */}
        <div className="flex flex-wrap justify-between items-center bg-gray-100 p-4 rounded-lg mb-6 shadow-inner">
          <button
            onClick={() => setIsRunning(prev => !prev)}
            className={`flex items-center px-6 py-2 rounded-full font-bold text-white transition duration-300 transform hover:scale-105 shadow-md ${
              isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isRunning ? (
              <>
                <Zap className="w-5 h-5 mr-2" /> **STOP** SIMULATION
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" /> **START** SIMULATION
              </>
            )}
          </button>

          <button
            onClick={resetSimulation}
            className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-full font-bold hover:bg-yellow-600 transition duration-300 shadow-md"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Reset
          </button>

          {/* Server Controls for Resilience Demo */}
          <div className="flex flex-wrap items-center mt-4 md:mt-0">
            <p className="text-sm font-semibold text-gray-700 flex items-center mr-2 mb-2 md:mb-0">Toggle Server Health:</p>
            {servers.map(s => (
              <button
                key={`toggle-${s.id}`}
                onClick={() => toggleServerAvailability(s.id)}
                className={`text-xs px-3 py-1 mr-2 rounded-full font-semibold transition-colors duration-200 border ${
                  s.isAvailable
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-300'
                    : 'bg-red-100 text-red-700 hover:bg-red-200 border-red-300'
                }`}
              >
                {s.name} ({s.isAvailable ? 'Up' : 'Down'})
              </button>
            ))}
          </div>
        </div>

        {/* Live Message Bar */}
        {message && (
          <div className="p-3 mb-4 bg-indigo-50 border-l-4 border-indigo-500 text-indigo-800 rounded-md flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className='font-medium'>{message}</span>
          </div>
        )}

        {/* Row 1: Simulation Visual + Current Load Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Simulation Visual (2/3 width) */}
            <div className="lg:col-span-2">
                {renderSimulation()}
            </div>

            {/* 2. Dynamic Bar Chart (1/3 width) */}
            <div className="lg:col-span-1">
                <LoadChart servers={servers} maxLoad={MAX_LOAD} />
            </div>
        </div>
        
        {/* Row 2: Historical Line Chart (Full Width) */}
        <div className="col-span-full">
            <LoadHistoryChart history={serverHistory} servers={initialServers} maxLoad={MAX_LOAD} />
        </div>

      </main>
    </div>
  );
};

export default LoadBalancerSimulator;
