import AutocompleteMUI from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import React from 'react'

import { cn } from '@/lib/utils'

interface AutocompleteProps {
  /** current value */
  value: string
  /** called with new value when changed */
  onChange: (value: string) => void
  /** list of suggested options */
  options: string[]
  /** placeholder text */
  placeholder?: string
  /** label shown above field (optional – you can also wrap in your own Label) */
  label?: string
  /** additional className for root */
  className?: string
}

/**
 * Tailwind-styled wrapper around MUI Autocomplete.
 * Supports free text entry (freeSolo) and provides option suggestions.
 */
export function Autocomplete({
  value,
  onChange,
  options,
  placeholder,
  label,
  className,
}: AutocompleteProps) {
  return (
    <AutocompleteMUI
      freeSolo
      options={options}
      value={value}
      onInputChange={(_, newValue) => onChange(newValue)}
      sx={{ width: '100%' }}
      renderInput={params => (
        <TextField
          {...params}
          placeholder={placeholder}
          label={label}
          variant="outlined"
          className={cn(
            'bg-slate-800 rounded-md [&_.MuiOutlinedInput-notchedOutline]:border-slate-700 [&_input]:text-cream-white',
            className
          )}
          InputProps={{
            ...params.InputProps,
            className: 'text-cream-white',
          }}
          InputLabelProps={{
            ...params.InputLabelProps,
            className: 'text-slate-400',
            shrink: true,
          }}
        />
      )}
    />
  )
}
