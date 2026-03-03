'use client';

import { useState, useEffect, useRef } from 'react';
import {
  fetchAPI,
  formatDateTime,
  isAuthenticated,
} from '../../../lib/api';

export default function ChatPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rides, setRides] = useState([]);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const isAuth = isAuthenticated();
    setAuthed(isAuth);
    if (isAuth) {
      loadRecentRides();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function loadRecentRides() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI('/rides?limit=50');
      setRides(
        Array.isArray(data) ? data : data?.rides ?? data?.data ?? []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(rideId) {
    try {
      setMessagesLoading(true);
      setMessagesError(null);
      setSelectedRideId(rideId);
      const data = await fetchAPI(`/chat/${rideId}/messages`);
      setMessages(
        Array.isArray(data) ? data : data?.messages ?? data?.data ?? []
      );
    } catch (err) {
      setMessagesError(err.message);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  function getSenderStyle(message) {
    const type =
      message.sender_type ?? message.senderType ?? message.type ?? '';
    if (type === 'system') {
      return {
        align: 'center',
        bg: '#f0f0f4',
        color: 'var(--text-muted)',
        borderColor: 'var(--border)',
      };
    }
    if (type === 'driver') {
      return {
        align: 'left',
        bg: 'var(--surface)',
        color: 'var(--text)',
        borderColor: 'var(--border)',
      };
    }
    // rider / current user
    return {
      align: 'right',
      bg: 'var(--primary-bg)',
      color: 'var(--text)',
      borderColor: '#C8E6C9',
    };
  }

  if (!authed) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Chat History</h1>
          <p>View ride chat logs and conversations</p>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
              &#9888;
            </div>
            <h3 style={{ marginBottom: 8 }}>Authentication Required</h3>
            <p className="text-muted" style={{ maxWidth: 400, margin: '0 auto' }}>
              You need to be logged in to view chat history. Please
              authenticate through the mobile app or API to access this section.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Chat History</h1>
        <p>View ride chat logs and conversations</p>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Ride Selector Sidebar */}
        <div className="card" style={{ width: 320, flexShrink: 0 }}>
          <div className="card-header">
            <h2>Select Ride</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div className="loading-container" style={{ padding: 40 }}>
                <div className="spinner" />
                <p>Loading rides...</p>
              </div>
            ) : error ? (
              <div style={{ padding: 20 }}>
                <div className="error-message">
                  <p>{error}</p>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={loadRecentRides}
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : rides.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p className="text-muted">No rides found.</p>
              </div>
            ) : (
              <div
                style={{
                  maxHeight: 500,
                  overflowY: 'auto',
                }}
              >
                {rides.map((ride) => (
                  <div
                    key={ride.id}
                    onClick={() => loadMessages(ride.id)}
                    style={{
                      padding: '14px 20px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      background:
                        selectedRideId === ride.id
                          ? 'var(--primary-bg)'
                          : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedRideId !== ride.id) {
                        e.currentTarget.style.background = '#f8f9fb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedRideId !== ride.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            selectedRideId === ride.id
                              ? 'var(--primary)'
                              : 'var(--text)',
                        }}
                      >
                        Ride #{ride.id}
                      </span>
                      <span
                        className={`badge ${
                          ride.status === 'completed'
                            ? 'badge-green'
                            : ride.status === 'cancelled'
                            ? 'badge-red'
                            : ride.status === 'active' ||
                              ride.status === 'in_progress'
                            ? 'badge-blue'
                            : 'badge-gray'
                        }`}
                        style={{ fontSize: 11 }}
                      >
                        {(ride.status ?? 'unknown')
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </div>
                    <div
                      className="text-muted"
                      style={{
                        fontSize: 12,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ride.pickup_address ??
                        ride.pickupAddress ??
                        ride.pickup ??
                        'Unknown pickup'}
                    </div>
                    <div
                      className="text-muted"
                      style={{ fontSize: 11, marginTop: 2 }}
                    >
                      {formatDateTime(
                        ride.created_at ?? ride.createdAt ?? ride.date
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="card" style={{ flex: 1, minHeight: 500 }}>
          <div className="card-header">
            <h2>
              {selectedRideId
                ? `Conversation — Ride #${selectedRideId}`
                : 'Conversation'}
            </h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {!selectedRideId ? (
              <div className="empty-state" style={{ padding: 60 }}>
                <div className="empty-state-icon">&#128172;</div>
                <h3>Select a ride</h3>
                <p>Choose a ride from the list to view its chat history.</p>
              </div>
            ) : messagesLoading ? (
              <div className="loading-container" style={{ padding: 60 }}>
                <div className="spinner" />
                <p>Loading messages...</p>
              </div>
            ) : messagesError ? (
              <div className="error-message" style={{ padding: 40 }}>
                <p>Failed to load messages: {messagesError}</p>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => loadMessages(selectedRideId)}
                >
                  Retry
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state" style={{ padding: 60 }}>
                <div className="empty-state-icon">&#128172;</div>
                <h3>No messages</h3>
                <p>No chat messages found for this ride.</p>
              </div>
            ) : (
              <div
                style={{
                  padding: 24,
                  maxHeight: 500,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {messages.map((msg, i) => {
                  const style = getSenderStyle(msg);
                  const senderType =
                    msg.sender_type ?? msg.senderType ?? msg.type ?? '';
                  const isSystem = senderType === 'system';

                  return (
                    <div
                      key={msg.id ?? i}
                      style={{
                        display: 'flex',
                        justifyContent:
                          style.align === 'center'
                            ? 'center'
                            : style.align === 'right'
                            ? 'flex-end'
                            : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: isSystem ? '90%' : '70%',
                          background: style.bg,
                          border: `1px solid ${style.borderColor}`,
                          borderRadius: isSystem ? 8 : 12,
                          padding: isSystem ? '8px 16px' : '12px 16px',
                          color: style.color,
                        }}
                      >
                        {isSystem ? (
                          <div
                            style={{
                              fontSize: 13,
                              fontStyle: 'italic',
                              textAlign: 'center',
                            }}
                          >
                            {msg.content ?? msg.message ?? msg.text ?? ''}
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                marginBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {msg.sender_name ??
                                  msg.senderName ??
                                  msg.sender ??
                                  (senderType === 'driver'
                                    ? 'Driver'
                                    : 'Rider')}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-muted)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatDateTime(
                                  msg.sent_at ??
                                    msg.sentAt ??
                                    msg.created_at ??
                                    msg.createdAt ??
                                    msg.timestamp
                                )}
                              </span>
                            </div>
                            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                              {msg.content ?? msg.message ?? msg.text ?? ''}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                marginTop: 4,
                                textAlign: 'right',
                              }}
                            >
                              {msg.read || msg.is_read || msg.isRead
                                ? 'Read'
                                : 'Delivered'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
