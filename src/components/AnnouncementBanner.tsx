import React from 'react';
import { useTenant } from '../tenant/TenantContext';

/** Short café announcement configured in the INBYTE Admin (e.g. changed opening hours). */
export const AnnouncementBanner: React.FC = () => {
  const { tenant } = useTenant();
  const announcement = tenant.content.announcement;
  if (!announcement) return null;
  return (
    <div className="table-session-banner is-info" role="status" id="tenant-announcement">
      <span className="material-symbols-outlined" aria-hidden="true">campaign</span>
      <span>{announcement.text}</span>
      {announcement.linkUrl && (
        <a href={announcement.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-notice-action">
          التفاصيل
        </a>
      )}
    </div>
  );
};
