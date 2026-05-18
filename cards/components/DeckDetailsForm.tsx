import React, { ChangeEvent } from 'react';
import type { DeckDetails } from '../types';

interface DeckDetailsFormProps {
  details: DeckDetails;
  onDetailsChange: (newDetails: DeckDetails) => void;
  variant?: 'basic' | 'technical';
}

const InputField = ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder = '',
}: {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) => (
  <div>
    <label htmlFor={name} className="label-brutal">{label}</label>
    <input
      type={type}
      name={name}
      id={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="input-brutal"
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}> = ({ label, name, value, onChange, children }) => (
  <div>
    <label htmlFor={name} className="label-brutal">{label}</label>
    <select name={name} id={name} value={value} onChange={onChange} className="input-brutal" style={{ appearance: 'auto' }}>
      {children}
    </select>
  </div>
);

const TextAreaField = ({
  label,
  name,
  value,
  onChange,
  placeholder = '',
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) => (
  <div>
    <label htmlFor={name} className="label-brutal">{label}</label>
    <textarea
      name={name}
      id={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={3}
      className="input-brutal"
      style={{ resize: 'vertical' }}
    />
  </div>
);

const DeckDetailsForm: React.FC<DeckDetailsFormProps> = ({ details, onDetailsChange, variant = 'basic' }) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const type = 'type' in e.target ? (e.target as HTMLInputElement).type : '';
    onDetailsChange({
      ...details,
      [name]: type === 'number' ? Number(value) : value,
    });
  };

  if (variant === 'technical') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          <InputField
            label="Base URL — Game QR Codes"
            name="baseUrl"
            value={details.baseUrl ?? 'https://www.massivescan.com/qrc/'}
            onChange={handleChange}
            placeholder="https://www.massivescan.com/qrc/"
          />
          <InputField
            label="Base URL — Utility QR Codes"
            name="utilityBaseUrl"
            value={details.utilityBaseUrl ?? ''}
            onChange={handleChange}
            placeholder="e.g., https://your.site/promo/"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem' }}>
          <InputField label="Deck ID" name="deck_id" value={details.deck_id ?? '0001'} onChange={handleChange} placeholder="0001" />
          <InputField label="Version" name="version" value={details.version} onChange={handleChange} type="number" />
          <SelectField label="QR Error Correction Level" name="errorCorrectionLevel" value={details.errorCorrectionLevel ?? 'Q'} onChange={handleChange}>
            <option value="L">L — Low (~7% damage recovery)</option>
            <option value="M">M — Medium (~15% damage recovery)</option>
            <option value="Q">Q — Quartile (~25% damage recovery)</option>
            <option value="H">H — High (~30% damage recovery)</option>
          </SelectField>
        </div>
      </div>
    );
  }

  // variant === 'basic'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <InputField label="Deck Name" name="deck_name" value={details.deck_name} onChange={handleChange} />
      <TextAreaField label="Deck Description" name="deck_description" value={details.deck_description} onChange={handleChange} />
    </div>
  );
};

export default DeckDetailsForm;
