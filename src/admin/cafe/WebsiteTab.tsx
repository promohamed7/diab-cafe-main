import React, { useState } from 'react';
import { api } from '../api';
import { Card, SaveBar, TextArea, TextInput, Toggle, orNull, useSave } from '../ui';
import type { TabProps } from './types';
import { sectionPath } from './types';

interface Promo {
  title: string;
  text: string;
  imageUrl: string;
}
interface AboutSection {
  title: string;
  icon: string;
  paragraphs: string;
  items: string;
}

const paragraphsOf = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
/** "Title: text" per line. */
const itemsOf = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':');
      return i > 0 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { title: l, text: '' };
    });

export const WebsiteTab: React.FC<TabProps> = ({ tenant, reload }) => {
  const c = tenant.content;
  const [hero, setHero] = useState({
    heroBadge: c.heroBadge ?? '',
    heroTitle: c.heroTitle ?? '',
    heroSubtitle: c.heroSubtitle ?? '',
    heroImageUrl: c.heroImageUrl ?? '',
    heroImageMobileUrl: c.heroImageMobileUrl ?? ''
  });
  const [announcement, setAnnouncement] = useState({ text: c.announcement?.text ?? '', linkUrl: c.announcement?.linkUrl ?? '' });
  const [promotions, setPromotions] = useState<Promo[]>((c.promotions ?? []).map((p: any) => ({ title: p.title, text: p.text ?? '', imageUrl: p.imageUrl ?? '' })));
  const [footerText, setFooterText] = useState(c.footerText ?? '');
  const [aboutOn, setAboutOn] = useState(!!c.about);
  const [about, setAbout] = useState({
    navLabel: c.about?.navLabel ?? 'من نحن',
    title: c.about?.title ?? '',
    lead: c.about?.lead ?? '',
    intro: c.about?.intro ?? ''
  });
  const [sections, setSections] = useState<AboutSection[]>(
    (c.about?.sections ?? []).map((s: any) => ({
      title: s.title,
      icon: s.icon ?? '',
      paragraphs: (s.paragraphs ?? []).join('\n\n'),
      items: (s.items ?? []).map((i: any) => (i.text ? `${i.title}: ${i.text}` : i.title)).join('\n')
    }))
  );

  const ct = tenant.contact;
  const [contact, setContact] = useState({
    phone: ct.phone ?? '',
    whatsapp: ct.whatsapp ?? '',
    address: ct.address ?? '',
    mapsUrl: ct.mapsUrl ?? '',
    website: ct.website ?? '',
    businessHoursText: tenant.businessHoursText ?? ''
  });
  const [social, setSocial] = useState<{ label: string; url: string }[]>(ct.social ?? []);

  const saveContent = useSave();
  const saveContact = useSave();

  return (
    <div className="tab-body">
      <form
        id="website-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = {
            heroBadge: orNull(hero.heroBadge),
            heroTitle: orNull(hero.heroTitle),
            heroSubtitle: orNull(hero.heroSubtitle),
            heroImageUrl: orNull(hero.heroImageUrl),
            heroImageMobileUrl: orNull(hero.heroImageMobileUrl),
            announcement: announcement.text.trim() ? { text: announcement.text.trim(), linkUrl: orNull(announcement.linkUrl) } : null,
            promotions: promotions.filter((p) => p.title.trim()).map((p) => ({ title: p.title.trim(), text: orNull(p.text), imageUrl: orNull(p.imageUrl) })),
            footerText: orNull(footerText),
            about:
              aboutOn && about.title.trim()
                ? {
                    navLabel: about.navLabel.trim() || about.title.trim().slice(0, 30),
                    title: about.title.trim(),
                    lead: orNull(about.lead),
                    intro: orNull(about.intro),
                    sections: sections
                      .filter((s) => s.title.trim())
                      .map((s) => ({ title: s.title.trim(), icon: orNull(s.icon), paragraphs: paragraphsOf(s.paragraphs), items: itemsOf(s.items) }))
                  }
                : null
          };
          if (await saveContent.run(() => api('PUT', sectionPath(tenant.tenantId, 'website'), body))) reload();
        }}
      >
        <Card title="Hero">
          <div className="form-grid">
            <TextInput label="Badge" value={hero.heroBadge} onChange={(v) => setHero({ ...hero, heroBadge: v })} />
            <TextInput label="Title" name="heroTitle" value={hero.heroTitle} onChange={(v) => setHero({ ...hero, heroTitle: v })} />
            <TextInput label="Subtitle" name="heroSubtitle" value={hero.heroSubtitle} onChange={(v) => setHero({ ...hero, heroSubtitle: v })} wide />
            <TextInput label="Hero image URL" value={hero.heroImageUrl} onChange={(v) => setHero({ ...hero, heroImageUrl: v })} wide />
            <TextInput label="Hero image URL (mobile)" value={hero.heroImageMobileUrl} onChange={(v) => setHero({ ...hero, heroImageMobileUrl: v })} wide />
          </div>
        </Card>

        <Card title="Announcement">
          <div className="form-grid">
            <TextInput
              label="Text"
              name="announcementText"
              value={announcement.text}
              onChange={(v) => setAnnouncement({ ...announcement, text: v })}
              hint="Shown at the top of every page. Leave empty for none."
              wide
            />
            <TextInput label="Link (optional)" value={announcement.linkUrl} onChange={(v) => setAnnouncement({ ...announcement, linkUrl: v })} wide />
          </div>
        </Card>

        <Card
          title="Promotional sections"
          actions={
            promotions.length < 6 && (
              <button type="button" className="btn btn-ghost btn-small" id="add-promotion" onClick={() => setPromotions([...promotions, { title: '', text: '', imageUrl: '' }])}>
                Add section
              </button>
            )
          }
        >
          <p className="muted">Display only — prices and discounts always come from INBYTE Café.</p>
          {promotions.map((p, i) => (
            <div className="repeat-row" key={i}>
              <TextInput label="Title" name={`promo-${i}-title`} value={p.title} onChange={(v) => setPromotions(promotions.map((x, j) => (j === i ? { ...x, title: v } : x)))} />
              <TextInput label="Text" value={p.text} onChange={(v) => setPromotions(promotions.map((x, j) => (j === i ? { ...x, text: v } : x)))} wide />
              <TextInput label="Image URL" value={p.imageUrl} onChange={(v) => setPromotions(promotions.map((x, j) => (j === i ? { ...x, imageUrl: v } : x)))} wide />
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setPromotions(promotions.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
        </Card>

        <Card title="About page">
          <Toggle label="Show an About page" checked={aboutOn} onChange={setAboutOn} />
          {aboutOn && (
            <>
              <div className="form-grid">
                <TextInput label="Navigation label" value={about.navLabel} onChange={(v) => setAbout({ ...about, navLabel: v })} />
                <TextInput label="Title" value={about.title} onChange={(v) => setAbout({ ...about, title: v })} />
                <TextInput label="Lead" value={about.lead} onChange={(v) => setAbout({ ...about, lead: v })} wide />
                <TextArea label="Introduction" value={about.intro} onChange={(v) => setAbout({ ...about, intro: v })} />
              </div>
              {sections.map((s, i) => (
                <div className="repeat-row" key={i}>
                  <TextInput label="Section title" value={s.title} onChange={(v) => setSections(sections.map((x, j) => (j === i ? { ...x, title: v } : x)))} />
                  <TextInput label="Icon (Material Symbols name)" value={s.icon} onChange={(v) => setSections(sections.map((x, j) => (j === i ? { ...x, icon: v } : x)))} />
                  <TextArea label="Paragraphs (blank line between)" value={s.paragraphs} onChange={(v) => setSections(sections.map((x, j) => (j === i ? { ...x, paragraphs: v } : x)))} />
                  <TextArea label="Items (one per line: Title: text)" value={s.items} onChange={(v) => setSections(sections.map((x, j) => (j === i ? { ...x, items: v } : x)))} />
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => setSections(sections.filter((_, j) => j !== i))}>
                    Remove section
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setSections([...sections, { title: '', icon: '', paragraphs: '', items: '' }])}>
                Add section
              </button>
            </>
          )}
        </Card>

        <Card title="Footer">
          <TextInput label="Footer text" name="footerText" value={footerText} onChange={setFooterText} wide />
        </Card>
        <SaveBar state={saveContent.state} label="Save website content" />
      </form>

      <form
        id="contact-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = {
            phone: orNull(contact.phone),
            whatsapp: orNull(contact.whatsapp),
            address: orNull(contact.address),
            mapsUrl: orNull(contact.mapsUrl),
            website: orNull(contact.website),
            businessHoursText: orNull(contact.businessHoursText),
            social: social.filter((s) => s.label.trim() && s.url.trim())
          };
          if (await saveContact.run(() => api('PUT', sectionPath(tenant.tenantId, 'contact'), body))) reload();
        }}
      >
        <Card title="Contact and opening hours">
          <div className="form-grid">
            <TextInput label="Phone" name="phone" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} />
            <TextInput label="WhatsApp" value={contact.whatsapp} onChange={(v) => setContact({ ...contact, whatsapp: v })} />
            <TextInput label="Address" name="address" value={contact.address} onChange={(v) => setContact({ ...contact, address: v })} wide />
            <TextInput label="Map link" value={contact.mapsUrl} onChange={(v) => setContact({ ...contact, mapsUrl: v })} wide />
            <TextInput label="Website" value={contact.website} onChange={(v) => setContact({ ...contact, website: v })} wide />
            <TextInput
              label="Opening hours"
              name="businessHoursText"
              value={contact.businessHoursText}
              onChange={(v) => setContact({ ...contact, businessHoursText: v })}
              hint="Display text only — the site never claims the café is open."
              wide
            />
          </div>
          <h3>Social media</h3>
          {social.map((s, i) => (
            <div className="repeat-row" key={i}>
              <TextInput label="Label" value={s.label} onChange={(v) => setSocial(social.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
              <TextInput label="URL" value={s.url} onChange={(v) => setSocial(social.map((x, j) => (j === i ? { ...x, url: v } : x)))} wide />
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setSocial(social.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          {social.length < 8 && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setSocial([...social, { label: '', url: '' }])}>
              Add link
            </button>
          )}
          <SaveBar state={saveContact.state} label="Save contact" />
        </Card>
      </form>
    </div>
  );
};
