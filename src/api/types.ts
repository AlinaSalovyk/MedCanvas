/**
 * MedCanvas Typed API Contracts
 * Maps directly to backend ASP.NET Core DTOs and RFC 7807 ProblemDetails.
 */

export interface AuthTokenResponse {
  token: string;
  expiresAtUtc: string;
  userId: string;
  fullName: string;
  email: string;
  clinicId: string;
  clinicName: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  clinicId: string;
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  fullName: string;
  clinicId: string;
  role: string;
}

export interface PatientDto {
  id: string;
  clinicId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  externalMedicalRecordNumber?: string | null;
  medicalAlerts?: string | null;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}

export interface CreatePatientRequest {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  externalMedicalRecordNumber?: string | null;
  medicalAlerts?: string | null;
}

export interface UpdatePatientRequest {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  externalMedicalRecordNumber?: string | null;
  medicalAlerts?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface DentalEncounterDto {
  id: string;
  clinicId: string;
  patientId: string;
  attendingUserId: string;
  startedAtUtc: string;
  completedAtUtc?: string | null;
  chiefComplaint?: string | null;
  status: "InProgress" | "Completed" | "Cancelled";
}

export interface StartEncounterRequest {
  patientId: string;
  chiefComplaint?: string | null;
}

export interface CompleteEncounterRequest {
  clinicalSummary?: string | null;
}

export interface CancelEncounterRequest {
  reason?: string | null;
}

export interface OdontogramResponseDto {
  id: string;
  clinicId: string;
  patientId: string;
  encounterId: string;
  payloadVersion: string;
  snapshotJson: string;
  isFinalized: boolean;
  finalizedAtUtc?: string | null;
  finalizedByUserId?: string | null;
  concurrencyVersion: number;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}

export interface SaveOdontogramRequest {
  snapshotJson: string;
  expectedVersion?: number | null;
  changeSummary?: string | null;
}

export interface OdontogramRevisionDto {
  id: string;
  recordId: string;
  revisionNumber: number;
  snapshotJson: string;
  changeSummary?: string | null;
  authorUserId: string;
  createdAtUtc: string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}
