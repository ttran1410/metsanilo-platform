type Props = {
  selected: boolean;
  onToggle: (selected: boolean) => void;
};

export function OrderRowSelectionCell({ selected, onToggle }: Props) {
  return (
    <td data-label="Select" className="p-3">
      <input type="checkbox" checked={selected} onChange={(event) => onToggle(event.target.checked)} />
    </td>
  );
}
