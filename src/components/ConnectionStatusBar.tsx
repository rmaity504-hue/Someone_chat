import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { WifiOff, RefreshCw } from 'lucide-react';

export const ConnectionStatusBar: React.FC = () => {
  const { connectionStatus, reconnectAttempts, maxReconnectAttempts, retryConnection } = useAuth();

  if (connectionStatus === 'connected' || connectionStatus === 'idle') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full text-xs py-2 px-4 border-b transition-all duration-300 flex items-center justify-between ${
        connectionStatus === 'reconnecting'
          ? 'bg-[#FAF3EB] text-[#825C26] border-[#EADFCB]'
          : 'bg-[#FBEBE8] text-[#A84332] border-[#F0CEC6]'
      }`}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {connectionStatus === 'reconnecting' ? (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span>
                Reconnecting to sanctuary... (Attempt {reconnectAttempts} of {maxReconnectAttempts})
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-[#A84332] shrink-0" />
              <span>Connection lost. Mobile network or Wi-Fi dropped.</span>
            </>
          )}
        </div>

        <button
          onClick={retryConnection}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            connectionStatus === 'reconnecting'
              ? 'bg-[#EADFCB]/60 hover:bg-[#EADFCB] text-[#523A16]'
              : 'bg-[#A84332] hover:bg-[#8D3425] text-[#FAF8F5]'
          }`}
        >
          <RefreshCw className={`w-3 h-3 ${connectionStatus === 'reconnecting' ? 'animate-spin' : ''}`} />
          <span>{connectionStatus === 'reconnecting' ? 'Retry now' : 'Reconnect'}</span>
        </button>
      </div>
    </div>
  );
};
