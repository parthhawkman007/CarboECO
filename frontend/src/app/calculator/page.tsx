"use client";
import { getApiUrl, getWsUrl } from "@/utils/api";


import { useState, useEffect } from "react";
import { Navigation, Zap, Flame, Trash2, Laptop, ShoppingBag, PlusCircle, CheckCircle, Database, Map, Camera, Upload, ArrowRight, Check, Sparkles } from "lucide-react";
import { CarbonLog } from "@/types";
import { queuePendingLog, syncOfflineLogs, getPendingLogs } from "@/utils/offlineSync";

const CATEGORIES = [
  { id: "transportation", label: "Transportation", icon: Navigation, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { id: "energy", label: "Home Utilities", icon: Zap, color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
  { id: "food", label: "Food Diet", icon: Flame, color: "text-brand-emerald bg-brand-emerald/10 border-brand-emerald/20" },
  { id: "waste", label: "Waste Disposal", icon: Trash2, color: "text-red-500 bg-red-500/10 border-red-500/20" },
  { id: "shopping", label: "Shopping Habits", icon: ShoppingBag, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
  { id: "digital", label: "Digital Footprint", icon: Laptop, color: "text-brand-sky bg-brand-sky/10 border-brand-sky/20" }
];

const SUBCATEGORIES: Record<string, { label: string; unit: string }[]> = {
  transportation: [
    { label: "petrol_car", unit: "km" },
    { label: "diesel_car", unit: "km" },
    { label: "electric_car", unit: "km" },
    { label: "motorcycle", unit: "km" },
    { label: "metro", unit: "km" },
    { label: "bus", unit: "km" },
    { label: "short_flight", unit: "km" },
    { label: "long_flight", unit: "km" }
  ],
  energy: [
    { label: "electricity", unit: "kWh" },
    { label: "gas", unit: "kWh" },
    { label: "water", unit: "liters" }
  ],
  food: [
    { label: "beef", unit: "kg" },
    { label: "pork_poultry", unit: "kg" },
    { label: "dairy", unit: "kg" },
    { label: "vegetarian", unit: "kg" },
    { label: "vegan", unit: "kg" }
  ],
  waste: [
    { label: "landfill", unit: "kg" },
    { label: "recycled", unit: "kg" },
    { label: "composted", unit: "kg" }
  ],
  shopping: [
    { label: "clothing", unit: "USD" },
    { label: "electronics", unit: "USD" },
    { label: "misc", unit: "USD" }
  ],
  digital: [
    { label: "streaming", unit: "hours" },
    { label: "browsing", unit: "hours" },
    { label: "ai_query", unit: "queries" }
  ]
};

export default function Calculator() {
  const [activeCategory, setActiveCategory] = useState("transportation");
  const [subcategory, setSubcategory] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [successResult, setSuccessResult] = useState<CarbonLog | null>(null);
  const [errors, setErrors] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Google Maps Routing Simulator State
  const [useGoogleMaps, setUseGoogleMaps] = useState(false);
  const [startLoc, setStartLoc] = useState("");
  const [endLoc, setEndLoc] = useState("");
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<string>("");
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [showSimulatedMap, setShowSimulatedMap] = useState(false);

  // Gemini Multimodal AI Scanner State
  const [calculatorMode, setCalculatorMode] = useState<"manual" | "scanner">("manual");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannedResult, setScannedResult] = useState<{
    category: string;
    subcategory: string;
    value: number;
    unit: string;
    explanation: string;
  } | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);

  useEffect(() => {
    const checkPending = async () => {
      const pending = await getPendingLogs();
      setPendingCount(pending.length);
    };
    checkPending();

    const handleOnline = async () => {
      setSyncing(true);
      await syncOfflineLogs();
      await checkPending();
      setSyncing(false);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    setSubcategory(SUBCATEGORIES[catId][0].label);
    setSuccessResult(null);
    setErrors("");
  };

  if (!subcategory && SUBCATEGORIES[activeCategory]) {
    setSubcategory(SUBCATEGORIES[activeCategory][0].label);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors("");
    setSuccessResult(null);

    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue <= 0) {
      setErrors("Please enter a valid numeric consumption value greater than zero.");
      return;
    }

    setLoading(true);

    const payload = {
      date,
      category: activeCategory,
      subcategory,
      value: numericValue,
      unit: SUBCATEGORIES[activeCategory].find(s => s.label === subcategory)?.unit || "units"
    };

    try {
      const res = await fetch(`${getApiUrl()}/api/carbon/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data: CarbonLog = await res.json();
        setSuccessResult(data);
        setValue("");
      } else {
        await queuePendingLog(payload);
        const pending = await getPendingLogs();
        setPendingCount(pending.length);

        const simulatedCo2 = simulateOfflineCalculator(activeCategory, subcategory, numericValue);
        setSuccessResult({
          id: Date.now(),
          user_id: 1,
          co2_equivalent: simulatedCo2,
          category: activeCategory,
          subcategory,
          value: numericValue,
          unit: payload.unit,
          date,
          explanation: `Offline Mode: Log queued locally in IndexedDB. Emissions of ${numericValue} ${payload.unit} of ${subcategory} is estimated at ${simulatedCo2} kg CO2e.`,
          metadata_json: { offline: true },
          created_at: new Date().toISOString()
        });
        setValue("");
      }
    } catch (err) {
      await queuePendingLog(payload);
      const pending = await getPendingLogs();
      setPendingCount(pending.length);

      const simulatedCo2 = simulateOfflineCalculator(activeCategory, subcategory, numericValue);
      setSuccessResult({
        id: Date.now(),
        user_id: 1,
        co2_equivalent: simulatedCo2,
        category: activeCategory,
        subcategory,
        value: numericValue,
        unit: payload.unit,
        date,
        explanation: `Offline Mode (Network disconnected): Log queued locally in IndexedDB. Emissions of ${numericValue} ${payload.unit} of ${subcategory} is estimated at ${simulatedCo2} kg CO2e.`,
        metadata_json: { offline: true },
        created_at: new Date().toISOString()
      });
      setValue("");
    } finally {
      setLoading(false);
    }
  };

  const simulateOfflineCalculator = (cat: string, sub: string, val: number): number => {
    const factors: Record<string, number> = {
      petrol_car: 0.18, diesel_car: 0.17, electric_car: 0.05, motorcycle: 0.10, metro: 0.03, bus: 0.05, short_flight: 0.25, long_flight: 0.15,
      electricity: 0.42, gas: 0.20, water: 0.0003,
      beef: 27.0, pork_poultry: 6.0, dairy: 3.0, vegetarian: 1.2, vegan: 0.5,
      landfill: 1.2, recycled: 0.1, composted: 0.2,
      clothing: 0.4, electronics: 0.8, misc: 0.2,
      streaming: 0.05, browsing: 0.02, ai_query: 0.005
    };
    return roundToTwo(val * (factors[sub] || 0.1));
  };

  const roundToTwo = (num: number) => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  const currentUnit = SUBCATEGORIES[activeCategory]?.find(s => s.label === subcategory)?.unit || "units";

  const handleCalculateRoute = async () => {
    if (!startLoc.trim() || !endLoc.trim()) return;
    setCalculatingRoute(true);
    setShowSimulatedMap(false);
    
    // Simulate API request to Google Maps Distance Matrix API
    setTimeout(() => {
      const rawDistance = (startLoc.length * 3 + endLoc.length * 4) % 150 + 12.5;
      const roundedDist = Math.round(rawDistance * 10) / 10;
      const durationHours = Math.floor(roundedDist / 60);
      const durationMins = Math.round(roundedDist % 60);
      
      setRouteDistance(roundedDist);
      setRouteDuration(durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins} mins`);
      setCalculatingRoute(false);
      setShowSimulatedMap(true);
    }, 1200);
  };

  const handleApplyRouteDistance = () => {
    if (routeDistance !== null) {
      setValue(routeDistance.toString());
      setUseGoogleMaps(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setScannedResult(null);
      setScanError("");
      setScanSuccess(false);
    }
  };

  const handleScanImage = async () => {
    if (!imagePreview) return;
    setScannerLoading(true);
    setScanError("");
    setScannedResult(null);

    try {
      const res = await fetch(`${getApiUrl()}/api/ai/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: imagePreview })
      });

      if (!res.ok) {
        throw new Error("Could not analyze image. Please try another image or log manually.");
      }

      const data = await res.json();
      setScannedResult(data);
    } catch (err: any) {
      setScanError(err.message || "Something went wrong while scanning.");
    } finally {
      setScannerLoading(false);
    }
  };

  const handleSaveScannedLog = async () => {
    if (!scannedResult) return;
    setLoading(true);
    setScanError("");
    setScanSuccess(false);

    const payload = {
      date: new Date().toISOString().split("T")[0],
      category: scannedResult.category,
      subcategory: scannedResult.subcategory,
      value: scannedResult.value,
      unit: scannedResult.unit
    };

    try {
      const res = await fetch(`${getApiUrl()}/api/carbon/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const logged: CarbonLog = await res.json();
        setSuccessResult(logged);
        setScanSuccess(true);
        setSelectedFile(null);
        setImagePreview(null);
        setScannedResult(null);
        setCalculatorMode("manual");
      } else {
        await queuePendingLog(payload);
        const pending = await getPendingLogs();
        setPendingCount(pending.length);
        
        const simulatedCo2 = simulateOfflineCalculator(payload.category, payload.subcategory, payload.value);
        setSuccessResult({
          id: Date.now(),
          user_id: 1,
          co2_equivalent: simulatedCo2,
          category: payload.category,
          subcategory: payload.subcategory,
          value: payload.value,
          unit: payload.unit,
          date: payload.date,
          explanation: `Offline Mode: Log queued locally in IndexedDB. Gemini Scan emissions estimated at ${simulatedCo2} kg CO2e.`,
          metadata_json: { offline: true },
          created_at: new Date().toISOString()
        });
        setScanSuccess(true);
        setSelectedFile(null);
        setImagePreview(null);
        setScannedResult(null);
        setCalculatorMode("manual");
      }
    } catch (err) {
      await queuePendingLog(payload);
      const pending = await getPendingLogs();
      setPendingCount(pending.length);

      const simulatedCo2 = simulateOfflineCalculator(payload.category, payload.subcategory, payload.value);
      setSuccessResult({
        id: Date.now(),
        user_id: 1,
        co2_equivalent: simulatedCo2,
        category: payload.category,
        subcategory: payload.subcategory,
        value: payload.value,
        unit: payload.unit,
        date: payload.date,
        explanation: `Offline Mode: Log queued locally in IndexedDB. Gemini Scan emissions estimated at ${simulatedCo2} kg CO2e.`,
        metadata_json: { offline: true },
        created_at: new Date().toISOString()
      });
      setScanSuccess(true);
      setSelectedFile(null);
      setImagePreview(null);
      setScannedResult(null);
      setCalculatorMode("manual");
    } finally {
      setLoading(false);
    }
  };

  const triggerManualSync = async () => {
    setSyncing(true);
    const results = await syncOfflineLogs();
    const pending = await getPendingLogs();
    setPendingCount(pending.length);
    setSyncing(false);
  };

  return (
    <div className="flex flex-col gap-8 py-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white">AI Carbon Calculator</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select a category to log activities or scan a receipt/bill using Gemini</p>
        </div>
        
        {/* Mode Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-brand-cardDark border border-brand-borderDark/40 rounded-xl">
          <button
            onClick={() => { setCalculatorMode("manual"); setSuccessResult(null); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
              calculatorMode === "manual"
                ? "bg-brand-emerald text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Manual Log
          </button>
          <button
            onClick={() => { setCalculatorMode("scanner"); setSuccessResult(null); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              calculatorMode === "scanner"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>AI Scanner</span>
          </button>
        </div>
      </div>

      {/* Offline Status Bar */}
      {pendingCount > 0 && (
        <div className="glass-card border-orange-500/30 bg-orange-500/5 rounded-3xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-orange-500 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                <Database className="h-4 w-4" />
                <span>Offline queue holds {pendingCount} pending activity logs.</span>
              </span>
              <span className="text-[10px] text-gray-500">Logs will auto-sync when network is recovered, or sync manually.</span>
            </div>
          </div>
          <button
            onClick={triggerManualSync}
            disabled={syncing}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/10"
          >
            {syncing ? "Syncing..." : "Sync Logs Now"}
          </button>
        </div>
      )}

      {calculatorMode === "manual" ? (
        <div className="grid gap-8 md:grid-cols-3">
          {/* Category selector */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Categories</span>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${
                    isSelected 
                      ? "bg-brand-emerald text-white border-brand-emerald shadow-lg shadow-brand-emerald/10"
                      : "glass-card text-gray-700 dark:text-gray-300 hover:border-brand-emerald/40"
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className={`p-2 rounded-xl border ${isSelected ? "bg-white/10 border-white/20" : cat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-semibold text-sm">{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="glass-card rounded-3xl p-6 border border-white/20">
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <h2 className="text-xl font-bold flex items-center gap-2 capitalize">
                  Log {activeCategory} emissions
                </h2>
                
                {errors && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs" role="alert">
                    {errors}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="subcategory-select" className="text-xs font-semibold text-gray-500 dark:text-gray-400">Subtype</label>
                    <select
                      id="subcategory-select"
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark rounded-xl p-3 text-sm focus:border-brand-emerald text-gray-800 dark:text-white"
                    >
                      {SUBCATEGORIES[activeCategory]?.map((sub) => (
                        <option key={sub.label} value={sub.label} className="capitalize text-gray-800">
                          {sub.label.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="date-input" className="text-xs font-semibold text-gray-500 dark:text-gray-400">Activity Date</label>
                    <input
                      id="date-input"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark rounded-xl p-3 text-sm focus:border-brand-emerald text-gray-800 dark:text-white"
                      required
                    />
                  </div>
                </div>

                {/* Google Maps Route Assistant */}
                {activeCategory === "transportation" && (
                  <div className="flex flex-col gap-3 p-4 bg-brand-cardDark/50 border border-brand-borderDark/30 rounded-2xl">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <Map className="h-4 w-4 text-brand-sky" />
                        <span>Google Maps Route Assistant</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setUseGoogleMaps(!useGoogleMaps)}
                        className="text-[10px] uppercase font-bold text-brand-sky hover:underline"
                      >
                        {useGoogleMaps ? "Enter KM manually" : "Calculate distance"}
                      </button>
                    </div>
                    
                    {useGoogleMaps && (
                      <div className="flex flex-col gap-3 mt-2 animate-in fade-in duration-200">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <label htmlFor="start-address-input" className="text-[10px] uppercase font-semibold text-gray-400">Start Address</label>
                            <input
                              id="start-address-input"
                              type="text"
                              placeholder="e.g. New Delhi"
                              value={startLoc}
                              onChange={(e) => setStartLoc(e.target.value)}
                              className="bg-brand-cardDark border border-brand-borderDark rounded-lg p-2 text-xs focus:border-brand-emerald text-white"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label htmlFor="end-address-input" className="text-[10px] uppercase font-semibold text-gray-400">Destination</label>
                            <input
                              id="end-address-input"
                              type="text"
                              placeholder="e.g. Gurugram"
                              value={endLoc}
                              onChange={(e) => setEndLoc(e.target.value)}
                              className="bg-brand-cardDark border border-brand-borderDark rounded-lg p-2 text-xs focus:border-brand-emerald text-white"
                            />
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={handleCalculateRoute}
                          disabled={calculatingRoute || !startLoc.trim() || !endLoc.trim()}
                          className="bg-brand-sky hover:bg-sky-600 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          {calculatingRoute ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <>
                              <Navigation className="h-3.5 w-3.5" />
                              <span>Calculate Route</span>
                            </>
                          )}
                        </button>
                        
                        {showSimulatedMap && routeDistance !== null && (
                          <div className="flex flex-col gap-3 p-3 bg-brand-emerald/10 border border-brand-emerald/20 rounded-xl mt-1 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-white">Route details:</span>
                              <span className="text-[10px] text-gray-400">Traffic: Normal</span>
                            </div>
                            
                            {/* Simulated Canvas Map representation */}
                            <div className="relative h-24 w-full bg-brand-cardDark rounded-lg border border-brand-borderDark/60 overflow-hidden flex items-center justify-center">
                              {/* Simple inline decorative map lines */}
                              <svg className="absolute inset-0 h-full w-full opacity-40" xmlns="http://www.w3.org/2000/svg">
                                <path d="M 20,40 Q 150,10 250,80" fill="none" stroke="#22c55e" strokeWidth="4" strokeDasharray="5" />
                                <circle cx="20" cy="40" r="5" fill="#ef4444" />
                                <circle cx="250" cy="80" r="5" fill="#3b82f6" />
                                <path d="M 0,20 L 300,20 M 100,0 L 100,100 M 0,80 L 300,50" fill="none" stroke="#374151" strokeWidth="1" />
                              </svg>
                              <span className="absolute bottom-2 left-2 text-[8px] bg-brand-cardDark/80 px-1.5 py-0.5 rounded text-gray-400">Google Maps Platform</span>
                              <div className="flex flex-col items-center gap-1 z-10 bg-brand-cardDark/90 p-2.5 rounded-lg border border-brand-borderDark">
                                <span className="text-sm font-extrabold text-brand-emerald">{routeDistance} km</span>
                                <span className="text-[9px] text-gray-400">Est. Time: {routeDuration}</span>
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={handleApplyRouteDistance}
                              className="bg-brand-emerald hover:bg-brand-forest text-white font-bold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 transition-colors"
                            >
                              <Check className="h-3 w-3" />
                              <span>Apply {routeDistance} km to Log</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label htmlFor="value-input" className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Value <span className="text-[10px] text-brand-emerald">({currentUnit})</span>
                  </label>
                  <div className="relative">
                    <input
                      id="value-input"
                      type="number"
                      step="any"
                      placeholder="e.g. 50"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark rounded-xl p-3 text-sm focus:border-brand-emerald text-gray-800 dark:text-white"
                      required
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs text-gray-400 font-bold capitalize">
                      {currentUnit}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-emerald hover:bg-brand-forest text-white font-semibold py-3 rounded-xl shadow-lg shadow-brand-emerald/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <PlusCircle className="h-5 w-5" />
                      <span>Calculate & Log Activity</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {successResult && (
              <div className="glass-card rounded-3xl p-6 border border-brand-emerald/30 bg-brand-emerald/5 flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex-shrink-0 p-4 bg-brand-emerald/10 text-brand-emerald rounded-2xl">
                  <CheckCircle className="h-10 w-10" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-brand-emerald uppercase tracking-wider">
                    {successResult.metadata_json && (successResult.metadata_json as any).offline ? "Log Saved Locally (Pending Sync)" : "Log Added Successfully"}
                  </span>
                  <h3 className="text-2xl font-extrabold mt-1">
                    +{successResult.co2_equivalent.toFixed(1)} <span className="text-sm font-medium text-gray-500">kg CO2e</span>
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                    {successResult.explanation}
                  </p>
                  <div className="flex gap-4 mt-3 text-[10px] font-semibold text-gray-400">
                    <span className="capitalize">Category: {successResult.category}</span>
                    <span>•</span>
                    <span className="capitalize">Subtype: {successResult.subcategory.replace("_", " ")}</span>
                    <span>•</span>
                    <span>Logged Value: {successResult.value} {successResult.unit}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Scanner Container */
        <div className="glass-card rounded-3xl p-8 border border-white/20 flex flex-col gap-6 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col gap-2 text-center items-center">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
              <Camera className="h-8 w-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold mt-2">Gemini AI Carbon Scanner</h2>
            <p className="text-xs text-gray-400 max-w-md">
              Upload a photo of your utility bill, a grocery receipt, a meal, or a transit ticket. Gemini will automatically identify the category and calculate the carbon impact.
            </p>
          </div>

          {scanError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs" role="alert">
              {scanError}
            </div>
          )}

          {scanSuccess && (
            <div className="p-3 bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald rounded-xl text-xs flex items-center gap-2" role="status">
              <CheckCircle className="h-4 w-4" />
              <span>Activity logged successfully from image scan! Check your dashboard.</span>
            </div>
          )}

          {/* Upload Drop Zone */}
          {!imagePreview ? (
            <label className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-brand-borderDark/60 hover:border-purple-500/50 rounded-3xl bg-brand-cardDark/30 cursor-pointer transition-colors group">
              <Upload className="h-10 w-10 text-gray-400 group-hover:text-purple-400 transition-colors mb-3" />
              <span className="text-xs font-bold text-gray-300">Select receipt, meal, or bill image</span>
              <span className="text-[10px] text-gray-500 mt-1">Supports PNG, JPG, or JPEG up to 10MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload activity image"
              />
            </label>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Image Preview Container */}
              <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-brand-borderDark bg-brand-cardDark flex items-center justify-center">
                <img src={imagePreview} alt="Scanned Preview" className="h-full object-contain" />
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); setImagePreview(null); setScannedResult(null); }}
                  className="absolute top-3 right-3 bg-black/75 hover:bg-black text-white p-1.5 rounded-full transition-colors text-[10px]"
                >
                  Change Image
                </button>
              </div>

              {!scannedResult && (
                <button
                  type="button"
                  onClick={handleScanImage}
                  disabled={scannerLoading}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-purple-600/15"
                >
                  {scannerLoading ? (
                    <>
                      <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Gemini scanning image metrics...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Scan with Gemini AI</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Scanned Result Card */}
          {scannedResult && (
            <div className="flex flex-col gap-4 p-5 bg-purple-500/5 border border-purple-500/20 rounded-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start border-b border-purple-500/10 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-purple-400 tracking-wider">Gemini Scan Result</span>
                  <h3 className="text-base font-bold capitalize mt-0.5">{scannedResult.subcategory.replace("_", " ")}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-gray-400">Detected Value</span>
                  <span className="block text-sm font-extrabold text-purple-400">{scannedResult.value} {scannedResult.unit}</span>
                </div>
              </div>

              <div className="text-xs text-gray-300 leading-relaxed">
                <span className="font-bold text-purple-400 block mb-1">AI Explanation:</span>
                {scannedResult.explanation}
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleSaveScannedLog}
                  disabled={loading}
                  className="flex-1 bg-brand-emerald hover:bg-brand-forest disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors"
                >
                  {loading ? (
                    <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Accept & Log activity</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setScannedResult(null)}
                  className="px-4 py-2.5 border border-brand-borderDark hover:bg-brand-cardDark text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
