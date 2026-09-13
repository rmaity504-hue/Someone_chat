import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Shield,
  AlertTriangle,
  Users,
  Flag,
  RotateCcw,
  UserCheck,
  Ban,
  Radio,
  FileText,
  Activity,
  X,
  Check,
  MessageSquare,
} from 'lucide-react';
import { AdminStats, ReportRecord, ModerationFlagRecord, AppealRecord, SupportTicketRecord, SupportTicketStatus } from '../types.js';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const { token, user } = useAuth();

  const [tab, setTab] = useState<'stats' | 'reports' | 'flags' | 'users' | 'appeals' | 'tickets'>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [flags, setFlags] = useState<ModerationFlagRecord[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'open' | 'resolved' | 'dismissed'>('all');
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error loading admin stats:', err);
    }
  };

  const fetchReports = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {}
  };

  const fetchFlags = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/flags', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags || []);
      }
    } catch (err) {}
  };

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch (err) {}
  };

  const fetchAppeals = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/appeals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAppeals(data.appeals || []);
      }
    } catch (err) {}
  };

  const fetchTickets = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchStats();
      fetchReports();
      fetchFlags();
      fetchUsers();
      fetchAppeals();
      fetchTickets();
    }
  }, [isOpen, token, tab]);

  const handleUserAction = async (
    targetUserId: string,
    action: 'warn' | 'restrict' | 'suspend' | 'ban' | 'restore',
    reason: string,
    durationHours?: number
  ) => {
    try {
      const res = await fetch(`/api/admin/user/${targetUserId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, reason, durationHours }),
      });
      if (res.ok) {
        setActionSuccess(`Enforcement applied: ${action}`);
        fetchUsers();
        fetchReports();
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveReport = async (reportId: string, status: 'actioned' | 'dismissed', actionTaken: string) => {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, actionTaken }),
      });
      if (res.ok) {
        fetchReports();
      }
    } catch (err) {}
  };

  const handleResolveAppeal = async (appealId: string, status: 'approved' | 'rejected', adminNote?: string) => {
    try {
      const res = await fetch(`/api/admin/appeals/${appealId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, adminNote }),
      });
      if (res.ok) {
        fetchAppeals();
        fetchUsers();
      }
    } catch (err) {}
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: SupportTicketStatus) => {
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setActionSuccess(`Ticket marked as ${status}`);
        fetchTickets();
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleVolunteerRole = async (targetUserId: string, isVolunteer: boolean) => {
    try {
      const res = await fetch(`/api/admin/user/${targetUserId}/volunteer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isVolunteer }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/50 backdrop-blur-xs">
      <div
        className="bg-[#faf9f6] border border-stone-200 rounded-2xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl text-stone-800 overflow-hidden"
        id="admin-dashboard-modal"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-stone-800" />
            <div>
              <h2 className="font-medium text-lg text-stone-900">Moderation & Administration</h2>
              <span className="text-xs text-stone-500">
                Staff view • Operational statistics & progressive enforcement
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {actionSuccess && (
          <div className="px-6 py-2 bg-emerald-50 text-emerald-800 text-xs border-b border-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 px-6 bg-stone-50 gap-2 text-xs font-medium text-stone-600">
          <button
            id="admin-tab-stats"
            onClick={() => setTab('stats')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'stats' ? 'border-stone-900 text-stone-900' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Operational Stats</span>
          </button>

          <button
            id="admin-tab-reports"
            onClick={() => setTab('reports')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'reports' ? 'border-stone-900 text-stone-900' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Reports ({reports.filter((r) => r.status === 'pending').length})</span>
          </button>

          <button
            id="admin-tab-flags"
            onClick={() => setTab('flags')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'flags' ? 'border-stone-900 text-stone-900' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Automated Flags ({flags.filter((f) => !f.reviewed).length})</span>
          </button>

          <button
            id="admin-tab-users"
            onClick={() => setTab('users')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'users' ? 'border-stone-900 text-stone-900' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users & Volunteers</span>
          </button>

          <button
            id="admin-tab-appeals"
            onClick={() => setTab('appeals')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'appeals' ? 'border-stone-900 text-stone-900' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Appeals ({appeals.filter((a) => a.status === 'pending').length})</span>
          </button>

          <button
            id="admin-tab-tickets"
            onClick={() => setTab('tickets')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'tickets' ? 'border-stone-900 text-stone-900' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Support Tickets ({tickets.filter((t) => t.status === 'open').length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OPERATIONAL STATS */}
          {tab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-1">
                  <span className="text-xs text-stone-500">Total Members</span>
                  <p className="text-2xl font-light text-stone-900">{stats?.totalUsers ?? '—'}</p>
                  <span className="text-[10px] text-stone-400">{stats?.verifiedUsers ?? 0} verified</span>
                </div>

                <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-1">
                  <span className="text-xs text-stone-500">Active Sockets</span>
                  <p className="text-2xl font-light text-stone-900">{stats?.activeSockets ?? '—'}</p>
                  <span className="text-[10px] text-stone-400">
                    {stats?.currentlyMatching ?? 0} in pool (private)
                  </span>
                </div>

                <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-1">
                  <span className="text-xs text-stone-500">Active Conversations</span>
                  <p className="text-2xl font-light text-stone-900">{stats?.activeConversations ?? '—'}</p>
                  <span className="text-[10px] text-stone-400">
                    {stats?.totalConversationsCompleted ?? 0} total completed
                  </span>
                </div>

                <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-1">
                  <span className="text-xs text-stone-500">Available Listeners</span>
                  <p className="text-2xl font-light text-stone-900">{stats?.availableVolunteers ?? '—'}</p>
                  <span className="text-[10px] text-stone-400">
                    {stats?.totalMutualFriendships ?? 0} mutual connections
                  </span>
                </div>
              </div>

              {/* Ban Evasion & System Integrity Indicators */}
              <div className="p-5 bg-stone-100 rounded-xl border border-stone-200/80 space-y-2 text-xs text-stone-600">
                <h4 className="font-medium text-stone-900 text-sm flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-stone-700" />
                  Ban Evasion & Integrity Indicators
                </h4>
                <p>
                  The server tracks IP addresses, blocked partner records, and progressive infractions across sessions. Any accounts flagged for rapid re-registration following suspension will inherit scrutiny and block matching with previously reporting partners.
                </p>
                <p>
                  Remember: <strong>Operational stats and queue metrics are strictly restricted to staff</strong> and must never be exposed to ordinary members.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: REPORTS QUEUE */}
          {tab === 'reports' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-stone-900">Member Reports Queue</h3>
              {reports.length === 0 ? (
                <p className="text-xs text-stone-500 py-6 text-center">No reports filed.</p>
              ) : (
                reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 bg-white border border-stone-200 rounded-xl space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 uppercase">
                            {rep.category.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-stone-400">
                            {new Date(rep.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-stone-900 mt-1">
                          Reported User: {rep.reportedDisplayName} (ID: {rep.reportedUserId})
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          rep.status === 'pending'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {rep.status}
                      </span>
                    </div>

                    <div className="p-2.5 bg-stone-50 rounded-lg text-xs text-stone-700">
                      <strong>Report Details:</strong> {rep.details}
                    </div>

                    {rep.status === 'pending' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => {
                            handleUserAction(rep.reportedUserId, 'warn', rep.details);
                            handleResolveReport(rep.id, 'actioned', 'Warning issued');
                          }}
                          className="px-3 py-1 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg text-xs"
                        >
                          Step 1: Warning
                        </button>
                        <button
                          onClick={() => {
                            handleUserAction(rep.reportedUserId, 'restrict', rep.details);
                            handleResolveReport(rep.id, 'actioned', 'Temporary restriction');
                          }}
                          className="px-3 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg text-xs"
                        >
                          Step 2: Restrict
                        </button>
                        <button
                          onClick={() => {
                            handleUserAction(rep.reportedUserId, 'suspend', rep.details, 30 * 24);
                            handleResolveReport(rep.id, 'actioned', 'Suspended 30 days');
                          }}
                          className="px-3 py-1 bg-orange-50 text-orange-800 hover:bg-orange-100 rounded-lg text-xs"
                        >
                          Step 3: Suspend 30d
                        </button>
                        <button
                          onClick={() => {
                            handleUserAction(rep.reportedUserId, 'suspend', rep.details, 90 * 24);
                            handleResolveReport(rep.id, 'actioned', 'Suspended 90 days');
                          }}
                          className="px-3 py-1 bg-rose-50 text-rose-800 hover:bg-rose-100 rounded-lg text-xs"
                        >
                          Step 4: Suspend 90d
                        </button>
                        <button
                          onClick={() => {
                            handleUserAction(rep.reportedUserId, 'ban', rep.details);
                            handleResolveReport(rep.id, 'actioned', 'Permanent removal');
                          }}
                          className="px-3 py-1 bg-red-600 text-white hover:bg-red-700 rounded-lg text-xs font-medium"
                        >
                          Step 5: Permanent Ban
                        </button>
                        <button
                          onClick={() => handleResolveReport(rep.id, 'dismissed', 'Dismissed after review')}
                          className="px-3 py-1 border border-stone-300 text-stone-600 hover:bg-stone-100 rounded-lg text-xs"
                        >
                          Dismiss (Non-violation)
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: AUTOMATED SAFETY FLAGS */}
          {tab === 'flags' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-stone-900">Automated System Flags</h3>
              <p className="text-xs text-stone-500">
                Automated detection flags potential solicitation, harassment, coercion, and scam patterns. Vulnerability and sadness are strictly whitelisted from flagging.
              </p>
              {flags.length === 0 ? (
                <p className="text-xs text-stone-500 py-6 text-center">No automated flags detected.</p>
              ) : (
                flags.map((flag) => (
                  <div
                    key={flag.id}
                    className="p-4 bg-white border border-stone-200 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800">
                        {flag.triggerCategory} • Severity: {flag.severity}
                      </span>
                      <span className="text-stone-400">
                        {new Date(flag.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-stone-800 font-medium">
                      User: {flag.displayName} ({flag.userId})
                    </p>
                    <div className="p-2 bg-stone-100 rounded-lg font-mono text-stone-700">
                      &quot;{flag.flaggedText}&quot;
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleUserAction(flag.userId, 'warn', `Automated flag for ${flag.triggerCategory}`)}
                        className="px-2.5 py-1 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg"
                      >
                        Warn
                      </button>
                      <button
                        onClick={() => handleUserAction(flag.userId, 'suspend', `Automated flag for ${flag.triggerCategory}`, 30 * 24)}
                        className="px-2.5 py-1 bg-orange-100 text-orange-800 hover:bg-orange-200 rounded-lg"
                      >
                        Suspend 30d
                      </button>
                      <button
                        onClick={() => handleUserAction(flag.userId, 'suspend', `Repeated violation for ${flag.triggerCategory}`, 90 * 24)}
                        className="px-2.5 py-1 bg-rose-100 text-rose-800 hover:bg-rose-200 rounded-lg"
                      >
                        Suspend 90d
                      </button>
                      <button
                        onClick={() => handleUserAction(flag.userId, 'ban', `Severe or repeated violation: ${flag.triggerCategory}`)}
                        className="px-2.5 py-1 bg-red-600 text-white hover:bg-red-700 rounded-lg"
                      >
                        Permanent Ban
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: USERS & VOLUNTEERS */}
          {tab === 'users' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-stone-900">User Management & Volunteer Roster</h3>
              <div className="space-y-2">
                {usersList.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 bg-white border border-stone-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-900 text-sm">{u.displayName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            u.status === 'banned'
                              ? 'bg-red-100 text-red-800'
                              : u.status === 'suspended'
                              ? 'bg-orange-100 text-orange-800'
                              : u.status === 'restricted'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {u.status}
                        </span>
                        {u.isVolunteer && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                            Volunteer {u.volunteerActive ? '(Listener Active)' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-stone-500 text-[11px] mt-0.5">
                        Email: {u.email} • Role: {u.role} • Joined {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                      {u.restrictionReason && (
                        <p className="text-red-600 text-[11px] mt-0.5">Notice: {u.restrictionReason}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={() => handleToggleVolunteerRole(u.id, !u.isVolunteer)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          u.isVolunteer
                            ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        }`}
                      >
                        {u.isVolunteer ? 'Revoke Volunteer' : 'Make Volunteer'}
                      </button>

                      {u.status !== 'offline' && u.status !== 'available' && u.status !== 'connected' ? (
                        <button
                          onClick={() => handleUserAction(u.id, 'restore', 'Restored by admin')}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-medium"
                        >
                          Reinstate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUserAction(u.id, 'restrict', 'Manual administrative review')}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs"
                        >
                          Restrict
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: APPEALS REVIEW */}
          {tab === 'appeals' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-stone-900">Member Appeals</h3>
              {appeals.length === 0 ? (
                <p className="text-xs text-stone-500 py-6 text-center">No pending appeals.</p>
              ) : (
                appeals.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 bg-white border border-stone-200 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-900">
                        {app.userDisplayName} ({app.userEmail})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                        {app.status}
                      </span>
                    </div>
                    <div className="p-2.5 bg-stone-50 rounded-lg text-stone-700">
                      <strong>Reason for appeal:</strong> {app.reason}
                    </div>
                    {app.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleResolveAppeal(app.id, 'approved', 'Appeal approved by moderator')}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          Approve & Reinstate
                        </button>
                        <button
                          onClick={() => handleResolveAppeal(app.id, 'rejected', 'Appeal rejected upon review')}
                          className="px-3 py-1 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 6: SUPPORT TICKETS */}
          {tab === 'tickets' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200">
                <div>
                  <h3 className="text-sm font-medium text-stone-900">In-App Support & Admin Tickets</h3>
                  <p className="text-xs text-stone-500">
                    Direct inquiries, bug reports, and harassment escalation submitted via Contact Admin
                  </p>
                </div>
                {/* Filter buttons */}
                <div className="flex items-center gap-1.5">
                  {(['all', 'open', 'resolved', 'dismissed'] as const).map((filterStatus) => (
                    <button
                      key={filterStatus}
                      id={`ticket-filter-${filterStatus}`}
                      onClick={() => setTicketStatusFilter(filterStatus)}
                      className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-colors cursor-pointer ${
                        ticketStatusFilter === filterStatus
                          ? 'bg-stone-900 text-white font-medium'
                          : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {filterStatus}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const filteredTickets = tickets.filter((t) => {
                  if (ticketStatusFilter === 'all') return true;
                  return t.status === ticketStatusFilter;
                });

                if (filteredTickets.length === 0) {
                  return (
                    <div className="text-center py-12 bg-white rounded-xl border border-stone-200 text-stone-500 text-xs">
                      No support tickets found with status "{ticketStatusFilter}".
                    </div>
                  );
                }

                const getCategoryBadgeClass = (cat: string) => {
                  switch (cat) {
                    case 'Harassment Report':
                      return 'bg-red-50 text-red-700 border-red-200';
                    case 'Bug':
                      return 'bg-amber-50 text-amber-700 border-amber-200';
                    case 'Account Issue':
                      return 'bg-purple-50 text-purple-700 border-purple-200';
                    default:
                      return 'bg-blue-50 text-blue-700 border-blue-200';
                  }
                };

                const getStatusBadgeClass = (status: string) => {
                  switch (status) {
                    case 'resolved':
                      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    case 'dismissed':
                      return 'bg-stone-100 text-stone-500 border-stone-200';
                    default:
                      return 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
                  }
                };

                return (
                  <div className="space-y-3">
                    {filteredTickets.map((t) => (
                      <div
                        key={t.id}
                        className="p-4 bg-white border border-stone-200 rounded-xl space-y-3 text-xs shadow-2xs hover:border-stone-300 transition-all"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${getCategoryBadgeClass(t.category)}`}>
                              {t.category}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${getStatusBadgeClass(t.status)}`}>
                              {t.status}
                            </span>
                            <span className="text-stone-400 text-[11px] font-mono">
                              #{t.id.slice(-8)}
                            </span>
                          </div>
                          <span className="text-stone-400 text-[11px]">
                            {new Date(t.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-semibold text-stone-900 text-sm">{t.subject}</h4>
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            Sender:{' '}
                            {t.userDisplayName ? (
                              <span className="text-stone-800 font-medium">
                                {t.userDisplayName} {t.userEmail && `(${t.userEmail})`}
                              </span>
                            ) : t.userEmail ? (
                              <span className="text-stone-800 font-medium">{t.userEmail}</span>
                            ) : (
                              <span className="italic">Anonymous / Guest</span>
                            )}
                          </p>
                        </div>

                        <div className="p-3 bg-stone-50 rounded-lg text-stone-800 whitespace-pre-wrap leading-relaxed border border-stone-200/60">
                          {t.message}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                          <span className="text-[10px] text-stone-400">
                            {t.resolvedAt && `Resolved ${new Date(t.resolvedAt).toLocaleDateString()}`}
                          </span>
                          <div className="flex items-center gap-2">
                            {t.status !== 'resolved' && (
                              <button
                                id={`ticket-resolve-btn-${t.id}`}
                                onClick={() => handleUpdateTicketStatus(t.id, 'resolved')}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Mark Resolved</span>
                              </button>
                            )}
                            {t.status !== 'dismissed' && (
                              <button
                                id={`ticket-dismiss-btn-${t.id}`}
                                onClick={() => handleUpdateTicketStatus(t.id, 'dismissed')}
                                className="px-2.5 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs hover:bg-stone-200 transition-colors cursor-pointer"
                              >
                                Dismiss
                              </button>
                            )}
                            {t.status !== 'open' && (
                              <button
                                id={`ticket-reopen-btn-${t.id}`}
                                onClick={() => handleUpdateTicketStatus(t.id, 'open')}
                                className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs hover:bg-amber-100 transition-colors cursor-pointer"
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
