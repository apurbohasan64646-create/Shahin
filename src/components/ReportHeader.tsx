import React, { useRef } from "react";
import { Image, Upload, RefreshCw } from "lucide-react";

interface ReportHeaderProps {
  centerName?: string;
  banglaName?: string;
  address?: string;
  contact?: string;
  isEditable?: boolean;
  onUpdate?: (updates: { centerName?: string; banglaName?: string; address?: string; contact?: string }) => void;
  logoUrl?: string;
  onLogoUpdate?: (logoUrl: string) => void;
  isAgentRole?: boolean;
}

export default function ReportHeader({
  centerName = "AL-JABBAR MEDICAL CENTER",
  banglaName = "আল-জাব্বার মেডিকেল সেন্টার",
  address = "H-93/4 (1st Floor), Airport Road, Kakoli, Banani, Dhaka-1213, Bangladesh",
  contact = "Phone : 01332-119140, E-aljabbarmedicalcenterbd25@gmail.com",
  isEditable = false,
  onUpdate,
  logoUrl,
  onLogoUpdate,
  isAgentRole = false,
}: ReportHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (onLogoUpdate) {
          onLogoUpdate(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col items-center text-center pb-3 border-b border-gray-300 w-full">
      {/* Top Banner Row with Logo and Hospital Typography */}
      <div className="relative flex items-center justify-center w-full px-4 min-h-[72px]">
        {/* AMC Vector or Custom Logo */}
        <div 
          onClick={isEditable && !isAgentRole && onLogoUpdate ? triggerFileInput : undefined}
          className={`absolute -left-5 top-0 w-18 h-18 flex-shrink-0 flex items-center justify-center group overflow-hidden border border-transparent rounded-lg ${
            isEditable && !isAgentRole && onLogoUpdate ? "cursor-pointer hover:border-blue-400 hover:bg-slate-50" : ""
          }`}
          title={isEditable && !isAgentRole && onLogoUpdate ? "Click to change Hospital Logo" : undefined}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Hospital Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <svg
              className="w-full h-full"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* outer blue crescent shield */}
              <path
                d="M15 50C15 28.5 32.5 11 54 11C75.5 11 93 28.5 93 50C93 71.5 75.5 89 54 89C40.6 89 28.8 82.2 21.8 71.8"
                stroke="#1352a2"
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* inner blue ring segment */}
              <path
                d="M25 50C25 34.6 37.4 22.2 52.8 22.2C68.2 22.2 80.6 34.6 80.6 50C80.6 65.4 68.2 77.8 52.8 77.8"
                stroke="#1352a2"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
              {/* red inner cross & medical symbols */}
              <path
                d="M44 48H60M52 40V56"
                stroke="#e52427"
                strokeWidth="5"
                strokeLinecap="round"
              />
              {/* green leaf icon */}
              <path
                d="M26 62C24 55 28 48 35 48C40 48 42 53 40 58C38 63 31 64 26 62Z"
                fill="#2a7e43"
                opacity="0.8"
              />
              {/* bottom Red 'AMC' text arches */}
              <path
                d="M32 72C35 77 41 81 48 81C55 81 61 77 64 72"
                stroke="#e52427"
                strokeWidth="2.5"
              />
              <text
                x="52"
                y="93"
                fill="#e52427"
                fontSize="10"
                fontWeight="900"
                textAnchor="middle"
                className="font-sans"
              >
                AMC
              </text>
            </svg>
          )}

          {isEditable && !isAgentRole && onLogoUpdate && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[8px] font-sans text-center p-1 leading-normal no-print">
              <RefreshCw className="w-3.5 h-3.5 mb-0.5 animate-spin-slow" />
              <span>Change Logo</span>
            </div>
          )}

          {isEditable && !isAgentRole && onLogoUpdate && (
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoChange}
              accept="image/*"
              className="hidden"
            />
          )}
        </div>

        {/* Center Name and Titles */}
        <div className="flex flex-col items-center max-w-[85%] mx-auto">
          {isEditable && !isAgentRole && onUpdate ? (
            <div className="flex flex-col items-center gap-1 w-full no-print">
              <div className="border-b border-[#2a7e43] pb-0.5 mb-1 inline-block max-w-full">
                <input
                  type="text"
                  value={centerName}
                  onChange={(e) => onUpdate({ centerName: e.target.value })}
                  className="font-sans text-2xl md:text-[25.5px] font-[900] tracking-wider text-[#1352a2] text-center border-none max-w-full focus:outline-none bg-transparent whitespace-nowrap"
                />
              </div>
              <input
                type="text"
                value={banglaName}
                onChange={(e) => onUpdate({ banglaName: e.target.value })}
                className="font-sans text-lg md:text-xl font-bold text-red-600 text-center border border-dashed border-red-300 rounded px-1 max-w-full focus:outline-none focus:ring-1 focus:ring-red-500 bg-red-50/50 mt-1"
              />
            </div>
          ) : (
            <>
              <div className="border-b border-[#2a7e43] pb-0.5 mb-1 inline-block max-w-full">
                <h1 className="font-sans text-2xl md:text-[25.5px] font-[900] tracking-wider text-[#1352a2] leading-tight select-all whitespace-nowrap">
                  {centerName}
                </h1>
              </div>
              <h2 className="font-sans text-xl md:text-[21px] font-[700] text-[#e52427] leading-tight select-all mt-1">
                {banglaName}
              </h2>
            </>
          )}
        </div>
      </div>

      {/* Address and Contact details (in Green) */}
      <div className="flex flex-col items-center mt-2 w-full px-6">
        {isEditable && !isAgentRole && onUpdate ? (
          <div className="flex flex-col gap-1 w-full max-w-xl no-print mt-1">
            <input
              type="text"
              value={address}
              onChange={(e) => onUpdate({ address: e.target.value })}
              className="text-center font-medium text-xs text-emerald-800 border border-dashed border-emerald-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50/30"
            />
            <input
              type="text"
              value={contact}
              onChange={(e) => onUpdate({ contact: e.target.value })}
              className="text-center font-medium text-xs text-emerald-800 border border-dashed border-emerald-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50/30"
            />
          </div>
        ) : (
          <>
            <p className="font-sans text-xs md:text-[11px] font-[600] text-[#2a7e43] leading-relaxed select-all">
              {address}
            </p>
            <p className="font-sans text-xs md:text-[11px] font-[600] text-[#2a7e43] leading-relaxed select-all mt-0.5">
              {contact}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
