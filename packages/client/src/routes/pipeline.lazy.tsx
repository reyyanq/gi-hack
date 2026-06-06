import { useState } from "react";
import {
  usePipelineLeads,
  usePipelineStages,
  useStartPipeline,
  useAdvanceStage,
  useRegressStage,
  useAddActivity,
  useContactActivity,
  useRunOutreach,
  useGeneratePreferenceLink,
  STAGES,
  type StageName,
  type PipelineLead,
  type ContactSummary,
} from "../lib/pipeline";

function StageColumn({
  stage,
  leads,
  onAdvance,
  onStartPipeline,
}: {
  stage: string;
  leads: PipelineLead[];
  onAdvance: (contactId: string) => void;
  onStartPipeline: (companyName: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (newName.trim()) {
      onStartPipeline(newName.trim());
      setNewName("");
      setAdding(false);
    }
  };

  const isFirst = stage === "New";
  const isLast = stage === "Closed Won" || stage === "Closed Lost";

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 min-w-[260px] flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="font-semibold text-sm text-cyan-400">{stage}</h3>
        <span className="text-xs text-gray-500">{leads.length} leads</span>
      </div>

      <div className="p-2 space-y-2 min-h-[200px]">
        {leads.map((lead) => (
          <LeadCard key={lead.contacts[0]?.id ?? lead.companyName} lead={lead} onAdvance={onAdvance} isLast={isLast} />
        ))}

        {isFirst && (
          <div className="p-2">
            {adding ? (
              <div className="space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Company name"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-500"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <div className="flex gap-1">
                  <button onClick={handleAdd} className="bg-cyan-600 hover:bg-cyan-500 text-xs px-2 py-1 rounded">
                    Add
                  </button>
                  <button onClick={() => setAdding(false)} className="text-xs text-gray-400 px-2 py-1">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full text-left text-gray-500 hover:text-white text-xs py-2 transition-colors"
              >
                + Add lead
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  onAdvance,
  isLast,
}: {
  lead: PipelineLead;
  onAdvance: (contactId: string) => void;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const genLink = useGeneratePreferenceLink();
  const contact = lead.contacts[0];

  return (
    <div className="bg-gray-800 rounded p-3 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          <h4 className="text-sm font-medium truncate">{lead.companyName}</h4>
          {lead.companySegment && (
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{lead.companySegment}</span>
          )}
        </div>
        {!isLast && contact && (
          <button
            onClick={() => onAdvance(contact.id)}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded ml-2 flex-shrink-0"
            title="Advance to next stage"
          >
            →
          </button>
        )}
      </div>

      {lead.lastActivity && (
        <p className="text-xs text-gray-500 mt-1 truncate">{lead.lastActivity}</p>
      )}

      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
        >
          {expanded ? "▲ Less" : "▼ Details"}
        </button>
        {contact && (
          <button
            onClick={async () => {
              try {
                const result = await genLink.mutateAsync({
                  contactId: contact.id,
                  companyName: lead.companyName,
                  contactName: contact.name || "Valued Partner",
                  email: contact.email || "",
                  role: contact.role || "Contact",
                });
                const url = `${window.location.origin}${result.url}`;
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {}
            }}
            disabled={genLink.isPending}
            className="text-xs text-gray-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
          >
            {genLink.isPending ? "..." : copied ? "✓ Copied!" : "🔗 Link"}
          </button>
        )}
      </div>

      {expanded && contact && <ContactDetail contactId={contact.id} />}
    </div>
  );
}

function ContactDetail({ contactId }: { contactId: string }) {
  const { data: activities } = useContactActivity(contactId);
  const addActivity = useAddActivity();
  const regress = useRegressStage();
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showRegress, setShowRegress] = useState(false);
  const [targetStage, setTargetStage] = useState("");

  const handleAddNote = () => {
    if (noteText.trim()) {
      addActivity.mutate({ contactId, type: "note", note: noteText.trim() });
      setNoteText("");
      setShowNote(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-700 space-y-2">
      <button
        onClick={() => setShowNote(!showNote)}
        className="text-xs text-gray-400 hover:text-white transition-colors"
      >
        {showNote ? "Cancel" : "+ Add note"}
      </button>

      {showNote && (
        <div className="space-y-1">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-500 resize-none"
            placeholder="Write a note..."
          />
          <button
            onClick={handleAddNote}
            disabled={addActivity.isPending}
            className="bg-cyan-600 hover:bg-cyan-500 text-xs px-2 py-1 rounded disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      <button
        onClick={() => setShowRegress(!showRegress)}
        className="text-xs text-gray-400 hover:text-white transition-colors block"
      >
        {showRegress ? "Cancel" : "← Move back"}
      </button>

      {showRegress && (
        <div className="flex gap-1 flex-wrap">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => regress.mutate({ contactId, stage: s })}
              className="text-[10px] bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {activities && activities.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Activity</p>
          {activities.slice(0, 5).map((a) => (
            <div key={a.id} className="text-xs text-gray-400">
              <span className="text-gray-600">{new Date(a.date).toLocaleDateString()}</span> {a.note}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PipelinePage() {
  const { data: leads, isLoading: leadsLoading } = usePipelineLeads();
  const { data: stages } = usePipelineStages();
  const startPipeline = useStartPipeline();
  const advance = useAdvanceStage();
  const runOutreach = useRunOutreach();

  const stageLeads = new Map<string, PipelineLead[]>();
  if (leads) {
    for (const lead of leads) {
      const stage = lead.currentStage;
      if (!stageLeads.has(stage)) stageLeads.set(stage, []);
      stageLeads.get(stage)!.push(lead);
    }
  }

  const handleAdvance = (contactId: string) => {
    advance.mutate(contactId);
  };

  const handleStart = (companyName: string) => {
    startPipeline.mutate({ companyName });
  };

  const displayStages = stages ?? STAGES;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pipeline CRM</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runOutreach.mutate()}
            disabled={runOutreach.isPending}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
          >
            {runOutreach.isPending ? "⏳ Running..." : "🚀 Run Outreach"}
          </button>
          <p className="text-sm text-gray-500">
            {leads ? `${leads.length} total` : "Loading..."}
          </p>
        </div>
      </div>

      {leadsLoading && (
        <div className="text-gray-500 text-sm">Loading pipeline...</div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {displayStages.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            leads={stageLeads.get(stage) ?? []}
            onAdvance={handleAdvance}
            onStartPipeline={handleStart}
          />
        ))}
      </div>
    </div>
  );
}
