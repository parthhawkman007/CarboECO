import React from "react";

interface Field {
  key: string;
  label: string;
}

interface AccessibleChartProps {
  title: string;
  description: string;
  data: Array<Record<string, any>>;
  fields: Field[];
  children: React.ReactNode;
}

export default function AccessibleChart({
  title,
  description,
  data,
  fields,
  children,
}: AccessibleChartProps) {
  return (
    <div className="relative w-full h-full" role="img" aria-label={`${title}. ${description}`}>
      {/* Screen Reader Alternative Data Presentation */}
      <div className="sr-only">
        <h3>{title}</h3>
        <p>{description}</p>
        <table>
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field.key} scope="col">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                {fields.map((field) => (
                  <td key={field.key}>{String(row[field.key] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Visual Chart Graphic (Hidden from assistive technologies to avoid noisy SVG path readings) */}
      <div aria-hidden="true" className="w-full h-full">
        {children}
      </div>
    </div>
  );
}
