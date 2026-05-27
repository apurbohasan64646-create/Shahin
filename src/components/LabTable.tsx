import React from "react";
import { LabInvestigations } from "../types";

interface LabTableProps {
  data: LabInvestigations;
  isEditable: boolean;
  onUpdate: (fields: Partial<LabInvestigations>) => void;
}

export default function LabTable({ data, isEditable, onUpdate }: LabTableProps) {
  // Helpers to update subfields
  const updateSerology = (fields: Partial<LabInvestigations["serology"]>) => {
    onUpdate({
      ...data,
      serology: { ...data.serology, ...fields },
    });
  };

  const updateBiochemical = (fields: Partial<LabInvestigations["biochemical"]>) => {
    onUpdate({
      ...data,
      biochemical: { ...data.biochemical, ...fields },
    });
  };

  const updateHematology = (fields: Partial<LabInvestigations["hematology"]>) => {
    onUpdate({
      ...data,
      hematology: { ...data.hematology, ...fields },
    });
  };

  const updateUrine = (fields: Partial<LabInvestigations["urine"]>) => {
    onUpdate({
      ...data,
      urine: { ...data.urine, ...fields },
    });
  };

  return (
    <div className="flex-1">
      <table className="w-full border-2 border-slate-900 text-left text-[11px] leading-[14px]">
        <thead>
          <tr className="border-b-2 border-slate-900 bg-slate-50">
            <th
              colSpan={3}
              className="py-1 px-2 text-center font-[800] text-gray-950 uppercase tracking-wider text-[11px]"
            >
              LABORATORY INVESTIGATIONS
            </th>
          </tr>
        </thead>
        <tbody>
          {/* SEROLOGY SECTION */}
          {/* Row 1: HBsAg */}
          <tr className="border-b border-slate-900">
            <td
              rowSpan={4}
              className="py-2 px-2 font-[800] text-gray-950 text-center bg-slate-50 border-r border-slate-900 align-middle uppercase text-[10px] tracking-wide w-[28%]"
            >
              SEROLOGY
            </td>
            <td className="py-1 px-2 font-semibold text-gray-800 border-r border-slate-900 w-[32%]">
              HBsAg
            </td>
            <td className="py-1 px-2 font-bold text-gray-950 bg-white">
              {isEditable ? (
                <input
                  type="text"
                  value={data.serology.hbsag}
                  onChange={(e) => updateSerology({ hbsag: e.target.value })}
                  className="w-full font-bold border border-dashed border-gray-300 rounded px-1 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                />
              ) : (
                <span className="select-all block w-full">{data.serology.hbsag}</span>
              )}
            </td>
          </tr>
          {/* Row 2: VDRL */}
          <tr className="border-b border-slate-900">
            <td className="py-1 px-2 font-semibold text-gray-800 border-r border-slate-900">
              VDRL
            </td>
            <td className="py-1 px-2 font-bold text-gray-950 bg-white">
              {isEditable ? (
                <input
                  type="text"
                  value={data.serology.vdrl}
                  onChange={(e) => updateSerology({ vdrl: e.target.value })}
                  className="w-full font-bold border border-dashed border-gray-300 rounded px-1 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                />
              ) : (
                <span className="select-all block w-full">{data.serology.vdrl}</span>
              )}
            </td>
          </tr>
          {/* Row 3: TPHA */}
          <tr className="border-b border-slate-900">
            <td className="py-1 px-2 font-semibold text-gray-800 border-r border-slate-900">
              TPHA
            </td>
            <td className="py-1 px-2 font-bold text-gray-950 bg-white">
              {isEditable ? (
                <input
                  type="text"
                  value={data.serology.tpha}
                  onChange={(e) => updateSerology({ tpha: e.target.value })}
                  className="w-full font-bold border border-dashed border-gray-300 rounded px-1 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                />
              ) : (
                <span className="select-all block w-full">{data.serology.tpha}</span>
              )}
            </td>
          </tr>
          {/* Row 4: Blood Group */}
          <tr className="border-b-2 border-slate-900">
            <td className="py-1 px-2 font-semibold text-gray-800 border-r border-slate-900">
              Blood Group
            </td>
            <td className="py-1 px-2 font-bold text-gray-950 bg-white">
              {isEditable ? (
                <input
                  type="text"
                  value={data.serology.bloodGroup}
                  onChange={(e) => updateSerology({ bloodGroup: e.target.value })}
                  className="w-full font-bold border border-dashed border-gray-300 rounded px-1 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                />
              ) : (
                <span className="select-all block w-full">{data.serology.bloodGroup}</span>
              )}
            </td>
          </tr>

          {/* BIOCHEMICAL SECTION */}
          {/* Row 1: S. Bilirubin */}
          <tr className="border-b border-slate-900">
            <td
              rowSpan={2}
              className="py-2 px-2 font-[800] text-gray-950 text-center bg-slate-50 border-r border-slate-900 align-middle uppercase text-[10px] tracking-wide"
            >
              BIOCHEMICAL
            </td>
            <td className="py-1 px-2 font-semibold text-gray-800 border-r border-slate-900">
              S. Bilirubin
            </td>
            <td className="py-1 px-2 font-bold text-gray-950 bg-white">
              {isEditable ? (
                <input
                  type="text"
                  value={data.biochemical.sBilirubin}
                  onChange={(e) => updateBiochemical({ sBilirubin: e.target.value })}
                  className="w-full font-bold border border-dashed border-gray-300 rounded px-1 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                />
              ) : (
                <span className="select-all block w-full">{data.biochemical.sBilirubin}</span>
              )}
            </td>
          </tr>
          {/* Row 2: Sugar Random */}
          <tr className="border-b-2 border-slate-900">
            <td className="py-1 px-2 font-semibold text-gray-800 border-r border-slate-900">
              Sugar Random
            </td>
            <td className="py-1 px-2 font-bold text-gray-950 bg-white">
              {isEditable ? (
                <input
                  type="text"
                  value={data.biochemical.sugarRandom}
                  onChange={(e) => updateBiochemical({ sugarRandom: e.target.value })}
                  className="w-full font-bold border border-dashed border-gray-300 rounded px-1 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                />
              ) : (
                <span className="select-all block w-full">{data.biochemical.sugarRandom}</span>
              )}
            </td>
          </tr>

          {/* HEMATOLOGY SECTION */}
          <tr className="border-b-2 border-slate-900">
            <td className="py-2 px-2 font-[800] text-gray-950 text-center bg-slate-50 border-r border-slate-900 align-middle uppercase text-[10px] tracking-wide">
              HEMATOLOGY
            </td>
            <td className="py-2 px-2 font-semibold text-gray-800 border-r border-slate-900">
              Hemoglobin
            </td>
            <td className="py-2 px-2 font-bold text-gray-950 bg-white">
              {isEditable ? (
                <input
                  type="text"
                  value={data.hematology.hemoglobin}
                  onChange={(e) => updateHematology({ hemoglobin: e.target.value })}
                  className="w-full font-bold border border-dashed border-gray-300 rounded px-1 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                />
              ) : (
                <span className="select-all block w-full">{data.hematology.hemoglobin}</span>
              )}
            </td>
          </tr>

          {/* URINE SECTION */}
          <tr>
            <td className="py-2 px-2 font-[800] text-gray-950 text-center bg-slate-50 border-r border-slate-900 align-middle uppercase text-[10px] tracking-wide">
              URINE
            </td>
            <td className="py-2 px-2 font-semibold text-gray-800 border-r border-slate-900">
              Pregnancy Test
            </td>
            <td className="py-2 px-2 font-bold text-gray-950 bg-white">
              {isEditable ? (
                <input
                  type="text"
                  value={data.urine.pregnancyTest}
                  onChange={(e) => updateUrine({ pregnancyTest: e.target.value })}
                  className="w-full font-bold border border-dashed border-gray-300 rounded px-1 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                />
              ) : (
                <span className="select-all block w-full">{data.urine.pregnancyTest}</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
