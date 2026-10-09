import type { ChangeEventHandler } from "react";

type SelectionCheckboxProps = {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

export function SelectionCheckbox({ label, checked, indeterminate = false, disabled, onChange }: SelectionCheckboxProps) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      ref={(node) => { if (node) node.indeterminate = indeterminate; }}
      className="size-4 cursor-pointer rounded-sm accent-focus-ring disabled:cursor-default"
    />
  );
}
