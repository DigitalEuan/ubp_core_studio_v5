import React, { useMemo } from 'react';

interface GLMConstellationProps {
    stateJson: string; // The JSON string of idea_state
}

export const GLMConstellation: React.FC<GLMConstellationProps> = ({ stateJson }) => {
    const data = useMemo(() => {
        try {
            return JSON.parse(stateJson);
        } catch (e) {
            return null;
        }
    }, [stateJson]);

    if (!data || !data.colour) {
        return <div className="text-gray-500 font-mono text-xs">Awaiting metatheoretical state...</div>;
    }

    const { primary, secondary, blend, nrci, mog, evidence_count } = data.colour;
    
    // Determine the active thesis text
    let thesis = "Unknown Concept";
    let isCrystallized = false;
    if (data.manager && data.manager.zones && data.manager.active_idx !== -1) {
        const activeZone = data.manager.zones[data.manager.active_idx];
        if (activeZone && activeZone.thesis) {
            thesis = activeZone.thesis;
            isCrystallized = activeZone.crystallized;
        }
    }

    return (
        <div className="flex flex-col items-center justify-center gap-6 w-full h-full relative p-6">
            {/* Ambient Background Glow based on blend */}
            <div 
               className="absolute inset-0 opacity-20 pointer-events-none rounded-xl"
               style={{
                   background: `radial-gradient(circle at center, ${blend} 0%, transparent 70%)`
               }}
            />

            <div className="text-center z-10">
               <h3 className="text-xl font-bold font-mono tracking-widest uppercase mb-1 drop-shadow-md" style={{ color: primary }}>
                  {thesis}
               </h3>
               <div className="text-[10px] text-gray-400 font-mono tracking-widest uppercase opacity-80">
                  {mog} • {isCrystallized ? "Crystallized" : "Amorphous"}
               </div>
            </div>

            {/* Constellation Canvas (CSS abstract art) */}
            <div className="relative w-48 h-48 flex items-center justify-center z-10 my-4">
                {/* Orbital Rings */}
                <div className="absolute inset-0 border border-white/5 rounded-full animate-[spin_60s_linear_infinite]" />
                <div className="absolute inset-4 border border-white/10 rounded-full animate-[spin_40s_linear_infinite_reverse]" />
                
                {/* Core Idea Node */}
                <div 
                   className="absolute w-12 h-12 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center transition-all duration-1000"
                   style={{ 
                       backgroundColor: primary,
                       boxShadow: `0 0 30px ${primary}80` 
                   }}
                >
                   <div className="w-8 h-8 rounded-full border-2 border-black/30" />
                </div>

                {/* Evidence Nodes */}
                {evidence_count > 0 && Array.from({ length: Math.min(evidence_count, 12) }).map((_, i) => {
                    const angle = (i / Math.min(evidence_count, 12)) * 360;
                    const radius = 60 + (i % 3) * 10;
                    return (
                        <div 
                           key={i}
                           className="absolute w-3 h-3 rounded-full transition-all duration-1000"
                           style={{
                               transform: `rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)`,
                               backgroundColor: i === 0 ? secondary : blend,
                               boxShadow: `0 0 10px ${i === 0 ? secondary : blend}80`
                           }}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-sm z-10 mt-2">
                <div className="bg-black/60 border border-gray-800 rounded p-2 text-center">
                   <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Primary</div>
                   <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: primary }} />
                      <span className="font-mono text-xs" style={{ color: primary }}>{primary}</span>
                   </div>
                </div>
                <div className="bg-black/60 border border-gray-800 rounded p-2 text-center">
                   <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Secondary</div>
                   <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: secondary }} />
                      <span className="font-mono text-xs" style={{ color: secondary }}>{secondary}</span>
                   </div>
                </div>
                <div className="bg-black/60 border border-gray-800 rounded p-2 text-center">
                   <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Blend</div>
                   <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: blend }} />
                      <span className="font-mono text-xs" style={{ color: blend }}>{blend}</span>
                   </div>
                </div>
                <div className="bg-black/60 border border-gray-800 rounded p-2 text-center">
                   <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">NRCI Coherence</div>
                   <div className="font-mono text-xs text-blue-300">{(nrci * 100).toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
};
