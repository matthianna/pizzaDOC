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
    backgroundColor: 'white',
    borderColor: state.isFocused ? '#f97316' : '#d1d5db',
    borderWidth: '1px',
    borderRadius: '8px',
    minHeight: '44px',
    fontSize: '14px',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(249, 115, 22, 0.1)' : 'none',
    '&:hover': {
      borderColor: '#f97316',
    },
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected 
      ? '#f97316' 
      : state.isFocused 
        ? '#fed7aa' 
        : 'white',
    color: state.isSelected 
      ? 'white' 
      : state.isFocused 
        ? '#ea580c' 
        : '#374151',
    fontSize: '14px',
    padding: '12px 16px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: state.isSelected ? '#f97316' : '#fed7aa',
      color: state.isSelected ? 'white' : '#ea580c',
    },
  }),
  singleValue: (provided) => ({
    ...provided,
    color: '#374151',
    fontSize: '14px',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: '#9ca3af',
    fontSize: '14px',
  }),
  menu: (provided) => ({
    ...provided,
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 50,
  }),
  menuList: (provided) => ({
    ...provided,
    padding: '4px',
  }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    color: state.isFocused ? '#f97316' : '#9ca3af',
    '&:hover': {
      color: '#f97316',
    },
  }),
  clearIndicator: (provided) => ({
    ...provided,
    color: '#9ca3af',
    '&:hover': {
      color: '#ef4444',
    },
  }),
}

export const Select = forwardRef<any, SelectProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className={`w-full ${className || ''}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export type { Option }
