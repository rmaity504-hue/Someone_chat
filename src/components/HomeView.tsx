import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { motion } from 'motion/react';
import { Sparkles, MessageSquare, ShieldCheck, Heart, Hash, Plus, X } from 'lucide-react';
import { socketService } from '../services/socket.js';

interface HomeViewProps {
  onFindSomeone: (topics?: string[]) => void;
  onOpenAuth: () => void;
  onOpenSafety: () => void;
}

const SUGGESTED_TOPICS = [
  'Casual',
  'Philosophy',
  'Late Night',
  'Books',
  'Music',
  'Heart-to-Heart',
  'Gaming',
  'Art',
];

export const HomeView: React.FC<HomeViewProps> = ({
  onFindSomeone,
  onOpenAuth,
  onOpenSafety,
}) => {
  const { user } = useAuth();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    // Initial fetch for presence count
    fetch('/api/presence')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.count === 'number') {
          setOnlineCount(data.count);
        }
      })
      .catch(() => {});

    // Listen to real-time online_count updates from WebSocket
    const handleOnlineCount = (data: any) => {
      if (data && typeof data.count === 'number') {
        setOnlineCount(data.count);
      }
    };

    socketService.on('online_count', handleOnlineCount);

    return () => {
      socketService.off('online_count', handleOnlineCount);
    };
  }, []);

  const toggleTopic = (topic: string) => {
    const clean = topic.trim().toLowerCase();
    if (selectedTopics.includes(clean)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== clean));
    } else {
      if (selectedTopics.length >= 3) return;
      setSelectedTopics([...selectedTopics, clean]);
    }
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customTag.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;
    if (clean.length > 20) return;
    if (!selectedTopics.includes(clean) && selectedTopics.length < 3) {
      setSelectedTopics([...selectedTopics, clean]);
    }
    setCustomTag('');
  };

  const removeTopic = (topic: string) => {
    setSelectedTopics(selectedTopics.filter((t) => t !== topic));
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-10 md:py-16 text-center max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-7 w-full"
      >
        {/* Welcoming unhurried microcopy badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5F2EB] border border-[#E7E0D8] text-xs font-medium text-[#78716C] shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C86D51]"></span>
            <span>A quiet corner for genuine human conversation</span>
          </div>
        </div>

        {/* Primary and Supporting Messages */}
        <div className="space-y-3.5">
          <h1
            id="home-primary-message"
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#2D2723] tracking-tight leading-[1.22]"
          >
            There are people awake all over the world.
          </h1>

          {/* Ambient Live Online Presence Counter */}
          <div className="flex justify-center pt-0.5">
            <div
              id="ambient-presence-badge"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5F2EB] border border-[#E7E0D8] text-xs font-medium text-[#5C534D] shadow-2xs"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C86D51] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C86D51]"></span>
              </span>
              <span>
                {onlineCount && onlineCount > 1
                  ? `${onlineCount} people awake right now`
                  : '• quiet atmosphere'}
              </span>
            </div>
          </div>

          <p
            id="home-supporting-message"
            className="text-base sm:text-lg md:text-xl text-[#5C534D] font-normal max-w-lg mx-auto leading-relaxed"
          >
            Sometimes, you just want another human being to talk to. No profiles, no judgments, just simple presence.
          </p>
        </div>

        {/* Optional Topic Tags Section */}
        <div
          id="topic-selection-section"
          className="p-4 sm:p-5 bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl text-left space-y-3 shadow-2xs max-w-lg mx-auto"
        >
          <div className="flex justify-between items-center w-full gap-2">
            <label className="text-xs font-medium text-[#5C534D] flex items-center gap-1.5 min-w-0 flex-wrap">
              <Hash className="w-3.5 h-3.5 text-[#C86D51] shrink-0" />
              <span className="leading-tight">Conversation Topics <span className="text-[#8C827A] font-normal">(optional, pick up to 3)</span></span>
            </label>
            <span className="text-[11px] text-[#8C827A] shrink-0 font-medium whitespace-nowrap pl-1">
              {selectedTopics.length}/3 selected
            </span>
          </div>

          {/* Preset Suggested Chips */}
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_TOPICS.map((topic) => {
              const clean = topic.toLowerCase();
              const isSelected = selectedTopics.includes(clean);
              const isDisabled = !isSelected && selectedTopics.length >= 3;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  disabled={isDisabled}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#C86D51] text-[#FAF8F5] shadow-xs'
                      : isDisabled
                      ? 'bg-[#F5F2EB]/50 text-[#8C827A]/40 border border-[#E7E0D8]/40 cursor-not-allowed'
                      : 'bg-[#F5F2EB] text-[#5C534D] hover:text-[#2D2723] hover:bg-[#EDE6DC] border border-[#E7E0D8]'
                  }`}
                >
                  {topic}
                </button>
              );
            })}
          </div>

          {/* Custom tag input form */}
          {selectedTopics.length < 3 && (
            <form onSubmit={handleAddCustomTag} className="flex items-center gap-2 pt-1">
              <input
                id="custom-topic-input"
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Or add a custom topic (e.g. poetry)..."
                maxLength={20}
                className="flex-1 px-3 py-1.5 bg-[#FAF8F5] border border-[#E7E0D8] rounded-full text-xs text-[#2D2723] placeholder:text-[#8C827A] focus:outline-none focus:ring-1 focus:ring-[#C86D51]/30 focus:border-[#C86D51]"
              />
              <button
                type="submit"
                disabled={!customTag.trim()}
                className="px-3 py-1.5 bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#5C534D] hover:text-[#2D2723] border border-[#E7E0D8] rounded-full text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </form>
          )}

          {/* Active Selected Tags display */}
          {selectedTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E7E0D8]/60">
              <span className="text-[11px] text-[#8C827A] mr-1">Active filters:</span>
              {selectedTopics.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FAF0EB] text-[#C86D51] border border-[#E8C7BC] rounded-full text-xs font-medium"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => removeTopic(t)}
                    className="hover:text-[#A84332] cursor-pointer"
                    title={`Remove ${t}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setSelectedTopics([])}
                className="text-[11px] text-[#8C827A] hover:text-[#A84332] underline ml-auto cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            id="home-find-someone-btn"
            onClick={() => onFindSomeone(selectedTopics)}
            className="w-full sm:w-auto px-9 py-3.5 bg-[#C86D51] hover:bg-[#B65E43] active:bg-[#A35239] text-[#FAF8F5] rounded-full font-medium text-base transition-all duration-200 shadow-[0_4px_20px_-2px_rgba(200,109,81,0.28)] hover:shadow-[0_6px_24px_-2px_rgba(200,109,81,0.38)] active:scale-[0.98] cursor-pointer"
          >
            {selectedTopics.length > 0
              ? `Find someone (${selectedTopics.length} topic${selectedTopics.length > 1 ? 's' : ''})`
              : 'Find someone'}
          </button>

          {!user && (
            <button
              id="home-sign-in-btn"
              onClick={onOpenAuth}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#2D2723] rounded-full font-medium text-base border border-[#E7E0D8] transition-all duration-200 shadow-2xs cursor-pointer"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Core philosophy reassurance (subtle, non-distracting) */}
        <div className="pt-8 border-t border-[#E7E0D8]/70 max-w-md mx-auto text-xs text-[#8C827A] space-y-2 leading-relaxed">
          <p>
            18+ only. Genuine text conversation between two adults. No profiles, no popularity, no dating algorithms.
          </p>
          <p>
            Conversations are subject to clearly disclosed safety monitoring.{' '}
            <button
              id="home-read-safety-link"
              onClick={onOpenSafety}
              className="underline underline-offset-3 decoration-[#E7E0D8] hover:decoration-[#5C534D] text-[#5C534D] hover:text-[#2D2723] transition-colors"
            >
              Read our safety notice
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
