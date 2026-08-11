'use client'

import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid'
import { cn } from '@/lib/utils'

interface Option {
  value: string | number
  label: string
  disabled?: boolean
}

interface SelectProps {
  options: Option[]
  value: string | number
  onChange: (value: string | number) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  label?: string
  error?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Seleziona un'opzione",
  disabled = false,
  className = '',
  label,
  error
}: SelectProps) {
  const selectedOption = options.find(option => option.value === value)

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-[var(--pd-text)] mb-1">
          {label}
        </label>
      )}
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <Listbox.Button
            className={cn(
              "relative w-full cursor-default rounded-md py-2 pl-3 pr-10 text-left border focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] sm:text-sm",
              disabled ? "bg-[var(--pd-surface-muted)] text-[var(--pd-muted)] cursor-not-allowed" : "bg-[var(--pd-surface)] text-[var(--pd-text)]",
              error ? "border-[var(--pd-danger)]" : "border-[var(--pd-border-strong)]",
              "shadow-sm"
            )}
          >
            <span className="block truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-[var(--pd-muted)]"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options
              className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md py-1 text-base shadow-lg focus:outline-none sm:text-sm"
              style={{
                backgroundColor: 'var(--pd-surface)',
                border: '1px solid var(--pd-border)',
                boxShadow: 'var(--pd-shadow)',
              }}
            >
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  className={({ active }) =>
                    cn(
                      "relative cursor-default select-none py-2 pl-10 pr-4",
                      active ? 'bg-[var(--pd-accent-soft)] text-[var(--pd-text)]' : 'text-[var(--pd-text)]',
                      option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    )
                  }
                  value={option.value}
                  disabled={option.disabled}
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={cn(
                          "block truncate",
                          selected ? 'font-medium' : 'font-normal'
                        )}
                      >
                        {option.label}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--pd-accent)]">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
      {error && (
        <p className="mt-1 text-sm text-[var(--pd-danger)]">{error}</p>
      )}
    </div>
  )
}
