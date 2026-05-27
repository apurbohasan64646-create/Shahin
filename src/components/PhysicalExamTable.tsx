import React from "react";
import { PhysicalExamination } from "../types";

interface PhysicalExamTableProps {
  data: PhysicalExamination;
  isEditable: boolean;
  onUpdate: (fields: Partial<PhysicalExamination>) => void;
}

export default function PhysicalExamTable({
  data,
  isEditable,
  onUpdate,
}: PhysicalExamTableProps) {
  // Mapping of internal keys to printed row labels
  const rows: { key: keyof PhysicalExamination; label: string }[] = [
    { key: "height", label: "Height" },
    { key: "weight", label: "Weight" },
    { key: "pulse", label: "Pulse" },
    { key: "bloodPressure", label: "Blood Pressure (BP)" },
    { key: "heart", label: "Heart" },
    { key: "liver", label: "Liver" },
    { key: "spleen", label: "Spleen" },
    { key: "eyeLeft", label: "Eye (LT)" },
    { key: "eyeRight", label: "Eye (RT)" },
    { key: "ent", label: "ENT" },
    { key: "skin", label: "Skin" },
    { key: "physicalCondition", label: "Physical Condition" },
    { key: "ecg", label: "ECG" },
    { key: "chestP_A_View", label: "Chest P/A View" },
  ];

  return (
    <div className="flex-1">
      <table className="w-full border-2 border-slate-900 text-left text-[11px] leading-[14px]">
        <thead>
          <tr className="border-b-2 border-slate-900 bg-slate-50">
            <th
              colSpan={2}
              className="py-1 px-2 text-center font-[800] text-gray-950 uppercase tracking-wider text-[11px]"
            >
              PHYSICAL EXAMINATION
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label }) => (
            <tr key={key} className="border-b border-slate-900 last:border-b-0">
              {/* Row Label */}
              <td className="py-1 px-2 font-semibold text-gray-800 border-r border-slate-900 w-[55%]">
                {label}
              </td>
              {/* Row Value */}
              <td className="py-1 px-2 font-bold text-gray-950 bg-white">
                {isEditable ? (
                  <input
                    type="text"
                    value={data[key]}
                    onChange={(e) => onUpdate({ [key]: e.target.value })}
                    className="w-full font-bold text-gray-950 border border-dashed border-gray-300 rounded px-1 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                  />
                ) : (
                  <span className="select-all block w-full">{data[key]}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
