import React from 'react';

interface SectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
  isCollapsible?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  accent?: string;
}

const Section: React.FC<SectionProps> = ({
  title,
  description,
  children,
  isCollapsible = false,
  isOpen = true,
  onToggle,
  accent = '#FFE500',
}) => {
  const sectionId = `section-content-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="card-brutal mb-8">
      <div
        className={`flex justify-between items-start p-5 border-b-2 border-black ${isCollapsible ? 'cursor-pointer' : ''}`}
        style={{ borderLeft: `6px solid ${accent}`, transition: 'background 0.1s' }}
        onMouseEnter={e => { if (isCollapsible) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#F5F0E8'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = ''; }}
        onClick={isCollapsible ? onToggle : undefined}
        aria-expanded={isCollapsible ? isOpen : undefined}
        aria-controls={isCollapsible ? sectionId : undefined}
      >
        <div className="flex-grow">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1A1A1A' }}>
            {title}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#4A4A4A', marginTop: '2px', fontWeight: 500 }}>{description}</p>
        </div>
        {isCollapsible && (
          <button
            className="btn-brutal-sm ml-4 flex items-center justify-center"
            style={{ width: '32px', height: '32px', background: isOpen ? accent : '#FFFFFF', flexShrink: 0 }}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '16px', height: '16px', color: '#1A1A1A', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {(!isCollapsible || isOpen) && (
        <div id={sectionId} style={{ padding: '1.5rem' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default Section;
