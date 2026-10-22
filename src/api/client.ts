import type {
  AuthTokenResponse,
  LoginRequest,
  CurrentUserResponse,
  PatientDto,
  CreatePatientRequest,
  UpdatePatientRequest,
  PagedResult,
  DentalEncounterDto,
  StartEncounterRequest,
  CompleteEncounterRequest,
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

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
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
      this.onUnauthorized?.();
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

  public async login(req: LoginRequest): Promise<AuthTokenResponse> {
    const res = await this.request<AuthTokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(req),
    });
    this.setToken(res.data.token);
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

  // --- Patient Endpoints ---

  public async getPatients(pageNumber = 1, pageSize = 20, searchTerm?: string): Promise<PagedResult<PatientDto>> {
    const query = new URLSearchParams({
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
    });
    if (searchTerm) {
      query.set("searchTerm", searchTerm);
    }
    const res = await this.request<PagedResult<PatientDto>>(`/patients?${query.toString()}`);
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

  public async updatePatient(id: string, req: UpdatePatientRequest): Promise<PatientDto> {
    const res = await this.request<PatientDto>(`/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(req),
    });
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
      body: JSON.stringify(req || {}),
    });
  }

  public async cancelEncounter(id: string): Promise<void> {
    await this.request<void>(`/encounters/${id}/cancel`, {
      method: "POST",
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
