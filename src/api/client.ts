import type {
  ClinicDashboardDto,
  InvoiceDto,
  PerformedProcedureDto,
  CatalogItemDto,
  CreateCatalogItemRequest,
  UpdateCatalogItemRequest,
  TreatmentPlanDto,
  AddPlanItemRequest,
  AppointmentDto,
  ChairDto,
  AvailabilityTemplateDto,
  CalendarWindowOptions,
  CreateAppointmentRequest,
  PatientListOptions,
  PatientDuplicateHint,
  ClinicMemberDto,
  ClinicMembershipSummary,
  ClinicSettingsDto,
  LoginRequest,
  LoginResult,
  OnboardClinicRequest,
  AddClinicMemberRequest,
  UpdateClinicSettingsRequest,
  CurrentUserResponse,
  PatientDto,
  CreatePatientRequest,
  UpdatePatientRequest,
  PagedResult,
  DentalEncounterDto,
  StartEncounterRequest,
  CompleteEncounterRequest,
  CancelEncounterRequest,
  OdontogramResponseDto,
  SaveOdontogramRequest,
  OdontogramRevisionDto,
  ProblemDetails,
} from "./types";

export class ApiError extends Error {
  public readonly status: number;
  public readonly problem?: ProblemDetails;

  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

export class ConcurrencyConflictError extends ApiError {
  constructor(message: string, problem?: ProblemDetails) {
    super(412, message, problem);
    this.name = "ConcurrencyConflictError";
  }
}

export interface ClientConfig {
  baseUrl?: string;
  token?: string | null;
  onUnauthorized?: () => void;
}

export class MedCanvasApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private onUnauthorized?: () => void;

  constructor(config?: ClientConfig) {
    this.baseUrl = (config?.baseUrl || "/api/v1").replace(/\/+$/, "");
    this.token = config?.token || null;
    this.onUnauthorized = config?.onUnauthorized;
  }

  public setToken(token: string | null): void {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    customHeaders?: Record<string, string>
  ): Promise<{ data: T; etag?: string | null }> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...customHeaders,
    };

    const requestToken = this.token;
    if (requestToken) {
      headers["Authorization"] = `Bearer ${requestToken}`;
    }

    if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    });

    if (response.status === 401) {
      // A late response from the previous clinic/session must not log out the
      // current one. Expiration also discards the expired credential immediately.
      if (this.token === requestToken) {
        this.token = null;
        this.onUnauthorized?.();
      }
      throw new ApiError(401, "Unauthorized: Authentication required or token expired.");
    }

    const etag = response.headers.get("ETag");

    if (!response.ok) {
      let problem: ProblemDetails | undefined;
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;

      try {
        problem = await response.json();
        if (problem?.detail) {
          errorMessage = problem.detail;
        } else if (problem?.title) {
          errorMessage = problem.title;
        }
      } catch {
        // Body was not JSON
      }

      if (response.status === 412) {
        throw new ConcurrencyConflictError(
          errorMessage || "Precondition failed: odontogram state modified by another session.",
          problem
        );
      }

      throw new ApiError(response.status, errorMessage, problem);
    }

    if (response.status === 204) {
      return { data: undefined as unknown as T, etag };
    }

    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json") || contentType.includes("application/fhir+json")) {
      const data = await response.json();
      return { data, etag };
    }

    const text = await response.text();
    return { data: text as unknown as T, etag };
  }

  // --- Auth Endpoints ---

  public async login(req: LoginRequest): Promise<LoginResult> {
    const res = await this.request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify(req),
    });
    if (res.data.token) {
      this.setToken(res.data.token);
    }
    return res.data;
  }

  public async getCurrentUser(): Promise<CurrentUserResponse> {
    const res = await this.request<CurrentUserResponse>("/auth/me", {
      method: "GET",
    });
    return res.data;
  }

  public logout(): void {
    this.setToken(null);
  }

  public async getMyClinics(): Promise<ClinicMembershipSummary[]> {
    const res = await this.request<ClinicMembershipSummary[]>("/auth/clinics", { method: "GET" });
    return res.data;
  }

  public async switchClinic(clinicId: string): Promise<LoginResult> {
    const res = await this.request<LoginResult>("/auth/switch-clinic", {
      method: "POST",
      body: JSON.stringify({ clinicId }),
    });
    if (res.data.token) {
      this.setToken(res.data.token);
    }
    return res.data;
  }

  // --- Clinic Endpoints ---

  public async onboardClinic(req: OnboardClinicRequest): Promise<LoginResult> {
    const res = await this.request<LoginResult>("/clinics/onboarding", {
      method: "POST",
      body: JSON.stringify(req),
    });
    if (res.data.token) {
      this.setToken(res.data.token);
    }
    return res.data;
  }

  public async getClinicMembers(): Promise<ClinicMemberDto[]> {
    const res = await this.request<ClinicMemberDto[]>("/clinics/members", { method: "GET" });
    return res.data;
  }

  public async addClinicMember(req: AddClinicMemberRequest): Promise<ClinicMemberDto> {
    const res = await this.request<ClinicMemberDto>("/clinics/members", {
      method: "POST",
      body: JSON.stringify(req),
    });
    return res.data;
  }

  public async changeMemberRole(userId: string, role: string): Promise<ClinicMemberDto> {
    const res = await this.request<ClinicMemberDto>(`/clinics/members/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
    return res.data;
  }

  public async revokeClinicMember(userId: string): Promise<void> {
    await this.request<void>(`/clinics/members/${userId}`, { method: "DELETE" });
  }

  public async activateClinicMember(userId: string): Promise<void> {
    await this.request<void>(`/clinics/members/${userId}/activate`, { method: "POST" });
  }

  public async getClinicSettings(): Promise<ClinicSettingsDto> {
    const res = await this.request<ClinicSettingsDto>("/clinics/settings", { method: "GET" });
    return res.data;
  }

  public async updateClinicSettings(req: UpdateClinicSettingsRequest): Promise<ClinicSettingsDto> {
    const res = await this.request<ClinicSettingsDto>("/clinics/settings", {
      method: "PUT",
      body: JSON.stringify(req),
    });
    return res.data;
  }

  // --- Patient Endpoints ---

  public async getPatients(options: PatientListOptions = {}): Promise<PagedResult<PatientDto>> {
    const query = new URLSearchParams({
      pageNumber: (options.pageNumber ?? 1).toString(),
      pageSize: (options.pageSize ?? 20).toString(),
    });
    if (options.searchTerm) {
      query.set("searchTerm", options.searchTerm);
    }
    if (options.sortBy) {
      query.set("sortBy", options.sortBy);
    }
    if (options.sortDescending) {
      query.set("sortDescending", "true");
    }
    if (options.includeArchived) {
      query.set("includeArchived", "true");
    }
    const res = await this.request<PagedResult<PatientDto>>(`/patients?${query.toString()}`);
    return res.data;
  }

  public async getPatientDuplicates(hint: PatientDuplicateHint): Promise<PatientDto[]> {
    const query = new URLSearchParams();
    if (hint.firstName) query.set("firstName", hint.firstName);
    if (hint.lastName) query.set("lastName", hint.lastName);
    if (hint.dateOfBirth) query.set("dateOfBirth", hint.dateOfBirth);
    if (hint.externalMedicalRecordNumber) query.set("externalMedicalRecordNumber", hint.externalMedicalRecordNumber);
    const res = await this.request<PatientDto[]>(`/patients/duplicates?${query.toString()}`);
    return res.data;
  }

  public async getPatient(id: string): Promise<PatientDto> {
    const res = await this.request<PatientDto>(`/patients/${id}`);
    return res.data;
  }

  public async createPatient(req: CreatePatientRequest): Promise<PatientDto> {
    const res = await this.request<PatientDto>("/patients", {
      method: "POST",
      body: JSON.stringify(req),
    });
    return res.data;
  }

  public async updatePatient(
    id: string,
    req: UpdatePatientRequest,
    expectedVersion: number,
    etag?: string | null
  ): Promise<PatientDto> {
    const res = await this.request<PatientDto>(
      `/patients/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({ ...req, expectedVersion }),
      },
      { "If-Match": etag ?? `"${expectedVersion}"` }
    );
    return res.data;
  }

  public async archivePatient(id: string): Promise<PatientDto> {
    const res = await this.request<PatientDto>(`/patients/${id}/archive`, { method: "POST" });
    return res.data;
  }

  public async restorePatient(id: string): Promise<PatientDto> {
    const res = await this.request<PatientDto>(`/patients/${id}/restore`, { method: "POST" });
    return res.data;
  }


  // --- Scheduling Endpoints (M03) ---

  public async getAppointments(options: CalendarWindowOptions): Promise<AppointmentDto[]> {
    const query = new URLSearchParams({
      fromUtc: options.fromUtc,
      toUtc: options.toUtc,
    });
    if (options.clinicianId) query.set("clinicianId", options.clinicianId);
    if (options.chairId) query.set("chairId", options.chairId);
    if (options.status) query.set("status", options.status);
    const res = await this.request<AppointmentDto[]>(`/appointments?${query.toString()}`);
    return res.data;
  }

  public async createAppointment(req: CreateAppointmentRequest): Promise<AppointmentDto> {
    const res = await this.request<AppointmentDto>("/appointments", {
      method: "POST",
      body: JSON.stringify(req),
    });
    return res.data;
  }

  public async appointmentAction(id: string, action: "confirm" | "arrive" | "complete" | "no-show"): Promise<AppointmentDto> {
    const res = await this.request<AppointmentDto>(`/appointments/${id}/${action}`, { method: "POST" });
    return res.data;
  }

  public async cancelAppointment(id: string, reason: string): Promise<AppointmentDto> {
    const res = await this.request<AppointmentDto>(`/appointments/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    return res.data;
  }

  public async rescheduleAppointment(
    id: string,
    newStartAtUtc: string,
    newEndAtUtc: string,
    expectedVersion: number,
    etag?: string | null,
    newChairId?: string
  ): Promise<AppointmentDto> {
    const res = await this.request<AppointmentDto>(
      `/appointments/${id}/reschedule`,
      {
        method: "POST",
        body: JSON.stringify({ newStartAtUtc, newEndAtUtc, newChairId, expectedVersion }),
      },
      { "If-Match": etag ?? `"${expectedVersion}"` }
    );
    return res.data;
  }

  public async getChairs(): Promise<ChairDto[]> {
    const res = await this.request<ChairDto[]>("/chairs");
    return res.data;
  }

  public async createChair(name: string): Promise<ChairDto> {
    const res = await this.request<ChairDto>("/chairs", { method: "POST", body: JSON.stringify({ name }) });
    return res.data;
  }

  public async renameChair(id: string, name: string): Promise<ChairDto> {
    const res = await this.request<ChairDto>(`/chairs/${id}/name`, { method: "PUT", body: JSON.stringify({ name }) });
    return res.data;
  }

  public async setChairActive(id: string, active: boolean): Promise<ChairDto> {
    const res = await this.request<ChairDto>(`/chairs/${id}/${active ? "activate" : "deactivate"}`, { method: "POST" });
    return res.data;
  }

  public async getAvailability(clinicianUserId: string): Promise<AvailabilityTemplateDto> {
    const res = await this.request<AvailabilityTemplateDto>(`/availability/${clinicianUserId}`);
    return res.data;
  }

  public async replaceAvailability(
    clinicianUserId: string,
    windows: Array<{ dayOfWeek: number; startTime: string; endTime: string; breaks: Array<{ startTime: string; endTime: string }> }>
  ): Promise<AvailabilityTemplateDto> {
    const res = await this.request<AvailabilityTemplateDto>(`/availability/${clinicianUserId}`, {
      method: "PUT",
      body: JSON.stringify({ windows }),
    });
    return res.data;
  }

  public async addAvailabilityException(clinicianUserId: string, date: string, isWorkingDay: boolean): Promise<AvailabilityTemplateDto> {
    const res = await this.request<AvailabilityTemplateDto>(`/availability/${clinicianUserId}/exceptions`, {
      method: "POST",
      body: JSON.stringify({ date, isWorkingDay }),
    });
    return res.data;
  }

  public async removeAvailabilityException(exceptionId: string): Promise<void> {
    await this.request<void>(`/availability/exceptions/${exceptionId}`, { method: "DELETE" });
  }


  // --- Treatment Planning Endpoints (M05) ---

  public async getCatalogItems(): Promise<CatalogItemDto[]> {
    const res = await this.request<CatalogItemDto[]>("/catalog");
    return res.data;
  }

  public async createCatalogItem(req: CreateCatalogItemRequest): Promise<CatalogItemDto> {
    const res = await this.request<CatalogItemDto>("/catalog", { method: "POST", body: JSON.stringify(req) });
    return res.data;
  }

  public async updateCatalogItem(id: string, req: UpdateCatalogItemRequest): Promise<CatalogItemDto> {
    const res = await this.request<CatalogItemDto>(`/catalog/${id}`, { method: "PUT", body: JSON.stringify({ ...req, itemId: id }) });
    return res.data;
  }

  public async setCatalogItemActive(id: string, active: boolean): Promise<CatalogItemDto> {
    const res = await this.request<CatalogItemDto>(`/catalog/${id}/${active ? "activate" : "deactivate"}`, { method: "POST" });
    return res.data;
  }

  public async getTreatmentPlan(planId: string): Promise<TreatmentPlanDto> {
    const res = await this.request<TreatmentPlanDto>(`/treatment-plans/${planId}`);
    return res.data;
  }

  public async getPatientTreatmentPlans(patientId: string): Promise<TreatmentPlanDto[]> {
    const res = await this.request<TreatmentPlanDto[]>(`/treatment-plans/by-patient/${patientId}`);
    return res.data;
  }

  public async createTreatmentPlan(patientId: string, sourceEncounterId: string): Promise<TreatmentPlanDto> {
    const res = await this.request<TreatmentPlanDto>("/treatment-plans", {
      method: "POST",
      body: JSON.stringify({ patientId, sourceEncounterId }),
    });
    return res.data;
  }

  public async addPlanItem(planId: string, req: AddPlanItemRequest): Promise<TreatmentPlanDto> {
    const res = await this.request<TreatmentPlanDto>(`/treatment-plans/${planId}/items`, {
      method: "POST",
      body: JSON.stringify(req),
    });
    return res.data;
  }

  public async removePlanItem(planId: string, itemId: string): Promise<TreatmentPlanDto> {
    const res = await this.request<TreatmentPlanDto>(`/treatment-plans/${planId}/items/${itemId}`, { method: "DELETE" });
    return res.data;
  }

  public async submitTreatmentPlan(planId: string): Promise<TreatmentPlanDto> {
    const res = await this.request<TreatmentPlanDto>(`/treatment-plans/${planId}/submit`, { method: "POST" });
    return res.data;
  }

  public async approveTreatmentPlan(planId: string): Promise<TreatmentPlanDto> {
    const res = await this.request<TreatmentPlanDto>(`/treatment-plans/${planId}/approve`, { method: "POST" });
    return res.data;
  }

  public async cancelTreatmentPlan(planId: string): Promise<TreatmentPlanDto> {
    const res = await this.request<TreatmentPlanDto>(`/treatment-plans/${planId}/cancel`, { method: "POST" });
    return res.data;
  }


  // --- Treatment Execution Endpoints (M06) ---

  public async getEncounterPerformedProcedures(encounterId: string): Promise<PerformedProcedureDto[]> {
    const res = await this.request<PerformedProcedureDto[]>(`/encounters/${encounterId}/performed-procedures`);
    return res.data;
  }

  public async getPatientPerformedProcedures(patientId: string): Promise<PerformedProcedureDto[]> {
    const res = await this.request<PerformedProcedureDto[]>(`/patients/${patientId}/performed-procedures`);
    return res.data;
  }

  public async recordPerformedProcedure(
    encounterId: string,
    req: { catalogItemId: string; idempotencyKey: string; toothFdi?: string | null; quantity: number; clinicalNote?: string | null; treatmentPlanItemId?: string | null }
  ): Promise<PerformedProcedureDto> {
    const res = await this.request<PerformedProcedureDto>(`/encounters/${encounterId}/performed-procedures`, {
      method: "POST",
      body: JSON.stringify(req),
    });
    return res.data;
  }

  public async voidPerformedProcedure(id: string, reason: string): Promise<PerformedProcedureDto> {
    const res = await this.request<PerformedProcedureDto>(`/performed-procedures/${id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    return res.data;
  }


  // --- Demo Billing Endpoints (M07) ---

  public async getInvoice(invoiceId: string): Promise<InvoiceDto> {
    const res = await this.request<InvoiceDto>(`/invoices/${invoiceId}`);
    return res.data;
  }

  public async getPatientInvoices(patientId: string): Promise<InvoiceDto[]> {
    const res = await this.request<InvoiceDto[]>(`/invoices/by-patient/${patientId}`);
    return res.data;
  }

  public async createInvoiceFromEncounter(encounterId: string): Promise<InvoiceDto> {
    const res = await this.request<InvoiceDto>(`/invoices/from-encounter/${encounterId}`, { method: "POST", body: "{}" });
    return res.data;
  }

  public async registerSimulatedPayment(invoiceId: string, amount: number, idempotencyKey: string, methodLabel = "Каса (демо)"): Promise<InvoiceDto> {
    const res = await this.request<InvoiceDto>(`/invoices/${invoiceId}/simulated-payments`, {
      method: "POST",
      body: JSON.stringify({ amount, methodLabel, idempotencyKey }),
    });
    return res.data;
  }

  public async voidInvoice(invoiceId: string, reason: string): Promise<InvoiceDto> {
    const res = await this.request<InvoiceDto>(`/invoices/${invoiceId}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    return res.data;
  }


  public async getDashboard(): Promise<ClinicDashboardDto> {
    const res = await this.request<ClinicDashboardDto>("/dashboard");
    return res.data;
  }

  // --- Encounter Endpoints ---

  public async startEncounter(req: StartEncounterRequest): Promise<DentalEncounterDto> {
    const res = await this.request<DentalEncounterDto>("/encounters", {
      method: "POST",
      body: JSON.stringify(req),
    });
    return res.data;
  }

  public async getEncounter(id: string): Promise<DentalEncounterDto> {
    const res = await this.request<DentalEncounterDto>(`/encounters/${id}`);
    return res.data;
  }

  public async getPatientEncounters(patientId: string): Promise<DentalEncounterDto[]> {
    const res = await this.request<DentalEncounterDto[]>(`/patients/${patientId}/encounters`);
    return res.data;
  }

  public async completeEncounter(id: string, req?: CompleteEncounterRequest): Promise<void> {
    await this.request<void>(`/encounters/${id}/complete`, {
      method: "POST",
      body: req ? JSON.stringify(req) : undefined,
    });
  }

  public async cancelEncounter(id: string, req?: CancelEncounterRequest | string): Promise<void> {
    const body = typeof req === "string" ? { reason: req } : req;
    await this.request<void>(`/encounters/${id}/cancel`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async getEncounterFhirBundle(encounterId: string): Promise<unknown> {
    const res = await this.request<unknown>(`/encounters/${encounterId}/fhir`, {
      method: "GET",
    });
    return res.data;
  }

  // --- Odontogram Endpoints ---

  public async getOdontogramByEncounter(encounterId: string): Promise<{ odontogram: OdontogramResponseDto; etag?: string | null }> {
    const res = await this.request<OdontogramResponseDto>(`/encounters/${encounterId}/odontogram`);
    return { odontogram: res.data, etag: res.etag };
  }

  public async getLatestOdontogramByPatient(patientId: string): Promise<{ odontogram: OdontogramResponseDto; etag?: string | null }> {
    const res = await this.request<OdontogramResponseDto>(`/patients/${patientId}/odontogram/latest`);
    return { odontogram: res.data, etag: res.etag };
  }

  public async getOdontogramRevisions(encounterId: string): Promise<OdontogramRevisionDto[]> {
    const res = await this.request<OdontogramRevisionDto[]>(`/encounters/${encounterId}/odontogram/revisions`);
    return res.data;
  }

  public async saveOdontogram(
    encounterId: string,
    req: SaveOdontogramRequest,
    ifMatchETag?: string | null
  ): Promise<{ odontogram: OdontogramResponseDto; etag?: string | null }> {
    const headers: Record<string, string> = {};
    if (ifMatchETag) {
      headers["If-Match"] = ifMatchETag;
    }

    const res = await this.request<OdontogramResponseDto>(
      `/encounters/${encounterId}/odontogram`,
      {
        method: "PUT",
        body: JSON.stringify(req),
      },
      headers
    );

    return { odontogram: res.data, etag: res.etag };
  }

  public async finalizeOdontogram(
    encounterId: string,
    ifMatchETag?: string | null
  ): Promise<{ odontogram: OdontogramResponseDto; etag?: string | null }> {
    const headers: Record<string, string> = {};
    if (ifMatchETag) {
      headers["If-Match"] = ifMatchETag;
    }

    const res = await this.request<OdontogramResponseDto>(
      `/encounters/${encounterId}/odontogram/finalize`,
      {
        method: "POST",
      },
      headers
    );

    return { odontogram: res.data, etag: res.etag };
  }
}
