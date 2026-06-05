import React from 'react';

/** Beautiful empty state component */
export const EmptyState = ({
  icon: Icon,
  title = 'Nothing here yet',
  description = '',
  action = null, // { label, onClick }
}) => (
  <div className="empty-state" role="status">
    {Icon && (
      <div className="empty-state-icon">
        <Icon size={36} aria-hidden="true" />
      </div>
    )}
    <h3 className="empty-state-title">{title}</h3>
    {description && <p className="empty-state-desc">{description}</p>}
    {action && (
      <button onClick={action.onClick} className="btn-primary empty-state-btn">
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
