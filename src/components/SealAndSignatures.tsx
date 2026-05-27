import React, { useRef } from "react";
import { SignatureConfig } from "../types";
import { Upload, RefreshCw } from "lucide-react";

interface SealAndSignaturesProps {
  config: SignatureConfig;
  isEditable: boolean;
  onUpdate: (updatedConfig: Partial<SignatureConfig>) => void;
  checkedSignatureUrl?: string;
  doctorSignatureUrl?: string;
  hospitalSealUrl?: string;
  onUpdateCheckedSignature?: (url: string) => void;
  onUpdateDoctorSignature?: (url: string) => void;
  onUpdateHospitalSeal?: (url: string) => void;
  isAgentRole?: boolean;
}

export default function SealAndSignatures({
  config,
  isEditable,
  onUpdate,
  checkedSignatureUrl,
  doctorSignatureUrl,
  hospitalSealUrl,
  onUpdateCheckedSignature,
  onUpdateDoctorSignature,
  onUpdateHospitalSeal,
  isAgentRole = false,
}: SealAndSignaturesProps) {
  const checkedSignInputRef = useRef<HTMLInputElement>(null);
  const doctorSignInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);

  const handleCheckedSignChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateCheckedSignature) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateCheckedSignature(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDoctorSignChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateDoctorSignature) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateDoctorSignature(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSealChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateHospitalSeal) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateHospitalSeal(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full mt-6 grid grid-cols-3 gap-4 items-end text-center text-gray-950 font-sans text-[10px]">
      
      {/* 1. LEFT COLUMN: Checked By */}
      {config.showCheckedSignature ? (
        <div className="flex flex-col items-center relative min-h-[110px] justify-end">
          {/* Checked By Signature Block */}
          {checkedSignatureUrl ? (
            <div 
              onClick={isEditable && !isAgentRole && onUpdateCheckedSignature ? () => checkedSignInputRef.current?.click() : undefined}
              className={`absolute top-0 flex items-center justify-center select-none group min-h-[50px] w-28 rounded border border-transparent transition-all ${
                isEditable && !isAgentRole && onUpdateCheckedSignature ? "cursor-pointer hover:border-blue-400 hover:bg-slate-50/50" : "pointer-events-none"
              }`}
            >
              <img
                src={checkedSignatureUrl}
                alt="Checked By Signature"
                className="w-24 h-12 object-contain"
                referrerPolicy="no-referrer"
              />

              {isEditable && !isAgentRole && onUpdateCheckedSignature && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[8px] p-0.5 leading-normal rounded no-print">
                  <RefreshCw className="w-3.5 h-3.5 mb-0.5" />
                  <span>Upload Signature</span>
                </div>
              )}

              {isEditable && !isAgentRole && onUpdateCheckedSignature && (
                <input
                  type="file"
                  ref={checkedSignInputRef}
                  onChange={handleCheckedSignChange}
                  accept="image/*"
                  className="hidden"
                />
              )}
            </div>
          ) : isEditable && !isAgentRole && onUpdateCheckedSignature ? (
            <div 
              onClick={() => checkedSignInputRef.current?.click()}
              className="absolute top-0 flex items-center justify-center select-none group h-12 w-28 rounded border border-dashed border-gray-300 hover:border-blue-400 hover:bg-slate-50/50 cursor-pointer transition-all no-print"
            >
              <div className="text-gray-400 text-[8px] flex flex-col items-center">
                <Upload className="w-3.5 h-3.5 mb-0.5 text-gray-400" />
                <span>Upload Signature</span>
              </div>
              <input
                type="file"
                ref={checkedSignInputRef}
                onChange={handleCheckedSignChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          ) : (
            <div className="h-12" />
          )}

          <div className="w-full z-10 flex flex-col items-center">
            <span className="font-bold text-[11px] text-gray-700 tracking-wide border-b border-gray-400 pb-0.5 mb-1.5 px-6 leading-none">
              Checked By
            </span>

            {isEditable && !isAgentRole ? (
              <div className="flex flex-col gap-0.5 w-full px-1">
                <input
                  type="text"
                  value={config.checkedByName}
                  onChange={(e) => onUpdate({ checkedByName: e.target.value })}
                  className="w-full text-center font-bold text-[#1e3a8a] border border-dashed border-blue-200 rounded text-[9px] bg-slate-50 focus:outline-none"
                  placeholder="Tech Name"
                />
                <input
                  type="text"
                  value={config.checkedByTitle1}
                  onChange={(e) => onUpdate({ checkedByTitle1: e.target.value })}
                  className="w-full text-center text-gray-500 border border-dashed border-gray-200 rounded text-[8px] bg-slate-50 focus:outline-none"
                  placeholder="Title 1"
                />
                <input
                  type="text"
                  value={config.checkedByTitle2}
                  onChange={(e) => onUpdate({ checkedByTitle2: e.target.value })}
                  className="w-full text-center text-gray-400 border border-dashed border-gray-200 rounded text-[8px] bg-slate-50 focus:outline-none"
                  placeholder="Title 2"
                />
              </div>
            ) : (
              <div className="flex flex-col select-all">
                <span className="font-bold text-[#1e40af] text-[10.5px] leading-tight">
                  {config.checkedByName}
                </span>
                <span className="text-[8.5px] text-gray-500 font-semibold leading-tight mt-0.5">
                  {config.checkedByTitle1}
                </span>
                <span className="text-[8.5px] text-gray-400 font-semibold leading-none">
                  {config.checkedByTitle2}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div />
      )}

      {/* 2. MIDDLE COLUMN: Center Stamp / Seal */}
      <div className="flex flex-col items-center justify-center relative min-h-[110px]">
        {config.showCenterStamp && (
          <div 
            onClick={isEditable && !isAgentRole && onUpdateHospitalSeal ? () => sealInputRef.current?.click() : undefined}
            className={`w-24 h-24 select-none flex items-center justify-center transition-transform duration-200 relative group rounded-full border border-transparent ${
              isEditable && !isAgentRole && onUpdateHospitalSeal ? "cursor-pointer hover:scale-105 hover:border-blue-400 hover:bg-slate-50/50" : ""
            }`}
          >
            {hospitalSealUrl ? (
              <img
                src={hospitalSealUrl}
                alt="Hospital Seal"
                className="w-full h-full object-contain mix-blend-multiply opacity-85 rotate-[-5deg]"
                referrerPolicy="no-referrer"
              />
            ) : (
              /* Custom high fidelity hospital stamp SVG */
              <svg
                className="w-full h-full opacity-80"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Double outer circles */}
                <circle cx="50" cy="50" r="46" stroke="#1e3a8a" strokeWidth="2.5" />
                <circle cx="50" cy="50" r="41" stroke="#1e3a8a" strokeWidth="1.2" />
                
                {/* Inner ring */}
                <circle cx="50" cy="50" r="28" stroke="#1e3a8a" strokeWidth="1.5" />
                
                {/* Center star */}
                <polygon
                  points="50,38 53,44 60,45 55,50 56,57 50,53 44,57 45,50 40,45 47,44"
                  fill="#1e3a8a"
                />
                
                {/* Deflector arches inside logo stamp */}
                <circle cx="50" cy="50" r="24" stroke="#1e3a8a" strokeWidth="0.5" strokeDasharray="2 2" />

                {/* Text arched along outer pathway */}
                <path
                  id="stampPathTop"
                  d="M 12,50 A 38,38 0 1,1 88,50"
                  fill="none"
                />
                <text fontSize="8.2" fontWeight="900" fill="#1e3a8a" letterSpacing="0.8">
                  <textPath href="#stampPathTop" startOffset="50%" textAnchor="middle">
                    AL-JABBAR MEDICAL CENTER
                  </textPath>
                </text>

                <path
                  id="stampPathBottom"
                  d="M 88,50 A 38,38 0 1,1 12,50"
                  fill="none"
                />
                <text fontSize="8" fontWeight="900" fill="#1e3a8a" letterSpacing="1.2">
                  <textPath href="#stampPathBottom" startOffset="50%" textAnchor="middle">
                    ★ DHAKA ★
                  </textPath>
                </text>
              </svg>
            )}

            {isEditable && !isAgentRole && onUpdateHospitalSeal && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[8px] p-2 text-center rounded-full no-print">
                <RefreshCw className="w-4 h-4 mb-0.5" />
                <span>Upload Seal</span>
              </div>
            )}

            {isEditable && !isAgentRole && onUpdateHospitalSeal && (
              <input
                type="file"
                ref={sealInputRef}
                onChange={handleSealChange}
                accept="image/*"
                className="hidden"
              />
            )}
          </div>
        )}
      </div>

      {/* 3. RIGHT COLUMN: Dr Ali Ahsan (Authorized) */}
      <div className="flex flex-col items-center relative min-h-[110px] justify-end">
        {/* Doctor Signature Graphic */}
        {config.showDoctorSignature && (
          <div 
            onClick={isEditable && !isAgentRole && onUpdateDoctorSignature ? () => doctorSignInputRef.current?.click() : undefined}
            className={`${doctorSignatureUrl ? "relative mb-2" : "absolute top-0"} flex items-center justify-center select-none group min-h-[50px] w-28 rounded border border-transparent transition-all ${
              isEditable && !isAgentRole && onUpdateDoctorSignature ? "cursor-pointer hover:border-blue-400 hover:bg-slate-50/50" : "pointer-events-none"
            }`}
          >
            {doctorSignatureUrl ? (
              <img
                src={doctorSignatureUrl}
                alt="Doctor Signature"
                className="w-24 h-12 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              /* Elegant cursive handwritten blue ink signature */
              <svg
                className="w-24 h-14 opacity-90"
                viewBox="0 0 100 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Handwritten "Ahsan" flow */}
                <path
                  d="M12 28 C16 10, 24 5, 27 12 C29 17, 30 35, 34 33 C38 31, 40 18, 44 23 C48 28, 49 33, 52 32 C55 31, 58 10, 62 14 C66 18, 64 30, 68 28 C74 24, 82 12, 92 18"
                  stroke="#134e4a"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Crossed dash under-swipe */}
                <path
                  d="M18 35 C28 34, 45 29, 78 26"
                  stroke="#134e4a"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  opacity="0.8"
                />
              </svg>
            )}

            {isEditable && !isAgentRole && onUpdateDoctorSignature && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[8px] p-0.5 leading-normal rounded no-print">
                <RefreshCw className="w-3.5 h-3.5 mb-0.5" />
                <span>Upload Signature</span>
              </div>
            )}

            {isEditable && !isAgentRole && onUpdateDoctorSignature && (
              <input
                type="file"
                ref={doctorSignInputRef}
                onChange={handleDoctorSignChange}
                accept="image/*"
                className="hidden"
              />
            )}
          </div>
        )}

        <div className="w-full z-10 flex flex-col items-center">
          {/* Signature line for Doctor */}
          <span className="w-28 border-b border-gray-400 mb-1.5 block">
            &nbsp;
          </span>

          {isEditable && !isAgentRole ? (
            <div className="flex flex-col gap-0.5 w-full px-1">
              <input
                type="text"
                value={config.doctorName}
                onChange={(e) => onUpdate({ doctorName: e.target.value })}
                className="w-full text-center font-bold text-[#134e4a] border border-dashed border-teal-200 rounded text-[9px] bg-slate-50 focus:outline-none"
                placeholder="Doctor Name"
              />
              <input
                type="text"
                value={config.doctorTitle1}
                onChange={(e) => onUpdate({ doctorTitle1: e.target.value })}
                className="w-full text-center text-gray-500 border border-dashed border-gray-200 rounded text-[7.5px] bg-slate-50 focus:outline-none"
                placeholder="Titles Line 1"
              />
              <input
                type="text"
                value={config.doctorTitle2}
                onChange={(e) => onUpdate({ doctorTitle2: e.target.value })}
                className="w-full text-center text-gray-400 border border-dashed border-gray-200 rounded text-[8px] bg-slate-50 focus:outline-none"
                placeholder="Titles Line 2"
              />
              <input
                type="text"
                value={config.doctorTitle3}
                onChange={(e) => onUpdate({ doctorTitle3: e.target.value })}
                className="w-full text-center text-gray-400 border border-dashed border-gray-200 rounded text-[8px] bg-slate-50 focus:outline-none"
                placeholder="Titles Line 3"
              />
            </div>
          ) : (
            <div className="flex flex-col select-all">
              <span className="font-bold text-[#115e59] text-[10.5px] leading-tight">
                {config.doctorName}
              </span>
              <span className="text-[7.5px] text-gray-500 font-extrabold leading-tight mt-0.5 whitespace-normal max-w-full px-1">
                {config.doctorTitle1}
              </span>
              <span className="text-[8.5px] text-gray-400 font-semibold leading-tight">
                {config.doctorTitle2}
              </span>
              {config.doctorTitle3 && !config.doctorTitle3.toLowerCase().includes("medical center") && (
                <span className="text-[8.5px] text-gray-400 font-semibold leading-none">
                  {config.doctorTitle3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
