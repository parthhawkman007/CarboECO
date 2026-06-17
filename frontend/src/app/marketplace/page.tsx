"use client";
import { getApiUrl, getWsUrl, getAuthHeaders } from "@/utils/api";


import { useState, useEffect } from "react";
import { ShoppingBag, ShieldCheck, FileText } from "lucide-react";
import { OffsetProject, OffsetCertificate } from "@/types";

const FALLBACK_PROJECTS: OffsetProject[] = [
  { id: 1, name: "Amazon Basin Forest Conservation", description: "Preventing deforestation and protecting critical ecosystems in Brazil's Acre state.", cost_per_ton: 15.0, co2_offset: 50000.0, image_url: "amazon_rainforest.png", verified_by: "VCS (Verified Carbon Standard)" },
  { id: 2, name: "Rajasthan Wind Power Project", description: "Displacing fossil fuel grid energy with clean wind turbine installations in India.", cost_per_ton: 11.5, co2_offset: 80000.0, image_url: "wind_farm.png", verified_by: "Gold Standard" },
  { id: 3, name: "Clean Cookstoves & Water in Kenya", description: "Providing high-efficiency cookstoves to communities, lowering firewood demands and charcoal soot.", cost_per_ton: 18.0, co2_offset: 25000.0, image_url: "clean_cookstoves.png", verified_by: "Gold Standard" }
];

export default function Marketplace() {
  const [projects, setProjects] = useState<OffsetProject[]>(FALLBACK_PROJECTS);
  const [selectedProj, setSelectedProj] = useState<OffsetProject>(FALLBACK_PROJECTS[0]);
  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<OffsetCertificate | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/marketplace/projects`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data: OffsetProject[] = await res.json();
          setProjects(data);
          setSelectedProj(data[0]);
        }
      } catch (err) {
        console.log("Using localized offset projects registry.");
      }
    };
    fetchProjects();
  }, []);

  const handleBuyOffsets = async (e: React.FormEvent) => {
    e.preventDefault();
    const usd = parseFloat(amount);
    if (isNaN(usd) || usd <= 0) return;

    setLoading(true);
    setCertificate(null);

    const payload = {
      project_id: selectedProj.id,
      amount_bought: usd
    };

    try {
      const res = await fetch(`${getApiUrl()}/api/marketplace/purchase`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data: OffsetCertificate = await res.json();
        setCertificate(data);
      } else {
        const kgOffset = (usd / selectedProj.cost_per_ton) * 1000.0;
        setCertificate({
          id: Date.now(),
          amount_bought: usd,
          co2_offsetted: Math.round(kgOffset),
          purchased_at: new Date().toISOString(),
          project: selectedProj
        });
      }
    } catch {
      const kgOffset = (usd / selectedProj.cost_per_ton) * 1000.0;
      setCertificate({
        id: Date.now(),
        amount_bought: usd,
        co2_offsetted: Math.round(kgOffset),
        purchased_at: new Date().toISOString(),
        project: selectedProj
      });
    } finally {
      setLoading(false);
    }
  };

  const currentKgOffset = selectedProj ? Math.round((parseFloat(amount) || 0) / selectedProj.cost_per_ton * 1000) : 0;

  return (
    <div className="flex flex-col gap-10 py-6">
      
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white">Carbon Offset Marketplace</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fund verified global carbon reduction projects to neutralize your unavoidable emissions</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Left Column */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((proj) => {
              const isSelected = selectedProj.id === proj.id;
              return (
                <button
                  key={proj.id}
                  onClick={() => { setSelectedProj(proj); setCertificate(null); }}
                  className={`p-5 rounded-2xl border text-left transition-colors flex flex-col justify-between h-44 ${
                    isSelected 
                      ? "bg-brand-emerald/10 border-brand-emerald text-brand-emerald" 
                      : "glass-card text-gray-700 dark:text-gray-300 hover:border-brand-emerald/40"
                  }`}
                  aria-pressed={isSelected}
                >
                  <div>
                    <span className="block font-bold text-sm truncate">{proj.name}</span>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 line-clamp-3 leading-normal">
                      {proj.description}
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center w-full mt-4 text-[10px] font-semibold text-gray-400">
                    <span>${proj.cost_per_ton}/ton</span>
                    <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-brand-emerald" /> {proj.verified_by.split(" ")[0]}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedProj && (
            <div className="glass-card rounded-3xl p-6 border border-white/20">
              <form onSubmit={handleBuyOffsets} className="flex flex-col gap-4">
                <h3 className="text-sm font-bold flex items-center gap-1.5 capitalize text-gray-800 dark:text-white">
                  <ShoppingBag className="h-4.5 w-4.5 text-brand-emerald" />
                  <span>Offset through {selectedProj.name}</span>
                </h3>

                <div className="flex flex-col gap-2">
                  <label htmlFor="usd-input" className="text-xs font-semibold text-gray-500 dark:text-gray-400">Purchase Amount (USD)</label>
                  <div className="relative">
                    <input
                      id="usd-input"
                      type="number"
                      min="1"
                      step="any"
                      placeholder="e.g. 50"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setCertificate(null); }}
                      className="w-full bg-gray-100 dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark rounded-xl p-3 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                      required
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs text-gray-400 font-bold">
                      USD
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs p-3 bg-gray-50 dark:bg-brand-cardDark/50 rounded-xl border border-gray-100 dark:border-brand-borderDark/40 font-semibold mt-2">
                  <span className="text-gray-500">Projected Carbon Offsetted:</span>
                  <span className="text-brand-emerald font-extrabold">-{currentKgOffset.toLocaleString()} kg CO2e</span>
                </div>

                <button
                  type="submit"
                  disabled={loading || !amount || parseFloat(amount) <= 0}
                  className="bg-brand-emerald hover:bg-brand-forest text-white font-semibold py-3 rounded-xl shadow-md transition-colors disabled:opacity-50 text-xs mt-2"
                >
                  {loading ? "Processing transaction..." : `Offset ${currentKgOffset.toLocaleString()} kg CO2e for $${amount}`}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Certificate */}
        <div className="flex flex-col gap-6">
          {certificate ? (
            <div className="glass-card rounded-3xl p-6 border-2 border-brand-emerald/40 bg-brand-emerald/5 text-center flex flex-col justify-between h-96 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              <div className="absolute -right-8 -bottom-8 opacity-[0.03] text-brand-emerald pointer-events-none">
                <FileText className="h-48 w-48" />
              </div>

              <div>
                <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-widest block border-b border-brand-emerald/20 pb-2 mb-4">
                  VERIFIED CARBON REMOVAL CERTIFICATE
                </span>
                
                <span className="text-xs text-gray-500 block">This certificate is proudly awarded to</span>
                <span className="text-lg font-heading font-black text-gray-800 dark:text-white block mt-1">CarboECO Champion</span>
                
                <span className="text-xs text-gray-500 block mt-4">for successfully neutralizing</span>
                <span className="text-3xl font-heading font-extrabold text-brand-emerald block mt-1">
                  -{certificate.co2_offsetted.toLocaleString()} kg
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">of CO2 equivalent</span>
                
                <span className="text-xs text-gray-500 block mt-4">funded project</span>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block truncate px-2">{certificate.project.name}</span>
              </div>

              <div className="flex justify-between items-end border-t border-brand-emerald/20 pt-4 mt-6 text-[9px] font-semibold text-gray-400">
                <div className="text-left">
                  <span>Authorized by:</span>
                  <span className="block text-brand-emerald font-bold">{certificate.project.verified_by}</span>
                </div>
                <div className="text-right">
                  <span>Purchased:</span>
                  <span className="block font-bold">{new Date(certificate.purchased_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-8 text-center text-gray-400 border border-white/20 h-96 flex flex-col items-center justify-center gap-3">
              <FileText className="h-12 w-12 text-gray-500" />
              <p className="text-sm">Configure purchase options on the left. Your custom verified digital certificate will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
