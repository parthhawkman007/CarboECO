"use client";
import { getApiUrl, getWsUrl, getAuthHeaders } from "@/utils/api";


import { useState, useEffect } from "react";
import { BatteryCharging, Sun, Flame, Plane, Landmark, Trees, MapPin, Navigation, Car, Train, Bike } from "lucide-react";
import { SimulationRun } from "@/types";

const PRESET_ROUTES = [
  { id: "sv", name: "Silicon Valley (San Jose ➔ SF)", lat1: 37.3382, lon1: -121.8863, lat2: 37.7749, lon2: -122.4194, dist: 78.2, elev: 42, stops: 18 },
  { id: "co", name: "Colorado Ascent (Denver ➔ Boulder)", lat1: 39.7392, lon1: -104.9903, lat2: 40.0150, lon2: -105.2705, dist: 48.5, elev: 165, stops: 8 },
  { id: "ec", name: "East Coast Corridor (Philly ➔ NYC)", lat1: 39.9526, lon1: -75.1652, lat2: 40.7128, lon2: -74.0060, dist: 152.4, elev: 12, stops: 25 },
  { id: "custom", name: "Custom Coordinates Input", lat1: 41.8781, lon1: -87.6298, lat2: 42.0451, lon2: -87.6877, dist: 24.5, elev: 8, stops: 12 }
];

export default function Simulator() {
  const [activeTab, setActiveTab] = useState<"standard" | "gis">("standard");

  // Standard tab states
  const [switchToEv, setSwitchToEv] = useState(false);
  const [evAnnualKm, setEvAnnualKm] = useState(12000);
  const [installSolar, setInstallSolar] = useState(false);
  const [solarCapacity, setSolarCapacity] = useState(4500);
  const [meatlessDays, setMeatlessDays] = useState(0);
  const [reduceFlights, setReduceFlights] = useState(0);

  // GIS tab states
  const [selectedRoute, setSelectedRoute] = useState(PRESET_ROUTES[0]);
  const [customLat1, setCustomLat1] = useState("41.8781");
  const [customLon1, setCustomLon1] = useState("-87.6298");
  const [customLat2, setCustomLat2] = useState("42.0451");
  const [customLon2, setCustomLon2] = useState("-87.6877");
  const [customElev, setCustomElev] = useState(10);
  const [customStops, setCustomStops] = useState(15);
  const [gisCalculated, setGisCalculated] = useState(false);

  const [history, setHistory] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/simulator/history`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (err) {
        console.error("Failed to load simulation history.", err);
      }
    };
    fetchHistory();
  }, []);

  // Constants matching config EFs
  const EF_CAR_PETROL = 0.18;
  const EF_CAR_ELECTRIC = 0.05;
  const EF_ELECTRICITY_GRID = 0.42;
  const EF_FOOD_BEEF = 27.0;
  const EF_FOOD_VEGETARIAN = 1.2;
  const EF_FLIGHT_SHORT = 0.25;

  // 1. Calculate Standard Scenario
  let standardCo2Saved = 0.0;
  if (switchToEv) {
    standardCo2Saved += evAnnualKm * (EF_CAR_PETROL - EF_CAR_ELECTRIC);
  }
  if (installSolar) {
    standardCo2Saved += solarCapacity * EF_ELECTRICITY_GRID;
  }
  if (meatlessDays > 0) {
    standardCo2Saved += meatlessDays * 52 * (EF_FOOD_BEEF - EF_FOOD_VEGETARIAN) * 0.25;
  }
  if (reduceFlights > 0) {
    standardCo2Saved += reduceFlights * 800.0 * EF_FLIGHT_SHORT;
  }

  const roundToTwo = (num: number) => Math.round(num * 100) / 100;
  const totalStandardSaved = roundToTwo(standardCo2Saved);

  // 2. GIS Routing Calculations
  const isCustom = selectedRoute.id === "custom";
  const startLat = isCustom ? parseFloat(customLat1) || 0 : selectedRoute.lat1;
  const startLon = isCustom ? parseFloat(customLon1) || 0 : selectedRoute.lon1;
  const endLat = isCustom ? parseFloat(customLat2) || 0 : selectedRoute.lat2;
  const endLon = isCustom ? parseFloat(customLon2) || 0 : selectedRoute.lon2;
  const routeElev = isCustom ? customElev : selectedRoute.elev;
  const routeStops = isCustom ? customStops : selectedRoute.stops;

  // Haversine formula
  const calculateHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10;
  };

  const calculatedDist = isCustom ? calculateHaversine(startLat, startLon, endLat, endLon) : selectedRoute.dist;

  // Emissions including grade engine load & stopping frequency penalty factors
  const carPetrolEmissions = calculatedDist * (EF_CAR_PETROL + (routeElev * 0.0003) + (routeStops * 0.012));
  const carElectricEmissions = calculatedDist * (EF_CAR_ELECTRIC + (routeElev * 0.00008) + (routeStops * 0.003));
  const metroEmissions = calculatedDist * 0.03;
  const busEmissions = calculatedDist * (0.08 + (routeElev * 0.0001) + (routeStops * 0.005));
  const bikeEmissions = 0.0;

  // CO2 Saved taking Metro instead of Petrol Car
  const gisCo2Saved = roundToTwo(Math.max(0, carPetrolEmissions - metroEmissions));
  const activeCo2Saved = activeTab === "standard" ? totalStandardSaved : gisCo2Saved;
  const equivalentTrees = Math.round(activeCo2Saved / 22.0);

  const handleSaveSimulation = async () => {
    setLoading(true);
    const payload = {
      name: activeTab === "standard" 
        ? `Scenario ${new Date().toLocaleDateString()}` 
        : `GIS Commute (${selectedRoute.name.split(" (")[0]})`,
      inputs_json: activeTab === "standard" ? {
        type: "standard",
        switch_to_ev: switchToEv,
        ev_annual_km: evAnnualKm,
        install_solar_panels: installSolar,
        solar_capacity_kwh_annual: solarCapacity,
        meatless_days_per_week: meatlessDays,
        reduce_flight_hours: reduceFlights
      } : {
        type: "gis",
        route_name: selectedRoute.name,
        distance_km: calculatedDist,
        elevation_gain_m: routeElev,
        stops_count: routeStops,
        car_petrol_co2: roundToTwo(carPetrolEmissions),
        metro_co2: roundToTwo(metroEmissions),
        car_electric_co2: roundToTwo(carElectricEmissions)
      }
    };

    try {
      const res = await fetch(`${getApiUrl()}/api/simulator/run`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data: SimulationRun = await res.json();
        setHistory(prev => [data, ...prev]);
      } else {
        setHistory(prev => [{ id: Date.now(), user_id: 1, name: payload.name, inputs_json: payload.inputs_json, co2_saved: activeCo2Saved, created_at: new Date().toISOString() }, ...prev]);
      }
    } catch {
      setHistory(prev => [{ id: Date.now(), user_id: 1, name: payload.name, inputs_json: payload.inputs_json, co2_saved: activeCo2Saved, created_at: new Date().toISOString() }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 py-6 max-w-5xl mx-auto">
      
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white">Impact Simulator</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Simulate custom sustainability scenarios and GIS transit route deltas in real time</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-brand-borderDark/40">
        <button
          onClick={() => setActiveTab("standard")}
          className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 ${
            activeTab === "standard"
              ? "border-brand-emerald text-brand-emerald"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Lifestyle Impact Scenario
        </button>
        <button
          onClick={() => setActiveTab("gis")}
          className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 ${
            activeTab === "gis"
              ? "border-brand-emerald text-brand-emerald"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          GIS Geo-Transit Route Simulator
        </button>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Left Columns: Simulator Controls */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {activeTab === "standard" ? (
            <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-6">
              {/* 1. Electric Vehicle Swapping */}
              <div className="flex flex-col gap-4 border-b border-gray-100 dark:border-brand-borderDark/40 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl"><BatteryCharging className="h-5 w-5" /></div>
                      <div>
                        <label htmlFor="ev-toggle" className="block font-bold text-sm text-gray-800 dark:text-white cursor-pointer">Switch to Electric Vehicle (EV)</label>
                        <span className="text-[10px] text-gray-400">Model savings swapping internal combustion with EV</span>
                      </div>
                    </div>
                  <input
                    type="checkbox"
                    checked={switchToEv}
                    onChange={(e) => setSwitchToEv(e.target.checked)}
                    className="h-5 w-5 rounded text-brand-emerald focus:ring-brand-emerald accent-brand-emerald cursor-pointer"
                    id="ev-toggle"
                  />
                </div>

                {switchToEv && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex justify-between text-xs text-gray-500 font-semibold">
                      <label htmlFor="ev-km-slider">Annual Commute (km)</label>
                      <span>{evAnnualKm.toLocaleString()} km</span>
                    </div>
                    <input
                      id="ev-km-slider"
                      type="range"
                      min="1000"
                      max="40000"
                      step="1000"
                      value={evAnnualKm}
                      onChange={(e) => setEvAnnualKm(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-brand-borderDark rounded-lg appearance-none cursor-pointer accent-brand-emerald"
                    />
                  </div>
                )}
              </div>

              {/* 2. Solar Panels */}
              <div className="flex flex-col gap-4 border-b border-gray-100 dark:border-brand-borderDark/40 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl"><Sun className="h-5 w-5" /></div>
                      <div>
                        <label htmlFor="solar-toggle" className="block font-bold text-sm text-gray-800 dark:text-white cursor-pointer">Install Rooftop Solar Panels</label>
                        <span className="text-[10px] text-gray-400">Generate clean electricity from renewable solar arrays</span>
                      </div>
                    </div>
                  <input
                    type="checkbox"
                    checked={installSolar}
                    onChange={(e) => setInstallSolar(e.target.checked)}
                    className="h-5 w-5 rounded text-brand-emerald focus:ring-brand-emerald accent-brand-emerald cursor-pointer"
                    id="solar-toggle"
                  />
                </div>

                {installSolar && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex justify-between text-xs text-gray-500 font-semibold">
                      <label htmlFor="solar-kwh-slider">Annual Solar Generation Capacity (kWh)</label>
                      <span>{solarCapacity.toLocaleString()} kWh</span>
                    </div>
                    <input
                      id="solar-kwh-slider"
                      type="range"
                      min="1000"
                      max="15000"
                      step="500"
                      value={solarCapacity}
                      onChange={(e) => setSolarCapacity(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-brand-borderDark rounded-lg appearance-none cursor-pointer accent-brand-emerald"
                    />
                  </div>
                )}
              </div>

              {/* 3. Meatless days */}
              <div className="flex flex-col gap-4 border-b border-gray-100 dark:border-brand-borderDark/40 pb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-emerald/10 text-brand-emerald rounded-xl"><Flame className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="block font-bold text-sm text-gray-800 dark:text-white">Meatless Days Per Week</span>
                      <span className="text-xs font-semibold text-brand-emerald">{meatlessDays} days</span>
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Scale down meat intake to plant protein equivalents</span>
                    <input
                      type="range"
                      min="0"
                      max="7"
                      step="1"
                      value={meatlessDays}
                      onChange={(e) => setMeatlessDays(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-brand-borderDark rounded-lg appearance-none cursor-pointer accent-brand-emerald mt-3"
                      aria-label="Number of meatless days per week"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Flight reduction */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl"><Plane className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="block font-bold text-sm text-gray-800 dark:text-white">Reduce Air Flight Travel</span>
                      <span className="text-xs font-semibold text-brand-emerald">{reduceFlights} hours</span>
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Avoid flight journeys (short domestic and long haul)</span>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="2"
                      value={reduceFlights}
                      onChange={(e) => setReduceFlights(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-brand-borderDark rounded-lg appearance-none cursor-pointer accent-brand-emerald mt-3"
                      aria-label="Flight hours reduced annually"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-6 animate-in fade-in duration-200">
              {/* Route corridor select */}
              <div className="flex flex-col gap-2">
                <label htmlFor="route-preset" className="text-xs font-bold text-gray-500 dark:text-gray-400">Select Transit Corridor</label>
                <select
                  id="route-preset"
                  value={selectedRoute.id}
                  onChange={(e) => {
                    const found = PRESET_ROUTES.find(r => r.id === e.target.value);
                    if (found) setSelectedRoute(found);
                  }}
                  className="w-full bg-gray-100 dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark rounded-xl p-3 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                >
                  {PRESET_ROUTES.map(route => (
                    <option key={route.id} value={route.id} className="text-gray-800">
                      {route.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Coordinates block */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 p-4 bg-gray-100/50 dark:bg-brand-cardDark/50 rounded-2xl border border-gray-100 dark:border-brand-borderDark/20">
                  <span className="text-[10px] font-bold text-brand-emerald uppercase flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Start Coordinates
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Lat"
                      aria-label="Start latitude coordinate"
                      value={isCustom ? customLat1 : selectedRoute.lat1.toFixed(4)}
                      disabled={!isCustom}
                      onChange={(e) => setCustomLat1(e.target.value)}
                      className="bg-white dark:bg-brand-darkBg text-xs p-2 rounded-lg border border-gray-200 dark:border-brand-borderDark"
                    />
                    <input
                      type="text"
                      placeholder="Lon"
                      aria-label="Start longitude coordinate"
                      value={isCustom ? customLon1 : selectedRoute.lon1.toFixed(4)}
                      disabled={!isCustom}
                      onChange={(e) => setCustomLon1(e.target.value)}
                      className="bg-white dark:bg-brand-darkBg text-xs p-2 rounded-lg border border-gray-200 dark:border-brand-borderDark"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-4 bg-gray-100/50 dark:bg-brand-cardDark/50 rounded-2xl border border-gray-100 dark:border-brand-borderDark/20">
                  <span className="text-[10px] font-bold text-brand-emerald uppercase flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Destination Coordinates
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Lat"
                      aria-label="Destination latitude coordinate"
                      value={isCustom ? customLat2 : selectedRoute.lat2.toFixed(4)}
                      disabled={!isCustom}
                      onChange={(e) => setCustomLat2(e.target.value)}
                      className="bg-white dark:bg-brand-darkBg text-xs p-2 rounded-lg border border-gray-200 dark:border-brand-borderDark"
                    />
                    <input
                      type="text"
                      placeholder="Lon"
                      aria-label="Destination longitude coordinate"
                      value={isCustom ? customLon2 : selectedRoute.lon2.toFixed(4)}
                      disabled={!isCustom}
                      onChange={(e) => setCustomLon2(e.target.value)}
                      className="bg-white dark:bg-brand-darkBg text-xs p-2 rounded-lg border border-gray-200 dark:border-brand-borderDark"
                    />
                  </div>
                </div>
              </div>

              {/* GIS Terrain Modifiers */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-gray-500 font-semibold">
                    <label htmlFor="elev-slider">Elevation Gain (meters)</label>
                    <span>{routeElev} m</span>
                  </div>
                  <input
                    id="elev-slider"
                    type="range"
                    min="0"
                    max="500"
                    step="5"
                    value={routeElev}
                    disabled={!isCustom}
                    onChange={(e) => setCustomElev(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 dark:bg-brand-borderDark rounded-lg appearance-none cursor-pointer accent-brand-emerald disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-gray-500 font-semibold">
                    <label htmlFor="stops-slider">Urban Traffic Stops</label>
                    <span>{routeStops} intersections</span>
                  </div>
                  <input
                    id="stops-slider"
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={routeStops}
                    disabled={!isCustom}
                    onChange={(e) => setCustomStops(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 dark:bg-brand-borderDark rounded-lg appearance-none cursor-pointer accent-brand-emerald disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Comparative Output Visualization */}
              <div className="flex flex-col gap-3 mt-4 border-t border-gray-100 dark:border-brand-borderDark/40 pt-6">
                <span className="text-xs font-bold uppercase text-gray-400">Emissions Comparison (kg CO2e total)</span>
                
                <div className="flex flex-col gap-4 mt-2">
                  {/* Petrol Sedan */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-xs font-bold flex items-center gap-1"><Car className="h-3.5 w-3.5 text-red-500" /> Petrol Sedan</div>
                    <div className="flex-1 bg-gray-200 dark:bg-brand-borderDark h-4 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (carPetrolEmissions / carPetrolEmissions) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-mono font-bold w-16 text-right">{carPetrolEmissions.toFixed(1)} kg</span>
                  </div>

                  {/* EV SUV */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-xs font-bold flex items-center gap-1"><Car className="h-3.5 w-3.5 text-blue-500" /> EV SUV</div>
                    <div className="flex-1 bg-gray-200 dark:bg-brand-borderDark h-4 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${(carElectricEmissions / carPetrolEmissions) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono font-bold w-16 text-right">{carElectricEmissions.toFixed(1)} kg</span>
                  </div>

                  {/* City Bus */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-xs font-bold flex items-center gap-1"><Train className="h-3.5 w-3.5 text-yellow-500" /> City Bus</div>
                    <div className="flex-1 bg-gray-200 dark:bg-brand-borderDark h-4 rounded-full overflow-hidden">
                      <div className="bg-yellow-500 h-full rounded-full transition-all duration-300" style={{ width: `${(busEmissions / carPetrolEmissions) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono font-bold w-16 text-right">{busEmissions.toFixed(1)} kg</span>
                  </div>

                  {/* Metro/Train */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-xs font-bold flex items-center gap-1"><Train className="h-3.5 w-3.5 text-brand-emerald" /> Electric Train</div>
                    <div className="flex-1 bg-gray-200 dark:bg-brand-borderDark h-4 rounded-full overflow-hidden">
                      <div className="bg-brand-emerald h-full rounded-full transition-all duration-300" style={{ width: `${(metroEmissions / carPetrolEmissions) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono font-bold w-16 text-right">{metroEmissions.toFixed(1)} kg</span>
                  </div>

                  {/* Active Commute */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-xs font-bold flex items-center gap-1"><Bike className="h-3.5 w-3.5 text-brand-sky" /> E-Bike/Walk</div>
                    <div className="flex-1 bg-gray-200 dark:bg-brand-borderDark h-4 rounded-full overflow-hidden">
                      <div className="bg-brand-sky h-full rounded-full transition-all duration-300" style={{ width: `0%` }} />
                    </div>
                    <span className="text-xs font-mono font-bold w-16 text-right">0.0 kg</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Results & History */}
        <div className="flex flex-col gap-6">
          {/* Real-time Savings Card */}
          <div className="glass-card rounded-3xl p-6 border border-brand-emerald/30 bg-brand-emerald/5 text-center flex flex-col gap-6">
            <div>
              <span className="text-xs font-semibold text-brand-emerald uppercase tracking-wider">
                {activeTab === "standard" ? "Annual Scenario Savings" : "Single Route Corridors Delta"}
              </span>
              <h2 className="text-4xl font-extrabold text-brand-emerald mt-2">
                -{activeCo2Saved.toLocaleString()}
                <span className="text-xs font-bold text-gray-500 ml-1">kg CO2e {activeTab === "standard" ? "/ yr" : ""}</span>
              </h2>
              {activeTab === "gis" && (
                <span className="text-[10px] text-gray-500 block mt-1">
                  (Commuting via Electric Train instead of Petrol vehicle on this {calculatedDist} km path)
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 bg-white dark:bg-brand-cardDark p-4 rounded-2xl border border-gray-100 dark:border-brand-borderDark/40">
              <div className="p-3 bg-brand-emerald/10 text-brand-emerald rounded-full">
                <Trees className="h-6 w-6" />
              </div>
              <div className="text-left">
                <span className="block text-lg font-black">{equivalentTrees} Trees</span>
                <span className="text-[10px] text-gray-400">Equivalent absorption capacity</span>
              </div>
            </div>

            <button
              onClick={handleSaveSimulation}
              disabled={loading || activeCo2Saved === 0}
              className="w-full bg-brand-emerald hover:bg-brand-forest text-white font-semibold py-3 rounded-xl shadow-md transition-colors disabled:opacity-50 text-xs"
            >
              {loading ? "Saving Scenario..." : "Save Simulation Scenario"}
            </button>
          </div>

          {/* History log */}
          {history.length > 0 && (
            <div className="glass-card rounded-3xl p-6 border border-white/20">
              <h4 className="text-xs font-bold uppercase text-gray-400 mb-3 flex items-center gap-1.5">
                <Landmark className="h-4 w-4" />
                <span>Scenario Archives</span>
              </h4>

              <div className="flex flex-col gap-3 max-h-[180px] overflow-y-auto pr-1">
                {history.map((h, i) => (
                  <div key={i} className="flex justify-between items-center text-xs border-b border-gray-100 dark:border-brand-borderDark/40 pb-2 last:border-0 last:pb-0">
                    <div>
                      <span className="font-bold block text-left truncate max-w-[150px]">{h.name}</span>
                      <span className="text-[9px] text-gray-400 block text-left">{new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                    <span className="font-extrabold text-brand-emerald">-{h.co2_saved} kg CO2e</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
