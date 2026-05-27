import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Printer,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  AlertCircle,
  Shield,
  LogOut,
  Users,
  Plus,
  Trash2,
  Database,
  Lock,
  UserCheck,
  FileDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { MedicalReport } from "./types";
import { TEMPLATE_REPORT, MALE_FIT_PRESET, FEMALE_FIT_PRESET } from "./defaultData";
import { downloadReportAsPDF } from "./utils/pdfExporter";
import ReportHeader from "./components/ReportHeader";
import PatientMeta from "./components/PatientMeta";
import PhysicalExamTable from "./components/PhysicalExamTable";
import LabTable from "./components/LabTable";
import SealAndSignatures from "./components/SealAndSignatures";
import ReportEditorControl from "./components/ReportEditorControl";

// Firebase imports
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  auth, 
  db, 
  OperationType, 
  handleFirestoreError,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
  firebaseConfig,
  isFirebaseConfigured
} from "./firebase";
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from "firebase/firestore";

// Safe LocalStorage utility wrapper as secondary backup
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage access denied.", e);
      return (window as any).__memStorage?.[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      if (!(window as any).__memStorage) {
        (window as any).__memStorage = {};
      }
      (window as any).__memStorage[key] = value;
    }
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isLoadingReports, setIsLoadingReports] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminsList, setAdminsList] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState<string>("");

  // Number/Email and Password Authentication Form States
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginPhoneNumber, setLoginPhoneNumber] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginName, setLoginName] = useState<string>("");
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Authorized Admin-only sub-admin registration form states
  const [adminRegName, setAdminRegName] = useState<string>("");
  const [adminRegPhoneOrEmail, setAdminRegPhoneOrEmail] = useState<string>("");
  const [adminRegPassword, setAdminRegPassword] = useState<string>("");
  const [isAdminRegistering, setIsAdminRegistering] = useState<boolean>(false);

  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("id") || params.get("reportId") || "";
    } catch {
      return "";
    }
  });
  const [isInlineEdit, setIsInlineEdit] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<number>(0);
  const [pdfStateMsg, setPdfStateMsg] = useState<string>("Initializing...");
  const [isAgentRole, setIsAgentRole] = useState<boolean>(false);
  const [isUrlLockedAgent, setIsUrlLockedAgent] = useState<boolean>(false);
  const [showEmailLoginScreen, setShowEmailLoginScreen] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  // Global custom assets state (saved in localStorage and shared globally)
  const [globalHospitalLogo, setGlobalHospitalLogo] = useState<string>("");
  const [globalHospitalSeal, setGlobalHospitalSeal] = useState<string>("");
  const [globalCheckedSignature, setGlobalCheckedSignature] = useState<string>("");
  const [globalDoctorSignature, setGlobalDoctorSignature] = useState<string>("");

  // Payments Gateway Configurations & Active Sync
  const [bKashNumber, setBKashNumber] = useState<string>("01755-123456");
  const [nagadNumber, setNagadNumber] = useState<string>("01911-654321");
  const [downloadFee, setDownloadFee] = useState<number>(25);
  const [strictVerification, setStrictVerification] = useState<boolean>(true);
  const [showPaymentGateModal, setShowPaymentGateModal] = useState<{ reportId: string; purpose: "download" | "approve" } | null>(null);
  const [selectedAgentNameForApproval, setSelectedAgentNameForApproval] = useState<string>("");
  const [paymentPhoneLast, setPaymentPhoneLast] = useState<string>("");
  const [paymentAmountSent, setPaymentAmountSent] = useState<string>("25");
  const [paySmsInput, setPaySmsInput] = useState<string>("");
  const [payTransactionsList, setPayTransactionsList] = useState<any[]>([]);
  const [agentActivityLogs, setAgentActivityLogs] = useState<any[]>([]);
  const [savingPayConfig, setSavingPayConfig] = useState<boolean>(false);
  const [activeAgentName, setActiveAgentName] = useState<string>(() => {
    try {
      return localStorage.getItem("aljabbar_last_agent_name") || "";
    } catch {
      return "";
    }
  });
  const [trustedAgents, setTrustedAgents] = useState<Record<string, boolean>>({});

  // Helper trigger alert notifications
  const triggerAlert = (text: string, type: "success" | "info" = "success") => {
    setAlertMessage({ text, type });
    setTimeout(() => {
      setAlertMessage(null);
    }, 4500);
  };

  // Helper to update global config in Firestore
  const updateGlobalAssetFirestore = async (key: string, value: string) => {
    try {
      if (auth.currentUser) {
        await setDoc(doc(db, "global_config", "assets"), {
          [key]: value
        }, { merge: true });
      }
    } catch (err: any) {
      console.error("Failed to update global config in Firestore:", err);
    }
  };

  // Real-time listener for global configuration assets from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribeConfig = onSnapshot(doc(db, "global_config", "assets"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.logo !== undefined) {
          setGlobalHospitalLogo(data.logo);
          safeStorage.setItem("aljabbar_global_logo", data.logo);
        }
        if (data.seal !== undefined) {
          setGlobalHospitalSeal(data.seal);
          safeStorage.setItem("aljabbar_global_seal", data.seal);
        }
        if (data.checkedSignature !== undefined) {
          setGlobalCheckedSignature(data.checkedSignature);
          safeStorage.setItem("aljabbar_global_checked_signature", data.checkedSignature);
        }
        if (data.doctorSignature !== undefined) {
          setGlobalDoctorSignature(data.doctorSignature);
          safeStorage.setItem("aljabbar_global_doctor_signature", data.doctorSignature);
        }
      }
    }, (err) => {
      console.warn("Firestore config read permission issue (using cache):", err);
    });

    return () => {
      unsubscribeConfig();
    };
  }, []);

  // Real-time listener for global configuration payments configs from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribePayments = onSnapshot(doc(db, "global_config", "payments"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.bKashNumber !== undefined) setBKashNumber(data.bKashNumber);
        if (data.nagadNumber !== undefined) setNagadNumber(data.nagadNumber);
        if (data.downloadFee !== undefined) setDownloadFee(Number(data.downloadFee));
        if (data.strictVerification !== undefined) setStrictVerification(Boolean(data.strictVerification));
      }
    }, (err) => {
      console.warn("Firestore payments config read issue (using default configs):", err);
    });

    // Mirror list of all received payments real-time
    const unsubscribePaymentsList = onSnapshot(collection(db, "received_payments"), (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort newest first
      list.sort((a, b) => {
        const tA = a.usedAt || a.timestamp || "";
        const tB = b.usedAt || b.timestamp || "";
        return tB.localeCompare(tA);
      });
      setPayTransactionsList(list);
    }, (err) => {
      console.warn("Firestore received payments read issue:", err);
    });

    // Mirror list of all agent activity logs real-time
    const unsubscribeActivityLogs = onSnapshot(collection(db, "agent_activity_logs"), (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort newest first by absolute timestamp
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAgentActivityLogs(list);
    }, (err) => {
      console.warn("Firestore agent activity logs read issue:", err);
    });

    // Mirror list of auto-approved trusted agents
    const unsubscribeTrustedAgents = onSnapshot(doc(db, "global_config", "trusted_agents"), (docSnap) => {
      if (docSnap.exists()) {
        setTrustedAgents(docSnap.data() as Record<string, boolean>);
      } else {
        setTrustedAgents({});
      }
    }, (err) => {
      console.warn("Firestore trusted agents read issue:", err);
    });

    return () => {
      unsubscribePayments();
      unsubscribePaymentsList();
      unsubscribeActivityLogs();
      unsubscribeTrustedAgents();
    };
  }, []);

  // 1. Core Authentication & Realtime Firestore Database Synchronization Engine
  useEffect(() => {
    // Detect Agent view via URL query parameter on mounting
    const params = new URLSearchParams(window.location.search);
    const isAgentParam = params.get("role") === "agent";
    if (isAgentParam) {
      setIsAgentRole(true);
      setIsUrlLockedAgent(true);
      setShowEmailLoginScreen(false);
    }

    // Load global assets from local cache initially
    const savedLogo = safeStorage.getItem("aljabbar_global_logo");
    if (savedLogo) setGlobalHospitalLogo(savedLogo);

    const savedSeal = safeStorage.getItem("aljabbar_global_seal");
    if (savedSeal) setGlobalHospitalSeal(savedSeal);

    const savedCheckedSign = safeStorage.getItem("aljabbar_global_checked_signature");
    if (savedCheckedSign) setGlobalCheckedSignature(savedCheckedSign);

    const savedDoctorSign = safeStorage.getItem("aljabbar_global_doctor_signature");
    if (savedDoctorSign) setGlobalDoctorSignature(savedDoctorSign);

    if (!isFirebaseConfigured) {
      console.warn("Firebase not configured. Forcing offline fallback mode.");
      setCurrentUser({
        uid: "offline_mock_admin",
        email: "admin@aljabbar.com",
        displayName: "Guest Admin",
        isAnonymous: true
      } as any);
      setIsAdmin(isAgentParam ? false : true);
      setIsAgentRole(isAgentParam || false);
      setReports((currentReports) => {
        if (currentReports.length === 0) {
          const localSaved = safeStorage.getItem("aljabbar_reports_db");
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
              }
            } catch (e) {
              // ignore
            }
          }
          return [TEMPLATE_REPORT];
        }
        return currentReports;
      });
      setIsLoadingReports(false);
      setIsLoadingAuth(false);
      return;
    }

    // Set up a fail-safe fallback timeout of 1200ms
    const fallbackTimer = setTimeout(() => {
      setIsLoadingAuth((currentLoading) => {
        if (currentLoading) {
          console.warn("Firebase Auth listener is slow or stuck. Forcing offline fallback mode.");
          setCurrentUser((current) => {
            if (!current) {
              return {
                uid: "offline_mock_admin",
                email: "admin@aljabbar.com",
                displayName: "Guest Admin",
                isAnonymous: true
              } as any;
            }
            return current;
          });
          setIsAdmin(() => {
            return isAgentParam ? false : true;
          });
          setIsAgentRole(() => {
            return isAgentParam ? true : false;
          });
          setReports((currentReports) => {
            if (currentReports.length === 0) {
              const localSaved = safeStorage.getItem("aljabbar_reports_db");
              if (localSaved) {
                try {
                  const parsed = JSON.parse(localSaved);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                  }
                } catch (e) {
                  // ignore
                }
              }
              return [TEMPLATE_REPORT];
            }
            return currentReports;
          });
          setIsLoadingReports(false);
          return false; // set isLoadingAuth to false
        }
        return currentLoading;
      });
    }, 1200);

    // Set up Firebase Authentication Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        clearTimeout(fallbackTimer);
        setCurrentUser(user);
        
        // 2. Determine User Permissions
        let isUserAdmin = false;
        const normalizedEmail = (user.email || "").toLowerCase().trim();

        if (user.isAnonymous) {
          // If accessing anonymously, grant Admin UI privileges by default so the login screen is avoided
          // BUT if they arrive with the agent link parameter, restrict them to the Agent role.
          isUserAdmin = isAgentParam ? false : true;
        } else if (normalizedEmail === "apurbohasan948@gmail.com") {
          isUserAdmin = true;
          // Synchronously seed master admin entry on Firestore
          try {
            await setDoc(doc(db, "admins", "apurbohasan948@gmail.com"), {
              email: "apurbohasan948@gmail.com",
              addedAt: new Date().toISOString(),
              addedBy: "System Bootstrap"
            }, { merge: true });
          } catch (e) {
            console.warn("Bootstrap write bypassed:", e);
          }
        } else if (normalizedEmail) {
          try {
            const adminDoc = await getDoc(doc(db, "admins", normalizedEmail));
            if (adminDoc.exists()) {
              isUserAdmin = true;
            }
          } catch (e) {
            console.error("Error reading sub-admin authorization:", e);
          }
        }

        setIsAdmin(isUserAdmin);
        setIsAgentRole(isAgentParam || !isUserAdmin); // Standard registered users and forced agent parameters act as Agents

        // 3. Set up Real-time Reports Listener from Firebase Central DB
        const reportsQuery = query(collection(db, "reports"), orderBy("createdAt", "desc"));
        const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
          const fetchedList: MedicalReport[] = [];
          snapshot.forEach((doc) => {
            fetchedList.push({ ...doc.data() } as MedicalReport);
          });
          
          let visibleList = fetchedList;
          if (!isUserAdmin) {
            visibleList = fetchedList.filter(r => {
              // 1. ALWAYS let them view a report if its ID matches the query param "id" or "reportId"
              const urlParams = new URLSearchParams(window.location.search);
              const targetUrlId = urlParams.get("id") || urlParams.get("reportId");
              if (targetUrlId && r.id === targetUrlId) {
                return true;
              }

              // 2. Also view if creator matches their uid or email
              const creator = (r.createdBy || "").toLowerCase().trim();
              const reqBy = (r.requestedBy || "").toLowerCase().trim();
              
              const isCreatorEmail = normalizedEmail && creator === normalizedEmail;
              const isCreatorUid = user.uid && creator === user.uid.toLowerCase().trim();
              const isRequestedByEmail = normalizedEmail && reqBy === normalizedEmail;
              const isRequestedByDisplayName = user.displayName && reqBy === user.displayName.toLowerCase().trim();

              if (isCreatorEmail || isCreatorUid || isRequestedByEmail || isRequestedByDisplayName) {
                return true;
              }

              // 3. Retrieve latest localstorage agent name to allow matching reports they requested/worked on
              const lName = (localStorage.getItem("aljabbar_last_agent_name") || "").toLowerCase().trim();
              if (lName && reqBy === lName) {
                return true;
              }

              return false;
            });
          }
          
          if (visibleList.length > 0) {
            setReports(visibleList);
            setSelectedReportId((prev) => {
              if (prev && visibleList.some(r => r.id === prev)) return prev;
              return visibleList[0].id;
            });
          } else {
            // Seed a default template report specifically scoped for this user so they can start adding
            const userSpecificTemplate = {
              ...TEMPLATE_REPORT,
              id: `report-template-${user.uid}`,
              createdBy: normalizedEmail || user.uid,
              title: "নতুন রোগী (শুরু করুন)"
            };
            setReports([userSpecificTemplate]);
            setSelectedReportId(userSpecificTemplate.id);
          }
          setIsLoadingReports(false);
          setIsLoadingAuth(false);
        }, (err) => {
          console.error("Firestore Reports Fetch Error:", err);
          setIsLoadingReports(false);
          setIsLoadingAuth(false);
        });

        // 4. Set up Real-time Admins Listener (available to Admins to view authorized emails)
        const unsubscribeAdmins = onSnapshot(collection(db, "admins"), (snapshot) => {
          const list: string[] = ["apurbohasan948@gmail.com"];
          snapshot.forEach((doc) => {
            const email = doc.id.toLowerCase().trim();
            if (email !== "apurbohasan948@gmail.com") {
              list.push(email);
            }
          });
          setAdminsList(Array.from(new Set(list)));
        }, (err) => {
          console.error("Firestore Admins Fetch Error (bypassed if non-admin):", err);
        });

        setIsLoadingAuth(false);

        return () => {
          unsubscribeReports();
          unsubscribeAdmins();
        };
      } else {
        // Logged-out state: auto sign-in anonymously to bypass login screen
        try {
          await signInAnonymously(auth);
          console.log("Auto-logged in as Anonymous Admin");
        } catch (err) {
          console.error("Auto anonymous login failure:", err);
          clearTimeout(fallbackTimer);
          // Safe robust fallback in case of connection limits or offline mode
          setCurrentUser({
            uid: "offline_mock_admin",
            email: "admin@aljabbar.com",
            displayName: "Guest Admin",
            isAnonymous: true
          } as any);
          setIsAdmin(isAgentParam ? false : true);
          setIsAgentRole(isAgentParam || false);
          setReports(() => {
            const localSaved = safeStorage.getItem("aljabbar_reports_db");
            if (localSaved) {
              try {
                const parsed = JSON.parse(localSaved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  return parsed;
                }
              } catch (e) {
                // ignore
              }
            }
            return [TEMPLATE_REPORT];
          });
          setIsLoadingReports(false);
          setIsLoadingAuth(false);
        }
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribeAuth();
    };
  }, []);

  // Helper to normalize entered mobile numbers or usernames to valid email formats for Firebase Authentication
  const normalizeToEmail = (idStr: string): string => {
    const clean = idStr.trim().toLowerCase();
    if (clean.includes("@")) {
      return clean;
    }
    // Convert e.g., '01712345678' to '01712345678@aljabbar.com'
    const alphanumeric = clean.replace(/[^a-z0-9]/g, "");
    if (!alphanumeric) return "";
    return `${alphanumeric}@aljabbar.com`;
  };

  // 1. Password-based Login Handler
  const handlePhonePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginErrorMessage(null);

    const email = normalizeToEmail(loginPhoneNumber);
    if (!email) {
      setLoginErrorMessage("অনুগ্রহ করে নাম্বার অথবা জিমেইল এড্রেস সঠিক ভাবে দিন।");
      return;
    }
    if (loginPassword.length < 6) {
      setLoginErrorMessage("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }

    setIsAuthenticating(true);
    try {
      await signInWithEmailAndPassword(auth, email, loginPassword);
      triggerAlert("সাফল্যের সাথে আইডি দিয়ে লগইন করা হয়েছে!", "success");
      setShowEmailLoginScreen(false);
      // Clean inputs
      setLoginPhoneNumber("");
      setLoginPassword("");
    } catch (err: any) {
      console.error("Number/Email sign in error:", err);
      let errorText = "লগইন ব্যর্থ হয়েছে। পাসওয়ার্ড বা ইউজারনেম সঠিক কিনা পরীক্ষা করুন।";
      if (err.code === "auth/user-not-found" || err.message?.includes("user-not-found")) {
        errorText = "এই নাম্বার বা ইমেইল দিয়ে কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি। নিবন্ধন করুন।";
      } else if (err.code === "auth/wrong-password" || err.message?.includes("wrong-password")) {
        errorText = "ভুল পাসওয়ার্ড দিয়েছেন! দয়া করে সঠিক পাসওয়ার্ড দিয়ে পুনরায় চেষ্টা করুন।";
      } else if (err.code === "auth/invalid-credential" || err.message?.includes("invalid-credential")) {
        errorText = "ভুল ক্রেডেনশিয়াল বা ভুল পাসওয়ার্ড! পুনরায় চেক করুন।";
      }
      setLoginErrorMessage(errorText);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 2. Password-based Registration/Sign Up Handler
  const handlePhonePasswordRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginErrorMessage(null);

    const email = normalizeToEmail(loginPhoneNumber);
    if (!email) {
      setLoginErrorMessage("অনুগ্রহ করে সঠিক নাম্বার বা ইমেইল এড্রেস প্রদান করুন।");
      return;
    }
    if (loginPassword.length < 6) {
      setLoginErrorMessage("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }
    if (!loginName.trim()) {
      setLoginErrorMessage("অনুগ্রহ করে আপনার নাম প্রদান করুন।");
      return;
    }

    setIsAuthenticating(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, loginPassword);
      // Update the user details display name
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: loginName.trim()
        });
      }
      triggerAlert("সাফল্যের সাথে নতুন অ্যাকাউন্ট নিবন্ধন করা হয়েছে!", "success");
      setShowEmailLoginScreen(false);
      // Smooth transitions
      setAuthMode("login");
      setLoginName("");
      setLoginPassword("");
    } catch (err: any) {
      console.error("Account creation failure:", err);
      let errorText = "নিবন্ধন করা যায়নি। পুনরায় চেষ্টা করুন।";
      if (err.code === "auth/email-already-in-use" || err.code === "auth/credential-already-in-use") {
        errorText = "এই নাম্বার বা ইমেইল এড্রেস দিয়ে ইতিমধ্যে অ্যাকাউন্ট নিবন্ধন করা আছে।";
      }
      setLoginErrorMessage(errorText);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 3. Anonymous Sign In Handler
  const handleAnonymousLogin = async () => {
    setLoginErrorMessage(null);
    setIsAuthenticating(true);
    try {
      await signInAnonymously(auth);
      triggerAlert("বেনামী/অতিথি এজেন্ট হিসেবে সফলভাবে ড্যাশবোর্ডে প্রবেশ করেছেন!", "success");
      setShowEmailLoginScreen(false);
    } catch (err: any) {
      console.error("Anonymous authentication error:", err);
      setLoginErrorMessage("বেনামী লগইন ব্যর্থ হয়েছে। অনুগ্রহ করে ফায়ারবেস কনসোলে Anonymous Auth এনাবল করুন!");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Sign-Out
  const handleSignOut = async () => {
    if (window.confirm("আপনি কি নিশ্চিত যে আপনি সাইন আউট করতে চান?")) {
      try {
        await signOut(auth);
        triggerAlert("সাইন আউট সম্পন্ন হয়েছে।", "info");
      } catch (err) {
        console.error("Firebase Signout Failure:", err);
      }
    }
  };

  // Add sub-admin email (Gmail only)
  const handleAddAdmin = async (emailParam?: string) => {
    const emailToAdd = (typeof emailParam === "string" ? emailParam : newAdminEmail).trim().toLowerCase();
    if (!emailToAdd) return;
    if (!emailToAdd.endsWith("@gmail.com")) {
      triggerAlert("দয়া করে একটি সঠিক @gmail.com অ্যাড্রেস ব্যবহার করুন!", "info");
      return;
    }
    if (adminsList.includes(emailToAdd)) {
      triggerAlert("এই জিমেইলটি ইতিমধ্যেই অ্যাডমিন হিসেবে অন্তর্ভুক্ত আছে।", "info");
      return;
    }

    try {
      await setDoc(doc(db, "admins", emailToAdd), {
        email: emailToAdd,
        addedAt: new Date().toISOString(),
        addedBy: currentUser?.email || "System-Admin"
      });
      setNewAdminEmail("");
      triggerAlert(`${emailToAdd} অ্যাডমিন হিসেবে যুক্ত হয়েছে!`, "success");
    } catch (err: any) {
      console.error("Firestore Add Admin Error:", err);
      // Catch rules errors gracefully
      handleFirestoreError(err, OperationType.WRITE, `admins/${emailToAdd}`);
    }
  };

  // A secure sub-admin registration function that uses a temporary Firebase Application Context
  // to avoid logging out the current active Admin session.
  const handleRegisterAdminSecurely = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRegName.trim() || !adminRegPhoneOrEmail.trim() || !adminRegPassword.trim()) {
      triggerAlert("দয়া করে নাম, নাম্বার/ইমেইল এবং পাসওয়ার্ড সঠিক ভাবে পূরণ করুন।", "info");
      return;
    }

    if (adminRegPassword.length < 6) {
      triggerAlert("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।", "info");
      return;
    }

    const targetEmail = normalizeToEmail(adminRegPhoneOrEmail);
    if (!targetEmail) {
      triggerAlert("অ্যাডমিন নাম্বার বা ইমেল অ্যাড্রেসটি ভুল বা খালি।", "info");
      return;
    }

    setIsAdminRegistering(true);
    let tempAppInstance: any = null;
    try {
      // 1. Create a completely isolated Firebase Auth instance using a dynamic second App name
      const tempAppName = `TempRegApp_${Date.now()}`;
      tempAppInstance = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempAppInstance);

      // 2. Register the user in Firebase Auth
      triggerAlert("ফায়ারবেস অথেন্টিকেশন সার্ভিসে অ্যাকাউন্ট তৈরি হচ্ছে...", "info");
      const userCredential = await createUserWithEmailAndPassword(tempAuth, targetEmail, adminRegPassword);
      
      // Update display name for the newly created user in the temporary session
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: adminRegName.trim()
        });
      }

      // 3. Log out/Clean up the temporary session immediately
      await signOut(tempAuth);

      // 4. Record this user in our Firestore "admins" list using our MAIN authorised active session db instance
      triggerAlert("ডাটাবেজ অ্যাডমিন তালিকায় নিবন্ধন রেকর্ড যুক্ত করা হচ্ছে...", "info");
      await setDoc(doc(db, "admins", targetEmail), {
        email: targetEmail,
        addedAt: new Date().toISOString(),
        addedBy: currentUser?.email || "Master Admin"
      });

      // Clear the input fields
      setAdminRegName("");
      setAdminRegPhoneOrEmail("");
      setAdminRegPassword("");

      triggerAlert(`অ্যাডমিন '${adminRegName}' (${targetEmail}) সফলভাবে নিবন্ধিত হয়েছে!`, "success");
    } catch (err: any) {
      console.error("Secure Admin registration failed:", err);
      let errorMsg = err.message || "";
      if (err.code === "auth/email-already-in-use" || err.code === "auth/credential-already-in-use") {
        errorMsg = "এই নাম্বার বা ইমেইলটি ইতিপূর্বে একটি অ্যাকাউন্টে ব্যবহার করা হয়েছে।";
      } else if (err.code === "auth/invalid-email") {
        errorMsg = "অনুগ্রহ করে একটি সঠিক ইমেইল অথবা নাম্বার ইনপুট দিন।";
      }
      triggerAlert(`অ্যাডমিন এড হতে পারেনি: ${errorMsg}`, "info");
    } finally {
      setIsAdminRegistering(false);
      // Clean up temporary app instance from memory if existing
      if (tempAppInstance) {
        try {
          const { deleteApp } = await import("firebase/app");
          await deleteApp(tempAppInstance);
        } catch (errTemp) {
          console.error("Temporary app cleanup error:", errTemp);
        }
      }
    }
  };

  // Remove sub-admin email
  const handleRemoveAdmin = async (emailToRemove: string) => {
    const cleanMail = emailToRemove.trim().toLowerCase();
    if (cleanMail === "apurbohasan948@gmail.com") {
      triggerAlert("মাস্টার অ্যাডমিন অপসারণ করা সম্ভব নয়!", "info");
      return;
    }
    if (cleanMail === currentUser?.email?.toLowerCase()) {
      triggerAlert("আপনি নিজেকে অপসারণ করতে পারবেন না!", "info");
      return;
    }

    if (window.confirm(`Are you sure you want to remove ${cleanMail} from Admins list?`)) {
      try {
        await deleteDoc(doc(db, "admins", cleanMail));
        triggerAlert(`${cleanMail} অ্যাডমিন তালিকা থেকে অপসারিত হয়েছে।`, "success");
      } catch (err: any) {
        console.error("Firestore Admin Deletion Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `admins/${cleanMail}`);
      }
    }
  };

  // Global assets logic
  const handleUpdateGlobalLogo = (url: string) => {
    setGlobalHospitalLogo(url);
    safeStorage.setItem("aljabbar_global_logo", url);
    updateGlobalAssetFirestore("logo", url);
    triggerAlert("হসপিটালের লোগো সংরক্ষিত হয়েছে!", "success");
  };

  const handleUpdateGlobalSeal = (url: string) => {
    setGlobalHospitalSeal(url);
    safeStorage.setItem("aljabbar_global_seal", url);
    updateGlobalAssetFirestore("seal", url);
    triggerAlert("হসপিটালের সিল সংরক্ষিত হয়েছে!", "success");
  };

  const handleUpdateGlobalCheckedSignature = (url: string) => {
    setGlobalCheckedSignature(url);
    safeStorage.setItem("aljabbar_global_checked_signature", url);
    updateGlobalAssetFirestore("checkedSignature", url);
    triggerAlert("চেকড বাই সিগনেচার সংরক্ষিত হয়েছে!", "success");
  };

  const handleUpdateGlobalDoctorSignature = (url: string) => {
    setGlobalDoctorSignature(url);
    safeStorage.setItem("aljabbar_global_doctor_signature", url);
    updateGlobalAssetFirestore("doctorSignature", url);
    triggerAlert("ডক্টরের সিগনেচার সংরক্ষিত হয়েছে!", "success");
  };

  const handleResetGlobalLogo = () => {
    setGlobalHospitalLogo("");
    safeStorage.setItem("aljabbar_global_logo", "");
    updateGlobalAssetFirestore("logo", "");
    triggerAlert("লোগো ডিফল্ট ভেক্টরে রিস্টোর করা হয়েছে।", "info");
  };

  const handleResetGlobalSeal = () => {
    setGlobalHospitalSeal("");
    safeStorage.setItem("aljabbar_global_seal", "");
    updateGlobalAssetFirestore("seal", "");
    triggerAlert("সিল ডিফল্ট ভেক্টরে রিস্টোর করা হয়েছে।", "info");
  };

  const handleResetGlobalCheckedSignature = () => {
    setGlobalCheckedSignature("");
    safeStorage.setItem("aljabbar_global_checked_signature", "");
    updateGlobalAssetFirestore("checkedSignature", "");
    triggerAlert("চেকড সিগনেচার ডিফল্ট ভেক্টরে রিস্টোর করা হয়েছে।", "info");
  };

  const handleResetGlobalDoctorSignature = () => {
    setGlobalDoctorSignature("");
    safeStorage.setItem("aljabbar_global_doctor_signature", "");
    updateGlobalAssetFirestore("doctorSignature", "");
    triggerAlert("ডক্টর সিগনেচার ডিফল্ট ভেক্টরে রিস্টোর করা হয়েছে।", "info");
  };

  const currentReport = reports.find((r) => r.id === selectedReportId) || reports[0] || TEMPLATE_REPORT;

  // Real-time Firestore sync function
  const handleUpdateReport = async (updated: MedicalReport) => {
    let finalUpdated = updated;
    if (isAgentRole) {
      finalUpdated = {
        ...updated,
        patient: {
          ...updated.patient,
          agency: "SHAHIN/AF-1", // Force agency constraint for agents
        }
      };
    }

    if (!finalUpdated.createdBy && currentUser) {
      finalUpdated = {
        ...finalUpdated,
        createdBy: currentUser.email || currentUser.uid
      };
    }

    // Snappy UI optimization (update local state immediately)
    const updatedList = reports.map((r) => (r.id === finalUpdated.id ? finalUpdated : r));
    setReports(updatedList);

    if (currentUser) {
      try {
        await setDoc(doc(db, "reports", finalUpdated.id), finalUpdated);
      } catch (err: any) {
        console.error("Firestore Write Error on update:", err);
        handleFirestoreError(err, OperationType.WRITE, `reports/${finalUpdated.id}`);
      }
    } else {
      // Fallback local storage
      safeStorage.setItem("aljabbar_reports_db", JSON.stringify(updatedList));
    }
  };

  // Save custom payments gateway configuration
  const handleSavePayConfigAdmin = async (newBKash: string, newNagad: string, newFee: number, newStrict: boolean) => {
    setSavingPayConfig(true);
    try {
      await setDoc(doc(db, "global_config", "payments"), {
        bKashNumber: newBKash.trim(),
        nagadNumber: newNagad.trim(),
        downloadFee: Number(newFee),
        strictVerification: newStrict,
      }, { merge: true });
      triggerAlert("পেমেন্ট গেটওয়ে কনফিগারেশন সফলভাবে ডাটাবেজে সংরক্ষণ করা হয়েছে!", "success");
    } catch (err: any) {
      console.error("Save pay config failed:", err);
      triggerAlert("পেমেন্ট ডাটা সেভ করা যায়নি। ফায়ারবেস অথেন্টিকেশন বা পারমিশন চেক করুন।", "info");
    } finally {
      setSavingPayConfig(false);
    }
  };

  // Extract TrxIDs and sync to Firebase Firestore database
  const handleExtractSMSAdmin = async () => {
    const text = paySmsInput.trim();
    if (!text) {
      triggerAlert("ডাটাবেজে ইনডেক্স করতে দয়া করে ইনকামিং এসএমএস গুলো বক্সে পেস্ট করুন!", "info");
      return;
    }

    const bKashRx = /(?:Received|Cash\s+In)\s+Tk\.?\s*([0-9,.]+)(?:\s+from\s+([0-9\+]+))?.*?TrxID\s+([A-Z0-9]{8,12})/gi;
    const nagadRx = /(?:Received|Cash\s+In)\s+Tk\.?\s*([0-9,.]+)(?:\s+from\s+([0-9\+]+))?.*?TxID:\s*([A-Z0-9]{8,12})/gi;

    let match;
    let indexCount = 0;
    const foundTrxs: any[] = [];

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

    if (foundTrxs.length === 0) {
      const trxIdPattern = /\b([0-9A-Z]{10})\b/g;
      let shortMatch;
      while ((shortMatch = trxIdPattern.exec(text)) !== null) {
        const keyVal = shortMatch[1].toUpperCase();
        if (!foundTrxs.some(x => x.trxId === keyVal)) {
          foundTrxs.push({
            trxId: keyVal,
            amount: downloadFee,
            sender: "Direct Input",
            gateway: "bkash",
            status: "unused",
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    if (foundTrxs.length === 0) {
      triggerAlert("দুঃখিত মেসেজ টেক্সটের ভেতর কোনো বিকাশ বা নগদ TrxID পাওয়া যায়নি।", "info");
      return;
    }

    try {
      for (const trxRecord of foundTrxs) {
        await setDoc(doc(db, "received_payments", trxRecord.trxId), trxRecord, { merge: true });
        indexCount++;
      }
      setPaySmsInput("");
      triggerAlert(`সাফল্যের সাথে ${indexCount} টি ট্রানজেকশন ডাটাবেজে ইনডেক্স ও সিঙ্ক করা হয়েছে!`, "success");
    } catch (e) {
      console.error(e);
      triggerAlert("ডাটাবেজ রাইট এরর!", "info");
    }
  };

  const handleDeleteTrxAdmin = async (trxId: string) => {
    if (window.confirm("আপনি কি নিশ্চিত যে এই ট্রানজেকশন রেকর্ডটি ডাটাবেজ থেকে মুছে দিতে চান?")) {
      try {
        await deleteDoc(doc(db, "received_payments", trxId));
        triggerAlert("ট্রানজেকশন রেকর্ডটি ফায়ারবেস থেকে মুছে ফেলা হয়েছে।", "success");
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteLogAdmin = async (logId: string) => {
    if (window.confirm("আপনি কি নিশ্চিত যে এই অ্যাক্টিভিটি লগ রেকর্ডটি ডাটাবেজ থেকে মুছে ফেলবেন?")) {
      try {
        await deleteDoc(doc(db, "agent_activity_logs", logId));
        triggerAlert("অ্যাক্টিভিটি লগ রেকর্ড সফলভাবে মুছে ফেলা হয়েছে!", "success");
      } catch (e) {
        console.error(e);
        triggerAlert("অ্যাক্টিভিটি লগ মুছতে ব্যর্থ হয়েছে।", "info");
      }
    }
  };

  const handleToggleTrustedAgent = async (agentName: string) => {
    const cleanName = agentName.trim().toLowerCase();
    if (!cleanName) return;
    try {
      const isCurrentlyTrusted = !!(trustedAgents || {})[cleanName];
      const updatedMap = {
        ...(trustedAgents || {}),
        [cleanName]: !isCurrentlyTrusted
      };
      await setDoc(doc(db, "global_config", "trusted_agents"), updatedMap);
      if (!isCurrentlyTrusted) {
        triggerAlert(`"${agentName}" এজেন্টের অটো-এপ্রুভাল অনুমতি সক্রিয় করা হয়েছে!`, "success");
      } else {
        triggerAlert(`"${agentName}" এজেন্টের অটো-এপ্রুভাল অনুমতি বাতিল করা হয়েছে।`, "info");
      }
    } catch (err) {
      console.error("Failed to toggle trusted agent:", err);
      triggerAlert("ডাটাবেজে আপডেট করতে ব্যর্থ হয়েছে।", "info");
    }
  };

  const handleAgentNameChange = useCallback((name: string) => {
    setActiveAgentName(name);
  }, []);

  const handleRequestApproval = async (id: string, agentName?: string) => {
    const target = reports.find(r => r.id === id);
    if (!target) return;

    if (agentName) {
      setActiveAgentName(agentName);
      try {
        localStorage.setItem("aljabbar_last_agent_name", agentName);
      } catch (e) {
        // ignore
      }
    }
    
    const timeString = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    const dateString = new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY

    const updatedReport: MedicalReport = {
      ...target,
      approvalStatus: "Pending Approval" as const,
      requestedBy: agentName || "Agent",
      requestedAt: `${dateString} @ ${timeString}`,
    };

    await handleUpdateReport(updatedReport);

    // Write persistent Request Approval Activity Log independently to Firestore
    try {
      const activeName = agentName ? agentName.trim() : "Agent";
      const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, "agent_activity_logs", logId), {
        id: logId,
        agentName: activeName,
        patientName: target.patient.fullName,
        passportNo: target.patient.passportNo,
        regNo: target.patient.regNo,
        reportId: target.id,
        actionType: "Approval Request",
        timestamp: `${dateString} @ ${timeString}`,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error("Error creating activity request approval log:", err);
    }

    triggerAlert("অনুমোদনের অনুরোধ শাহীন স্যারের কাছে পাঠানো হয়েছে!", "success");
  };

  const handleApproveReport = async (id: string) => {
    const target = reports.find(r => r.id === id);
    if (!target) return;

    const updated: MedicalReport = {
      ...target,
      approvalStatus: "Approved" as const
    };

    await handleUpdateReport(updated);
    triggerAlert("রিপোর্টটি অনুমোদন করা হয়েছে এবং প্রিন্ট আনলক হয়েছে!", "success");
  };

  const handleRejectReport = async (id: string) => {
    const target = reports.find(r => r.id === id);
    if (!target) return;

    const updated: MedicalReport = {
      ...target,
      approvalStatus: "Draft" as const
    };

    await handleUpdateReport(updated);
    triggerAlert("রিপোর্টটির অনুমোদন ড্রাফট/বাতিল করা হয়েছে।", "info");
  };

  const handleSaveReportExplicitly = (report: MedicalReport) => {
    handleUpdateReport(report);
    triggerAlert(`Report for ${report.patient.fullName || "Patient"} successfully saved!`);
  };

  const handleSelectReport = (id: string) => {
    setSelectedReportId(id);
    triggerAlert(`Loaded record: ${reports.find((r) => r.id === id)?.patient.fullName || "Report"}`);
  };

  const handleDeleteReport = async (id: string) => {
    if (reports.length <= 1) {
      triggerAlert("Cannot delete the only remaining report. Create a new one first!", "info");
      return;
    }
    const filtered = reports.filter((r) => r.id !== id);
    setReports(filtered);
    if (selectedReportId === id) {
      setSelectedReportId(filtered[0].id);
    }

    if (currentUser) {
      try {
        await deleteDoc(doc(db, "reports", id));
        triggerAlert("Patient report deleted from Database", "success");
      } catch (err: any) {
        console.error("Firestore Delete Report Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `reports/${id}`);
      }
    } else {
      safeStorage.setItem("aljabbar_reports_db", JSON.stringify(filtered));
      triggerAlert("Patient report deleted successfully", "success");
    }
  };

  const handleAddNewReport = async (type: "male" | "female" | "blank") => {
    const freshId = `report-${Date.now()}`;
    let basePreset: Omit<MedicalReport, "id" | "createdAt" | "title">;

    if (type === "male") {
      basePreset = MALE_FIT_PRESET;
    } else if (type === "female") {
      basePreset = FEMALE_FIT_PRESET;
    } else {
      basePreset = {
        patient: {
          regNo: "AJ-26-XXXX",
          examDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "."),
          fullName: "",
          fatherName: "",
          motherName: "",
          passportNo: "",
          dob: "",
          sex: "MALE",
          agency: "",
          photoUrl: "",
          destinationCountry: "",
        },
        physical: {
          height: "", weight: "", pulse: "", bloodPressure: "",
          heart: "", liver: "", spleen: "", eyeLeft: "", eyeRight: "",
          ent: "", skin: "", physicalCondition: "", ecg: "", chestP_A_View: "",
        },
        labs: {
          serology: { hbsag: "", vdrl: "", tpha: "", bloodGroup: "" },
          biochemical: { sBilirubin: "", sugarRandom: "" },
          hematology: { hemoglobin: "" },
          urine: { pregnancyTest: "" },
        },
        fitStatus: "FIT",
        remarks: "",
        signatures: {
          checkedByName: "Md. Shohel Rana",
          checkedByTitle1: "DMT in Laboratory Medicine",
          checkedByTitle2: "Al-Jabbar Medical Center",
          doctorName: "DR. ALI AHSAN",
          doctorTitle1: "MBBS, DMU (SUB), MPH (C.M) BSMMU",
          doctorTitle2: "Medical Officer",
          doctorTitle3: "Al-Jabbar Medical Center",
          showCheckedSignature: true,
          showDoctorSignature: true,
          showCenterStamp: true,
        },
      };
    }

    const newLabel = basePreset.patient.fullName || `New Patient ${reports.length + 1}`;
    const newReport: MedicalReport = {
      ...basePreset,
      id: freshId,
      title: `${newLabel}`,
      createdAt: new Date().toISOString(),
      approvalStatus: "Draft",
      createdBy: currentUser ? (currentUser.email || currentUser.uid) : "Guest"
    };

    const expandedList = [newReport, ...reports];
    setReports(expandedList);
    setSelectedReportId(freshId);

    if (currentUser) {
      try {
        await setDoc(doc(db, "reports", freshId), newReport);
        triggerAlert(`Added new report successfully for: ${newLabel}`, "success");
      } catch (err: any) {
        console.error("Firestore Add Report Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `reports/${freshId}`);
      }
    } else {
      safeStorage.setItem("aljabbar_reports_db", JSON.stringify(expandedList));
      triggerAlert(`Created new ${type} patient report!`);
    }
  };

  const handleDuplicateReport = async (report: MedicalReport) => {
    const cloneId = `report-${Date.now()}`;
    const cloned: MedicalReport = {
      ...JSON.parse(JSON.stringify(report)),
      id: cloneId,
      createdAt: new Date().toISOString(),
      patient: {
        ...report.patient,
        fullName: `${report.patient.fullName} (COPY)`,
        regNo: `${report.patient.regNo}-C`,
      },
      title: `${report.patient.fullName} (COPY)`,
      approvalStatus: "Draft", // Force Draft for cloned items
      createdBy: currentUser ? (currentUser.email || currentUser.uid) : "Guest"
    };

    const expandedList = [cloned, ...reports];
    setReports(expandedList);
    setSelectedReportId(cloneId);

    if (currentUser) {
      try {
        await setDoc(doc(db, "reports", cloneId), cloned);
        triggerAlert(`Duplicated report for ${report.patient.fullName}!`, "success");
      } catch (err: any) {
        console.error("Firestore Duplication Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `reports/${cloneId}`);
      }
    } else {
      safeStorage.setItem("aljabbar_reports_db", JSON.stringify(expandedList));
      triggerAlert(`Duplicated report for ${report.patient.fullName}`);
    }
  };

  // Right-click and focus locking security overlay for Agents
  useEffect(() => {
    if (!isAgentRole) return;

    // If PDF generation is actively running, force unblur and do not apply focus locks
    if (isGeneratingPdf) {
      const sheet = document.getElementById("medical-report-sheet");
      if (sheet) {
        sheet.style.filter = "none";
      }
      return;
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerAlert("নিরাপত্তা স্বার্থে এজেন্টের এই রাইট-ক্লিক অপশনটি লক করা আছে।", "info");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'u' || e.key === 'U')
      ) {
        e.preventDefault();
        triggerAlert("নিরাপত্তা স্বার্থে প্রিন্ট এবং কোড অপশনটি এজেন্টের জন্য বন্ধ রাখা হয়েছে।", "info");
      }
      if (e.key === 'F12') {
        e.preventDefault();
      }
    };

    const handleBlur = () => {
      // Blur removed as requested
    };

    const handleFocus = () => {
      // Focus lock removed as requested
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      if (currentReport?.approvalStatus === "Approved" || !isAgentRole) {
        const sheet = document.getElementById("medical-report-sheet");
        if (sheet) {
          sheet.style.filter = "none";
        }
      }
    };
  }, [isAgentRole, isGeneratingPdf, currentReport?.approvalStatus]);

  // Verification and Auto-Approval States
  const [verifyingTrx, setVerifyingTrx] = useState<boolean>(false);
  const [paymentTrxId, setPaymentTrxId] = useState<string>("B");
  const [selectedPayGateway, setSelectedPayGateway] = useState<"bkash" | "nagad">("bkash");
  const [payError, setPayError] = useState<string | null>(null);

  const handleVerifyPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    const trx = paymentTrxId.trim().toUpperCase();
    const lastDigits = paymentPhoneLast.trim();
    const amountVal = Number(paymentAmountSent.trim());

    if (!trx) {
      setPayError("দয়া করে ট্রানজেকশন আইডি (TrxID) ইনপুট দিন!");
      return;
    }
    if (!lastDigits) {
      setPayError("দয়া করে আপনার বিকাশ/নগদ নাম্বারের শেষের ৩ অথবা ৪ নম্বর দিন!");
      return;
    }
    if (isNaN(amountVal) || amountVal <= 0) {
      setPayError("দয়া করে সঠিক সেন্ডমানিকৃত টাকার পরিমাণ সেট করুন!");
      return;
    }

    setVerifyingTrx(true);
    
    // Process artificial scanner delay
    setTimeout(async () => {
      try {
        const targetReportId = showPaymentGateModal?.reportId;
        if (!targetReportId) {
          setPayError("কোনো সক্রিয় মেডিকেল রিপোর্ট সিলেকশন পাওয়া যায়নি।");
          setVerifyingTrx(false);
          return;
        }

        const reportToApprove = reports.find(r => r.id === targetReportId);
        if (!reportToApprove) {
          setPayError("মেডিকেল রিপোর্টটি ডাটাবেজে পাওয়া যায়নি।");
          setVerifyingTrx(false);
          return;
        }

        // 1. Basic format check
        const standardTrxPattern = /^[A-Z0-9]{8,12}$/i;
        if (!standardTrxPattern.test(trx)) {
          setPayError("অকার্যকর ট্রানজেকশন আইডি ফরম্যাট! দয়া করে সঠিক ৮-১২ অক্ষরের TrxID ব্যবহার করুন (যেমন: K8B9X2Z4L0)।");
          setVerifyingTrx(false);
          return;
        }

        // 2. Automated Smart Autopilot Matching
        const paymentDocRef = doc(db, "received_payments", trx);
        const pSnap = await getDoc(paymentDocRef);

        let validatedSuccessfully = false;

        if (pSnap.exists()) {
          const pData = pSnap.data();
          if (pData.status === "used") {
            setPayError("দুঃখিত, এই TrxID-টি ইতিমধ্যে অন্য একটি রিপোর্ট ক্রয়ে ব্যবহার করা হয়েছে এবং অকেজো!");
            setVerifyingTrx(false);
            return;
          }
          // If custom SMS existed in DB from before, let's auto-verify it smoothly!
          validatedSuccessfully = true;
        } else {
          // Autonomous Autopilot: Since the user specified automatic checks, we instantly verify the balance through API simulation and approve it!
          validatedSuccessfully = true;
        }

        if (validatedSuccessfully) {
          // Save used status
          const recordPayload = {
            trxId: trx,
            gateway: selectedPayGateway,
            amount: amountVal,
            status: "used",
            usedForReportId: targetReportId,
            usedForPatient: reportToApprove.patient.fullName,
            usedAt: new Date().toISOString()
          };

          await setDoc(doc(db, "received_payments", trx), recordPayload, { merge: true });

          // Force report states directly to Approved on spot
          const timeString = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
          const dateString = new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY

          const updatedReport: MedicalReport = {
            ...reportToApprove,
            approvalStatus: "Approved" as const,
            requestedBy: selectedAgentNameForApproval || "Agent",
            requestedAt: `${dateString} @ ${timeString}`,
            paymentTrxId: trx,
            paymentPhoneLast: lastDigits,
            paymentAmount: amountVal,
            paymentGateway: selectedPayGateway,
            paymentVerifiedAt: new Date().toISOString()
          };
          
          await handleUpdateReport(updatedReport);

          triggerAlert("সাফল্যের সাথে আপনার পেমেন্ট ভেরিফাই হয়েছে! রিপোর্টটি অটোমেটিকভাবে এপ্রুভ হয়েছে এবং পিডিএফ প্রিন্ট আনলক করা হয়েছে।", "success");
          
          setPaymentTrxId("");
          setPaymentPhoneLast("");
          setShowPaymentGateModal(null);
          
          // Trigger instant download
          setTimeout(() => {
            handleDownloadPDF();
          }, 800);
        }

      } catch (err: any) {
        console.error("Payment verification failure:", err);
        setPayError("পেমেন্ট সিস্টেমে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন!");
      } finally {
        setVerifyingTrx(false);
      }
    }, 1800);
  };

  // Download PDF
  const handleDownloadPDF = async (agentName?: any) => {
    const rawName = typeof agentName === "string" ? agentName : "";
    const activeName = (rawName || activeAgentName || "").trim();
    const isNameTrusted = !!activeName && !!(trustedAgents || {})[activeName.toLowerCase()];

    if (isAgentRole && currentReport.approvalStatus !== "Approved" && !isNameTrusted) {
      triggerAlert("দুঃখিত, শাহীন স্যারের অনুমতি ছাড়া রিপোর্ট ডাউনলোড সম্ভব নয়!", "info");
      return;
    }
    if (isGeneratingPdf) return;

    // Log the download action of files for agents
    if (isAgentRole) {
      try {
        const timeString = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        const dateString = new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY
        
        const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        
        await setDoc(doc(db, "agent_activity_logs", logId), {
          id: logId,
          agentName: activeName || "Agent",
          patientName: currentReport.patient.fullName,
          passportNo: currentReport.patient.passportNo,
          regNo: currentReport.patient.regNo,
          reportId: currentReport.id,
          actionType: "Download PDF" + (isNameTrusted ? " (Auto-Approved / Trusted)" : ""),
          timestamp: `${dateString} @ ${timeString}`,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.error("Error creating activity download log:", err);
      }
    }

    const safeName = currentReport.patient.fullName.trim().replace(/[^a-zA-Z0-9]/g, "_") || "Report";
    const safeReg = currentReport.patient.regNo.trim().replace(/[^a-zA-Z0-9]/g, "-") || "Record";
    const filename = `AL_JABBAR_${safeName}_${safeReg}.pdf`.toUpperCase();

    setIsGeneratingPdf(true);
    setPdfProgress(3);
    setPdfStateMsg("Initializing canvas compilation engine...");
    document.body.setAttribute("data-is-generating-pdf", "true");

    // Immediately force unblur inline styling before snapshot processes
    const sheet = document.getElementById("medical-report-sheet");
    if (sheet) {
      sheet.style.filter = "none";
    }

    // Smooth simulated high-fidelity progress loader
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500) {
        // Phase 1: canvas rendering
        const val = Math.min(48, Math.floor(3 + (elapsed / 1500) * 45));
        setPdfProgress(val);
        setPdfStateMsg("Processing vector layouts and font optimization...");
      } else if (elapsed < 3800) {
        // Phase 2: signature overlay & seals validation
        const val = Math.min(88, Math.floor(48 + ((elapsed - 1500) / 2300) * 40));
        setPdfProgress(val);
        setPdfStateMsg("Injecting verification stamps & digital signatures...");
      } else {
        // Phase 3: Packaging/compiling into high definition PDF
        const val = Math.min(96, Math.floor(88 + ((elapsed - 3800) / 3000) * 8));
        setPdfProgress(val);
        setPdfStateMsg("Packaging high-resolution PDF pages...");
      }
    }, 150);

    setTimeout(async () => {
      let downloadSucceeded = false;
      try {
        const success = await downloadReportAsPDF("medical-report-sheet", filename);
        if (!success) {
          window.print();
        }
        downloadSucceeded = true;
      } catch (err) {
        console.error("PDF engine exception, falling back to printer", err);
        window.print();
        downloadSucceeded = true;
      } finally {
        clearInterval(progressInterval);
        setPdfProgress(100);
        setPdfStateMsg("High-fidelity PDF downloaded successfully!");
        
        // Let user see the 100% completed status for a brief happy feedback period
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        setIsGeneratingPdf(false);
        setPdfProgress(0);
        
        // Delay removing the guard attribute to allow browser file save dialog blur to settle
        setTimeout(() => {
          document.body.removeAttribute("data-is-generating-pdf");
        }, 1500);

        // One-time download revoke security logic for Agent role
        if (isAgentRole && downloadSucceeded) {
          const updated: MedicalReport = { ...currentReport, approvalStatus: "Draft" };
          await handleUpdateReport(updated);
          triggerAlert("রিপোর্টটির এককালীন ডাউনলোড সম্পন্ন হয়েছে এবং পুনরায় লক করা হয়েছে!", "success");
        }
      }
    }, 450);
  };

  const handleResetToDefaults = () => {
    if (window.confirm("Are you sure you want to restore the default database template? This erases Firestore history.")) {
      const defaultList = [TEMPLATE_REPORT];
      setReports(defaultList);
      setSelectedReportId(TEMPLATE_REPORT.id);
      if (currentUser) {
        setDoc(doc(db, "reports", TEMPLATE_REPORT.id), TEMPLATE_REPORT).catch(console.error);
      } else {
        safeStorage.setItem("aljabbar_reports_db", JSON.stringify(defaultList));
      }
      triggerAlert("System reset to initial Al-Jabbar original medicine template.", "info");
    }
  };

  const getFitBoxStyles = () => {
    const status = (currentReport.fitStatus || "").trim().toUpperCase();
    if (status === "FIT") {
      return {
        text: "FIT",
        colorClass: "text-emerald-700 font-extrabold",
        borderClass: "border-2 border-slate-900 bg-emerald-50/10",
      };
    } else if (status === "UNFIT") {
      return {
        text: "UNFIT",
        colorClass: "text-red-700 font-extrabold",
        borderClass: "border-2 border-dashed border-red-600 bg-red-50/5",
      };
    } else {
      return {
        text: status,
        colorClass: "text-amber-700 font-extrabold",
        borderClass: "border-2 double border-slate-800 bg-amber-50/10",
      };
    }
  };

  const fitStyle = getFitBoxStyles();

  // Synchronize dynamic trusted agent permissions
  const safeAgentName = (activeAgentName || "").trim();
  const isAgentTrusted = !!safeAgentName && !!(trustedAgents || {})[safeAgentName.toLowerCase()];

  // Security listener to block F12, inspect, copying, and Ctrl+P standard printing for Agent role
  useEffect(() => {
    if (!isAgentRole) return;

    const handleKeySecurity = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Block Ctrl+P (Print)
      if ((e.ctrlKey || e.metaKey) && k === "p") {
        e.preventDefault();
        e.stopPropagation();
        triggerAlert("নিরাপত্তা সতর্কবার্তা: সরাসরি প্রিন্ট করা নিষিদ্ধ। এপ্রুভ হওয়ার পর 'Download PDF' বাটন ক্লিক করুন।", "info");
      }
      // Block Ctrl+C (Copy)
      if ((e.ctrlKey || e.metaKey) && k === "c") {
        e.preventDefault();
        e.stopPropagation();
        triggerAlert("নিরাপত্তা সতর্কবার্তা: রিপোর্ট ও টেক্সট কপি করা নিষিদ্ধ করা হয়েছে।", "info");
      }
      // Block Ctrl+S (Save Page)
      if ((e.ctrlKey || e.metaKey) && k === "s") {
        e.preventDefault();
        e.stopPropagation();
      }
      // Block Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && k === "u") {
        e.preventDefault();
        e.stopPropagation();
      }
      // Block F12 & Ctrl+Shift+I / Ctrl+Shift+J (Inspect)
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "i" || k === "j"))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const blockContext = (e: MouseEvent) => {
      e.preventDefault();
      triggerAlert("নিরাপত্তা সতর্কবার্তা: রাইট-ক্লিক করা সম্পূর্ণ নিষেধ।", "info");
    };

    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeySecurity, true);
    window.addEventListener("contextmenu", blockContext, true);
    window.addEventListener("copy", blockCopy, true);

    return () => {
      window.removeEventListener("keydown", handleKeySecurity, true);
      window.removeEventListener("contextmenu", blockContext, true);
      window.removeEventListener("copy", blockCopy, true);
    };
  }, [isAgentRole]);

  // Synchronise body attributes for media print css selectors and screenshot blockers
  useEffect(() => {
    const roleVal = isAgentRole ? "true" : "false";
    document.body.setAttribute("data-agent-role", roleVal);
    
    const isApprovedVal = (currentReport?.approvalStatus === "Approved" || isAgentTrusted) ? "true" : "false";
    document.body.setAttribute("data-report-approved", isApprovedVal);
    
    // Cleanup on unmount
    return () => {
      document.body.removeAttribute("data-agent-role");
      document.body.removeAttribute("data-report-approved");
    };
  }, [isAgentRole, currentReport?.approvalStatus, isAgentTrusted]);

  // ==================== A. GLOBAL LOADING SKELETON ====================
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-sans tracking-tight">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-slate-750 border-t-emerald-400 rounded-full animate-spin" />
          <div className="space-y-1">
            <h3 className="text-white text-sm font-bold">সুরক্ষিত ডাটাবেজ কানেক্ট করা হচ্ছে...</h3>
            <p className="text-slate-400 text-xs">Al-Jabbar Healthcare Cloud Database Integration Engine</p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== B. RE-IDENTIFY OR GUEST LOGIN SCREEN ====================
  if (!currentUser || showEmailLoginScreen) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans antialiased text-slate-850">
        <div className="w-full max-w-md bg-white border border-gray-200 shadow-xl rounded-3xl overflow-hidden p-6 md:p-8 flex flex-col gap-5 text-center">
          
          <div className="flex flex-col items-center gap-3">
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner mb-1">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-none">
              Al-Jabbar Portal BD
            </h1>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider leading-none">
              মেডিকেল এক্সামিনেশন রিপোর্ট সিস্টেম
            </p>
          </div>

          <div className="text-xs text-indigo-850 bg-indigo-50/50 border border-indigo-100/60 p-3 rounded-2xl text-center font-bold flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>অনুমোদিত এডমিন এবং স্টাফদের জন্য নিরাপদ প্রবেশদ্বার</span>
          </div>

          {loginErrorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-650 rounded-xl p-3 text-left flex items-start gap-2.5 text-xs font-medium leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{loginErrorMessage}</span>
            </div>
          )}

          <form onSubmit={handlePhonePasswordLogin} className="space-y-3.5 text-left">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">মোবাইল নাম্বার অথবা জিমেইল (Number / Email)</label>
              <input
                type="text"
                required
                placeholder="যেমন: 017XXXXXXXX অথবা example@gmail.com"
                value={loginPhoneNumber}
                onChange={(e) => setLoginPhoneNumber(e.target.value)}
                className="w-full text-xs py-2.5 px-3.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">পাসওয়ার্ড (Password)</label>
              <input
                type="password"
                required
                placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full text-xs py-2.5 px-3.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 text-white font-extrabold text-xs rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 cursor-pointer shadow-md transition-all mt-4.5"
            >
              {isAuthenticating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "আইডি দিয়ে প্রবেশ করুন"
              )}
            </button>
          </form>

          {isUrlLockedAgent && (
            <>
              <div className="relative flex py-1.5 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-bold uppercase tracking-wider">অথবা (OR)</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <button
                type="button"
                onClick={handleAnonymousLogin}
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-5 text-indigo-700 font-extrabold text-xs rounded-xl bg-indigo-50 hover:bg-indigo-100/80 active:bg-indigo-100 cursor-pointer transition-all"
              >
                অতিথি/বেনামী এজেন্ট হিসেবে প্রবেশ করুন (Anonymous Guest)
              </button>
            </>
          )}

          {currentUser && (
            <button
              type="button"
              onClick={() => setShowEmailLoginScreen(false)}
              className="w-full py-2.5 px-5 text-gray-700 font-extrabold text-xs rounded-xl bg-gray-100 hover:bg-gray-200/80 active:bg-gray-200 cursor-pointer transition-all border border-gray-300/40"
            >
              ← পোর্টাল-এ ফিরে যান (Go Back to Portal)
            </button>
          )}

          <p className="text-[10px] text-gray-400 font-medium">
            Authorized Medical Staff Portal. Protected by Secure Firebase Auth Suite.
          </p>

        </div>
      </div>
    );
  }

  // ==================== C. FULL PORTAL CONTAINER (WHEN LOGGED IN) ====================
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      
      {/* ==================== 1. FLOATING BANNER ALERTS ==================== */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div
            initial={{ opacity: 0, y: -45, scale: 0.95 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4.5 py-3 rounded-xl shadow-lg bg-slate-900 text-white font-medium text-xs antialiased max-w-sm"
          >
            {alertMessage.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-sky-400 flex-shrink-0" />
            )}
            <span className="leading-snug">{alertMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 2. APP GLOBAL TOP NAVIGATION (no-print) ==================== */}
      <header className="no-print bg-white border-b border-gray-200 z-10 w-full sticky top-0 px-4 md:px-8 py-3.5 flex flex-row justify-between items-center select-none shadow-sm/5%">
        <div className="flex items-center gap-2.5">
          <div className="p-1 px-1.5 bg-blue-600 rounded-lg text-white font-extrabold text-sm tracking-tighter flex items-center gap-1 shadow-inner select-none uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            AMC
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-sm md:text-base leading-none tracking-tight">
              Al-Jabbar Report Portal
            </h1>
            <p className="text-[10px] md:text-[11px] text-gray-400 font-medium leading-none mt-1">
              Medical Examination Sheet Customizer & PDF Exporter
            </p>
          </div>
        </div>

        {/* User Card, Admin Permissions Status and Logout Row */}
        <div className="flex items-center gap-4">
          
          {/* Permission badges or Dynamic switch controls */}
          {!isAdmin || isUrlLockedAgent ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-[11px] rounded-xl shadow-xs select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
              <span>Restricted Agent Portal</span>
            </div>
          ) : (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-gray-200 gap-1 font-sans shadow-inner">
              <button
                onClick={() => {
                  setIsAgentRole(false);
                  setIsInlineEdit(false);
                  triggerAlert("Admin Dashboard Mode activated!", "info");
                }}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  !isAgentRole
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                🔑 Admin Panel
              </button>
              <button
                onClick={() => {
                  setIsAgentRole(true);
                  setIsInlineEdit(false);
                  triggerAlert("Agent Restricted Mode activated!", "info");
                }}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  isAgentRole
                    ? "bg-indigo-600 text-white shadow-sm font-extrabold"
                    : "text-gray-500 hover:text-gray-950"
                }`}
              >
                👥 Agent Panel
              </button>
            </div>
          )}

          {/* User profile & Google logout */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 p-1 pr-3 rounded-xl">
            {currentUser.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt="Avatar" 
                className="w-7 h-7 rounded-lg border border-slate-300" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                {currentUser.isAnonymous ? "G" : "U"}
              </div>
            )}
            <div className="hidden md:flex flex-col text-left">
              <span className="text-[10.5px] font-extrabold leading-none text-slate-800">
                {currentUser.isAnonymous ? "Guest Admin" : (currentUser.displayName || "Authorized User")}
              </span>
              <span className="text-[9.5px] font-bold text-slate-400 block mt-0.5 animate-pulse">
                {isAdmin ? "⭐ ADMIN ACCESS" : "👥 SYSTEM AGENT"}
              </span>
            </div>
            
            {currentUser.isAnonymous ? (
              <button
                onClick={() => setShowEmailLoginScreen(true)}
                title="অ্যাডমিন সাইন-ইন করুন (Admin Sign-In)"
                className="ml-2 p-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-extrabold text-[10px]"
              >
                <Lock className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>Sign In</span>
              </button>
            ) : (
              <button
                onClick={handleSignOut}
                title="সাইন-আউট করুন"
                className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick PDF button */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => setIsInlineEdit(!isInlineEdit)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isInlineEdit
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-gray-300"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isInlineEdit ? "Direct Sheet Edit: ON" : "Direct Sheet Edit: OFF"}
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className={`flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all ${
                isGeneratingPdf
                  ? "bg-slate-700 opacity-75 cursor-wait text-slate-300"
                  : "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
              }`}
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  Print/PDF
                </>
              )}
            </button>

            <button
              onClick={handleResetToDefaults}
              title="Reset system database to defaults"
              className="p-1 px-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* ==================== 3. MAIN WORKSPACE CONTAINER ==================== */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 p-4 md:p-6 select-none leading-none">
        
        {/* ==================== LEFT COLUMN: WORKSHOP SIDEBAR (no-print) ==================== */}
        <section className="no-print w-full lg:w-[380px] lg:sticky lg:top-[85px] flex-shrink-0 flex flex-col gap-4 max-h-[calc(100vh-100px)] overflow-y-auto pb-6 pr-1 scrollbar-thin">
          
          {/* Premium Firestore Database and Admin email manager */}
          {!isAgentRole && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3.5 font-sans text-left">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-tight">
                    🔥 ফায়ারবেস ক্লাউড ডাটাবেজ
                  </span>
                </div>
                <span className="text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse block" />
                  সক্রিয় সিঙ্ক (Active)
                </span>
              </div>

              {/* Sub-Admin Registration Form */}
              <form onSubmit={handleRegisterAdminSecurely} className="space-y-2 border-b border-slate-100 pb-3">
                <label className="block text-[11px] font-extrabold text-indigo-900 uppercase tracking-tight flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-650" />
                  নতুন অ্যাডমিন নিবন্ধন ফরম (Add Admin):
                </label>
                
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    placeholder="নাম (যেমন: ডাঃ রফিকুল ইসলাম)"
                    value={adminRegName}
                    onChange={(e) => setAdminRegName(e.target.value)}
                    className="w-full text-[11px] py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                  />
                  
                  <input
                    type="text"
                    required
                    placeholder="মোবাইল নাম্বার অথবা জিমেইল এড্রেস"
                    value={adminRegPhoneOrEmail}
                    onChange={(e) => setAdminRegPhoneOrEmail(e.target.value)}
                    className="w-full text-[11px] py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                  />

                  <input
                    type="password"
                    required
                    placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষরের)"
                    value={adminRegPassword}
                    onChange={(e) => setAdminRegPassword(e.target.value)}
                    className="w-full text-[11px] py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAdminRegistering}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  {isAdminRegistering ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      নতুন অ্যাডমিন নিবন্ধন করুন
                    </>
                  )}
                </button>
                <span className="text-[9px] text-gray-400 font-semibold block leading-tight">
                  * নতুন অ্যাডমিনদের তালিকা ও তথ্য ফায়ারবেস ক্লাউডে সরাসরি অথেন্টিকেট করা হবে।
                </span>
              </form>

              {/* Connected Administrators Sub list */}
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                <div className="w-full flex items-center justify-between p-2 px-3 text-[10.5px] font-extrabold text-slate-800 bg-slate-100/50">
                  <span>📖 বর্তমান অ্যাডমিনদের তালিকা:</span>
                  <span className="text-[9.5px] text-slate-500 font-bold">{adminsList.length} জন</span>
                </div>
                
                <div className="p-2.5 max-h-[140px] overflow-y-auto scrollbar-thin divide-y divide-slate-100">
                  {adminsList.map((email) => {
                    const isMaster = email === "apurbohasan948@gmail.com";
                    const isSelf = email === currentUser?.email?.toLowerCase();
                    return (
                      <div key={email} className="flex items-center justify-between py-1.5 text-xs text-slate-700">
                        <span className="font-semibold tracking-tight truncate max-w-[210px]">
                          {email} {isMaster && "⭐" } {isSelf && " (You)"}
                        </span>
                        {!isMaster && !isSelf && (
                          <button
                            onClick={() => handleRemoveAdmin(email)}
                            className="p-1 hover:text-red-500 rounded-md cursor-pointer transition-colors"
                            title="অ্যাডমিন পদ থেকে অপসারণ করুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isMaster && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-yellow-50 text-amber-600 border border-amber-200 rounded-lg">
                            Master
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>



            </div>
          )}

          <ReportEditorControl
            currentReport={currentReport}
            reportsList={reports}
            onSelectReport={handleSelectReport}
            onSaveReport={handleSaveReportExplicitly}
            onDeleteReport={handleDeleteReport}
            onAddNewReport={handleAddNewReport}
            onDuplicateReport={handleDuplicateReport}
            onUpdateReport={handleUpdateReport}
            onDownloadPDF={handleDownloadPDF}
            isInlineEditMode={isInlineEdit}
            onToggleInlineEditMode={() => setIsInlineEdit(!isInlineEdit)}
            isGeneratingPdf={isGeneratingPdf}
            globalHospitalLogo={globalHospitalLogo}
            globalHospitalSeal={globalHospitalSeal}
            globalCheckedSignature={globalCheckedSignature}
            globalDoctorSignature={globalDoctorSignature}
            onUpdateGlobalLogo={handleUpdateGlobalLogo}
            onUpdateGlobalSeal={handleUpdateGlobalSeal}
            onUpdateGlobalCheckedSignature={handleUpdateGlobalCheckedSignature}
            onUpdateGlobalDoctorSignature={handleUpdateGlobalDoctorSignature}
            onResetGlobalLogo={handleResetGlobalLogo}
            onResetGlobalSeal={handleResetGlobalSeal}
            onResetGlobalCheckedSignature={handleResetGlobalCheckedSignature}
            onResetGlobalDoctorSignature={handleResetGlobalDoctorSignature}
            isAgentRole={isAgentRole}
            onRequestApproval={handleRequestApproval}
            onApproveReport={handleApproveReport}
            onRejectReport={handleRejectReport}
            isUserAdmin={isAdmin}
            adminsList={adminsList}
            onAddAdmin={handleAddAdmin}
            onRemoveAdmin={handleRemoveAdmin}
            currentUser={currentUser}
            agentActivityLogs={agentActivityLogs}
            onDeleteLog={handleDeleteLogAdmin}
            trustedAgents={trustedAgents}
            onToggleTrustedAgent={handleToggleTrustedAgent}
            onAgentNameChange={handleAgentNameChange}
            onOpenPaymentModal={(reportId, purpose, agentName) => {
              setSelectedAgentNameForApproval(agentName || activeAgentName || "Agent");
              setShowPaymentGateModal({ reportId, purpose });
            }}
            downloadFee={downloadFee}
          />
        </section>

        {/* ==================== RIGHT COLUMN: PRINT ENGINE CANVAS ==================== */}
        <section className="flex-1 flex flex-col items-center justify-start overflow-visible min-w-0">
          
          {/* Quick Workspace Guide Banner (no-print) */}
          <div className="no-print w-full max-w-[210mm] mb-3 p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-2.5 shadow-sm/5%">
            <Info className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px] text-teal-800 leading-relaxed">
              <span className="font-bold text-teal-900 text-xs block">Export Instruction for Users:</span>
              <span>
                To download your report as a perfect PDF, click <strong>Print/PDF</strong>. In the print dialogue, choose <strong>Save as PDF</strong> as the Destination, select <strong>A4 Portrait</strong>, turn on <strong>Background graphics</strong>, and set margins to <strong>None</strong> for spectacular results.
              </span>
            </div>
          </div>

          {/* PHYSICAL A4 SIZE CONTAINER SHEET */}
          <div className="w-full overflow-x-auto p-1 py-4 flex justify-center bg-slate-200/50 border border-slate-300 rounded-2xl scrollbar-none shadow-inner">
            <div
              id="medical-report-sheet"
              className={`print-area w-[210mm] h-[297mm] bg-white text-gray-900 border border-gray-400 shadow-xl relative flex flex-col justify-between ${isAgentRole ? "select-none" : "select-text"}`}
              style={{
                boxSizing: "border-box",
                padding: "15mm 20mm 15mm 20mm", // standard physical margin padding
              }}
            >
              
              {/* Conditional Blurring Wrapper for Draft Reports for Agents (Removed as requested) */}
              <div
                className="w-full flex-1 flex flex-col justify-between transition-all duration-300"
              >
                {/* Report Inner Flex Container */}
                <div className="w-full flex-1 flex flex-col">
                
                {/* A. Header Medical Branding */}
                <ReportHeader
                  centerName={currentReport.signatures.doctorTitle3 || "AL-JABBAR MEDICAL CENTER"}
                  isEditable={isInlineEdit}
                  onUpdate={(updates) => {
                    handleUpdateReport({
                      ...currentReport,
                      signatures: {
                        ...currentReport.signatures,
                        doctorTitle3: updates.centerName || currentReport.signatures.doctorTitle3,
                      },
                    });
                  }}
                  logoUrl={globalHospitalLogo}
                  onLogoUpdate={handleUpdateGlobalLogo}
                  isAgentRole={isAgentRole}
                />

                {/* B. Patient Meta Rows & Photo Box */}
                <PatientMeta
                  patient={currentReport.patient}
                  isEditable={isInlineEdit}
                  onUpdate={(fields) => {
                    handleUpdateReport({
                      ...currentReport,
                      patient: { ...currentReport.patient, ...fields },
                    });
                  }}
                  destinationCountry={currentReport.patient.destinationCountry}
                  onUpdateCountry={(country) => {
                    handleUpdateReport({
                      ...currentReport,
                      patient: { ...currentReport.patient, destinationCountry: country },
                    });
                  }}
                  isAgentRole={isAgentRole}
                  hospitalSealUrl={globalHospitalSeal}
                />

                {/* C. Physical & Labs Dual Side-by-Side Tables Grid */}
                <div className="w-full flex flex-row gap-5 items-start mt-4">
                  {/* Left Column: Physical Exam */}
                  <PhysicalExamTable
                    data={currentReport.physical}
                    isEditable={isInlineEdit}
                    onUpdate={(fields) => {
                      handleUpdateReport({
                        ...currentReport,
                        physical: { ...currentReport.physical, ...fields },
                      });
                    }}
                  />

                  {/* Right Column: Lab investigations */}
                  <LabTable
                    data={currentReport.labs}
                    isEditable={isInlineEdit}
                    onUpdate={(fields) => {
                      handleUpdateReport({
                        ...currentReport,
                        labs: { ...currentReport.labs, ...fields },
                      });
                    }}
                  />
                </div>

                {/* D. Bottom Fit Status Block */}
                <div className="w-full flex flex-col items-center mt-5">
                  <span className="font-sans text-[12.5px] font-[500] text-gray-800 leading-tight">
                    This Person is Found Medically,
                  </span>
                  
                  {/* Double Interactive Centered Fit State Border Box */}
                  <div className={`mt-1.5 px-12 py-1 flex items-center justify-center min-w-[140px] ${fitStyle.borderClass}`}>
                    {isInlineEdit ? (
                      <input
                        type="text"
                        value={currentReport.fitStatus}
                        onChange={(e) => handleUpdateReport({ ...currentReport, fitStatus: e.target.value.toUpperCase() })}
                        className="text-center font-bold tracking-widest text-[16px] border-none bg-transparent w-full focus:outline-none uppercase text-green-700 text-[#1e40af]"
                        placeholder="FIT"
                      />
                    ) : (
                      <span className={`text-[16px] font-[950] tracking-widest leading-none ${fitStyle.colorClass}`}>
                        {fitStyle.text}
                      </span>
                    )}
                  </div>

                  <span className="mt-1.5 font-sans text-[11px] font-[500] text-gray-500 select-all leading-none">
                    For the above mentioned tests
                  </span>
                </div>

                {/* E. Verified Signatures & Seals segment */}
                <SealAndSignatures
                  config={currentReport.signatures}
                  isEditable={isInlineEdit}
                  onUpdate={(fields) => {
                    handleUpdateReport({
                      ...currentReport,
                      signatures: { ...currentReport.signatures, ...fields },
                    });
                  }}
                  checkedSignatureUrl={globalCheckedSignature}
                  doctorSignatureUrl={globalDoctorSignature}
                  hospitalSealUrl={globalHospitalSeal}
                  onUpdateCheckedSignature={handleUpdateGlobalCheckedSignature}
                  onUpdateDoctorSignature={handleUpdateGlobalDoctorSignature}
                  onUpdateHospitalSeal={handleUpdateGlobalSeal}
                  isAgentRole={isAgentRole}
                />

              </div>

              {/* F. Print-Only Flat Sticky Blue Banner at bottom of A4 */}
              <div className="w-full mt-4 bg-[#1352a2] text-white text-center py-1.5 select-all text-[11px] font-sans font-[600] tracking-wider rounded-sm shadow-sm flex items-center justify-center leading-none">
                WWW.ALJABBARMEDICAL.COM
              </div>
            </div>

            {/* Unblurred Display Message for Agents: Removed as requested */}

          </div>
          </div>

        </section>

      </main>

      {/* ==================== AUTOMATED MULTI-GATEWAY PAYMENT MODAL ==================== */}
      <AnimatePresence>
        {showPaymentGateModal && (() => {
          const reportToPay = reports.find(r => r.id === showPaymentGateModal.reportId) || currentReport;
          const activeNumber = selectedPayGateway === "bkash" 
            ? bKashNumber 
            : nagadNumber;

          const gatewayColor = selectedPayGateway === "bkash" 
            ? "border-pink-500 text-pink-600 bg-pink-50/50" 
            : "border-orange-500 text-orange-600 bg-orange-50/50";

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] bg-slate-900/70 backdrop-blur-[4px] flex items-center justify-center p-4 font-sans antialiased text-slate-850"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-md bg-white border border-gray-100 shadow-2xl rounded-3xl overflow-hidden flex flex-col relative"
              >
                {/* Brand Color Indicator Bar */}
                <div className={`h-2 transition-colors duration-300 ${
                  selectedPayGateway === "bkash" 
                    ? "bg-[#e2125d]" 
                    : "bg-[#f05a24]"
                }`} />

                {/* Cancel Header Button */}
                <button
                  onClick={() => {
                    if (!verifyingTrx) {
                      setShowPaymentGateModal(null);
                      setPayError(null);
                    }
                  }}
                  className="absolute top-4 right-4 w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
                  disabled={verifyingTrx}
                >
                  ✕
                </button>

                <div className="p-6 md:p-8 flex flex-col gap-4 text-center">
                  <div className="mx-auto bg-blue-50 text-blue-700 w-12 h-12 rounded-2xl flex items-center justify-center animate-bounce">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[15px] text-gray-900">বিকাশ ও নগদ অটো এপ্রুভাল গেটওয়ে</h3>
                    <p className="text-[11px] text-gray-500 font-medium mt-1">
                      Al-Jabbar Instantly-Automated Payment Gateway
                    </p>
                  </div>

                  {/* Micro Report Identifier Badge */}
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-left text-[11px] font-medium text-gray-700 space-y-1">
                    <span className="text-[9.5px] font-bold text-slate-400 block uppercase">SELECTED PATIENT REPORT:</span>
                    <div className="flex items-center justify-between font-extrabold">
                      <span className="text-slate-900">{reportToPay.patient.fullName}</span>
                      <span className="text-gray-500">Reg: {reportToPay.patient.regNo}</span>
                    </div>
                  </div>

                  {/* Pay Gateway Selector Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPayGateway("bkash")}
                      className={`py-2 px-1 text-xs font-black rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        selectedPayGateway === "bkash"
                          ? "border-[#e2125d] text-[#e2125d] bg-pink-50/50 ring-2 ring-pink-500/10 scale-105"
                          : "border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 bg-white"
                      }`}
                      disabled={verifyingTrx}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#e2125d] block" />
                      <span>bKash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPayGateway("nagad")}
                      className={`py-2 px-1 text-xs font-black rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        selectedPayGateway === "nagad"
                          ? "border-[#f05a24] text-[#f05a24] bg-orange-50/50 ring-2 ring-orange-500/10 scale-105"
                          : "border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 bg-white"
                      }`}
                      disabled={verifyingTrx}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f05a24] block" />
                      <span>Nagad</span>
                    </button>
                  </div>

                  {!verifyingTrx ? (
                    <form onSubmit={handleVerifyPaymentSubmit} className="space-y-4 text-left">
                      {/* Gateway Instruction Card */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl relative space-y-2.5">
                        <span className="text-[10.5px] text-gray-600 font-extrabold block leading-normal">
                          অনুগ্রহ করে নিচের নাম্বারে <span className="text-red-600 font-black text-xs underline">{downloadFee} টাকা</span> সেন্ডমানি (Send Money) করুন:
                        </span>
                        
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-lg text-slate-900 select-all tracking-wide">
                            {activeNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(activeNumber);
                              triggerAlert("পেমেন্ট নাম্বার কপি করা হয়েছে!", "success");
                            }}
                            className="text-[10px] font-bold px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg shrink-0 cursor-pointer transition-all border border-blue-200/50"
                          >
                            নম্বর কপি করুন
                          </button>
                        </div>

                        {/* HIGHLY VISIBLE CRITICAL WARNING TEXT FOR USER INTENT */}
                        <div className="p-2 border border-red-200 bg-red-50 rounded-xl text-[9.5px] leading-relaxed text-red-700 font-bold">
                          ⚠️ অবশ্যই <span className="underline">সেন্ড মানি</span> করুন। ক্যাশআউট বা মোবাইল রিচার্জ করলে অ্যাডমিন দায়বদ্ধ থাকবে না এবং এপ্রুভাল অটো-রিজেক্ট হবে!
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-200/60 pt-2 font-medium">
                          <span>গেটওয়ে প্রকার: পার্সোনাল</span>
                          <span className="font-bold text-indigo-600">পেমেন্ট ফি: {downloadFee} BDT</span>
                        </div>
                      </div>

                      {/* Transaction ID & Sender details inside grid */}
                      <div className="space-y-3 bg-slate-50/50 p-3.5 border border-slate-100 rounded-2xl">
                        <span className="text-[10px] text-indigo-750 font-black block uppercase tracking-wide">
                          📝 আপনার পাঠানো পেমেন্ট তথ্য পূরণ করুন:
                        </span>

                        {/* Input 1: Transaction ID */}
                        <div className="space-y-1">
                          <label className="text-[10.5px] font-bold text-gray-700 block">
                            ১. ট্রানজেকশন আইডি (TrxID) লিখুন:
                          </label>
                          <input
                            type="text"
                            required
                            value={paymentTrxId}
                            onChange={(e) => setPaymentTrxId(e.target.value)}
                            placeholder="যেমন: K8B9X2Z4L0"
                            className="w-full font-mono font-bold text-center tracking-wider text-xs py-2 bg-white border border-gray-350 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Input 2: Last Digits */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-700 block leading-tight">
                              ২. নম্বরের শেষ ৩/৪ ডিজিট:
                            </label>
                            <input
                              type="text"
                              required
                              value={paymentPhoneLast}
                              onChange={(e) => setPaymentPhoneLast(e.target.value.replace(/[^0-9]/g, ""))}
                              placeholder="যেমন: 344"
                              className="w-full font-mono font-bold text-center text-xs py-2 bg-white border border-gray-350 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                          </div>

                          {/* Input 3: Amount Sent */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-700 block leading-tight">
                              ৩. সেন্ডমানি পরিমাণ (Tk):
                            </label>
                            <input
                              type="number"
                              required
                              value={paymentAmountSent}
                              onChange={(e) => setPaymentAmountSent(e.target.value)}
                              placeholder="যেমন: 25"
                              className="w-full font-mono font-bold text-center text-xs py-2 bg-white border border-gray-350 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {payError && (
                        <div className="p-3 bg-red-50 text-red-700 text-[10.5px] leading-relaxed border border-red-200 rounded-xl font-bold flex gap-2 items-start justify-center">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span>{payError}</span>
                        </div>
                      )}

                      {/* Submit Trigger */}
                      <button
                        type="submit"
                        className="w-full py-3 px-5 text-white font-black text-xs rounded-xl bg-blue-600 hover:bg-blue-700/90 hover:shadow-lg active:scale-[0.99] cursor-pointer transition-all border border-blue-700 shadow flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4 shrink-0" />
                        <span>ভেরিফাই ও অটো-এপ্রুভ করুন (Verify & Approve)</span>
                      </button>

                      {/* Smart Hint Info line */}
                      <p className="text-[9.5px] text-gray-400 font-semibold text-center leading-normal">
                        {strictVerification 
                          ? "🔒 Strict Match Active: Matches details against real-time incoming SMS logs in Shahin Sir's database."
                          : "🚀 Review Sync Mode: Transmits payment records securely for admin verification on mismatch."}
                      </p>
                    </form>
                  ) : (
                    /* Scanning AI animation screen */
                    <div className="py-8 flex flex-col items-center justify-center gap-5">
                      <div className="relative w-16 h-16">
                        <span className="absolute inset-0 w-full h-full rounded-full border-4 border-blue-100" />
                        <span className="absolute inset-0 w-full h-full rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                        <div className="absolute inset-2 bg-blue-50 rounded-full flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs font-black text-blue-700 block animate-pulse">
                          ক্রিপ্টোগ্রাফিক পেমেন্ট ম্যাচিং বিশ্লেষণ করা হচ্ছে...
                        </span>
                        <p className="text-[10px] text-gray-500 leading-normal max-w-xs font-semibold uppercase tracking-wider animate-pulse">
                          Al-Jabbar System AI is authenticating Personal Gateway SMS log index matching...
                        </p>
                      </div>

                      {/* Small visual logs ticker to mock processing for credibility */}
                      <div className="w-full bg-slate-900 text-[9px] text-green-400 font-mono p-3 rounded-xl border border-slate-800 text-left h-24 overflow-y-auto space-y-1 select-none shadow-inner leading-relaxed">
                        <div className="opacity-90 animate-pulse">[0.1s] SECURE AI LINK ESTABLISHED...</div>
                        <div className="opacity-80 delay-100">[0.4s] FETCHING FIRESTORE RECEIVED_PAYMENTS FOR KEY "{paymentTrxId.toUpperCase()}"...</div>
                        <div className="opacity-70 delay-300">[0.9s] PATTERN ANALYZER DETECTED VALID SMS METADATA...</div>
                        <div className="opacity-55 delay-500">[1.3s] EVALUATING REGEX SIGNALS... STATUS: PENDING APPROVAL</div>
                        <div className="opacity-40 delay-700">[1.7s] VERIFYING NON-DUPLICATE PAYLOAD... SUCCESS ✔</div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ==================== PDF GENERATING STATE OVERLAY WITH PROGRESS BAR ==================== */}
      <AnimatePresence>
        {isGeneratingPdf && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="no-print fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-white border border-slate-150 rounded-3xl p-7 shadow-2xl w-full max-w-sm text-center relative overflow-hidden"
            >
              {/* Subtle accent beam at top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

              {/* Animated Icon Container */}
              <div className="w-14 h-14 bg-blue-50 border border-blue-100/60 rounded-2xl flex items-center justify-center mx-auto mb-4.5 relative">
                {pdfProgress < 100 ? (
                  <>
                    <span className="absolute inset-0 rounded-2xl border-2 border-blue-200/35" />
                    <span className="absolute inset-0 rounded-2xl border-2 border-blue-600 border-t-transparent animate-spin" />
                    <FileDown className="w-6 h-6 text-blue-600 animate-pulse" />
                  </>
                ) : (
                  <motion.div
                    initial={{ scale: 0.6 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-md shadow-emerald-500/20"
                  >
                    <Check className="w-5 h-5 text-white" />
                  </motion.div>
                )}
              </div>

              {/* Heading */}
              <h2 className="text-slate-950 font-extrabold text-base leading-tight tracking-tight uppercase">
                {pdfProgress < 100 ? "Generating Report Document" : "Export Completed"}
              </h2>
              <p className="text-[10.5px] text-slate-400 font-medium tracking-wider uppercase mt-1 mb-6">
                HIGH-FIDELITY PDF RENDERING ENGINE
              </p>

              {/* Counter Display */}
              <div className="flex items-baseline justify-center gap-1.5 mb-2.5">
                <span className="text-4xl font-extrabold text-slate-800 tracking-tighter leading-none">
                  {pdfProgress}
                </span>
                <span className="text-sm font-bold text-slate-400 select-none">%</span>
              </div>

              {/* Smooth Progress Bar */}
              <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40 p-[1.5px] mb-4.5 shadow-inner">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-md shadow-blue-500/20"
                  initial={{ width: "0%" }}
                  animate={{ width: `${pdfProgress}%` }}
                  transition={{ ease: "easeInOut", duration: 0.25 }}
                />
              </div>

              {/* State Status message text */}
              <p className="text-xs text-slate-700 font-semibold tracking-wide h-8 leading-normal max-w-[280px] mx-auto">
                {pdfStateMsg}
              </p>

              {/* Helpful footer tips inside overlay */}
              <div className="mt-5 pt-4.5 border-t border-slate-100/80 flex items-center justify-center gap-1.5 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Render Engine Version 3.4 Active</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
