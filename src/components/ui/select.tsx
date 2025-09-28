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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <Listbox.Button
            className={cn(
              "relative w-full cursor-default rounded-md bg-white py-2 pl-3 pr-10 text-left border focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm",
              disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "text-gray-900",
              error ? "border-red-300" : "border-gray-300",
              "shadow-sm"
            )}
          >
            <span className="block truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
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
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  className={({ active, selected }) =>
                    cn(
                      "relative cursor-default select-none py-2 pl-10 pr-4",
                      active ? 'bg-orange-100 text-orange-900' : 'text-gray-900',
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
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-orange-600">
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
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
