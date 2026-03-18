interface CsvPreviewProps {
  headers: string[];
  rows: string[][];
  maxRows?: number;
}

export function CsvPreview({
  headers,
  rows,
  maxRows = 10,
}: CsvPreviewProps) {
  const displayRows = rows.slice(0, maxRows);
  const truncated = rows.length > maxRows;

  return (
    <div className="space-y-2">
      <div className="overflow-auto rounded-md border border-border-custom">
        <table className="w-full font-body text-sm">
          <thead>
            <tr className="border-b border-border-custom bg-muted/50">
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-medium text-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-border-custom last:border-b-0"
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-3 py-2 text-foreground"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <p className="text-xs text-muted-foreground">
          Zobrazených {displayRows.length} z {rows.length} riadkov
        </p>
      )}
    </div>
  );
}
