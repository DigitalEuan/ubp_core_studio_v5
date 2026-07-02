import React, { useMemo, useState } from 'react';
import { Search, Plus, Trash2, Edit2, GitCompare, Database, RefreshCw, Layers, Bookmark, HardDrive, ArrowRightLeft, Sparkles, HelpCircle } from 'lucide-react';

interface MemoryStatusProps {
  systemKb: string;
  langKb?: string;
  hashMemoryKb: string;
  beliefsKb: string;
  studyKb?: string;
  onSyncGitHub?: () => void;
  setSystemKb: (val: string) => void;
  setLangKb?: (val: string) => void;
  setHashMemoryKb: (val: string) => void;
  setBeliefsKb: (val: string) => void;
  setStudyKb?: (val: string) => void;
}

interface KBEntry {
  id: string;
  lexicon: string;
  tags: string[];
  nrci: number;
  tax: string;
  tier: 'Identity' | 'Stable' | 'Zombie' | 'Off-Lattice';
  domain: 'IMPERATIVE' | 'SUBSTANCE' | 'QUANTITY' | 'ALGORITHM' | 'MECHANISM' | 'ORGANISM' | 'ENTROPY' | 'MEANING' | 'UNCATEGORIZED';
  vector: number[];
  hash: string;
  source: string;
}

export const MemoryStatus: React.FC<MemoryStatusProps> = ({
  systemKb,
  langKb,
  hashMemoryKb,
  beliefsKb,
  studyKb,
  onSyncGitHub,
  setSystemKb,
  setLangKb,
  setHashMemoryKb,
  setBeliefsKb,
  setStudyKb,
}) => {
  // Navigation & filter UI States
  const [activeTab, setActiveTab] = useState<'browse' | 'compare'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('All');
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [selectedTier, setSelectedTier] = useState<string>('All');

  // Selected Entry and Form states
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNew, setIsEditingNew] = useState(false);

  // Custom new KB sources tracked in local state
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [newSourceName, setNewSourceName] = useState('');

  // Version comparer select sources
  const [compareLeftSource, setCompareLeftSource] = useState<string>('System KB');
  const [compareRightSource, setCompareRightSource] = useState<string>('Language KB');

  // Form bindings
  const [formId, setFormId] = useState('');
  const [formSource, setFormSource] = useState('System KB');
  const [formDomain, setFormDomain] = useState<KBEntry['domain']>('SUBSTANCE');
  const [formTier, setFormTier] = useState<KBEntry['tier']>('Stable');
  const [formLexicon, setFormLexicon] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [formVector, setFormVector] = useState<number[]>(Array(24).fill(0));
  const [formTax, setFormTax] = useState('0/1');
  const [formNrci, setFormNrci] = useState(1.0);

  // Helper: Categorize based on tags/id/content
  const inferDomain = (id: string, name: string, tags: string[] = []): KBEntry['domain'] => {
    const upperId = String(id || '').toUpperCase().trim();
    const combined = [...(tags || []), name].map(s => String(s || '').toUpperCase().trim());
    
    if (upperId.startsWith('LAW_')) return 'IMPERATIVE';
    if (combined.includes('SUBSTANCE')) return 'SUBSTANCE';
    if (combined.includes('ORGANISM')) return 'ORGANISM';
    if (combined.includes('ALGORITHM')) return 'ALGORITHM';
    if (combined.includes('QUANTITY')) return 'QUANTITY';
    if (combined.includes('MECHANISM')) return 'MECHANISM';
    if (combined.includes('IMPERATIVE')) return 'IMPERATIVE';
    if (combined.includes('ENTROPY')) return 'ENTROPY';
    if (combined.includes('MEANING')) return 'MEANING';

    if (combined.some(s => s === 'ENGLISH' || s === 'VOCABULARY' || s.includes('VOCAB') || s === 'EPISTEMIC' || s === 'CATEGORICAL')) return 'MEANING';
    if (combined.some(s => s === 'PHYSICS' || s === 'EARTH' || s.includes('EARTH_SCIENCE') || s === 'THERMAL' || s === 'NUCLEAR' || s === 'ACTION' || s === 'PHASE_TRANSITION')) return 'MECHANISM';
    if (combined.some(s => s === 'MATH' || s === 'MATHEMATICS' || s === 'TOPOLOGY' || s.includes('SCALE') || s.includes('NUMERIC') || s === 'COMPARISON' || s === 'COMPARATOR')) return 'QUANTITY';
    if (combined.some(s => s === 'CHEMISTRY' || s === 'BONDING' || s === 'MASS' || s === 'STATE' || s === 'PROPERTY' || s === 'STRUCTURAL')) return 'SUBSTANCE';
    if (combined.some(s => s === 'PSYCHOLOGY' || s === 'BIOLOGY')) return 'ORGANISM';
    if (combined.some(s => s === 'PYTHON' || s === 'CS' || s === 'COMPUTER SCIENCE' || s === 'OPERATOR' || s === 'INFORMATION' || s === 'PROCESS' || s === 'LOGIC')) return 'ALGORITHM';

    if (combined.some(s => s.includes('LAW') || s.includes('RULE') || s.includes('AXIOM') || s.includes('STANDARD') || s.includes('PRINCIPLE') || s.includes('REQ') || s.includes('PROTOCOL') || s.includes('COMMAND'))) return 'IMPERATIVE';
    if (combined.some(s => s.includes('ELEMENT') || s.includes('PERIODIC') || s.includes('METAL') || s.includes('GAS') || s.includes('LIQUID') || s.includes('MATTER') || s.includes('ATOM') || s.includes('MOLECULE') || s.includes('CHEMICAL') || s.includes('MINERAL') || s.includes('PLASTIC') || s.includes('GRAPHENE') || s.startsWith('MAT_') || s.startsWith('ELEM_'))) return 'SUBSTANCE';
    if (combined.some(s => s.includes('BIO') || s.includes('LIFE') || s.includes('CELL') || s.includes('DNA') || s.includes('ORGANIC') || s.includes('ANIMAL') || s.includes('PLANT') || s.includes('FUNGUS') || s.includes('HEALTH') || s.includes('NEURO') || s.includes('BODY') || s.includes('CANCER'))) return 'ORGANISM';
    if (combined.some(s => s.includes('ALGO') || s.includes('CODE') || s.includes('LOGIC') || s.includes('COMPUTE') || s.includes('DATA') || s.includes('PROCESS') || s.includes('FUNCTION') || s.includes('NETWORK') || s.includes('SYSTEM') || s.includes('INFO') || s.includes('FRACTAL'))) return 'ALGORITHM';
    if (combined.some(s => s.includes('NUM') || s.includes('CONST') || s.includes('UNIT') || s.includes('MEASURE') || s.includes('VALUE') || s.includes('RATIO') || s.includes('METRIC') || s.includes('COORDINATE') || s.includes('DIMENSION') || s.includes('GEOMETRY') || s.includes('SHAPE') || s.startsWith('BIN_'))) return 'QUANTITY';
    if (combined.some(s => s.includes('MECH') || s.includes('PHYS') || s.includes('ENERGY') || s.includes('FORCE') || s.includes('MOTION') || s.includes('WAVE') || s.includes('PARTICLE') || s.includes('REACT') || s.includes('KINETIC'))) return 'MECHANISM';
    if (combined.some(s => s.includes('CHAOS') || s.includes('VOID') || s.includes('NULL') || s.includes('ERROR') || s.includes('DECAY') || s.includes('NOISE') || s.includes('UNKNOWN') || s.includes('RANDOM'))) return 'ENTROPY';
    if (combined.some(s => s.includes('WORD') || s.includes('TERM') || s.includes('SEMANTIC') || s.includes('CONCEPT') || s.includes('IDEA') || s.includes('SYMBOL') || s.includes('DEFINITION') || s.includes('LANG'))) return 'MEANING';

    return 'UNCATEGORIZED';
  };

  // Helper: Infer stability tier based on NRCI score or weight
  const inferTier = (nrci: number): KBEntry['tier'] => {
    if (nrci >= 0.95) return 'Identity';
    if (nrci >= 0.70) return 'Stable';
    if (nrci >= 0.45) return 'Zombie';
    return 'Off-Lattice';
  };

  // --- PARSE MASTER DATABASE ---
  const allEntries = useMemo(() => {
    const list: KBEntry[] = [];

    const loadJSONKb = (kbString: string, sourceName: string) => {
      try {
        if (!kbString || kbString.trim() === '') return;
        const json = JSON.parse(kbString);
        let rawList: any[] = [];
        if (Array.isArray(json)) {
          rawList = json;
        } else if (json.entries) {
          rawList = Array.isArray(json.entries) ? json.entries : Object.values(json.entries);
        } else {
          rawList = Object.values(json);
        }

        rawList.forEach((item: any, index) => {
          let id = `ITEM_${index}`;
          let lex = 'No Description';
          let tags: string[] = [];
          let nrciVal = 0.76;
          let taxVal = '1/1';
          let vectorVal: number[] = Array(24).fill(0).map(() => (Math.random() > 0.5 ? 1 : 0));
          let hashVal = `${id}_hash`;

          if (Array.isArray(item)) {
            id = item[0] || `ITEM_${index}`;
            lex = item[1] || 'No Lexicon';
            tags = Array.isArray(item[2]) ? item[2] : [];
            vectorVal = Array.isArray(item[3]) ? item[3] : vectorVal;
            nrciVal = typeof item[5] === 'number' ? item[5] : nrciVal;
            taxVal = item[6] || taxVal;
          } else {
            id = item.ubp_id || item.id || `ITEM_${index}`;
            lex = item.lexicon || item.name || item.description || 'Untitled';
            tags = Array.isArray(item.tags) ? item.tags : [];
            vectorVal = Array.isArray(item.vector) ? item.vector : vectorVal;
            nrciVal = typeof item.nrci === 'number' ? item.nrci : (item.atlas?.nrci_score ?? (item.nrci_score ?? nrciVal));
            taxVal = item.tax || (item.atlas?.tax_ratio ?? (item.tax_str ?? taxVal));
            hashVal = item.hash || item.fingerprint || hashVal;
          }

          const resolvedDomain = inferDomain(id, lex, tags);
          const resolvedTier = inferTier(nrciVal);

          list.push({
            id,
            lexicon: lex,
            tags,
            nrci: nrciVal,
            tax: taxVal,
            tier: resolvedTier,
            domain: resolvedDomain,
            vector: vectorVal,
            hash: hashVal,
            source: sourceName,
          });
        });
      } catch (e) {
        // Fallback line-by-line parsing
        const lines = (kbString || "").split('\n');
        lines.forEach((line, idx) => {
          if (line.trim().startsWith('{')) {
            try {
              const item = JSON.parse(line.trim().replace(/,$/, ''));
              const id = item.ubp_id || item.id || `L_LINE_${idx}`;
              const lex = item.lexicon || item.name || item.description || 'Untitled';
              const tags = item.tags || [];
              const vectorVal = item.vector || Array(24).fill(0);
              const nrciVal = item.nrci || 0.70;
              list.push({
                id,
                lexicon: lex,
                tags,
                nrci: nrciVal,
                tax: item.tax || '0/1',
                tier: inferTier(nrciVal),
                domain: inferDomain(id, lex, tags),
                vector: vectorVal,
                hash: item.fingerprint || `line_${idx}`,
                source: sourceName,
              });
            } catch (err) {}
          }
        });
      }
    };

    // Load each potential source
    loadJSONKb(systemKb, 'System KB');
    if (langKb) loadJSONKb(langKb, 'Language KB');
    loadJSONKb(hashMemoryKb, 'Hash Memory KB');
    loadJSONKb(beliefsKb, 'Beliefs KB');

    // Load Study KB
    if (studyKb) {
      const lines = studyKb.split('\n');
      lines.forEach((line, idx) => {
        const match = line.match(/^\- \[(.*?)\] \*\*(.*?)\*\*: (.*)/);
        if (match) {
          const tagsStr = match[1] || "";
          const id = match[2];
          const content = match[3];
          const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];
          list.push({
            id,
            lexicon: content,
            tags,
            nrci: 0.68,
            tax: '26/40',
            tier: 'Zombie',
            domain: inferDomain(id, content, tags),
            vector: Array(24).fill(0).map((_, i) => (i < 12 ? 1 : 0)),
            hash: `study_${idx}`,
            source: 'Study KB',
          });
        }
      });
    }

    // Deduplicate lists by id + source to prevent React duplicate key warnings when duplicate nodes are imported or fetched from remote repo
    const uniqueList: KBEntry[] = [];
    const seen = new Set<string>();
    for (const entry of list) {
      const keySig = `${entry.id}_${entry.source}`;
      if (!seen.has(keySig)) {
        seen.add(keySig);
        uniqueList.push(entry);
      }
    }

    return uniqueList;
  }, [systemKb, langKb, hashMemoryKb, beliefsKb, studyKb]);

  // Compute total available KB sources (including custom ones)
  const availableSources = useMemo(() => {
    const base = ['System KB', 'Language KB', 'Hash Memory KB', 'Beliefs KB', 'Study KB'];
    return Array.from(new Set([...base, ...customSources, ...allEntries.map(e => e.source)]));
  }, [allEntries, customSources]);

  // Dynamic filter application
  const filteredEntries = useMemo(() => {
    return allEntries.filter(e => {
      const matchesSearch = searchQuery === '' || 
        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.lexicon.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSource = selectedSource === 'All' || e.source === selectedSource;
      const matchesDomain = selectedDomain === 'All' || e.domain === selectedDomain;
      const matchesTier = selectedTier === 'All' || e.tier === selectedTier;

      return matchesSearch && matchesSource && matchesDomain && matchesTier;
    });
  }, [allEntries, searchQuery, selectedSource, selectedDomain, selectedTier]);

  // Selected single entry detail representation
  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null;
    return allEntries.find(e => e.id === selectedEntryId) || null;
  }, [allEntries, selectedEntryId]);

  // Calculating Tier Distribution metrics for Custom SVG Doughnut Chart
  const tierStats = useMemo(() => {
    const stats = { Identity: 0, Stable: 0, Zombie: 0, 'Off-Lattice': 0 };
    filteredEntries.forEach(e => {
      if (stats[e.tier] !== undefined) stats[e.tier]++;
    });
    const total = Object.values(stats).reduce((a, b) => a + b, 0);

    return Object.entries(stats).map(([tier, count]) => ({
      tier: tier as KBEntry['tier'],
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    }));
  }, [filteredEntries]);

  // --- MUTABLE OPERATIONS & SERIALIZERS ---
  
  // Re-serialize state and propagate to parent App.tsx state setters
  const saveAllToAppCore = (updatedList: KBEntry[]) => {
    // 1. System KB Filter -> Object List serialization
    const sysItems = updatedList.filter(e => e.source === 'System KB');
    const sysJSON = JSON.stringify(sysItems.map(e => ({
      ubp_id: e.id,
      lexicon: e.lexicon,
      tags: e.tags,
      vector: e.vector,
      nrci: e.nrci,
      tax: e.tax,
      tier: e.tier,
      domain: e.domain,
    })), null, 2);
    setSystemKb(sysJSON);

    // 2. Language KB Filter
    if (setLangKb) {
      const langItems = updatedList.filter(e => e.source === 'Language KB');
      const langJSON = JSON.stringify(langItems.map(e => ({
        ubp_id: e.id,
        lexicon: e.lexicon,
        tags: e.tags,
        vector: e.vector,
        nrci: e.nrci,
        tax: e.tax,
        tier: e.tier,
        domain: e.domain,
      })), null, 2);
      setLangKb(langJSON);
    }

    // 3. Hash Memory KB Filter
    const hashItems = updatedList.filter(e => e.source === 'Hash Memory KB');
    const hashJSON = JSON.stringify(hashItems.map(e => ({
      id: e.id,
      lexicon: e.lexicon,
      tags: e.tags,
      vector: e.vector,
      nrci: e.nrci,
      tax: e.tax,
      tier: e.tier,
      domain: e.domain,
    })), null, 2);
    setHashMemoryKb(hashJSON);

    // 4. Beliefs KB Filter
    const beliefItems = updatedList.filter(e => e.source === 'Beliefs KB');
    const beliefJSON = JSON.stringify(beliefItems.map(e => ({
      ubp_id: e.id,
      description: e.lexicon,
      tags: e.tags,
      vector: e.vector,
      nrci_score: e.nrci,
    })), null, 2);
    setBeliefsKb(beliefJSON);

    // 5. Study KB (Markdown serialization)
    if (setStudyKb) {
      const studyItems = updatedList.filter(e => e.source === 'Study KB');
      let studyMd = `# UBP Study Knowledge Base\n## Active Study: [Using the UBP]\n\n`;
      studyItems.forEach(e => {
        studyMd += `- [${e.tags.join(', ')}] **${e.id}**: ${e.lexicon}\n`;
      });
      setStudyKb(studyMd);
    }
  };

  const handleUpdateEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim()) return;

    const listCopy = [...allEntries];
    const matchIdx = listCopy.findIndex(item => item.id === selectedEntryId && item.source === formSource);

    const updatedEntry: KBEntry = {
      id: formId.trim(),
      lexicon: formLexicon,
      tags: formTags,
      nrci: formNrci,
      tax: formTax,
      tier: formTier,
      domain: formDomain,
      vector: formVector,
      hash: selectedEntry?.hash || `hash_${Date.now()}`,
      source: formSource,
    };

    if (matchIdx !== -1) {
      listCopy[matchIdx] = updatedEntry;
    } else {
      listCopy.push(updatedEntry);
    }

    saveAllToAppCore(listCopy);
    setSelectedEntryId(updatedEntry.id);
    setIsEditing(false);
    setIsEditingNew(false);
  };

  const handleCreateNewBtnClick = () => {
    setFormId('NEW_ENTRY_' + Date.now().toString().slice(-4));
    setFormSource(selectedSource !== 'All' ? selectedSource : 'System KB');
    setFormDomain('SUBSTANCE');
    setFormTier('Stable');
    setFormLexicon('');
    setFormTags(['NEW_GRID']);
    setFormVector(Array(24).fill(0));
    setFormTax('0/1');
    setFormNrci(1.0);
    setIsEditingNew(true);
    setIsEditing(true);
    setSelectedEntryId(null);
  };

  const handleDeleteEntry = (id: string, s: string) => {
    if (!window.confirm(`Delete entry "${id}" from ${s}?`)) return;
    const filtered = allEntries.filter(e => !(e.id === id && e.source === s));
    saveAllToAppCore(filtered);
    setSelectedEntryId(null);
  };

  // Trigger editing values setup
  const startEditingMode = (entry: KBEntry) => {
    setFormId(entry.id);
    setFormSource(entry.source);
    setFormDomain(entry.domain);
    setFormTier(entry.tier);
    setFormLexicon(entry.lexicon);
    setFormTags(entry.tags);
    setFormVector(entry.vector);
    setFormTax(entry.tax);
    setFormNrci(entry.nrci);
    setIsEditingNew(false);
    setIsEditing(true);
  };

  const handleAddNewKbSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSourceName.trim() && !availableSources.includes(newSourceName.trim())) {
      setCustomSources(prev => [...prev, newSourceName.trim()]);
      setSelectedSource(newSourceName.trim());
      setNewSourceName('');
    }
  };

  // --- INTERACTIVE 24-BIT VECTOR METRICS RE-CALCULATOR ---
  const toggleVectorBit = (bitIndex: number) => {
    const updated = [...formVector];
    updated[bitIndex] = updated[bitIndex] === 1 ? 0 : 1;
    setFormVector(updated);

    // Compute updated tax & nrci based on UBP Octad formula:
    const H = updated.filter(b => b === 1).length;
    const computedTax = H * 0.207 + H * 0.125;
    const computedNrci = 10 / (10 + computedTax);

    setFormNrci(Math.round(computedNrci * 10000) / 10000);
    setFormTier(inferTier(computedNrci));

    const denom = 120;
    const num = Math.round(computedTax * denom);
    setFormTax(`${num}/${denom}`);
  };

  // --- CROSS-KB VERSION COMPARISON AND CROSS-ALIGNS ---
  const comparisonResults = useMemo(() => {
    const leftList = allEntries.filter(e => e.source === compareLeftSource);
    const rightList = allEntries.filter(e => e.source === compareRightSource);

    const leftMap = new Map(leftList.map(e => [e.id, e]));
    const rightMap = new Map(rightList.map(e => [e.id, e]));

    const differing: { id: string; left: KBEntry; right: KBEntry }[] = [];
    const leftOnly: KBEntry[] = [];
    const rightOnly: KBEntry[] = [];

    // Find differing or left-only
    leftList.forEach(leftItem => {
      const rightItem = rightMap.get(leftItem.id);
      if (rightItem) {
        const hasDiff = leftItem.lexicon !== rightItem.lexicon || 
          JSON.stringify(leftItem.tags) !== JSON.stringify(rightItem.tags) ||
          JSON.stringify(leftItem.vector) !== JSON.stringify(rightItem.vector);
        if (hasDiff) {
          differing.push({ id: leftItem.id, left: leftItem, right: rightItem });
        }
      } else {
        leftOnly.push(leftItem);
      }
    });

    // Find right-only
    rightList.forEach(rightItem => {
      if (!leftMap.has(rightItem.id)) {
        rightOnly.push(rightItem);
      }
    });

    return { differing, leftOnly, rightOnly };
  }, [allEntries, compareLeftSource, compareRightSource]);

  // Synchronize dynamic copy operations across Left / Right KBs
  const copyEntryAcrossSource = (entryToCopy: KBEntry, targetSource: string) => {
    const listCopy = [...allEntries];
    const targetIdx = listCopy.findIndex(e => e.id === entryToCopy.id && e.source === targetSource);

    const copiedEntry: KBEntry = {
      ...entryToCopy,
      source: targetSource,
    };

    if (targetIdx !== -1) {
      listCopy[targetIdx] = copiedEntry;
    } else {
      listCopy.push(copiedEntry);
    }

    saveAllToAppCore(listCopy);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a16] border border-blue-900/30 rounded-lg overflow-hidden select-none text-[13px] text-[#e4e4f8]" id="ubp-memory-workbench">
      
      {/* Upper Unified Tab Navigation */}
      <div className="flex justify-between items-center px-4 bg-[#101028] border-b border-[#252548]" id="kb-browser-navbar">
        <div className="flex gap-4">
          <button
            onClick={() => { setActiveTab('browse'); setIsEditing(false); }}
            className={`py-3 px-1 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'browse' ? 'border-[#4f72ff] text-white' : 'border-transparent text-[#6868a0] hover:text-white'
            }`}
            type="button"
          >
            <Database className="w-3.5 h-3.5 text-[#4f72ff]" />
            KB Browser Dashboard
          </button>
          <button
            onClick={() => { setActiveTab('compare'); setIsEditing(false); }}
            className={`py-3 px-1 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'compare' ? 'border-[#4f72ff] text-white' : 'border-transparent text-[#6868a0] hover:text-white'
            }`}
            type="button"
          >
            <GitCompare className="w-3.5 h-3.5 text-[#ff9933]" />
            Version Comparer
          </button>
        </div>

        {onSyncGitHub && (
          <button
            onClick={onSyncGitHub}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#181835] hover:bg-[#1e1e40] border border-[#2e2e5a] text-[#4f72ff] hover:text-white text-[10.5px] uppercase font-bold tracking-wider rounded transition-colors cursor-pointer"
            title="Sync with Remote Master Repository"
            type="button"
          >
            <RefreshCw className="w-3 h-3 text-[#4f72ff]" />
            Sync GitHub
          </button>
        )}
      </div>

      {activeTab === 'browse' ? (
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT FILTER & ANALYTICS SIDEBAR */}
          <div className="w-[240px] bg-[#101028] border-r border-[#252548] p-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
            
            {/* Source KB selector */}
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <label className="text-[9px] uppercase font-black tracking-widest text-[#6868a0] flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-[#4f72ff]" />
                Source Database
              </label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full bg-[#181835] border border-[#2e2e5a] text-white rounded p-1.5 outline-none focus:border-[#4f72ff] font-sans"
              >
                <option value="All">All KBs Combined</option>
                {availableSources.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>

            {/* Geometric Domain */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-black tracking-widest text-[#6868a0] flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#bb44ff]" />
                Geometric Domain
              </label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full bg-[#181835] border border-[#2e2e5a] text-white rounded p-1.5 outline-none focus:border-[#4f72ff] font-sans"
              >
                <option value="All">All Domains</option>
                <option value="IMPERATIVE">IMPERATIVE</option>
                <option value="SUBSTANCE">SUBSTANCE</option>
                <option value="QUANTITY">QUANTITY</option>
                <option value="ALGORITHM">ALGORITHM</option>
                <option value="MECHANISM">MECHANISM</option>
                <option value="ORGANISM">ORGANISM</option>
                <option value="ENTROPY">ENTROPY</option>
                <option value="MEANING">MEANING</option>
              </select>
            </div>

            {/* Stability Tier */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-black tracking-widest text-[#6868a0] flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-[#22cc88]" />
                Stability Tier
              </label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="w-full bg-[#181835] border border-[#2e2e5a] text-white rounded p-1.5 outline-none focus:border-[#4f72ff] font-sans"
              >
                <option value="All">All Tiers</option>
                <option value="Identity">Identity (Pure Symmetry)</option>
                <option value="Stable">Stable Resonance</option>
                <option value="Zombie">Zombie Decay</option>
                <option value="Off-Lattice">Off-Lattice Divergence</option>
              </select>
            </div>

            {/* Chart showing tier distribution */}
            <div className="border-t border-[#2e2e5a] pt-4">
              <span className="text-[9px] uppercase font-black tracking-widest text-[#6868a0] block mb-2">TIER DISTRIBUTION</span>
              <div className="flex items-center justify-center p-2 relative h-[100px] w-full">
                
                {/* Custom SVG Radial Doughnut */}
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[#181835]"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    fill="none"
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {tierStats.reduce((accum, curr, idx) => {
                    const colors = ['#bb44ff', '#22cc88', '#ff9933', '#ff4466'];
                    const length = curr.percent;
                    const offset = accum.offset;
                    const strokeDash = `${length} ${100 - length}`;
                    accum.paths.push(
                      <path
                        key={idx}
                        stroke={colors[idx % colors.length]}
                        strokeWidth="3.2"
                        strokeDasharray={strokeDash}
                        strokeDashoffset={-offset}
                        fill="none"
                        d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    );
                    accum.offset += length;
                    return accum;
                  }, { offset: 0, paths: [] as React.ReactNode[] }).paths}
                </svg>
                <div className="absolute text-[11px] font-mono text-center">
                  <div className="text-white font-bold">{filteredEntries.length}</div>
                  <div className="text-[#6868a0] text-[8px] uppercase font-black">Nodes</div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-2 space-y-1 text-[10px] font-mono">
                {tierStats.map((stat, idx) => {
                  const colors = ['border-[#bb44ff] bg-[#bb44ff]', 'border-[#22cc88] bg-[#22cc88]', 'border-[#ff9933] bg-[#ff9933]', 'border-[#ff4466] bg-[#ff4466]'];
                  return (
                    <div key={stat.tier} className="flex justify-between items-center text-[#9090b8]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full border ${colors[idx % colors.length]} bg-opacity-20`} />
                        <span>{stat.tier}</span>
                      </div>
                      <span className="text-white font-bold">{stat.count} ({stat.percent.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom KB Creator */}
            <form onSubmit={handleAddNewKbSource} className="border-t border-[#2e2e5a] pt-4 flex flex-col gap-2">
              <label className="text-[9px] uppercase font-black tracking-widest text-[#6868a0]">Add Custom KB</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. Patent KB"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="flex-1 bg-[#181835] border border-[#2e2e5a] rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-2 bg-[#4f72ff] hover:bg-[#6a8bff] text-black font-extrabold rounded text-xs cursor-pointer"
                >
                  +
                </button>
              </div>
            </form>

            <button
              onClick={handleCreateNewBtnClick}
              className="w-full mt-auto py-2 bg-gradient-to-r from-[#22cc88] to-[#4f72ff] hover:brightness-110 text-black text-xs font-black uppercase rounded tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
              type="button"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" /> Create New Node
            </button>
          </div>

          {/* MAIN GRID VIEW */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#090916]">
            
            {/* Search Box / Filter Summary */}
            <div className="p-3 bg-[#101028] border-b border-[#252548] flex justify-between items-center gap-4 flex-shrink-0">
              <div className="flex-1 max-w-[400px] relative">
                <input
                  type="search"
                  placeholder="Filtered ID, tags, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#181835] border border-[#2e2e5a] text-[#e4e4f8] text-xs pl-8 pr-32 py-1.5 rounded focus:outline-none focus:border-[#4f72ff]"
                />
                <Search className="w-3.5 h-3.5 text-[#6868a0] absolute left-2.5 top-2.5" />
              </div>
              <div className="text-xs text-[#6868a0] font-mono">
                Total Loaded: <strong className="text-white">{allEntries.length}</strong> | Filtered: <strong className="text-white">{filteredEntries.length}</strong>
              </div>
            </div>

            {/* List / Table grid */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead>
                  <tr className="bg-[#101028]/80 backdrop-blur sticky top-0 border-b border-[#252548] text-[#6868a0] uppercase tracking-widest text-[9px]">
                    <th className="p-2.5 pl-5">UBP ID</th>
                    <th className="p-2.5">Source KB</th>
                    <th className="p-2.5">Domain</th>
                    <th className="p-2.5">Tier</th>
                    <th className="p-2.5">NRCI Coefficient</th>
                    <th className="p-2.5 text-right pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e40]/20">
                  {filteredEntries.map(e => {
                    const badgeStyles = 
                      e.tier === 'Identity' ? 'bg-[#bb44ff]/10 text-[#bb44ff]' :
                      e.tier === 'Stable' ? 'bg-[#22cc88]/10 text-[#22cc88]' :
                      e.tier === 'Zombie' ? 'bg-[#ff9933]/10 text-[#ff9933]' :
                      'bg-[#ff4466]/10 text-[#ff4466]';

                    return (
                      <tr
                        key={`${e.id}_${e.source}`}
                        onClick={() => { setSelectedEntryId(e.id); setIsEditing(false); }}
                        className={`hover:bg-[#181835]/40 transition-colors cursor-pointer ${
                          selectedEntryId === e.id ? 'bg-[#4f72ff]/10 border-l border-l-[#4f72ff]' : ''
                        }`}
                      >
                        <td className="p-2.5 pl-5 font-bold text-[#4f72ff]">{e.id}</td>
                        <td className="p-2.5 text-[#9090b8] text-[11px]">{e.source}</td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 bg-[#bb44ff]/5 text-[#bb44ff] rounded font-semibold text-[10px]">
                            {e.domain}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${badgeStyles}`}>
                            {e.tier}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-gray-200">{e.nrci.toFixed(5)}</td>
                        <td className="p-2.5 text-right pr-5">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={(evt) => { evt.stopPropagation(); setSelectedEntryId(e.id); startEditingMode(e); }}
                              className="p-1 hover:bg-[#4f72ff] hover:text-black border border-[#2e2e5a] bg-transparent rounded transition-all cursor-pointer"
                              title="Edit Geometry"
                              type="button"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(evt) => { evt.stopPropagation(); handleDeleteEntry(e.id, e.source); }}
                              className="p-1 hover:bg-[#ff4466] text-[#ff4466] hover:text-white border border-[#ff4466]/30 rounded transition-all cursor-pointer"
                              title="Delete Record"
                              type="button"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredEntries.length === 0 && (
                <div className="p-12 text-center text-[#6868a0] italic">
                  No matching entries found. Adjust filter terms if needed.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT DETAIL & EDIT SLIDEOUT DRAWER */}
          <div className={`w-[360px] bg-[#101028] border-l border-[#252548] flex flex-col overflow-hidden flex-shrink-0 transition-all ${
            selectedEntry || isEditing ? 'block' : 'hidden'
          }`}>
            
            <div className="p-3.5 border-b border-[#252548] flex justify-between items-center bg-[#151532]">
              <span className="text-[10px] uppercase font-black text-[#9090b8] tracking-widest leading-none">
                {isEditing ? (isAddingNew ? 'Create New Node' : 'Edit Node Geometry') : 'Node details'}
              </span>
              <button
                onClick={() => { setSelectedEntryId(null); setIsEditing(false); setIsEditingNew(false); }}
                className="text-[#6868a0] hover:text-white transition-colors cursor-pointer"
                type="button"
              >
                ✕
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdateEntrySubmit} className="flex-1 flex flex-col p-4 gap-3.5 overflow-y-auto scrollbar-thin">
                
                {/* ID input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-black text-[#6868a0]">UBP ID (Manifest Key)</label>
                  <input
                    type="text"
                    required
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    disabled={!isAddingNew}
                    className="w-full bg-[#181835] border border-[#2e2e5a] rounded p-1.5 outline-none font-mono text-xs focus:border-[#4f72ff] disabled:opacity-50"
                  />
                </div>

                {/* Source selection */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-black text-[#6868a0]">Target KB Destination</label>
                  <select
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="w-full bg-[#181835] border border-[#2e2e5a] text-white rounded p-1.5 outline-none focus:border-[#4f72ff] text-xs"
                  >
                    {availableSources.filter(src => src !== 'All').map(src => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>

                {/* Geometric Domain */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-black text-[#6868a0]">Geometric Domain</label>
                  <select
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value as KBEntry['domain'])}
                    className="w-full bg-[#181835] border border-[#2e2e5a] text-white rounded p-1.5 outline-none focus:border-[#4f72ff] text-xs"
                  >
                    <option value="IMPERATIVE">IMPERATIVE</option>
                    <option value="SUBSTANCE">SUBSTANCE</option>
                    <option value="QUANTITY">QUANTITY</option>
                    <option value="ALGORITHM">ALGORITHM</option>
                    <option value="MECHANISM">MECHANISM</option>
                    <option value="ORGANISM">ORGANISM</option>
                    <option value="ENTROPY">ENTROPY</option>
                    <option value="MEANING">MEANING</option>
                  </select>
                </div>

                {/* Lexicon definition */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-black text-[#6868a0]">Lexicon Content</label>
                  <textarea
                    required
                    rows={4}
                    value={formLexicon}
                    onChange={(e) => setFormLexicon(e.target.value)}
                    className="w-full bg-[#181835] border border-[#2e2e5a] rounded p-2 text-xs text-white outline-none focus:border-[#4f72ff] font-sans resize-none"
                    placeholder="Provide lexicon description, law definition, or semantic meaning"
                  />
                </div>

                {/* Tags management */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-black text-[#6868a0]">Structural Tags</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5 bg-black/30 p-1.5 rounded min-h-[30px] border border-[#222248]/40">
                    {formTags.map(tag => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-[#4f72ff]/10 text-[#4f72ff] text-[10px] rounded hover:bg-[#ff4466]/10 hover:text-[#ff4466] cursor-pointer transition-colors"
                        onClick={() => setFormTags(formTags.filter(t => t !== tag))}
                        title="Click to remove tag"
                      >
                        #{tag} <span>×</span>
                      </span>
                    ))}
                    {formTags.length === 0 && <span className="text-gray-600 text-[10px] italic">No structural tags declared</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Add tag"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      className="flex-1 bg-[#181835] border border-[#2e2e5a] rounded px-2 py-1 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = newTagInput.trim().toUpperCase();
                        if (clean && !formTags.includes(clean)) {
                          setFormTags([...formTags, clean]);
                          setNewTagInput('');
                        }
                      }}
                      className="px-3 py-1 bg-[#181835] hover:bg-[#1e1e40] border border-[#2e2e5a] text-white text-xs font-bold rounded cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* INTERACTIVE 24-BIT VECTOR METRIC MAP */}
                <div className="border-t border-[#2e2e5a] pt-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[9px] uppercase font-black text-[#6868a0]">
                    <span>24-bit Substrate Vector</span>
                    <span className="text-[#22cc88]">W={formVector.filter(b => b === 1).length}</span>
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {formVector.map((val, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleVectorBit(idx)}
                        className={`py-1 rounded text-[10px] font-mono font-bold transition-all border ${
                          val === 1 
                            ? 'bg-[#22cc88] text-black border-[#22cc88]' 
                            : 'bg-transparent text-[#6868a0] border-[#2e2e5a] hover:border-white/40'
                        }`}
                        title={`Bit channel ${idx}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1 px-1 py-1 bg-black/40 rounded border border-[#222248]/40 text-xs font-mono">
                    <div className="text-center">
                      <div className="text-[8px] uppercase text-[#6868a0]">Symmetry Tax</div>
                      <div className="text-white font-bold">{formTax}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[8px] uppercase text-[#6868a0]">Computed NRCI</div>
                      <div className="text-white font-bold">{formNrci.toFixed(5)}</div>
                    </div>
                  </div>
                </div>

                {/* Save button block */}
                <div className="flex gap-2 mt-auto pt-3 border-t border-[#2e2e5a]">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-[#4f72ff] hover:bg-[#6a8bff] text-black text-xs font-black uppercase tracking-wider rounded transition-colors cursor-pointer"
                  >
                    Commit Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setIsEditingNew(false);
                      if (selectedEntryId) {
                        const prev = allEntries.find(e => e.id === selectedEntryId);
                        if (prev) startEditingMode(prev);
                      }
                    }}
                    className="px-4 py-1.5 bg-transparent hover:bg-white/5 border border-transparent hover:border-[#2e2e5a] rounded text-white text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : selectedEntry ? (
              <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto scrollbar-thin">
                
                {/* Identifier */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase font-black text-[#6868a0]">Node Identifier</span>
                  <div className="text-lg font-mono font-bold text-[#4f72ff] bg-black/40 px-3 py-1.5 rounded border border-[#2e2e5a]">
                    {selectedEntry.id}
                  </div>
                </div>

                {/* Properties list */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-black/20 p-2 rounded border border-[#222248]/30">
                    <span className="text-[8px] uppercase font-black text-[#6868a0] block mb-0.5">Database Source</span>
                    <span className="text-[#9090b8] font-bold block truncate" title={selectedEntry.source}>
                      {selectedEntry.source}
                    </span>
                  </div>
                  <div className="bg-black/20 p-2 rounded border border-[#222248]/30">
                    <span className="text-[8px] uppercase font-black text-[#6868a0] block mb-0.5">Domain</span>
                    <span className="text-[#bb44ff] font-bold block">{selectedEntry.domain}</span>
                  </div>
                  <div className="bg-black/20 p-2 rounded border border-[#222248]/30">
                    <span className="text-[8px] uppercase font-black text-[#6868a0] block mb-0.5">Symmetry Tax</span>
                    <span className="text-white font-bold block">{selectedEntry.tax}</span>
                  </div>
                  <div className="bg-black/20 p-2 rounded border border-[#222248]/30">
                    <span className="text-[8px] uppercase font-black text-[#6868a0] block mb-0.5">NRCI Coefficient</span>
                    <span className={`font-bold block ${selectedEntry.nrci >= 0.70 ? 'text-[#22cc88]' : 'text-[#ff4466]'}`}>
                      {selectedEntry.nrci.toFixed(6)}
                    </span>
                  </div>
                </div>

                {/* Vector display */}
                {selectedEntry.vector && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase font-black text-[#6868a0]">Array Vector Representation</span>
                    <div className="bg-black/50 p-2.5 rounded border border-[#2e2e5a] font-mono text-[10px] grid grid-cols-8 gap-1">
                      {selectedEntry.vector.map((bit, idx) => (
                        <span key={idx} className={`p-1 rounded text-center font-bold ${
                          bit === 1 ? 'bg-[#22cc88]/20 text-[#22cc88]' : 'text-gray-700 bg-transparent'
                        }`}>
                          {bit}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lexicon box */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase font-black text-[#6868a0]">Lexicon Content</span>
                  <div className="bg-[#181835] p-3 rounded text-xs text-gray-200 border border-[#2e2e5a] leading-relaxed max-h-[160px] overflow-y-auto scrollbar-thin font-sans">
                    {selectedEntry.lexicon}
                  </div>
                </div>

                {/* Tags block */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] uppercase font-black text-[#6868a0]">Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEntry.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-black/40 border border-[#2e2e5a] rounded text-[10px] text-gray-400 font-mono">
                        #{t}
                      </span>
                    ))}
                    {selectedEntry.tags.length === 0 && <span className="text-gray-600 text-xs italic">No tags associated</span>}
                  </div>
                </div>

                {/* Actions bottom bar */}
                <div className="flex gap-2 mt-auto pt-4 border-t border-[#2e2e5a]">
                  <button
                    onClick={() => startEditingMode(selectedEntry)}
                    className="flex-1 py-1.5 bg-[#4f72ff] hover:bg-[#6a8bff] text-black text-xs font-black uppercase tracking-wider rounded transition-colors cursor-pointer"
                    type="button"
                  >
                    Modify Geometry
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(selectedEntry.id, selectedEntry.source)}
                    className="px-4 py-1.5 bg-transparent border border-[#ff4466]/40 hover:bg-[#ff4466] text-[#ff4466] hover:text-white text-xs font-bold rounded transition-all cursor-pointer"
                    type="button"
                  >
                    Delete Node
                  </button>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-[#6868a0] italic">
                Select a KB record or double-click to view active dimensions.
              </div>
            )}
          </div>

        </div>
      ) : (
        /* tab === 'compare' COMPARER / VERSION ALIGNER */
        <div className="flex-1 flex flex-col overflow-hidden bg-[#05050f]">
          
          {/* Base Comparer Header selector bar */}
          <div className="p-4 bg-[#101028] border-b border-[#252548] flex flex-wrap gap-4 items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-black text-[#6868a0] pl-1">Left Source Base</span>
                <select
                  value={compareLeftSource}
                  onChange={(e) => setCompareLeftSource(e.target.value)}
                  className="bg-[#181835] border border-[#2e2e5a] text-white rounded px-2.5 py-1.5 focus:border-[#4f72ff] text-xs"
                >
                  {availableSources.filter(src => src !== 'All').map(src => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>

              <div className="text-[#4f72ff] font-bold text-lg pt-3">VS</div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-black text-[#6868a0] pl-1">Right Target Align</span>
                <select
                  value={compareRightSource}
                  onChange={(e) => setCompareRightSource(e.target.value)}
                  className="bg-[#181835] border border-[#2e2e5a] text-white rounded px-2.5 py-1.5 focus:border-[#4f72ff] text-xs"
                >
                  {availableSources.filter(src => src !== 'All' && src !== compareLeftSource).map(src => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-right text-xs font-mono text-[#9090b8]">
              <div>Divergences: <strong className="text-[#ff9933]">{comparisonResults.differing.length}</strong></div>
              <div>Exclusive Left: <strong className="text-[#4f72ff]">{comparisonResults.leftOnly.length}</strong> | Right: <strong className="text-[#bb44ff]">{comparisonResults.rightOnly.length}</strong></div>
            </div>
          </div>

          {/* Comparer content lists side-by-side */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-thin">
            
            {/* 1. Differing nodes list */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-black uppercase text-[#ff9933] tracking-widest border-b border-[#2e2e5a] pb-1.5 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" /> Divergent Entries (Matching keys, different values)
              </h3>
              
              {comparisonResults.differing.length === 0 ? (
                <div className="text-xs text-gray-500 italic pl-2 py-2">No overlapping keys have divergent definitions! Perfect alignment.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {comparisonResults.differing.map(diff => (
                    <div key={diff.id} className="bg-[#101028] border border-orange-500/10 rounded p-4 flex flex-col gap-3 animate-fade-in">
                      
                      <div className="flex justify-between items-center text-xs font-mono border-b border-[#252548] pb-1.5">
                        <span className="text-white font-bold text-sm">{diff.id}</span>
                        <span className="text-gray-500 uppercase text-[10px]">CONVERGENCE MISMATCH</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Left version */}
                        <div className="bg-[#181835]/40 border border-[#2e2e5a]/30 p-3 rounded flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between text-[9px] uppercase font-bold text-[#4f72ff] mb-1.5">
                              <span>{compareLeftSource}</span>
                              <span className="font-mono">{diff.left.tier}</span>
                            </div>
                            <div className="text-xs text-gray-300 line-clamp-3 mb-2 font-sans">{diff.left.lexicon}</div>
                          </div>
                          <button
                            onClick={() => copyEntryAcrossSource(diff.left, compareRightSource)}
                            className="w-full text-center py-1 bg-[#4f72ff]/10 hover:bg-[#4f72ff] hover:text-black border border-[#2e2e5a] hover:border-transparent text-[10px] uppercase font-black rounded transition-colors cursor-pointer text-white"
                            type="button"
                          >
                            Copy to Right →
                          </button>
                        </div>

                        {/* Right version */}
                        <div className="bg-[#181835]/40 border border-[#2e2e5a]/30 p-3 rounded flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between text-[9px] uppercase font-bold text-[#bb44ff] mb-1.5">
                              <span>{compareRightSource}</span>
                              <span className="font-mono">{diff.right.tier}</span>
                            </div>
                            <div className="text-xs text-gray-300 line-clamp-3 mb-2 font-sans">{diff.right.lexicon}</div>
                          </div>
                          <button
                            onClick={() => copyEntryAcrossSource(diff.right, compareLeftSource)}
                            className="w-full text-center py-1 bg-[#bb44ff]/10 hover:bg-[#bb44ff] hover:text-black border border-[#2e2e5a] hover:border-transparent text-[10px] uppercase font-black rounded transition-colors cursor-pointer text-white"
                            type="button"
                          >
                            ← Copy to Left
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Left only nodes list */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-black uppercase text-[#4f72ff] tracking-widest border-b border-[#2e2e5a] pb-1.5">
                ✦ Unique keys in left ({compareLeftSource})
              </h3>
              {comparisonResults.leftOnly.length === 0 ? (
                <div className="text-xs text-gray-500 italic pl-2 py-2">No exclusive keys on this side.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {comparisonResults.leftOnly.map(e => (
                    <div key={e.id} className="bg-[#101028] border border-[#2e2e5a] p-3 rounded flex justify-between items-center gap-3 animate-fade-in">
                      <div className="flex-1 overflow-hidden">
                        <div className="font-mono text-xs font-bold text-white truncate">{e.id}</div>
                        <div className="text-[11px] text-[#9090b8] truncate font-sans">{e.lexicon}</div>
                      </div>
                      <button
                        onClick={() => copyEntryAcrossSource(e, compareRightSource)}
                        className="px-2.5 py-1 bg-[#4f72ff]/10 hover:bg-[#4f72ff] text-[#4f72ff] hover:text-black rounded text-[10px] uppercase font-black cursor-pointer flex-shrink-0"
                        type="button"
                      >
                        Copy Right
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Right only nodes list */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-black uppercase text-[#bb44ff] tracking-widest border-b border-[#2e2e5a] pb-1.5">
                ✦ Unique keys in right ({compareRightSource})
              </h3>
              {comparisonResults.rightOnly.length === 0 ? (
                <div className="text-xs text-gray-500 italic pl-2 py-2">No exclusive keys on this side.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {comparisonResults.rightOnly.map(e => (
                    <div key={e.id} className="bg-[#101028] border border-[#2e2e5a] p-3 rounded flex justify-between items-center gap-3 animate-fade-in">
                      <div className="flex-1 overflow-hidden">
                        <div className="font-mono text-xs font-bold text-white truncate">{e.id}</div>
                        <div className="text-[11px] text-[#9090b8] truncate font-sans">{e.lexicon}</div>
                      </div>
                      <button
                        onClick={() => copyEntryAcrossSource(e, compareLeftSource)}
                        className="px-2.5 py-1 bg-[#bb44ff]/10 hover:bg-[#bb44ff] text-[#bb44ff] hover:text-black rounded text-[10px] uppercase font-black cursor-pointer flex-shrink-0"
                        type="button"
                      >
                        Copy Left
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Stable indicator footer */}
      <div className="p-2.5 bg-[#101028] border-t border-[#252548] text-center font-mono text-[9.5px] text-[#6868a0] select-none flex-shrink-0 flex items-center justify-center gap-1.5">
        <Sparkles className="w-3 h-3 text-[#bb44ff] animate-pulse" />
        UBP SOP_002 Universal KB Browser & Sync Workspace • Active Session Saved to IndexedDB
      </div>
    </div>
  );
};
