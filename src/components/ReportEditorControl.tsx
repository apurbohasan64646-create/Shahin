import React, { useState, useEffect } from "react";
import {
  FileText,
  User,
  Activity,
  Beaker,
  Award,
  Plus,
  Trash2,
  Copy,
  Save,
  ChevronDown,
  Info,
  CheckCircle,
  FileCheck,
  Globe,
  Upload,
  UserCheck,
  Share2,
  Link,
  History,
  Coins,
  Clock,
  Lock,
  Unlock,
  Check,
  Zap,
  AlertCircle
} from "lucide-react";
import { MedicalReport, PatientDetails, PhysicalExamination, LabInvestigations, SignatureConfig, DownloadLog } from "../types";
import { MALE_FIT_PRESET, FEMALE_FIT_PRESET, TEMPLATE_REPORT } from "../defaultData";
import { db } from "../firebase";
import { doc, setDoc, getDoc, onSnapshot, collection, query, orderBy, deleteDoc, getDocs } from "firebase/firestore";

interface ReportEditorControlProps {
  currentReport: MedicalReport;
  reportsList: MedicalReport[];
  onSelectReport: (id: string) => void;
  onSaveReport: (report: MedicalReport) => void;
  onDeleteReport: (id: string) => void;
  onAddNewReport: (type: "male" | "female" | "blank") => void;
  onDuplicateReport: (report: MedicalReport) => void;
  onUpdateReport: (updatedReport: MedicalReport) => void;
  onDownloadPDF?: (agentName?: string) => void;
  isInlineEditMode: boolean;
  onToggleInlineEditMode: () => void;
  isGeneratingPdf?: boolean;
  globalHospitalLogo: string;
  globalHospitalSeal: string;
  globalCheckedSignature: string;
  globalDoctorSignature: string;
  onUpdateGlobalLogo: (url: string) => void;
  onUpdateGlobalSeal: (url: string) => void;
  onUpdateGlobalCheckedSignature: (url: string) => void;
  onUpdateGlobalDoctorSignature: (url: string) => void;
  onResetGlobalLogo: () => void;
  onResetGlobalSeal: () => void;
  onResetGlobalCheckedSignature: () => void;
  onResetGlobalDoctorSignature: () => void;
  globalGoogleSheetUrl?: string;
  onUpdateGoogleSheetUrl?: (url: string) => void;
  onResetGoogleSheetUrl?: () => void;
  isAgentRole?: boolean;
  onRequestApproval?: (id: string, agentName?: string) => void;
  onApproveReport?: (id: string) => void;
  onRejectReport?: (id: string) => void;
  isUserAdmin?: boolean;
  adminsList?: string[];
  onAddAdmin?: (email: string) => void;
  onRemoveAdmin?: (email: string) => void;
  currentUser?: any;
  agentActivityLogs?: DownloadLog[];
  onDeleteLog?: (id: string) => void;
  trustedAgents?: Record<string, boolean>;
  onToggleTrustedAgent?: (agentName: string) => void;
  onAgentNameChange?: (agentName: string) => void;
  onOpenPaymentModal?: (reportId: string, purpose: "download" | "approve", agentName?: string) => void;
  downloadFee?: number;
}

type TabType = "general" | "patient" | "physical" | "lab" | "signatures" | "admins" | "payments" | "logs";

export default function ReportEditorControl({
  currentReport,
  reportsList,
  onSelectReport,
  onSaveReport,
  onDeleteReport,
  onAddNewReport,
  onDuplicateReport,
  onUpdateReport,
  onDownloadPDF,
  isInlineEditMode,
  onToggleInlineEditMode,
  isGeneratingPdf = false,
  globalHospitalLogo,
  globalHospitalSeal,
  globalCheckedSignature,
  globalDoctorSignature,
  onUpdateGlobalLogo,
  onUpdateGlobalSeal,
  onUpdateGlobalCheckedSignature,
  onUpdateGlobalDoctorSignature,
  onResetGlobalLogo,
  onResetGlobalSeal,
  onResetGlobalCheckedSignature,
  onResetGlobalDoctorSignature,
  globalGoogleSheetUrl = "",
  onUpdateGoogleSheetUrl,
  onResetGoogleSheetUrl,
  isAgentRole = false,
  onRequestApproval,
  onApproveReport,
  onRejectReport,
  isUserAdmin = false,
  adminsList = [],
  onAddAdmin,
  onRemoveAdmin,
  currentUser = null,
  agentActivityLogs = [],
  onDeleteLog,
  trustedAgents = {},
  onToggleTrustedAgent,
  onAgentNameChange,
  onOpenPaymentModal,
  downloadFee = 25,
}: ReportEditorControlProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchLogQuery, setSearchLogQuery] = useState("");
  const [agentInputName, setAgentInputName] = useState(() => {
    try {
      return localStorage.getItem("aljabbar_last_agent_name") || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (onAgentNameChange) {
      onAgentNameChange(agentInputName);
    }
  }, [agentInputName]);

  useEffect(() => {
    if (isAgentRole && activeTab === "signatures") {
      setActiveTab("general");
    }
  }, [isAgentRole, activeTab]);

  // Payments Panel state managers
  const [payBKash, setPayBKash] = useState<string>("01755-123456");
  const [payNagad, setPayNagad] = useState<string>("01911-654321");
  const [payFee, setPayFee] = useState<number>(150);
  const [payStrict, setPayStrict] = useState<boolean>(false);
  const [smsInput, setSmsInput] = useState<string>("");
  const [transactionsList, setTransactionsList] = useState<any[]>([]);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Sync Payments configs dynamically
  useEffect(() => {
    if (!isUserAdmin) return;
    const unsubPay = onSnapshot(doc(db, "global_config", "payments"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.bKashNumber !== undefined) setPayBKash(d.bKashNumber);
        if (d.nagadNumber !== undefined) setPayNagad(d.nagadNumber);
        if (d.downloadFee !== undefined) setPayFee(Number(d.downloadFee));
        if (d.strictVerification !== undefined) setPayStrict(Boolean(d.strictVerification));
      }
    });

    // Mirror list of all received payments real-time
    const unsubPaymentsList = onSnapshot(collection(db, "received_payments"), (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort newest first
      list.sort((a,b) => {
        const tA = a.usedAt || a.timestamp || "";
        const tB = b.usedAt || b.timestamp || "";
        return tB.localeCompare(tA);
      });
      setTransactionsList(list);
    });

    return () => {
      unsubPay();
      unsubPaymentsList();
    };
  }, [isUserAdmin]);

  // Update payments config in Firebase doc
  const handleSavePayConfig = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, "global_config", "payments"), {
        bKashNumber: payBKash.trim(),
        nagadNumber: payNagad.trim(),
        downloadFee: Number(payFee),
        strictVerification: payStrict,
      }, { merge: true });
      alert("পেমেন্ট কনফিগারেশন সফলভাবে ডাটাবেজে সংরক্ষণ করা হয়েছে!");
    } catch (err: any) {
      console.error("Save pay config failed:", err);
      alert("পেমেন্ট ডাটা সেভ করা যায়নি। ফায়ারবেস অথেন্টিকেশন চেক করুন।");
    } finally {
      setSavingConfig(false);
    }
  };

  // Automated SMS Extractor Engine (Options 1 Auto Scanner)
  const handleExtractSMS = async () => {
    const text = smsInput.trim();
    if (!text) {
      alert("ডাটাবেজে ইনডেক্স করতে দয়া করে ইনকামিং এসএমএস গুলো বক্সে পেস্ট করুন!");
      return;
    }

    // Regular Expressions corresponding to different Bangladeshi personal SMS payment formats
    const bKashRx = /(?:Received|Cash\s+In)\s+Tk\.?\s*([0-9,.]+)(?:\s+from\s+([0-9\+]+))?.*?TrxID\s+([A-Z0-9]{8,12})/gi;
    const nagadRx = /(?:Received|Cash\s+In)\s+Tk\.?\s*([0-9,.]+)(?:\s+from\s+([0-9\+]+))?.*?TxID:\s*([A-Z0-9]{8,12})/gi;

    let match;
    let indexCount = 0;
    const foundTrxs: any[] = [];

    // Parse loop using bKash regex
    while ((match = bKashRx.exec(text)) !== null) {
      foundTrxs.push({
        trxId: match[3].toUpperCase(),
        amount: Number(match[1].replace(/,/g, "")),
        sender: match[2] || "Unknown",
        gateway: "bkash",
        status: "unused",
        timestamp: new Date().toISOString()
      });
    }

    // Reset loop & Parse loop using Nagad regex
    nagadRx.lastIndex = 0;
    while ((match = nagadRx.exec(text)) !== null) {
      foundTrxs.push({
        trxId: match[3].toUpperCase(),
        amount: Number(match[1].replace(/,/g, "")),
        sender: match[2] || "Unknown",
        gateway: "nagad",
        status: "unused",
        timestamp: new Date().toISOString()
      });
    }

    // Grab pure generic standalone code codes if found in the text
    if (foundTrxs.length === 0) {
      const trxIdPattern = /\b([0-9A-Z]{10})\b/g;
      let shortMatch;
      while ((shortMatch = trxIdPattern.exec(text)) !== null) {
        const keyVal = shortMatch[1].toUpperCase();
        if (!foundTrxs.some(x => x.trxId === keyVal)) {
          foundTrxs.push({
            trxId: keyVal,
            amount: payFee,
            sender: "Direct Input",
            gateway: "bkash",
            status: "unused",
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    if (foundTrxs.length === 0) {
      alert("দুঃখিত মেসেজ টেক্সটের ভেতর কোনো বিকাশ বা নগদ TrxID পাওয়া যায়নি বা ম্যাচিং করেনি। দয়া করে সঠিক SMS ফরম্যাট পেস্ট করুন!");
      return;
    }

    // Register active found transactions in Firestore securely!
    try {
      for (const trxRecord of foundTrxs) {
        await setDoc(doc(db, "received_payments", trxRecord.trxId), trxRecord, { merge: true });
        indexCount++;
      }
      setSmsInput("");
      alert(`সাফল্যের সাথে ${indexCount} টি ট্রানজেকশন ডাটাবেজে ইনডেক্স ও সিঙ্ক করা হয়েছে!`);
    } catch (e) {
      console.error(e);
      alert("ডাটাবেজ রাইট এরর! অনুগ্রহ করে Firestore রাইট পারমিশন চেক করুন।");
    }
  };

  const handleDeleteTrx = async (trxId: string) => {
    if (window.confirm("আপনি কি নিশ্চিত যে এই ট্রানজেকশন রেকর্ডটি ডাটাবেজ থেকে মুছে দিতে চান?")) {
      try {
        await deleteDoc(doc(db, "received_payments", trxId));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Local helper to update nested structures
  const updatePatient = (fieldUpdates: Partial<PatientDetails>) => {
    onUpdateReport({
      ...currentReport,
      patient: { ...currentReport.patient, ...fieldUpdates },
    });
  };

  const updatePhysical = (fieldUpdates: Partial<PhysicalExamination>) => {
    onUpdateReport({
      ...currentReport,
      physical: { ...currentReport.physical, ...fieldUpdates },
    });
  };

  const updateLabs = (fieldUpdates: Partial<LabInvestigations>) => {
    onUpdateReport({
      ...currentReport,
      labs: { ...currentReport.labs, ...fieldUpdates },
    });
  };

  const updateSignatures = (fieldUpdates: Partial<SignatureConfig>) => {
    onUpdateReport({
      ...currentReport,
      signatures: { ...currentReport.signatures, ...fieldUpdates },
    });
  };

  // Image Upload helper in the sidebar too
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updatePatient({ photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm h-full overflow-hidden">
      
      {/* 1. HEADER SECTION */}
      <div className="p-4 bg-slate-900 text-white flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold tracking-tight">Report Control Panel</h2>
        </div>
        <p className="text-[11px] text-slate-300">
          Replicate the Al-Jabbar medical certificate. Fully customize dates, values, names, or stamps below.
        </p>

        {/* Primary PDF / Approval Status Action Widgets */}
        {isAgentRole ? (
          <div className="mt-2 w-full space-y-3">
            
            {/* 📋 STEP TRACKER TIMELINE */}
            <div className="bg-slate-800 border border-slate-700/60 p-2.5 rounded-xl flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tight divide-x divide-slate-700">
              <div className="flex-1 text-center flex flex-col items-center gap-1 text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>ড্রাফট রেডি</span>
              </div>
              <div className={`flex-1 text-center flex flex-col items-center gap-1 pl-1 ${currentReport.approvalStatus === "Pending Approval" ? "text-amber-400 animate-pulse" : currentReport.approvalStatus === "Approved" ? "text-slate-300" : "text-slate-500"}`}>
                {currentReport.approvalStatus === "Approved" ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Clock className={`w-3.5 h-3.5 ${currentReport.approvalStatus === "Pending Approval" ? "text-amber-400" : "text-slate-500"}`} />
                )}
                <span>এপ্রুভাল পেন্ডিং</span>
              </div>
              <div className={`flex-1 text-center flex flex-col items-center gap-1 pl-1 ${currentReport.approvalStatus === "Approved" ? "text-emerald-400" : "text-slate-500"}`}>
                {currentReport.approvalStatus === "Approved" ? (
                  <Unlock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>ডাউনলোড আনলক</span>
              </div>
            </div>

            {currentReport.approvalStatus === "Approved" ? (
              <div className="space-y-2">
                <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl text-center space-y-1">
                  <span className="text-emerald-400 font-extrabold block text-xs flex items-center justify-center gap-1">
                    <Check className="w-4 h-4 text-emerald-400" />
                    রিপোর্টটি এপ্রুভ ও আনলক করা হয়েছে!
                  </span>
                  <p className="text-[10px] text-emerald-300/80 leading-relaxed font-semibold">
                    শাহীন স্যার বা অটোমেটেড পেমেন্ট দ্বারা আপনার ডাউনলোড অনুমোদন করা হয়েছে।
                  </p>
                </div>
                
                <button
                  onClick={onDownloadPDF}
                  disabled={isGeneratingPdf}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 text-white font-extrabold text-xs rounded-xl shadow-md transition-all focus:outline-none ${
                    isGeneratingPdf
                      ? "bg-slate-700 opacity-75 cursor-wait"
                      : "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 cursor-pointer scale-102"
                  }`}
                >
                  {isGeneratingPdf ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-white rounded-full animate-spin" />
                      Generating Perfect PDF...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4.5 h-4.5 text-white" />
                      Perfect PDF ডাউনলোড করুন (Download)
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3 font-sans">
                {currentReport.approvalStatus === "Pending Approval" && (
                  <div className="bg-amber-950/40 border border-amber-500/20 p-2.5 rounded-xl text-center space-y-1">
                    <span className="text-amber-400 font-extrabold block text-[11px] animate-pulse">⏳ এপ্রুভাল রিকোয়েস্ট পেন্ডিং অবস্থায় আছে</span>
                    <span className="text-[10px] text-amber-200/90 leading-tight block">
                      ডিভাইস: <strong className="text-white font-bold">{currentReport.requestedBy}</strong> @ {currentReport.requestedAt}
                    </span>
                  </div>
                )}

                {/* Agent Identity Input Card */}
                <div className="bg-slate-800/60 border border-slate-700/50 p-3 rounded-xl space-y-2 text-left shadow-inner">
                  <label className="block text-[11px] font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    👤 আপনার নাম (Agent Name):
                  </label>
                  <input
                    type="text"
                    required
                    value={agentInputName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAgentInputName(val);
                      try {
                        localStorage.setItem("aljabbar_last_agent_name", val);
                      } catch {
                        // ignore
                      }
                    }}
                    placeholder="যেমন: Agent Kabir / Al-Amin"
                    className="w-full text-xs py-2 px-3 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                {/* Dual Decision Panel */}
                <div className="flex flex-col gap-2">
                  
                  {/* Method A: Free Request */}
                  {currentReport.approvalStatus !== "Pending Approval" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!agentInputName.trim()) {
                          alert("প্রথমে আপনার সুন্দর নামটি লিখুন! তারপর শাহীন স্যারের কাছে অনুমোদনের রিকোয়েস্ট পাঠান।");
                          return;
                        }
                        if (onRequestApproval) {
                          onRequestApproval(currentReport.id, agentInputName.trim());
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md border border-indigo-500/30 transition-all duration-150 cursor-pointer text-center"
                    >
                      <Share2 className="w-4 h-4 text-indigo-100 shrink-0" />
                      <span>শাহীন স্যার কে রিকুয়েষ্ট পাঠান (ফ্রী)</span>
                    </button>
                  ) : (
                    <div className="py-2.5 px-3 bg-slate-800 border border-dashed border-slate-700 rounded-xl text-center text-slate-400 text-[10px] font-bold">
                      ✓ শাহীন স্যারকে ইতিমধ্যে রিকোয়েস্ট পাঠানো হয়েছে (পেন্ডিং)
                    </div>
                  )}

                  {/* Method B: Instant Bkash/Nagad auto validation gate */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!agentInputName.trim()) {
                        alert("পেমেন্ট ট্র্যাকিং এর সুবিধার্থে প্রথমে উপরে আপনার সুন্দর নামটি (Agent Name) লিখুন!");
                        return;
                      }
                      if (onOpenPaymentModal) {
                        onOpenPaymentModal(currentReport.id, "download", agentInputName.trim());
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-3 text-white font-extrabold text-xs rounded-xl shadow-md bg-gradient-to-r from-pink-600 to-orange-500 hover:brightness-110 active:scale-98 transition-all cursor-pointer group text-center"
                  >
                    <Zap className="w-3.5 h-3.5 text-yellow-300 animate-bounce group-hover:scale-110 shrink-0" />
                    <span>ইনস্ট্যান্ট অটো-এপ্রুভ করুন ({downloadFee} TK)</span>
                  </button>

                </div>

                <p className="text-[10px] text-indigo-300/80 text-center leading-normal">
                  * ম্যানুয়াল এপ্রুভাল রিকোয়েস্ট আসতে শাহীন স্যার লাইভে না থাকলে বেশ সময় লাগতে পারে। বিকাশ/নগদ গেটওয়ে দিয়ে ট্রানজেকশন ম্যাচ করে সাথে সাথে লাইভ এপ্রুভাল নিয়ে নিন ও ডাউনলোড করুন।
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2 w-full space-y-2">
            {/* Standard Admin Download PDF Button */}
            <button
              onClick={onDownloadPDF}
              disabled={isGeneratingPdf}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 text-white font-bold text-xs rounded-lg shadow-sm transition-all focus:outline-none ${
                isGeneratingPdf
                  ? "bg-slate-700 opacity-75 cursor-wait"
                  : "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 cursor-pointer"
              }`}
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  Download A4 PDF Report (Admin)
                </>
              )}
            </button>

            {/* Admin Approval Decision Bar (Only shown if pending approval or has special state) */}
            {currentReport.approvalStatus === "Pending Approval" && (
              <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-2.5 space-y-2 text-left">
                <span className="text-[11px] font-bold text-amber-400 block text-center">
                  ⚠️ Agent print request is pending approval!
                </span>
                {currentReport.requestedBy && (
                  <div className="bg-slate-900/60 p-2 rounded border border-amber-500/20 text-[10.5px]">
                    <span className="text-gray-400">রিকোয়েস্ট করেছেন:</span>{" "}
                    <span className="text-amber-300 font-extrabold">{currentReport.requestedBy}</span>
                    {currentReport.requestedAt && (
                      <span className="text-gray-400 text-[9px] block">সময়: {currentReport.requestedAt}</span>
                    )}
                  </div>
                )}

                {currentReport.requestedBy && (
                  <label className="flex items-center gap-2 py-2 px-2.5 bg-slate-900/60 rounded border border-slate-700/50 cursor-pointer text-[10px] hover:bg-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={!!currentReport.requestedBy && !!(trustedAgents || {})[currentReport.requestedBy.trim().toLowerCase()]}
                      onChange={() => onToggleTrustedAgent && onToggleTrustedAgent(currentReport.requestedBy)}
                      className="w-3.5 h-3.5 accent-indigo-500 rounded cursor-pointer"
                    />
                    <span className="text-indigo-200 font-bold leading-tight">এই এজেন্টের জন্য সবসময় অটো-এপ্রুভাল অনুমতি দিন (টিক মার্ক রাখুন)</span>
                  </label>
                )}

                {/* SHOW SENT DETAILED PAYMENTS INFO */}
                {(currentReport.paymentTrxId || currentReport.paymentPhoneLast) && (
                  <div className="bg-slate-900/80 p-2 rounded border border-indigo-500/30 text-[10px] text-gray-300 space-y-1">
                    <span className="text-indigo-400 font-extrabold block uppercase text-[8px] tracking-wider">💳 SUBMITTED PAYMENT METADATA:</span>
                    <div>Gateway: <span className="font-bold text-white uppercase">{currentReport.paymentGateway || "N/A"}</span></div>
                    <div>Trx ID: <span className="font-mono font-bold text-yellow-400 select-all">{currentReport.paymentTrxId || "N/A"}</span></div>
                    <div>Sender Phone Last: <span className="font-bold text-white">***{currentReport.paymentPhoneLast || "N/A"}</span></div>
                    <div>Amount: <span className="font-bold text-emerald-400">{currentReport.paymentAmount || "25"} BDT</span></div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onApproveReport && onApproveReport(currentReport.id)}
                    className="py-1.5 px-2 text-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10.5px] transition-colors cursor-pointer"
                  >
                    Approve (অনুমোদন)
                  </button>
                  <button
                    onClick={() => onRejectReport && onRejectReport(currentReport.id)}
                    className="py-1.5 px-2 text-center bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-[10.5px] transition-colors cursor-pointer"
                  >
                    Reject (বাতিল)
                  </button>
                </div>
              </div>
            )}

            {currentReport.approvalStatus === "Approved" && (
              <div className="bg-slate-800 border border-emerald-500/20 rounded-xl p-2.5 flex flex-col gap-1.5 text-[11px] px-3 font-semibold text-emerald-400 text-left">
                <div className="flex items-center justify-between">
                  <span>✓ Report Approved & Print Unlocked</span>
                  <button
                    onClick={() => onRejectReport && onRejectReport(currentReport.id)}
                    className="text-[9.5px] text-red-400 underline hover:text-red-350 cursor-pointer"
                  >
                    Revoke (বাতিল)
                  </button>
                </div>
                {currentReport.requestedBy && (
                  <div className="text-[9.5px] text-gray-300 bg-slate-900/40 p-1.5 rounded space-y-1">
                    <div>অনুমোদিত হয়েছে এজেন্টের জন্য: <span className="text-emerald-300 font-bold">{currentReport.requestedBy}</span></div>
                    {currentReport.paymentTrxId && (
                      <div className="text-[8.5px] text-gray-400">
                        পেমেন্ট: <span className="text-indigo-305 font-mono text-yellow-300">{currentReport.paymentTrxId}</span> (★ Auto-Verified)
                      </div>
                    )}
                  </div>
                )}

                {currentReport.requestedBy && (
                  <label className="flex items-center gap-2 py-1.5 px-2 bg-slate-900/60 rounded border border-slate-700/50 cursor-pointer text-[10.2px] hover:bg-slate-900 select-none mt-0.5">
                    <input
                      type="checkbox"
                      checked={!!currentReport.requestedBy && !!(trustedAgents || {})[currentReport.requestedBy.trim().toLowerCase()]}
                      onChange={() => onToggleTrustedAgent && onToggleTrustedAgent(currentReport.requestedBy)}
                      className="w-3.5 h-3.5 accent-indigo-500 rounded cursor-pointer"
                    />
                    <span className="text-gray-300">ভবিষ্যতে এই এজেন্টের জন্য অটো-এপ্রুভাল রাখুন (টিক মার্ক)</span>
                  </label>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. TAB CONTROLLER BAR */}
      <div className="flex border-b border-gray-200 bg-slate-50 overflow-x-auto text-xs scrollbar-none antialiased">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex-1 py-3 px-2 text-center font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-[75px] ${
            activeTab === "general"
              ? "border-blue-600 text-blue-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          General
        </button>
        <button
          onClick={() => setActiveTab("patient")}
          className={`flex-1 py-3 px-2 text-center font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-[75px] ${
            activeTab === "patient"
              ? "border-blue-600 text-blue-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Patient
        </button>
        <button
          onClick={() => setActiveTab("physical")}
          className={`flex-1 py-3 px-2 text-center font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-[75px] ${
            activeTab === "physical"
              ? "border-blue-600 text-blue-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Physical
        </button>
        <button
          onClick={() => setActiveTab("lab")}
          className={`flex-1 py-3 px-2 text-center font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-[75px] ${
            activeTab === "lab"
              ? "border-blue-600 text-blue-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Beaker className="w-3.5 h-3.5" />
          Labs
        </button>
        {!isAgentRole && (
          <>
            <button
              onClick={() => setActiveTab("signatures")}
              className={`flex-1 py-3 px-2 text-center font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-[75px] ${
                activeTab === "signatures"
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Signatures
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`flex-1 py-3 px-2 text-center font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-[75px] ${
                activeTab === "payments"
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              Payments
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex-1 py-3 px-2 text-center font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-[75px] ${
                activeTab === "logs"
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Activity Logs
            </button>
          </>
        )}
      </div>

      {/* 3. SCROLLABLE TAB CONTENT PANEL */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin space-y-4 text-xs font-sans text-gray-700">
        
        {/* ==================== TAB: GENERAL (Reports List & Presets) ==================== */}
        {activeTab === "general" && (
          <div className="space-y-4">
            
            {/* Quick Edit Mode Info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-blue-900 text-xs block">Double Editing Options:</span>
                <span className="text-blue-800 text-[11px] leading-relaxed block">
                  You can edit values using the form tabs here, <strong>or</strong> turn on <strong>Direct Paper Edit Mode</strong> below and type directly onto the certificate form!
                </span>
                <button
                  onClick={onToggleInlineEditMode}
                  className={`mt-1.5 py-1 px-3 text-[10.5px] font-bold rounded-md shadow-sm border transition-colors cursor-pointer flex items-center gap-1 ${
                    isInlineEditMode
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {isInlineEditMode ? "Direct Sheet Editing: ON" : "Turn ON Direct Sheet Editing"}
                </button>
              </div>
            </div>

            {/* Presets and Reports Section */}
            <div>
              <span className="font-bold text-gray-900 block mb-2 text-xs uppercase tracking-tight">
                Create / Load Templates
              </span>

              {/* Template generator buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onAddNewReport("male")}
                  className="py-2 px-1 text-center bg-sky-50 text-sky-700 font-bold border border-sky-200 hover:bg-sky-100 rounded-lg text-[10px] transition-colors cursor-pointer flex flex-col items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Male Preset
                </button>
                <button
                  onClick={() => onAddNewReport("female")}
                  className="py-2 px-1 text-center bg-pink-50 text-pink-700 font-bold border border-pink-200 hover:bg-pink-100 rounded-lg text-[10px] transition-colors cursor-pointer flex flex-col items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Female Preset
                </button>
                <button
                  onClick={() => onAddNewReport("blank")}
                  className="py-2 px-1 text-center bg-gray-50 text-gray-700 font-bold border border-gray-200 hover:bg-gray-100 rounded-lg text-[10px] transition-colors cursor-pointer flex flex-col items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Blank Form
                </button>
              </div>
            </div>

            {/* File Records Manager */}
            <div className="border-t border-gray-100 pt-3">
              <span className="font-bold text-gray-900 block mb-2 text-xs uppercase tracking-tight flex items-center justify-between">
                <span>Saved Reports ({reportsList.length})</span>
                <span className="text-[10px] text-gray-400 font-normal">Stored in local browser</span>
              </span>

              {reportsList.length === 0 ? (
                <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  No custom records saved yet. Adjust any details and save!
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-1.5 bg-slate-50/50 scrollbar-thin">
                  {reportsList.map((report) => (
                    <div
                      key={report.id}
                      className={`flex items-center justify-between p-2 rounded-lg transition-colors text-[11px] ${
                        currentReport.id === report.id
                          ? "bg-blue-50 border border-blue-200 text-blue-900 font-bold"
                          : "bg-white hover:bg-gray-50 text-gray-700 border border-transparent"
                      }`}
                    >
                      <button
                        onClick={() => onSelectReport(report.id)}
                        className="flex-1 text-left font-semibold truncate focus:outline-none cursor-pointer"
                      >
                        {report.patient.fullName || "Unnamed"} ({report.patient.destinationCountry || "N/A"})
                        <span className="block text-[9px] text-gray-400 font-normal">
                          {report.patient.regNo} | {report.patient.examDate}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 pl-2">
                        <button
                          onClick={() => onDuplicateReport(report)}
                          title="Duplicate"
                          className="p-1 text-gray-400 hover:text-blue-600 rounded-md hover:bg-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteReport(report.id)}
                          title="Delete"
                          className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-white"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save Current Report */}
            <div className="flex gap-2 border-t border-gray-100 pt-3">
              <button
                onClick={() => onSaveReport(currentReport)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save Report File
              </button>
            </div>

            {/* Global Branding & Hospital Assets Panel */}
            {!isAgentRole && (
              <div className="border-t border-gray-200 pt-4 space-y-3 mt-1.5">
                <span className="font-bold text-slate-900 block text-xs uppercase tracking-tight">
                  🏥 Hospital custom branding (গ্লোবাল লোগো)
                </span>
                <p className="text-[10px] text-gray-400 leading-normal">
                  এখানে আপলোডকৃত লোগোটি ব্রাউজার লোকাল ডাটাবেজে স্থায়ীভাবে সেভ হয়ে থাকবে। সকল রিপোর্টে এটি ব্যানার লোগো হিসেবে প্রদর্শিত হবে।
                </p>

                <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 border border-gray-300 bg-white rounded-lg flex items-center justify-center p-1 overflow-hidden">
                      {globalHospitalLogo ? (
                        <img
                          src={globalHospitalLogo}
                          alt="Global Logo"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[10px] text-blue-600 font-extrabold text-center leading-none">AMC default</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="font-bold block text-[11px] text-gray-800">Hospital Banner Logo</span>
                      <span className="text-[9px] text-gray-400 block mb-1">Click below or on sheet logo to upload</span>
                      <div className="flex gap-1.5">
                        <label className="inline-flex items-center gap-1 py-1 px-3 bg-white hover:bg-slate-100 text-gray-700 font-bold text-[10px] border border-gray-300 rounded shadow-xs cursor-pointer transition-colors">
                          <Upload className="w-2.5 h-2.5" />
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const r = new FileReader();
                                r.onloadend = () => onUpdateGlobalLogo(r.result as string);
                                r.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        {globalHospitalLogo && (
                          <button
                            onClick={onResetGlobalLogo}
                            className="py-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] border border-red-200 rounded cursor-pointer transition-colors"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Agent Panel Share Link (Admin Only) */}
            {!isAgentRole && (
              <div className="border-t border-gray-200 pt-4 space-y-2.5 mt-2">
                <span className="font-bold text-indigo-950 block text-xs uppercase tracking-tight flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                  👥 Copy Agent Panel Link (এজেন্টদের জন্য লিংক)
                </span>
                <p className="text-[10px] text-gray-500 leading-normal">
                  আজেন্ট লিংক কপি করে আপনার এজেন্টদের পাঠান। এই লিংকে ঢুকলে তারা এডমিন পোর্টালে এক্সেস পাবেনা।
                </p>

                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-2 text-left">
                  <span className="text-[10px] font-bold text-indigo-950 block">১. সরাসরি এই রিপোর্টার লিংক (Direct Link to Report):</span>
                  <div className="flex items-center gap-1.5 bg-white border border-indigo-200 rounded-lg p-1.5 pl-2 select-all">
                    <Link className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="text-[10px] text-indigo-900 font-mono font-semibold truncate flex-1 block">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}${window.location.pathname}?role=agent&id=${currentReport.id}`
                        : "Loading direct URL..."}
                    </span>
                    <button
                      onClick={() => {
                        const agentUrl = `${window.location.origin}${window.location.pathname}?role=agent&id=${currentReport.id}`;
                        navigator.clipboard.writeText(agentUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className={`py-1 px-3 rounded text-[10px] font-bold shadow-xs transition-colors cursor-pointer flex-shrink-0 ${
                        copiedLink
                          ? "bg-emerald-600 text-white"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      {copiedLink ? "কপি হয়েছে!" : "Copy URL"}
                    </button>
                  </div>

                  <span className="text-[10px] font-bold text-indigo-950/70 block pt-1">২. সাধারণ এজেন্ট প্যানেল লিংক (General Agent Portal):</span>
                  <div className="flex items-center gap-1.5 bg-white border border-indigo-200/60 rounded-lg p-1.5 pl-2 select-all">
                    <Link className="w-3.5 h-3.5 text-indigo-450 flex-shrink-0" />
                    <span className="text-[10px] text-indigo-900/60 font-mono truncate flex-1 block">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}${window.location.pathname}?role=agent`
                        : "Loading general URL..."}
                    </span>
                    <button
                      onClick={() => {
                        const agentUrl = `${window.location.origin}${window.location.pathname}?role=agent`;
                        navigator.clipboard.writeText(agentUrl);
                        alert("সাধারণ এজেন্ট লিংক ডিভাইস ক্লিপবোর্ডে কপি করা হয়েছে!");
                      }}
                      className="py-1 px-3 bg-slate-650 hover:bg-slate-705 text-slate-800 hover:text-white rounded text-[10px] font-bold shadow-xs transition-colors cursor-pointer flex-shrink-0"
                    >
                      Copy Gen
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== TAB: PATIENT DETAILS ==================== */}
        {activeTab === "patient" && (
          <div className="space-y-3.5">
            <span className="font-bold text-gray-900 block mb-1 text-xs uppercase tracking-tight">Patient Personal Metrics</span>

            {/* Photo upload row */}
            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-gray-200">
              <div className="w-14 h-16 border border-gray-300 bg-white rounded overflow-hidden flex items-center justify-center">
                {currentReport.patient.photoUrl ? (
                  <img
                    src={currentReport.patient.photoUrl}
                    alt="Current upload preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-6 h-6 text-gray-300" />
                )}
              </div>
              <div className="flex-1">
                <span className="font-semibold block text-[11px] text-gray-800">Add Patient Photo</span>
                <span className="text-[9px] text-gray-400 block mb-1">Upload headshot or passport picture</span>
                <label className="inline-flex items-center gap-1.5 py-1 px-3 bg-white hover:bg-gray-100 text-gray-700 font-bold text-[10px] border border-gray-300 rounded shadow-sm cursor-pointer transition-colors">
                  <Upload className="w-3 h-3" />
                  Choose File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Reg No</label>
                <input
                  type="text"
                  value={currentReport.patient.regNo}
                  onChange={(e) => updatePatient({ regNo: e.target.value })}
                  className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold bg-slate-50/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Date Of Exam</label>
                <input
                  type="text"
                  value={currentReport.patient.examDate}
                  onChange={(e) => updatePatient({ examDate: e.target.value })}
                  className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold bg-slate-50/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Full Name</label>
              <input
                type="text"
                value={currentReport.patient.fullName}
                onChange={(e) => updatePatient({ fullName: e.target.value.toUpperCase() })}
                className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold bg-slate-50/20 uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Father's Name</label>
                <input
                  type="text"
                  value={currentReport.patient.fatherName}
                  onChange={(e) => updatePatient({ fatherName: e.target.value.toUpperCase() })}
                  className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold bg-slate-50/20 uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Mother's Name</label>
                <input
                  type="text"
                  value={currentReport.patient.motherName}
                  onChange={(e) => updatePatient({ motherName: e.target.value.toUpperCase() })}
                  className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold bg-slate-50/20 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Sex</label>
                <select
                  value={currentReport.patient.sex}
                  onChange={(e) => updatePatient({ sex: e.target.value })}
                  className="w-full py-1.5 px-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold bg-white"
                >
                  <option value="MALE">MALE</option>
                  <option value="FEMALE">FEMALE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Date Of Birth</label>
                <input
                  type="text"
                  value={currentReport.patient.dob}
                  onChange={(e) => updatePatient({ dob: e.target.value })}
                  className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold bg-slate-50/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Passport No</label>
                <input
                  type="text"
                  value={currentReport.patient.passportNo}
                  onChange={(e) => updatePatient({ passportNo: e.target.value.toUpperCase() })}
                  className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold bg-slate-50/20 uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Agency</label>
                <input
                  type="text"
                  disabled={isAgentRole}
                  value={isAgentRole ? "SHAHIN/AF-1" : currentReport.patient.agency}
                  onChange={(e) => updatePatient({ agency: e.target.value.toUpperCase() })}
                  className={`w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold uppercase ${
                    isAgentRole ? "bg-slate-100 text-gray-500 cursor-not-allowed font-extrabold" : "bg-slate-50/20"
                  }`}
                  title={isAgentRole ? "Agency is locked for Agent accounts" : undefined}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                Destination Country
              </label>
              <input
                type="text"
                value={currentReport.patient.destinationCountry}
                onChange={(e) => updatePatient({ destinationCountry: e.target.value.toUpperCase() })}
                className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-extrabold text-blue-900 bg-blue-50/10 uppercase"
              />
            </div>

          </div>
        )}

        {/* ==================== TAB: PHYSICAL EXAMS ==================== */}
        {activeTab === "physical" && (
          <div className="space-y-3.5">
            <span className="font-bold text-gray-900 block mb-1 text-xs uppercase tracking-tight">Physical Parameters</span>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Height</label>
                <input
                  type="text"
                  value={currentReport.physical.height}
                  onChange={(e) => updatePhysical({ height: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Weight</label>
                <input
                  type="text"
                  value={currentReport.physical.weight}
                  onChange={(e) => updatePhysical({ weight: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Pulse</label>
                <input
                  type="text"
                  value={currentReport.physical.pulse}
                  onChange={(e) => updatePhysical({ pulse: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Blood Pressure</label>
                <input
                  type="text"
                  value={currentReport.physical.bloodPressure}
                  onChange={(e) => updatePhysical({ bloodPressure: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Heart</label>
                <input
                  type="text"
                  value={currentReport.physical.heart}
                  onChange={(e) => updatePhysical({ heart: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Liver</label>
                <input
                  type="text"
                  value={currentReport.physical.liver}
                  onChange={(e) => updatePhysical({ liver: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Spleen</label>
                <input
                  type="text"
                  value={currentReport.physical.spleen}
                  onChange={(e) => updatePhysical({ spleen: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Ear, Nose & Throat (ENT)</label>
                <input
                  type="text"
                  value={currentReport.physical.ent}
                  onChange={(e) => updatePhysical({ ent: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Eye Left (LT)</label>
                <input
                  type="text"
                  value={currentReport.physical.eyeLeft}
                  onChange={(e) => updatePhysical({ eyeLeft: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Eye Right (RT)</label>
                <input
                  type="text"
                  value={currentReport.physical.eyeRight}
                  onChange={(e) => updatePhysical({ eyeRight: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Skin</label>
                <input
                  type="text"
                  value={currentReport.physical.skin}
                  onChange={(e) => updatePhysical({ skin: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Physical Quality</label>
                <input
                  type="text"
                  value={currentReport.physical.physicalCondition}
                  onChange={(e) => updatePhysical({ physicalCondition: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">ECG</label>
                <input
                  type="text"
                  value={currentReport.physical.ecg}
                  onChange={(e) => updatePhysical({ ecg: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Chest P/A View</label>
                <input
                  type="text"
                  value={currentReport.physical.chestP_A_View}
                  onChange={(e) => updatePhysical({ chestP_A_View: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB: LAB INVESTIGATIONS ==================== */}
        {activeTab === "lab" && (
          <div className="space-y-4">
            
            {/* Serology Section */}
            <div>
              <span className="font-bold text-gray-900 block mb-2 text-[11px] uppercase tracking-wide border-b border-gray-200 pb-1 text-blue-800">
                1. Serology
              </span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">HBsAg</label>
                  <input
                    type="text"
                    value={currentReport.labs.serology.hbsag}
                    onChange={(e) => updateLabs({
                      serology: { ...currentReport.labs.serology, hbsag: e.target.value }
                    })}
                    className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">VDRL</label>
                  <input
                    type="text"
                    value={currentReport.labs.serology.vdrl}
                    onChange={(e) => updateLabs({
                      serology: { ...currentReport.labs.serology, vdrl: e.target.value }
                    })}
                    className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">TPHA</label>
                  <input
                    type="text"
                    value={currentReport.labs.serology.tpha}
                    onChange={(e) => updateLabs({
                      serology: { ...currentReport.labs.serology, tpha: e.target.value }
                    })}
                    className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Blood Group</label>
                  <input
                    type="text"
                    value={currentReport.labs.serology.bloodGroup}
                    onChange={(e) => updateLabs({
                      serology: { ...currentReport.labs.serology, bloodGroup: e.target.value }
                    })}
                    className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Biochemical, Hematology, Urine */}
            <div>
              <span className="font-bold text-gray-900 block mb-2 text-[11px] uppercase tracking-wide border-b border-gray-200 pb-1 text-blue-800">
                2. Biochemical, Hematology, Urine
              </span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">S. Bilirubin (BIOC)</label>
                  <input
                    type="text"
                    value={currentReport.labs.biochemical.sBilirubin}
                    onChange={(e) => updateLabs({
                      biochemical: { ...currentReport.labs.biochemical, sBilirubin: e.target.value }
                    })}
                    className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Sugar Random (BIOC)</label>
                  <input
                    type="text"
                    value={currentReport.labs.biochemical.sugarRandom}
                    onChange={(e) => updateLabs({
                      biochemical: { ...currentReport.labs.biochemical, sugarRandom: e.target.value }
                    })}
                    className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Hemoglobin (HEMA)</label>
                  <input
                    type="text"
                    value={currentReport.labs.hematology.hemoglobin}
                    onChange={(e) => updateLabs({
                      hematology: { hemoglobin: e.target.value }
                    })}
                    className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Pregnancy Test (URINE)</label>
                  <input
                    type="text"
                    value={currentReport.labs.urine.pregnancyTest}
                    onChange={(e) => updateLabs({
                      urine: { pregnancyTest: e.target.value }
                    })}
                    className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB: SIGNATURES & MEDICAL OUTCOME ==================== */}
        {activeTab === "signatures" && (
          <div className="space-y-4">
            
            {/* Fit Medical Outcome Box */}
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <span className="font-bold text-gray-950 block text-[11px] uppercase tracking-wide flex items-center gap-1">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Medical Outcome Assessment
              </span>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">FIT STATUS DISPLAY</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onUpdateReport({ ...currentReport, fitStatus: "FIT" });
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      currentReport.fitStatus === "FIT"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-400"
                        : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    FIT
                  </button>
                  <button
                    onClick={() => {
                      onUpdateReport({ ...currentReport, fitStatus: "UNFIT" });
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      currentReport.fitStatus === "UNFIT"
                        ? "bg-red-100 text-red-800 border-red-400"
                        : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    UNFIT
                  </button>
                </div>
                
                {/* Custom input in case they want a custom label like "RE-EXAMINE" */}
                <input
                  type="text"
                  placeholder="Or enter custom label (e.g., RE-EXAMINE)"
                  value={currentReport.fitStatus}
                  onChange={(e) => onUpdateReport({ ...currentReport, fitStatus: e.target.value })}
                  className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-bold mt-2 bg-white"
                />
              </div>
            </div>

            {/* Stamp / Signs Toggles */}
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <span className="font-bold text-gray-950 block text-[11px] uppercase tracking-wide">
                Seal & Signatures Options
              </span>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold py-1">
                  <input
                    type="checkbox"
                    checked={currentReport.signatures.showCheckedSignature}
                    onChange={(e) => updateSignatures({ showCheckedSignature: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>Show Technologist Signature</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold py-1">
                  <input
                    type="checkbox"
                    checked={currentReport.signatures.showCenterStamp}
                    onChange={(e) => updateSignatures({ showCenterStamp: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>Show Circular Hospital Stamp</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold py-1">
                  <input
                    type="checkbox"
                    checked={currentReport.signatures.showDoctorSignature}
                    onChange={(e) => updateSignatures({ showDoctorSignature: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>Show Doctor Signature</span>
                </label>
              </div>
            </div>

            {/* Staff detailed override inputs */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <span className="font-bold text-gray-900 block text-[10.5px] uppercase">
                Staff Names customization
              </span>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600">Technician Signee</label>
                <input
                  type="text"
                  value={currentReport.signatures.checkedByName}
                  onChange={(e) => updateSignatures({ checkedByName: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none text-[11px] font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600">Authorized Doctor</label>
                <input
                  type="text"
                  value={currentReport.signatures.doctorName}
                  onChange={(e) => updateSignatures({ doctorName: e.target.value })}
                  className="w-full py-1 px-2 border border-gray-300 rounded focus:outline-none text-[11px] font-medium"
                />
              </div>
            </div>

            {/* Global Custom Signs & Seals Manager */}
            <div className="border-t border-gray-200 pt-3 space-y-2.5">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wide">
                ✍️ Custom Signature & Seal (সিগনেচার ও সিল)
              </span>
              <p className="text-[10px] text-gray-400 leading-normal">
                এখানে আপলোডকৃত সিল এবং সিগনেচারসমূহ ডাটাবেজে সংরক্ষিত থাকবে এবং সকল রোগীর ফর্মে লোড হবে।
              </p>

              <div className="space-y-2 bg-slate-50 border border-gray-200 rounded-xl p-3">
                {/* 1. Checked By Sign */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[10.5px]">Technographer Sign</span>
                    <span className="text-[9px] text-gray-400">Checked By section</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="py-1 px-2.5 bg-white hover:bg-slate-100 text-gray-700 font-bold text-[10px] border border-gray-300 rounded cursor-pointer transition-colors inline-block relative">
                      {globalCheckedSignature ? "Change" : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const r = new FileReader();
                            r.onloadend = () => onUpdateGlobalCheckedSignature(r.result as string);
                            r.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {globalCheckedSignature && (
                      <button
                        onClick={onResetGlobalCheckedSignature}
                        className="py-1 px-2 bg-red-50 hover:bg-red-100 text-red-500 font-bold text-[10px] border border-red-200 rounded cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Circular Seal Stamp */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[10.5px]">Circular STAMP / Seal</span>
                    <span className="text-[9px] text-gray-400">Center seal stamp</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="py-1 px-2.5 bg-white hover:bg-slate-100 text-gray-700 font-bold text-[10px] border border-gray-300 rounded cursor-pointer transition-colors inline-block relative">
                      {globalHospitalSeal ? "Change" : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const r = new FileReader();
                            r.onloadend = () => onUpdateGlobalSeal(r.result as string);
                            r.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {globalHospitalSeal && (
                      <button
                        onClick={onResetGlobalSeal}
                        className="py-1 px-2 bg-red-50 hover:bg-red-100 text-red-500 font-bold text-[10px] border border-red-200 rounded cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Doctor sign */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[10.5px]">Doctor Signature</span>
                    <span className="text-[9px] text-gray-400">Authorized Officer</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="py-1 px-2.5 bg-white hover:bg-slate-100 text-gray-700 font-bold text-[10px] border border-gray-300 rounded cursor-pointer transition-colors inline-block relative">
                      {globalDoctorSignature ? "Change" : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const r = new FileReader();
                            r.onloadend = () => onUpdateGlobalDoctorSignature(r.result as string);
                            r.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {globalDoctorSignature && (
                      <button
                        onClick={onResetGlobalDoctorSignature}
                        className="py-1 px-2 bg-red-50 hover:bg-red-100 text-red-500 font-bold text-[10px] border border-red-200 rounded cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Firebase Cloud Integration */}
                <div className="border-t border-gray-200 pt-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-800">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span>🔥 Firebase Cloud Database Status</span>
                  </div>
                  <p className="text-[9.5px] text-slate-500 leading-normal">
                    গুগল স্প্রেডশিটের পরিবর্তে এখন সম্পূর্ণ ডাটাবেজ রিয়েল-টাইম ফায়ারবেস ক্লাউড স্টোরেজের সাথে যুক্ত। এটি চ্যাট, লাইভ এডিট বা ডাটা ইন্টিগ্রেশন সরাসরি পরিচালনা করে।
                  </p>
                  
                  <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl space-y-1">
                    <span className="text-[10px] text-indigo-900 font-bold block">💡 নতুন এডমিন যুক্ত করার নিয়ম:</span>
                    <p className="text-[9px] text-indigo-800 leading-relaxed">
                      সহকর্মী বা অন্য কোনো ডক্টরকে এডমিন বানাতে বাম পাশের সাইডবারে থাকা <strong>"নতুন অ্যাডমিন নিবন্ধন ফরম (Add Admin)"</strong> ফরমটি ব্যবহার করুন। সেখানে নাম, মোবাইল বা জিমেইল এবং পাসওয়ার্ড দিয়ে সুরক্ষিতভাবে নতুন অ্যাডমিন অ্যাকাউন্ট তৈরি করতে পারবেন।
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB: ADMINS (Admin User Management) ==================== */}
        {activeTab === "admins" && isUserAdmin && (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <span className="font-bold text-indigo-900 text-xs block mb-1">🛡️ Admin Access Management</span>
              <p className="text-indigo-800 text-[10.5px] leading-normal font-medium">
                বাম পাশের প্যানেল থেকে নাম, পাসওয়ার্ড এবং মোবাইল নাম্বার/জিমেইল দিয়ে নতুন অ্যাডমিন অ্যাকাউন্ট তৈরি করতে পারবেন। তৈরি করার পর তারা সরাসরি তাদের ক্রেডেনশিয়াল দিয়ে পোর্টালে প্রবেশ করতে পারবেন এবং পূর্ণ অ্যাডমিন এ্যাক্সেস পেয়ে যাবেন।
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
              <span className="text-[12px] text-gray-800 font-bold block">👉 বাম পাশের প্যানেলটি ব্যবহার করুন</span>
              <p className="text-[11px] text-gray-500 leading-normal max-w-md mx-auto">
                ডাটাবেজে নতুন ডিরেক্ট এডমিন একাউন্ট যুক্ত করতে দয়া করে বাম পাশের সাইডবারে থাকা <strong>"নতুন অ্যাডমিন নিবন্ধন ফরম"</strong> ব্যবহার করুন। সেখানে যেকোনো মোবাইল নাম্বার ও পাসওয়ার্ড দিয়ে খুব সহজেই রিয়েন-টাইম সিঙ্ক সুবিধা সহ আইডি তৈরি করা যায়।
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-gray-950 text-xs block uppercase tracking-wide">সক্রিয় এডমিনদের তালিকা ({adminsList?.length || 0}):</span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-white">
                {(!adminsList || adminsList.length === 0) ? (
                  <div className="text-center py-4 text-gray-400 font-medium">No admins loading...</div>
                ) : (
                  adminsList.map((email) => {
                    const isSelf = email === currentUser?.email?.toLowerCase();
                    const isSystemRoot = email === "apurbohasan948@gmail.com";
                    return (
                      <div key={email} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/70 border border-slate-200/60 font-mono text-[10.5px]">
                        <span className="font-semibold text-slate-800 truncate select-all">{email}</span>
                        <div className="flex items-center gap-1.5">
                          {isSystemRoot && (
                            <span className="text-[9px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-md">ROOT</span>
                          )}
                          {isSelf && (
                            <span className="text-[9px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.5 rounded-md">YOU</span>
                          )}
                          {!isSystemRoot && !isSelf && onRemoveAdmin && (
                            <button
                              onClick={() => {
                                onRemoveAdmin(email);
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* NEW Section: Trusted Agents Management */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <span className="font-bold text-slate-800 text-xs block uppercase tracking-wide">🔗 অটো-এপ্রুভড (সবসময় অনুমোদিত) এজেন্টদের তালিকা:</span>
              <p className="text-[10px] text-slate-500 leading-normal">
                নিচের তালিকায় থাকা এজেন্টদের রিপোর্ট ডাউনলোড করার জন্য বারবার শাহীন স্যারের অনুমতি প্রয়োজন হবে না। তারা যেকোনো সময় সরাসরি পিডিএফ ডাউনলোড করতে পারবে। টিক সরাই দিলে পুনরায় তাদের অনুমতি নিতে হবে।
              </p>
              
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-indigo-100 rounded-xl p-2 bg-indigo-50/20">
                {Object.keys(trustedAgents || {}).filter(k => (trustedAgents || {})[k]).length === 0 ? (
                  <div className="text-center py-4 text-gray-400 font-medium text-[10.5px]">তালিকায় কোনো পার্মানেন্ট এজেন্ট নেই। (টিক চিহ্ন দিলে বা এগ্রিমেন্ট এপ্রুভ করলে এখানে যুক্ত হবে)</div>
                ) : (
                  Object.keys(trustedAgents || {})
                    .filter(k => (trustedAgents || {})[k])
                    .map((agentName) => {
                      return (
                        <div key={agentName} className="flex items-center justify-between p-2 rounded-lg bg-white border border-indigo-100/60 text-[10.5px] shadow-sm">
                          <span className="font-extrabold text-slate-800 capitalize select-all flex items-center gap-1">👤 {agentName}</span>
                          <button
                            onClick={() => onToggleTrustedAgent && onToggleTrustedAgent(agentName)}
                            className="text-[9.5px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded border border-red-200/60 cursor-pointer transition-colors"
                          >
                            অনুমতি বাতিল করুন
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: PAYMENTS (Automated SMS & Gateways Configuration Hub) ==================== */}
        {activeTab === "payments" && isUserAdmin && (
          <div className="space-y-4 font-sans text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                <span>💸 Al-Jabbar Auto Payments & SMS Integration</span>
              </span>
              <p className="text-emerald-800 text-[10.5px] leading-normal font-medium">
                এজেন্ট একাউন্টে যখন কেউ রিপোর্ট ডাউনলোড করতে যাবে, তখন বিকাশ ও নগদ গেটওয়ে শো করবে। এজেন্ট টাকা পাঠানোর পর TrxID সাবমিট করলেই ডাটাবেজ চেক করে এই এআই গেটওয়ে অটোমেটিক রিপোর্টটি এপ্রুভ ও ডাউনলোড করে দেবে।
              </p>
            </div>

            {/* 1. Gateway Phone Settings Panel */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3.5 shadow-sm/5%">
              <span className="font-bold text-gray-950 text-[11px] block uppercase tracking-wider">📞 বিকাশ ও নগদ পার্সোনাল নম্বর সেটিং</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-extrabold block">বিকাশ পার্সোনাল নম্বর:</label>
                  <input
                    type="text"
                    value={payBKash}
                    onChange={(e) => setPayBKash(e.target.value)}
                    className="w-full font-mono py-1.5 px-2 bg-white border border-gray-300 rounded-lg text-[11px] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-extrabold block">নগদ পার্সোনাল নম্বর:</label>
                  <input
                    type="text"
                    value={payNagad}
                    onChange={(e) => setPayNagad(e.target.value)}
                    className="w-full font-mono py-1.5 px-2 bg-white border border-gray-300 rounded-lg text-[11px] font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-extrabold block">ডাউনলোড ফি (BDT Taka):</label>
                  <input
                    type="number"
                    value={payFee}
                    onChange={(e) => setPayFee(Number(e.target.value))}
                    className="w-full py-1.5 px-2 bg-white border border-gray-300 rounded-lg text-[11px] font-bold"
                  />
                </div>
                
                <div className="space-y-1 pt-4">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={payStrict}
                      onChange={(e) => setPayStrict(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] font-extrabold text-slate-700">কঠোর এসএমএস ম্যাচিং (Strict DB)</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSavePayConfig}
                disabled={savingConfig}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-[10.5px] transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingConfig ? "সেভ হচ্ছে..." : "পেমেন্ট গেটওয়ে সেটিংস সংরক্ষণ করুন (Save Settings)"}</span>
              </button>
            </div>

            {/* 2. Push Incoming Payments SMS Paste Arena */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2.5">
              <span className="font-bold text-gray-950 text-[11px] block uppercase tracking-wider">📥 SMS রিডার ও অটো-ইনডেক্সিং কনসোল (No Merchant Required)</span>
              <p className="text-[9.5px] text-slate-500 leading-normal">
                আপনার বিকাশ/নগদ এর ইনকামিং পেমেন্ট এসএমএসগুলো (যেমন: <em>"Received Tk 150... TrxID BL02..."</em>) নিচের বক্সে পেস্ট করে ইনডেক্স করুন। সিস্টেম তাৎক্ষণিকভাবে TrxID ও এমাউন্ট সিঙ্ক করে রাখবে:
              </p>
              
              <textarea
                value={smsInput}
                onChange={(e) => setSmsInput(e.target.value)}
                placeholder="বিকাশ বা নগদ থেকে আসা ক্যাশ-ইন / রিসিভড পেমেন্ট মেসেজটি এখানে পেস্ট করুন..."
                rows={3}
                className="w-full p-2 bg-white border border-gray-300 rounded-xl font-mono text-[10px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-teal-500"
              />

              <button
                type="button"
                onClick={handleExtractSMS}
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-lg text-[10.5px] transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer border border-teal-700"
              >
                <Upload className="w-3.5 h-3.5 animate-pulse" />
                <span>মেসেজ রিড ও ইনডেক্স করুন (Index Transaction IDs)</span>
              </button>
            </div>

            {/* 3. Transaction Log Sync Display */}
            <div className="space-y-2">
              <span className="font-bold text-gray-950 text-xs block uppercase tracking-wide">সক্রিয় পেমেন্ট ডাটাবেজ তালিকা ({transactionsList.length}):</span>
              <div className="space-y-1.5 max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-white">
                {transactionsList.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 font-medium leading-normal">
                    মেসেজ ইনডেক্স করা হয়নি।<br/>
                    <span className="text-[10px] text-gray-300 font-normal">Strict DB অফ থাকলে যেকোনো সঠিক ফরম্যাট TrxID সাবমিট করলেই এপ্রুভ হয়ে যাবে।</span>
                  </div>
                ) : (
                  transactionsList.map((trx) => (
                    <div key={trx.id} className="p-2 border border-slate-100 rounded-lg bg-slate-50/50 flex flex-col gap-1 text-[10.5px] font-mono leading-none">
                      <div className="flex justify-between items-center text-slate-800">
                        <span className="font-black text-slate-950 text-[11px] select-all tracking-wide">{trx.trxId}</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase leading-none ${
                            trx.gateway === "bkash" ? "bg-pink-100 text-pink-700" : "bg-orange-100 text-orange-700"
                          }`}>
                            {trx.gateway}
                          </span>
                          <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded leading-none ${
                            trx.status === "used" ? "bg-gray-100 text-gray-400" : "bg-emerald-100 text-emerald-700 font-black animate-pulse"
                          }`}>
                            {trx.status === "used" ? "USED" : "UNUSED"}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[9.5px] text-slate-500 border-t border-slate-200/40 pt-1 mt-0.5">
                        <span>ফি: {trx.amount} BDT</span>
                        {trx.status === "used" ? (
                          <span className="font-extrabold text-blue-600 truncate max-w-[120px]" title={trx.usedForPatient}>
                            Patient: {trx.usedForPatient || "Unlocked"}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDeleteTrx(trx.trxId)}
                            className="text-red-500 hover:text-red-700 transition-colors p-0.5 cursor-pointer shrink-0"
                            title="মুছে ফেলুন"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB: LOGS (Agent Activity & Audit Logs) ==================== */}
        {activeTab === "logs" && !isAgentRole && (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-left">
              <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping shrink-0" />
                <span>📥 Agent Download & Request Audit Logs (এজেন্ট অ্যাক্টিভিটি ট্র্যাকিং সিস্টেম)</span>
              </span>
              <p className="text-indigo-800 text-[10.5px] leading-normal font-medium">
                এজেন্ট প্যানেল থেকে যখনই কোনো এজেন্টের পক্ষ থেকে প্রিন্ট পিডিএফ এটেন্ড করা হবে কিংবা শাহীন স্যারের অনুমোদনের রিকোয়েস্ট পাঠানো হবে, তখন ফায়ারবেস ক্লাউডে অটোমেটিক তাদের নাম ও রিপোর্টের পূর্ণ বিবরণ আলাদা ডিরেক্টরিতে সংরক্ষণ করা হবে।
              </p>
            </div>

            {/* Log List Controls & Search Filter Bar */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold text-gray-700">🔎 খুঁজুন (সার্চ ফিল্টার):</label>
              <input
                type="text"
                placeholder="এজেন্ট নাম, পেশেন্ট নাম, পাসপোর্ট বা রেজি নং..."
                value={searchLogQuery}
                onChange={(e) => setSearchLogQuery(e.target.value)}
                className="w-full text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
              />
            </div>

            {/* Display list of filtered agentActivityLogs */}
            <div className="space-y-2 mt-1">
              <span className="font-bold text-gray-950 text-xs block uppercase tracking-wide text-left">
                অ্যাক্টিভিটি লগ তালিকা ({
                  agentActivityLogs.filter((log) => {
                    const query = searchLogQuery.toLowerCase().trim();
                    if (!query) return true;
                    return (
                      log.agentName?.toLowerCase().includes(query) ||
                      log.patientName?.toLowerCase().includes(query) ||
                      log.passportNo?.toLowerCase().includes(query) ||
                      log.regNo?.toLowerCase().includes(query) ||
                      log.actionType?.toLowerCase().includes(query)
                    );
                  }).length
                }):
              </span>
              
              <div className="space-y-2 max-h-[420px] overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">
                {agentActivityLogs.filter((log) => {
                  const query = searchLogQuery.toLowerCase().trim();
                  if (!query) return true;
                  return (
                    log.agentName?.toLowerCase().includes(query) ||
                    log.patientName?.toLowerCase().includes(query) ||
                    log.passportNo?.toLowerCase().includes(query) ||
                    log.regNo?.toLowerCase().includes(query) ||
                    log.actionType?.toLowerCase().includes(query)
                  );
                }).length === 0 ? (
                  <div className="text-center py-8 text-gray-400 font-medium font-sans leading-relaxed">
                    কোনো অ্যাক্টিভিটি লগ পাওয়া যায়নি।<br/>
                    <span className="text-[10px] text-gray-300 font-normal">এজেন্ট কন্ট্রিবিউটর বা সাবমিট করলে এখানে রিয়েল-টাইমে ডাটা রেন্ডার হবে।</span>
                  </div>
                ) : (
                  agentActivityLogs
                    .filter((log) => {
                      const query = searchLogQuery.toLowerCase().trim();
                      if (!query) return true;
                      return (
                        log.agentName?.toLowerCase().includes(query) ||
                        log.patientName?.toLowerCase().includes(query) ||
                        log.passportNo?.toLowerCase().includes(query) ||
                        log.regNo?.toLowerCase().includes(query) ||
                        log.actionType?.toLowerCase().includes(query)
                      );
                    })
                    .map((log) => (
                      <div key={log.id} className="p-2.5 border border-slate-200 rounded-xl bg-white flex flex-col gap-1.5 shadow-xs text-left">
                        <div className="flex justify-between items-start select-all">
                          <div className="space-y-0.5 text-left leading-tight">
                            <span className="text-slate-950 font-black text-xs block truncate max-w-[200px]">
                              👤 {log.agentName || "Agent Contributor"}
                            </span>
                            <span className="text-[9.5px] text-slate-400 font-medium block">
                              🕓 সময়: {log.timestamp}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-md uppercase border leading-none tracking-normal shrink-0 ${
                              log.actionType === "Download PDF"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}>
                              {log.actionType === "Download PDF" ? "📥 DOWNLOAD" : "✉ REQUEST"}
                            </span>
                            {onDeleteLog && (
                              <button
                                onClick={() => onDeleteLog(log.id)}
                                className="text-slate-350 hover:text-red-500 hover:bg-slate-50 rounded p-1 transition-colors cursor-pointer shrink-0"
                                title="অ্যাক্টিভিটি হিস্ট্রি থেকে মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-500" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Detailed information table summary for Admin visibility */}
                        <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-[10.5px] leading-relaxed text-slate-700 space-y-0.5 text-left select-all">
                          <div>রোগীর নাম: <span className="font-bold text-slate-950 uppercase">{log.patientName}</span></div>
                          <div className="flex font-mono text-[10px] divide-x divide-slate-200">
                            <div className="pr-1.5">পাসপোর্ট: <span className="font-extrabold text-slate-900">{log.passportNo}</span></div>
                            <div className="pl-1.5">রেজি: <span className="font-extrabold text-indigo-950">{log.regNo}</span></div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* 4. FOOTER CREDENTIALS NOTATION */}
      <div className="p-3 bg-slate-50 border-t border-gray-200 text-center text-[10px] font-medium text-gray-400 flex flex-col items-center justify-center gap-1.5">
        <span>Al-Jabbar Medical Center Report Manager</span>
        <span className="text-[9px] text-gray-300">A4 Dimensions: 210mm × 297mm formatted</span>
      </div>

    </div>
  );
}
