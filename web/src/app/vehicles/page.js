'use client';

import { useState, useEffect } from 'react';
import { fetchAPI, formatCurrency } from '../../lib/api';

const VEHICLE_ICONS = {
  standard: '&#128663;',
  economy: '&#128664;',
  premium: '&#128661;',
  luxury: '&#128661;',
  xl: '&#128656;',
  suv: '&#128656;',
  van: '&#128656;',
  pool: '&#128652;',
  shared: '&#128652;',
  accessible: '&#9855;',
  wheelchair: '&#9855;',
};

function getVehicleIcon(type) {
  const key = (type ?? '').toLowerCase();
  for (const [k, v] of Object.entries(VEHICLE_ICONS)) {
    if (key.includes(k)) return v;
  }
  return '&#128663;';
}

function isAccessibleType(vehicle) {
  const name = (
    vehicle.name ??
    vehicle.type ??
    vehicle.vehicle_type ??
    ''
  ).toLowerCase();
  return (
    name.includes('accessible') ||
    name.includes('wheelchair') ||
    vehicle.is_accessible === true ||
    vehicle.isAccessible === true ||
    vehicle.accessible === true
  );
}

function isPoolType(vehicle) {
  const name = (
    vehicle.name ??
    vehicle.type ??
    vehicle.vehicle_type ??
    ''
  ).toLowerCase();
  return (
    name.includes('pool') ||
    name.includes('shared') ||
    vehicle.is_shared === true ||
    vehicle.isShared === true
  );
}

export default function VehiclesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    loadVehicleTypes();
  }, []);

  async function loadVehicleTypes() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI('/vehicle-types');
      setVehicles(
        Array.isArray(data)
          ? data
          : data?.vehicle_types ?? data?.vehicleTypes ?? data?.types ?? data?.data ?? []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Vehicle Types</h1>
        <p>Explore available vehicle options for your rides</p>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading vehicle types...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>Failed to load vehicle types: {error}</p>
          <button className="btn btn-primary" onClick={loadVehicleTypes}>
            Retry
          </button>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128663;</div>
          <h3>No vehicle types available</h3>
          <p>Vehicle type information is currently unavailable. Please try again later.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 24,
          }}
        >
          {vehicles.map((vehicle, i) => {
            const accessible = isAccessibleType(vehicle);
            const pool = isPoolType(vehicle);
            const typeName =
              vehicle.name ??
              vehicle.type ??
              vehicle.vehicle_type ??
              vehicle.vehicleType ??
              `Vehicle ${i + 1}`;
            const multiplier =
              vehicle.price_multiplier ??
              vehicle.priceMultiplier ??
              vehicle.multiplier ??
              vehicle.surge_multiplier ??
              null;
            const capacity =
              vehicle.capacity ??
              vehicle.max_passengers ??
              vehicle.maxPassengers ??
              vehicle.seats ??
              null;
            const features =
              vehicle.features ??
              vehicle.amenities ??
              [];
            const description =
              vehicle.description ??
              vehicle.desc ??
              vehicle.summary ??
              '';

            return (
              <div
                key={vehicle.id ?? i}
                className="card"
                style={{
                  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                  cursor: 'default',
                  border: accessible
                    ? '2px solid var(--info)'
                    : pool
                    ? '2px solid var(--primary)'
                    : '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow)';
                }}
              >
                <div className="card-body">
                  {/* Badges Row */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: accessible || pool ? 12 : 0 }}>
                    {accessible && (
                      <span className="badge badge-blue">
                        &#9855; Accessible
                      </span>
                    )}
                    {pool && (
                      <span className="badge badge-green">
                        &#128176; Save Money
                      </span>
                    )}
                  </div>

                  {/* Icon and Title */}
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '16px 0',
                    }}
                  >
                    <div
                      style={{ fontSize: 56, marginBottom: 12 }}
                      dangerouslySetInnerHTML={{
                        __html: getVehicleIcon(typeName),
                      }}
                    />
                    <h3
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: 'var(--text)',
                        marginBottom: 8,
                      }}
                    >
                      {typeName
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </h3>
                    {description && (
                      <p
                        className="text-muted"
                        style={{
                          fontSize: 14,
                          lineHeight: 1.5,
                          maxWidth: 280,
                          margin: '0 auto',
                        }}
                      >
                        {description}
                      </p>
                    )}
                  </div>

                  {/* Details */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 32,
                      padding: '16px 0',
                      borderTop: '1px solid var(--border)',
                      borderBottom: features.length > 0 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {multiplier !== null && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          Price
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--primary)',
                          }}
                        >
                          {multiplier}x
                        </div>
                      </div>
                    )}
                    {capacity !== null && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          Capacity
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--text)',
                          }}
                        >
                          {capacity} {capacity === 1 ? 'seat' : 'seats'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  {features.length > 0 && (
                    <div style={{ paddingTop: 16 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          marginBottom: 10,
                        }}
                      >
                        Features
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        {features.map((feature, fi) => (
                          <span
                            key={fi}
                            className="badge badge-gray"
                            style={{ fontSize: 12 }}
                          >
                            {typeof feature === 'string'
                              ? feature
                              : feature.name ?? feature.label ?? ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
