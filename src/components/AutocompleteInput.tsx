import { useState, useRef, useEffect, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string;
  onChange: (value: string) => void;
  options: string[];
};

export default function AutocompleteInput({ value, onChange, options, ...inputProps }: Props) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.length < 1) {
      setFiltered([]);
      setOpen(false);
      return;
    }
    const lower = value.toLowerCase();
    const matches = options
      .filter((opt) => opt.toLowerCase().startsWith(lower) && opt !== value)
      .slice(0, 8);
    setFiltered(matches);
    setOpen(matches.length > 0);
  }, [value, options]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        {...inputProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (filtered.length > 0) setOpen(true);
        }}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((option) => (
            <li
              key={option}
              onMouseDown={() => {
                onChange(option);
                setOpen(false);
              }}
              className="px-3 py-2 text-sm text-gray-800 hover:bg-primary-50 cursor-pointer first:rounded-t-xl last:rounded-b-xl"
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
