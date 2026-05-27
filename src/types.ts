export interface PatientDetails {
  regNo: string;
  examDate: string;
  fullName: string;
  fatherName: string;
  motherName: string;
  passportNo: string;
  dob: string;
  sex: string;
  agency: string;
  photoUrl: string;
  destinationCountry: string; // e.g., "U.A.E"
  showSealOnPhoto?: boolean;
}

export interface PhysicalExamination {
  height: string;
  weight: string;
  pulse: string;
  bloodPressure: string;
  heart: string;
  liver: string;
  spleen: string;
  eyeLeft: string;
  eyeRight: string;
  ent: string;
  skin: string;
  physicalCondition: string;
  ecg: string;
  chestP_A_View: string;
}

export interface Serology {
  hbsag: string;
  vdrl: string;
  tpha: string;
  bloodGroup: string;
}

export interface Biochemical {
  sBilirubin: string;
  sugarRandom: string;
}

export interface Hematology {
  hemoglobin: string;
}

export interface Urine {
  pregnancyTest: string;
}

export interface LabInvestigations {
  serology: Serology;
  biochemical: Biochemical;
  hematology: Hematology;
  urine: Urine;
}

export interface SignatureConfig {
  checkedByName: string;
  checkedByTitle1: string;
  checkedByTitle2: string;
  doctorName: string;
  doctorTitle1: string;
  doctorTitle2: string;
  doctorTitle3: string;
  showCheckedSignature: boolean;
  showDoctorSignature: boolean;
  showCenterStamp: boolean;
}

export interface MedicalReport {
  id: string;
  title: string;          // Internal label or patient name for the dashboard
  createdAt: string;
  patient: PatientDetails;
  physical: PhysicalExamination;
  labs: LabInvestigations;
  fitStatus: "FIT" | "UNFIT" | "RE-EXAMINE" | string;
  remarks: string;
  signatures: SignatureConfig;
  approvalStatus?: "Draft" | "Pending Approval" | "Approved";
  requestedBy?: string;
  requestedAt?: string;
  createdBy?: string;
  paymentTrxId?: string;
  paymentPhoneLast?: string;
  paymentAmount?: number;
  paymentGateway?: string;
  paymentVerifiedAt?: string;
}

export interface DownloadLog {
  id: string;
  agentName: string;
  patientName: string;
  passportNo: string;
  regNo: string;
  reportId: string;
  downloadedAt: string;
  actionType: "Download PDF" | "Approval Request" | string;
  timestamp: string;
  createdAt: number;
}

