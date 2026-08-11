'use client'

import ReactSelect, { Props as ReactSelectProps, StylesConfig } from 'react-select'
import { forwardRef } from 'react'

interface Option {
  value: string | number
  label: string
}

interface SelectProps extends Omit<ReactSelectProps<Option, false>, 'styles'> {
  label?: string
  error?: string
}

const customStyles: StylesConfig<Option, false> = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: 'var(--pd-surface)',
    borderColor: state.isFocused ? 'var(--pd-accent)' : 'var(--pd-border-strong)',
    borderWidth: '1px',
    borderRadius: '8px',
    minHeight: '44px',
    fontSize: '14px',
    boxShadow: state.isFocused ? '0 0 0 3px var(--pd-accent-soft)' : 'none',
    '&:hover': {
      borderColor: 'var(--pd-accent)',
    },
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? 'var(--pd-accent)'
      : state.isFocused
        ? 'var(--pd-accent-soft)'
        : 'var(--pd-surface)',
    color: state.isSelected
      ? 'var(--pd-accent-fg)'
      : 'var(--pd-text)',
    fontSize: '14px',
    padding: '12px 16px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: state.isSelected ? 'var(--pd-accent)' : 'var(--pd-accent-soft)',
      color: state.isSelected ? 'var(--pd-accent-fg)' : 'var(--pd-text)',
    },
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'var(--pd-text)',
    fontSize: '14px',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: 'var(--pd-muted)',
    fontSize: '14px',
  }),
  menu: (provided) => ({
    ...provided,
    borderRadius: '8px',
    border: '1px solid var(--pd-border)',
    backgroundColor: 'var(--pd-surface)',
    boxShadow: 'var(--pd-shadow)',
    zIndex: 50,
  }),
  menuList: (provided) => ({
    ...provided,
    padding: '4px',
  }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    color: state.isFocused ? 'var(--pd-accent)' : 'var(--pd-muted)',
    '&:hover': {
      color: 'var(--pd-accent)',
    },
  }),
  clearIndicator: (provided) => ({
    ...provided,
    color: 'var(--pd-muted)',
    '&:hover': {
      color: 'var(--pd-danger)',
    },
  }),
}

export const Select = forwardRef<any, SelectProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className={`w-full ${className || ''}`}>
        {label && (
          <label className="block text-sm font-medium text-[var(--pd-text)] mb-2">
            {label}
          </label>
        )}
        <ReactSelect
          ref={ref}
          styles={customStyles}
          classNamePrefix="react-select"
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-[var(--pd-danger)]">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export type { Option }
