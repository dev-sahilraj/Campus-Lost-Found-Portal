import React from 'react';
import './Skeleton.css';

/** Animated shimmer placeholder */
export const Skeleton = ({ width = '100%', height = '1rem', radius = '0.5rem', className = '' }) => (
  <div
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius: radius }}
    role="status"
    aria-label="Loading..."
  />
);

/** Full card skeleton */
export const SkeletonCard = () => (
  <div className="skeleton-card" aria-hidden="true">
    <Skeleton height="150px" radius="0.5rem 0.5rem 0 0" />
    <div className="skeleton-card-body">
      <Skeleton height="1rem" width="70%" />
      <Skeleton height="0.75rem" width="50%" />
      <Skeleton height="0.75rem" width="40%" />
    </div>
  </div>
);

/** Skeleton grid of cards */
export const SkeletonGrid = ({ count = 6 }) => (
  <div className="skeleton-grid" role="status" aria-label="Loading items...">
    {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
  </div>
);

/** Skeleton for a list row */
export const SkeletonRow = () => (
  <div className="skeleton-row" aria-hidden="true">
    <Skeleton width="44px" height="44px" radius="50%" />
    <div className="skeleton-row-body">
      <Skeleton height="0.875rem" width="55%" />
      <Skeleton height="0.75rem" width="35%" />
    </div>
    <Skeleton width="60px" height="1.5rem" radius="1rem" />
  </div>
);

/** Skeleton for page header */
export const SkeletonHeader = () => (
  <div className="skeleton-header" aria-hidden="true">
    <Skeleton width="220px" height="2rem" />
    <Skeleton width="120px" height="1rem" />
  </div>
);
