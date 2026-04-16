# API Documentation

Base URL: `{HOST}/api/v1`

All responses follow a consistent envelope format. Success responses return `{ success: true, data: ... }`. Error responses return `{ success: false, error: { code, message, details } }`.

Authentication is via Bearer token in the `Authorization` header unless noted otherwise.

---

## Authentication

### POST /api/v1/auth/login

Log in with email and password. Returns JWT access token and opaque refresh token.

**Auth**: None
**Rate limit**: 5 requests/minute per IP

**Request body**:
```json
{
  "email": "manager@insurance.ma",
  "password": "admin1234"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "manager@insurance.ma",
      "full_name": "Admin Manager",
      "role": "MANAGER",
      "operator_code": "mgr001"
    },
    "access_token": "eyJ...",
    "refresh_token": "uuid-string"
  }
}
```

**Errors**: `401 AUTH_INVALID_CREDENTIALS`, `403 AUTH_ACCOUNT_DISABLED`, `429 RATE_LIMIT_EXCEEDED`

**Example**:
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@insurance.ma","password":"admin1234"}'
```

---

### POST /api/v1/auth/refresh

Rotate the refresh token and get a new access token. The old refresh token is revoked.

**Auth**: None (token in body)
**Rate limit**: 10 requests/minute per IP

**Request body**:
```json
{
  "refresh_token": "uuid-string"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "new-uuid-string"
  }
}
```

**Errors**: `401 AUTH_REFRESH_INVALID`, `401 AUTH_REFRESH_EXPIRED`, `401 AUTH_REFRESH_REVOKED`

**Example**:
```bash
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"your-refresh-token"}'
```

---

### POST /api/v1/auth/logout

Revoke the refresh token and end the session.

**Auth**: Bearer token required

**Request body**:
```json
{
  "refresh_token": "uuid-string"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": { "message": "Deconnexion reussie" }
}
```

**Example**:
```bash
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"your-refresh-token"}'
```

---

## Employees

### GET /api/v1/employees

List all employees. Manager only.

**Auth**: Bearer token, role: MANAGER

**Query parameters**:
| Param | Type | Description |
|---|---|---|
| `is_active` | boolean | Filter by active status |
| `role` | string | `MANAGER` or `EMPLOYEE` |
| `search` | string | Search in name, email, operator code |

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "employe1@insurance.ma",
      "full_name": "Ahmed Benali",
      "operator_code": "int46442",
      "role": "EMPLOYEE",
      "is_active": true,
      "last_heartbeat": "2026-04-15T10:30:00.000Z",
      "created_at": "2026-04-15T08:00:00.000Z",
      "updated_at": "2026-04-15T10:30:00.000Z"
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3001/api/v1/employees?is_active=true \
  -H "Authorization: Bearer $TOKEN"
```

---

### GET /api/v1/employees/:id

Get a single employee. Managers can view any employee; employees can view their own profile.

**Auth**: Bearer token

**Response (200)**:
```json
{
  "success": true,
  "data": { "id": "uuid", "email": "...", "full_name": "...", ... }
}
```

**Errors**: `404 EMPLOYEE_NOT_FOUND`

---

### POST /api/v1/employees

Create a new employee. Manager only.

**Auth**: Bearer token, role: MANAGER

**Request body**:
```json
{
  "email": "new@insurance.ma",
  "password": "securepass123",
  "full_name": "Fatima Zahra",
  "operator_code": "int50001",
  "role": "EMPLOYEE"
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": { "id": "uuid", "email": "new@insurance.ma", ... }
}
```

**Errors**: `409 EMPLOYEE_EMAIL_EXISTS`, `409 EMPLOYEE_OPERATOR_CODE_EXISTS`

**Example**:
```bash
curl -X POST http://localhost:3001/api/v1/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@insurance.ma","password":"securepass123","full_name":"Fatima Zahra","operator_code":"int50001","role":"EMPLOYEE"}'
```

---

### PATCH /api/v1/employees/:id

Update an existing employee. Manager only. All fields optional.

**Auth**: Bearer token, role: MANAGER

**Request body** (partial):
```json
{
  "full_name": "Updated Name",
  "is_active": false
}
```

**Response (200)**: Updated employee object.
**Errors**: `404 EMPLOYEE_NOT_FOUND`, `409 EMPLOYEE_EMAIL_EXISTS`, `409 EMPLOYEE_OPERATOR_CODE_EXISTS`

---

### DELETE /api/v1/employees/:id

Delete an employee (cascades operations). Manager only.

**Auth**: Bearer token, role: MANAGER

**Response (200)**:
```json
{
  "success": true,
  "data": { "message": "Employe supprime" }
}
```

**Errors**: `404 EMPLOYEE_NOT_FOUND`

---

## Operations

### GET /api/v1/operations

List operations with filtering and pagination. Employees automatically see only their own operations.

**Auth**: Bearer token

**Query parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| `employee_id` | uuid | -- | Filter by employee (manager only) |
| `type` | string | -- | `PRODUCTION` or `EMISSION` |
| `source` | string | -- | `EXCEL`, `MANUAL`, or `SCRAPER` |
| `policy_status` | string | -- | Filter by policy status text |
| `date_from` | ISO date | -- | Start date filter |
| `date_to` | ISO date | -- | End date filter |
| `search` | string | -- | Search policy number, client name |
| `page` | number | 1 | Page number (1-based) |
| `per_page` | number | 25 | Items per page (max 100) |
| `sort_by` | string | `created_at` | Sort field |
| `sort_order` | string | `desc` | `asc` or `desc` |

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "items": [ { "id": "uuid", "type": "PRODUCTION", ... } ],
    "pagination": {
      "page": 1,
      "per_page": 25,
      "total_items": 150,
      "total_pages": 6
    }
  }
}
```

**Example**:
```bash
curl "http://localhost:3001/api/v1/operations?type=PRODUCTION&page=1&per_page=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

### POST /api/v1/operations

Create a manual operation entry. Source is automatically set to `MANUAL`. Employees create their own operations; managers can optionally specify `employee_id`.

**Auth**: Bearer token

**Request body**:
```json
{
  "type": "PRODUCTION",
  "policy_number": "POL-2026-001",
  "client_name": "Mohammed El Fassi",
  "prime_net": "1500.00",
  "effective_date": "2026-04-15T00:00:00.000Z"
}
```

**Response (201)**: Created operation object.

Side effect: Emits `operation:new` via Socket.IO to the `dashboard` room.

---

### GET /api/v1/operations/stats

Aggregate statistics for operations. Manager only.

**Auth**: Bearer token, role: MANAGER

**Query parameters**: `employee_id`, `date_from`, `date_to`

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "total_operations": 150,
    "total_prime_net": "450000.00",
    "total_commissions": "22500.00",
    "total_policies": 85,
    "by_type": { "PRODUCTION": 90, "EMISSION": 60 },
    "by_source": { "EXCEL": 120, "MANUAL": 30, "SCRAPER": 0 }
  }
}
```

---

### GET /api/v1/operations/export

Export operations as an Excel (.xlsx) file. Uses same filters as the list endpoint (excluding pagination).

**Auth**: Bearer token, role: MANAGER

**Response**: Binary `.xlsx` file with `Content-Disposition: attachment` header.

**Example**:
```bash
curl -o operations.xlsx "http://localhost:3001/api/v1/operations/export?type=PRODUCTION" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Uploads

### POST /api/v1/uploads

Upload an Excel file (RMA format) for batch import. Processing is asynchronous -- the response returns immediately with status `PROCESSING`.

**Auth**: Bearer token, role: MANAGER
**Content-Type**: `multipart/form-data`
**Max file size**: 10 MB
**Accepted format**: `.xlsx` only

**Response (202)**:
```json
{
  "success": true,
  "data": {
    "upload_id": "uuid",
    "status": "PROCESSING",
    "filename": "etat_journalier_2026-04.xlsx"
  }
}
```

**Side effects**: Emits `upload:progress` and `upload:complete` events via Socket.IO.

**Errors**: `400 UPLOAD_INVALID_FILE_TYPE`, `400 UPLOAD_FILE_TOO_LARGE`

**Example**:
```bash
curl -X POST http://localhost:3001/api/v1/uploads \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@etat_journalier.xlsx"
```

---

### GET /api/v1/uploads

List upload history with pagination. Manager only.

**Auth**: Bearer token, role: MANAGER

**Query parameters**: `status`, `page`, `per_page`

---

### GET /api/v1/uploads/:id

Get details for a single upload. Manager only.

**Auth**: Bearer token, role: MANAGER

---

## Dashboard

### GET /api/v1/dashboard/kpis

Financial KPIs for today, this week, and this month. Manager only.

**Auth**: Bearer token, role: MANAGER

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "today": { "total_prime": "15000.00", "total_commission": "750.00", "operations_count": 12, "policies_count": 8 },
    "week": { "total_prime": "85000.00", "total_commission": "4250.00", "operations_count": 67, "policies_count": 35 },
    "month": { "total_prime": "450000.00", "total_commission": "22500.00", "operations_count": 150, "policies_count": 85 }
  }
}
```

---

### GET /api/v1/dashboard/activity

Recent activity feed (latest operations created). Manager only.

**Auth**: Bearer token, role: MANAGER

**Query parameters**: `limit` (default 20, max 50)

---

### GET /api/v1/dashboard/presence

Current employee presence status based on heartbeat data. Manager only.

**Auth**: Bearer token, role: MANAGER

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "employee_id": "uuid",
      "employee_name": "Ahmed Benali",
      "status": "online",
      "last_heartbeat": "2026-04-15T10:30:00.000Z"
    }
  ]
}
```

---

## Health Check

### GET /health

Returns server status and database connectivity. No authentication required.

**Response (200)**:
```json
{
  "status": "ok",
  "db": "connected",
  "uptime": 3600.5,
  "memory": { "rss": 50000000, "heapTotal": 30000000, "heapUsed": 25000000 }
}
```

**Example**:
```bash
curl http://localhost:3001/health
```

---

## Socket.IO Events

Connection URL: same as API host. Auth: `{ token: "<access_token>" }` in handshake.

### Client to Server

| Event | Payload | Description |
|---|---|---|
| `heartbeat` | None | Send every 30s to maintain presence |
| `join:dashboard` | None | Join dashboard room (manager only) |
| `leave:dashboard` | None | Leave dashboard room |

### Server to Client

| Event | Room | Payload | Trigger |
|---|---|---|---|
| `presence:update` | `dashboard` | `{ employee_id, status, last_heartbeat }` | Heartbeat or status change |
| `operation:new` | `dashboard` | `{ operation: ActivityItem }` | New operation created |
| `upload:progress` | `user:{id}` | `{ upload_id, processed_rows, total_rows }` | During Excel processing |
| `upload:complete` | `user:{id}` | `{ upload_id, result: UploadResult }` | Processing finished |
| `employee:updated` | `dashboard` | `{ employee: Employee }` | Employee created/updated/deactivated |
