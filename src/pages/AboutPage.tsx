import React from 'react';
import { useUI } from '../context/UIContext';
import { useCatalog } from '../hooks/useCatalog';
import { useTenant } from '../tenant/TenantContext';

/**
 * The café's own "about" page. Every word comes from the tenant configuration
 * (content.about + contact); the component has no café-specific text.
 */
export const AboutPage: React.FC = () => {
  const { setActiveTab } = useUI();
  const { tenant } = useTenant();
  const store = useCatalog().index?.catalog.store ?? null;
  const about = tenant.content.about;
  const { contact } = tenant;
  const phone = contact.phone ?? store?.phone ?? null;
  const address = contact.address ?? store?.address ?? null;

  return (
    <main className="page-content">
      <div className="content-inner">
        {about && (
          <section className="heritage-hero animate-entrance">
            {about.lead && <span className="heritage-lead-tag">{about.lead}</span>}
            <h1 className="heritage-title" id="about-title">{about.title}</h1>
            {about.intro && (
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--on-surface-variant)', maxWidth: '26rem', margin: '0 auto' }}>
                {about.intro}
              </p>
            )}
          </section>
        )}

        {about?.sections.map((section, i) => (
          <article key={i} className="heritage-story-card animate-entrance">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--primary)' }}>
              {section.icon && (
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }} aria-hidden="true">{section.icon}</span>
              )}
              <h2 style={{ fontFamily: 'var(--ff-arabic)', fontSize: '17px', fontWeight: 800 }}>{section.title}</h2>
            </div>
            {section.paragraphs.map((p, j) => (
              <p key={j} className="heritage-story-para">{p}</p>
            ))}
            {section.items.length > 0 && (
              <div className="origins-grid">
                {section.items.map((item, j) => (
                  <div key={j} className="origin-card">
                    <span className="origin-country">{item.title}</span>
                    {item.text && <p className="origin-notes">{item.text}</p>}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}

        <section className="checkout-section-card animate-entrance" aria-label="معلومات التواصل">
          <div className="checkout-section-title">
            <span className="material-symbols-outlined">storefront</span>
            <span>{tenant.identity.displayName}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontFamily: 'var(--ff-arabic)', fontSize: '13px', color: 'var(--on-surface)' }}>
            {address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>pin_drop</span>
                <span>
                  {address}
                  {contact.mapsUrl && (
                    <>
                      {' — '}
                      <a href={contact.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>الخريطة</a>
                    </>
                  )}
                </span>
              </div>
            )}
            {tenant.businessHoursText && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>schedule</span>
                <span>{tenant.businessHoursText}</span>
              </div>
            )}
            {phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>phone</span>
                <a href={`tel:${phone.replace(/[^+0-9]/g, '')}`} style={{ color: 'var(--primary)' }}>{phone}</a>
              </div>
            )}
            {contact.whatsapp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>chat</span>
                <a href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                  واتساب
                </a>
              </div>
            )}
            {(contact.website || contact.social.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {contact.website && (
                  <a className="inline-notice-action" href={contact.website} target="_blank" rel="noopener noreferrer">الموقع</a>
                )}
                {contact.social.map((link) => (
                  <a key={link.url} className="inline-notice-action" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab('menu')}
            className="btn-primary"
            style={{ justifyContent: 'center', height: '3.25rem', marginTop: '0.5rem', width: '100%' }}
            type="button"
          >
            <span>تصفح المنيو</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restaurant_menu</span>
          </button>
        </section>
      </div>
    </main>
  );
};
