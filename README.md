# BizFinder / Businessmen Backend API

Production-ready Node.js & MongoDB REST API implementation for the **BizFinder (Businessmen)** Flutter mobile application, matching [BACKEND_API_SPECIFICATION.md](file:///d:/khyati%20kotadiya/business-app/BACKEND_API_SPECIFICATION.md).

---

## 📁 Project Folder Structure

```
business-app/
├── BACKEND_API_SPECIFICATION.md     # Original API requirements
├── BizFinder_API.postman_collection.json  # Complete Postman Collection for Flutter frontend
├── package.json
├── .env.example                     # Environment template
├── .env                             # Local environment configuration
├── README.md
├── uploads/                         # Uploaded files served statically at /uploads
│   ├── avatars/                     # User profile photos
│   └── businesses/                  # Business photos and banners
└── src/
    ├── config/
    │   └── db.js                    # MongoDB connection via Mongoose
    ├── models/                      # MongoDB Schemas & Models
    │   ├── Admin.js                 # Admin user accounts with bcrypt
    │   ├── User.js
    │   ├── Otp.js
    │   ├── City.js
    │   ├── Sector.js
    │   ├── Category.js
    │   ├── Business.js
    │   ├── Favorite.js
    │   ├── Notification.js
    │   ├── DeviceToken.js
    │   ├── SupportInquiry.js
    │   ├── Faq.js
    │   └── Legal.js
    ├── middlewares/
    │   ├── authMiddleware.js         # JWT verification (protect & optionalAuth)
    │   ├── adminAuthMiddleware.js    # Admin JWT verification & SuperAdmin privilege
    │   ├── uploadMiddleware.js       # Multer file upload handlers
    │   └── errorMiddleware.js        # Global error & 404 handler
    ├── controllers/
    │   ├── admin/                    # 10 Admin Portal Controllers
    │   │   ├── adminAuthController.js
    │   │   ├── adminDashboardController.js
    │   │   ├── adminBusinessController.js
    │   │   ├── adminCategoryController.js
    │   │   ├── adminCityController.js
    │   │   ├── adminUserController.js
    │   │   ├── adminSupportController.js
    │   │   ├── adminFaqController.js
    │   │   ├── adminNotificationController.js
    │   │   └── adminLegalController.js
    │   ├── authController.js
    │   ├── userController.js
    │   ├── cityController.js
    │   ├── categoryController.js
    │   ├── businessController.js
    │   ├── favoriteController.js
    │   ├── vendorController.js
    │   ├── notificationController.js
    │   ├── supportController.js
    │   └── legalController.js
    ├── routes/
    │   ├── admin/                    # Admin Portal Routes (/api/v1/admin)
    │   ├── authRoutes.js
    │   ├── userRoutes.js
    │   ├── cityRoutes.js
    │   ├── categoryRoutes.js
    │   ├── businessRoutes.js
    │   ├── vendorRoutes.js
    │   ├── notificationRoutes.js
    │   ├── supportRoutes.js
    │   ├── legalRoutes.js
    │   └── index.js                 # Aggregated router under /api/v1
    ├── utils/
    │   ├── responseHelper.js        # Standard response envelope
    │   ├── access.js                # Admin roles: state / city / sector areas and permission checks
    │   ├── distanceCalculator.js    # Haversine distance calculator
    │   ├── phone.js                 # Indian mobile number checks (login number)
    │   ├── sms.js                   # Login OTP by SMS (MSG91, Fast2SMS or Twilio)
    │   └── idGenerator.js           # ID, Ticket & initials generator
    ├── app.js                       # Express app setup & middlewares
    └── server.js                    # Server startup script
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.x or newer (Tested on Node v24)
- **MongoDB**: Local MongoDB instance running on `mongodb://127.0.0.1:27017` or MongoDB Atlas URI

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` (already created with defaults):
```ini
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/bizfinder_db
JWT_SECRET=super_secret_jwt_key_bizfinder_2026_dev
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=super_refresh_jwt_key_bizfinder_2026_dev
JWT_REFRESH_EXPIRES_IN=30d
BASE_URL=http://localhost:5000

# SMS delivery for login OTPs (required when NODE_ENV=production). Pick one provider:
SMS_PROVIDER=msg91            # msg91 | fast2sms | twilio
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_TEMPLATE_ID=your_dlt_approved_otp_template_id
# FAST2SMS_API_KEY=your_fast2sms_api_key
# TWILIO_ACCOUNT_SID=ACxxxxxxxx
# TWILIO_AUTH_TOKEN=your_twilio_auth_token
# TWILIO_FROM=+1XXXXXXXXXX     # sender number, or a Messaging Service SID (MG...)
APP_NAME=Rotaract Clubs        # used in the Twilio message text
```

> **Login OTP email:** a random 6-digit code is emailed over SMTP to the registered user's email (set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optionally `SMTP_FROM` in `.env`). There is no fixed/static code; without SMTP settings `send-otp` returns `EMAIL_NOT_CONFIGURED`.
> MSG91 and Fast2SMS send to Indian numbers through DLT-registered OTP templates; for MSG91 the template must contain `##OTP##`.

### 4. First Admin Account
There is no database seeder: all data (states, cities, sectors, categories, users, businesses, FAQs, legal policies) is managed from the admin panel.
When the server starts and the database has **no admin accounts at all**, it creates one super admin so you can log in:
`SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` from `.env` (defaults `admin@bizfinder.com` / `admin123`). Change the password after the first login. Existing data is never touched.

### 5. Start Development Server
```bash
npm run dev
```
Or for production:
```bash
npm start
```
The server will start at: `http://localhost:5000/api/v1`

---

## 📬 Postman Collections

Two comprehensive Postman Collections are included in this project:

### 1. Flutter Mobile App Collection
👉 **`BizFinder_API.postman_collection.json`**
- Contains all client-side endpoints (Auth, User Profile, Search, Filters, Favorites, Vendor Listings, Notifications, FAQs, Legal).
- **Auto-Token Handling**: Executing `1. Authentication & Profile -> Verify OTP & Login` automatically captures and saves `{{accessToken}}`.
- **Demo Credentials**: an email added from the admin panel; the OTP arrives in that mailbox.

### 2. Admin Panel & Portal Collection
👉 **`BizFinder_Admin_API.postman_collection.json`**
- Dedicated collection for the administrative web panel and moderation team.
- Contains all 10 admin modules (Auth, Dashboard Stats, Businesses CRUD & Verification, Categories, Cities/Sectors, User Moderation, Support Tickets, FAQs, Notifications Broadcast, Legal Policies).
- **Auto-Token Handling**: Executing `Admin Auth & Profile -> Admin Login` automatically captures and saves `{{adminToken}}`.
- **Admin Credentials**: `admin@bizfinder.com` / `admin123`.

---

## 🌐 API Endpoints Reference

Base URL: `http://localhost:5000/api/v1`

### 1. Authentication & Profile

Only mobile numbers added by an admin (Admin panel → Users → Add user, or `POST /admin/users`) can log in. Login is mobile number + SMS OTP only. The number can be sent as `9876543210`, `+919876543210` or `+91 98765 43210`.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/send-otp` | Public | `{ phoneNumber }`. Texts a 6-digit OTP to a **registered** mobile number (403 `PHONE_NOT_REGISTERED` otherwise, 409 `PHONE_NOT_UNIQUE` if two users share it; 30s resend cooldown). Sending `email` returns 400 `LOGIN_METHOD_CHANGED` |
| `POST` | `/auth/verify-otp` | Public | `{ phoneNumber, otp }`. Verifies OTP (expires in 10 min, max 5 tries) and returns access token + user. Never creates accounts |
| `POST` | `/auth/google` | Public | Disabled (403 `LOGIN_METHOD_DISABLED`) |
| `POST` | `/auth/apple` | Public | Disabled (403 `LOGIN_METHOD_DISABLED`) |
| `POST` | `/auth/refresh-token` | Public | Refreshes expired access token |
| `GET` | `/user/profile` | Bearer | Returns logged-in user profile **plus `businessCount` and `businesses[]`** (all businesses owned by the user's email) |
| `GET` | `/user/businesses` | Bearer | Lists the logged-in user's businesses (optional `status` filter) |
| `POST` | `/user/businesses` | Bearer | Creates a business owned by the logged-in user |
| `PUT` | `/user/profile` | Bearer | Updates name or avatar (`multipart/form-data`). The mobile number is the login and can only be changed by an admin (400 `PHONE_CHANGE_NOT_ALLOWED`) |
| `DELETE`| `/user/account` | Bearer | Permanently deletes account & data |

### 2. States, Cities & Sectors
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/states` | Public | Lists all states with image, `code`, `cityCount`, and a live `businessCount` (counted from the businesses in its cities, border cities included; not stored) |
| `GET` | `/states/:id` | Public | State details by ID (e.g. `gujarat`) |
| `GET` | `/states/:stateId/cities` | Public | Lists all cities in a state (e.g. 33 cities in Gujarat), including border cities that are also under it |
| `GET` | `/cities` | Public | Lists all cities (filters: `search`, `state`; `state` includes border cities) |
| `GET` | `/cities/states` | Public | Alias to list all states |
| `GET` | `/cities/:cityId/sectors` | Public | Lists sectors within a city (filters: `search`) |

### 3. Categories
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | Public | Lists categories (optional `city` query recalculates business counts) |

### 4. Businesses Listing & Search
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/businesses` | Optional | Search & filter businesses with query, city, category, sector, minRating, openOnly, coordinates distance |
| `POST` | `/businesses` | Bearer | Creates a business owned by the logged-in user's email, placed at the user's state, city and sector (no location fields; `400 LOCATION_NOT_SET` if the user has none). JSON or `multipart/form-data`, image field `image`, max 10 MB |
| `GET` | `/businesses/top-rated`| Optional | Top-rated businesses for home screen carousel |
| `GET` | `/businesses/:id` | Optional | Single business detail (contact, timings, specialties, isFavorite) |
| `GET` | `/people` | Optional | Search people (business owners): each result is a person with their businesses, matched ones first (`query`, `category`, `state`, `city`, `sector`, `page`, `limit`) |
| `GET` | `/people/:id` | Optional | One person with all of their live businesses |
| `GET` | `/search` | Optional | Global search for people by name, mobile number, business name or specialization keywords (`q`, `state`, `city`, `sector`, `page`, `limit`) |

### 5. Favorites (Bookmarks)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/user/favorites` | Bearer | Lists the people the user saved (with their businesses) |
| `POST` | `/user/favorites/:personId`| Bearer | Saves a person (id from `/people`) to favorites |
| `DELETE`| `/user/favorites/:personId`| Bearer | Removes a person from favorites |
| `POST` / `DELETE` | `/user/favorites` | Bearer | Same as above with `{ "personId": "usr_..." }` in the body |

### 6. Vendor Management ("My Listings")
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/vendor/listings` | Bearer | Lists all businesses owned by the user's email |
| `POST` | `/vendor/listings` | Bearer | Creates a new business listing (`multipart/form-data`) |
| `PUT` | `/vendor/listings/:id` | Bearer | Updates owned business listing |
| `DELETE`| `/vendor/listings/:id` | Bearer | Deletes owned business listing |

### 7. Notifications
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | Bearer | In-app notifications and unread counter |
| `PATCH` | `/notifications/mark-read`| Bearer | Marks notifications as read (`{ notificationIds: ["all"] }`) |
| `POST` | `/notifications/device-token`| Bearer | Registers FCM push notification token |

### 8. Support, FAQs & Inquiries
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/support/faqs` | Public | Frequently Asked Questions |
| `POST` | `/support/inquiry` | Optional | Submits user inquiry/support ticket (returns `TIC-XXXX`) |

### 9. Legal Policies
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/legal/terms-and-privacy` | Public | Returns Terms of Service or Privacy Policy (`type=terms` or `type=privacy`) |

---

## 🛡️ 10. Admin Portal APIs Reference

Base URL: `http://localhost:5000/api/v1/admin`

### Default Admin Credentials:
- **SuperAdmin**: `admin@bizfinder.com` / `admin123` (created on first start when there are no admins; see `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`)

### Admin roles and areas

Every person registers under a state, a city in that state, and a sector in that city. Admin accounts are limited to an area:

| Role | Manages | Can add admins |
| :--- | :--- | :--- |
| `superadmin` | Everything, including every admin account | Any role |
| `admin` | Every state, city and sector, plus shared content (categories, FAQs, legal, broadcasts, support) | State, city and sector admins |
| `state_admin` | The states in `states` (ids): their cities (including border cities), sectors, people and businesses. Can add cities and sectors there | City and sector admins inside their states |
| `city_admin` | The cities in `cities` (ids): their sectors, people and businesses. Can rename the city and add, rename or delete its sectors | Sector admins inside their cities |
| `sector_admin` | The sectors in `sectors` (ids): their people and businesses only | None |

- Many admins can share the same state, city or sector, and one admin can have several.
- **State codes**: every state has a unique `code` of 2 to 6 digits, e.g. `3010` = Gujarat, `3011` = Maharashtra.
- **Border cities and villages**: a city has a main `state` and `otherStates` (border states). It is listed and managed under all of them, so its people and businesses are managed by the admins of every one of those states. A state admin can add border states to their cities, but can only remove states they manage, and can only delete a city when every state it is under is theirs.
- People and businesses belong to the area of their city and sector. Lists, counts and the dashboard only include the admin's area; opening or changing anything outside it returns `403 OUT_OF_SCOPE`. A user can only be added or moved to a sector inside the admin's area, and a business can only be given an owner inside it.
- Categories (read is open to every admin), FAQs, legal policies, broadcasts and support tickets are shared by every location, so only `superadmin` and `admin` manage them (`403 FORBIDDEN` for others).
- Renaming or deleting a state, city or sector keeps everything linked: users, businesses, border lists and admin areas follow the change.

| Module | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/admin/auth/login` | Admin login with JWT generation. Returns the admin with `scope` (names of their states/cities/sectors) and `access` (`level`, `isGlobal`, `assignableRoles`, `canManageAdmins`) |
| **Auth** | `GET` | `/admin/auth/profile` | Current admin profile with `scope` and `access` |
| **Auth** | `PUT` | `/admin/auth/profile` | Update profile / change password (8–64 characters, a letter and a number) |
| **Auth** | `GET` | `/admin/auth/admins` | Admin accounts with their `scope` and `canManage`. Super admins and admins see all; state and city admins see the admins they manage |
| **Auth** | `POST` | `/admin/auth/admins` | Create an admin: `{ name, email, password, role, states? \| cities? \| sectors? }` (ids for the role's area, each inside your own area). Errors: `ROLE_NOT_ALLOWED`, `INVALID_SCOPE`, `DUPLICATE_EMAIL` |
| **Auth** | `PUT` | `/admin/auth/admins/:id` | Edit an admin you manage: name, email, role, area, optional new `password` |
| **Auth** | `PATCH`| `/admin/auth/admins/:id/status`| Deactivate/activate an admin you manage |
| **Auth** | `DELETE`| `/admin/auth/admins/:id` | Remove an admin you manage |
| **Dashboard** | `GET` | `/admin/dashboard/stats` | KPI counters, charts distribution, recent items, for the admin's area (support only for global admins; sector admins get `charts.bySector`) |
| **States** | `GET` | `/admin/states` | States in the admin's area with live `actualCityCount`, `borderCityCount`, `actualBusinessCount` (`search` matches name or code) |
| **States** | `GET` | `/admin/states/options` | Every state's `id`, `name`, `code` (for pickers such as a city's border states) |
| **States** | `GET` | `/admin/states/:id` | State with its cities (border cities have `isBorder: true` and `allStates`) |
| **States** | `POST` | `/admin/states` | Create state (global admins). `code` required: 2–6 digits, unique (409 `DUPLICATE_CODE`) |
| **States** | `PUT` | `/admin/states/:id` | Update state (global admins). Renaming updates cities, users and businesses |
| **States** | `DELETE`| `/admin/states/:id` | Delete state (global admins). Removed from border lists and admin areas |
| **Businesses** | `GET` | `/admin/businesses` | Filterable list with pagination, status, verification and `ownerEmail` (`none` = unowned) |
| **Businesses** | `POST` | `/admin/businesses` | Create business with banner upload (`multipart/form-data`). `ownerEmail` is required; the business is placed at the owner's state, city and sector (`OWNER_REQUIRED`, `OWNER_NOT_FOUND`, `OWNER_LOCATION_MISSING`) |
| **Businesses** | `GET` | `/admin/businesses/:id` | Full business details incl. `ownerAccount` (the owning user) |
| **Businesses** | `PUT` | `/admin/businesses/:id` | Update business info / banner. State, city and sector can't be edited. Send `ownerEmail` to assign a new owner (moves the business to their location) or `""` to unassign |
| **Businesses** | `PATCH`| `/admin/businesses/:id/status`| Toggle `status`, `isVerified`, `isFeatured`, `isOpen` |
| **Businesses** | `DELETE`| `/admin/businesses/:id` | Delete business listing |
| **Categories** | `GET` | `/admin/categories` | List categories with actual business counts |
| **Categories** | `POST` | `/admin/categories` | Create new category (global admins) |
| **Categories** | `PUT` | `/admin/categories/:id` | Update category details (global admins) |
| **Categories** | `DELETE`| `/admin/categories/:id` | Delete category (global admins) |
| **Cities** | `GET` | `/admin/cities` | Cities in the admin's area with business and sector counts, `isBorder` and `canManage` (`state` filter includes border cities) |
| **Cities** | `GET` | `/admin/cities/:id` | City with its sectors (sector admins get only their sectors) |
| **Cities** | `POST` | `/admin/cities` | Create city (global and state admins): `{ name, state, otherStates?: ["Maharashtra"], imageUrl? }`. A state admin's main state must be theirs |
| **Cities** | `PUT` | `/admin/cities/:id` | Update city (global, state and city admins of the city). Only global and state admins change `state` / `otherStates`. Renaming updates users and businesses |
| **Cities** | `DELETE`| `/admin/cities/:id` | Delete city and its sectors (global admins, or a state admin of every state it is under) |
| **Sectors** | `GET` | `/admin/cities/:cityId/sectors`| List sectors in a city (sector admins get only theirs) |
| **Sectors** | `POST` | `/admin/cities/:cityId/sectors`| Add sector to a city (global, state and city admins of the city) |
| **Sectors** | `PUT` | `/admin/sectors/:id` | Update sector (same as above). Renaming updates users and businesses |
| **Sectors** | `DELETE`| `/admin/sectors/:id` | Delete sector (same as above). Removed from sector admins' areas |
| **Users** | `GET` | `/admin/users` | List users in the admin's area with search, role, status, `state`, `city`, `sector` filters (includes `listingsCount`, `lastLoginAt`) |
| **Users** | `POST` | `/admin/users` | Add a user so they can log in to the app (`{ phoneNumber, email, state, city, sector, name? }`). `phoneNumber` is their login: required, a valid 10-digit Indian mobile, one user per number (409 `PHONE_EXISTS`), saved as `+91XXXXXXXXXX`. `email` owns their businesses. The location is required, must come from the states → cities → sectors lists (a border city can be chosen under any of its states), must be inside the admin's area (403 `OUT_OF_SCOPE`), and is where the user's businesses are listed |
| **Users** | `PUT` | `/admin/users/:id` | Edit name / email / phone / location (send state, city and sector together). Changing the email or the location moves the user's businesses; a new phone number replaces their login (must be free, 409 `PHONE_EXISTS`) |
| **Users** | `GET` | `/admin/users/:id` | View user with all their businesses (`listings`) & favorites count |
| **Users** | `PATCH`| `/admin/users/:id/status` | Block/unblock/suspend user account |
| **Users** | `DELETE`| `/admin/users/:id` | Remove user (can no longer log in). Their businesses stay and reconnect if the email is added again |
| **Support / FAQs / Notifications / Legal** | | | Global admins only (`superadmin`, `admin`) |
| **Support** | `GET` | `/admin/support/inquiries` | List inquiries (filter: open, in_progress, resolved) |
| **Support** | `GET` | `/admin/support/inquiries/:ticketId`| View inquiry details |
| **Support** | `PATCH`| `/admin/support/inquiries/:ticketId/status`| Update status to resolved / in_progress |
| **Support** | `DELETE`| `/admin/support/inquiries/:ticketId`| Delete inquiry ticket |
| **FAQs** | `GET` | `/admin/faqs` | List all FAQs |
| **FAQs** | `POST` | `/admin/faqs` | Create FAQ |
| **FAQs** | `PUT` | `/admin/faqs/:id` | Update FAQ |
| **FAQs** | `DELETE`| `/admin/faqs/:id` | Delete FAQ |
| **Notifications** | `GET` | `/admin/notifications` | View system notifications |
| **Notifications** | `POST` | `/admin/notifications/broadcast` | Send broadcast notification to all users |
| **Notifications** | `DELETE`| `/admin/notifications/:id` | Delete notification |
| **Legal** | `GET` | `/admin/legal` | View all legal policies |
| **Legal** | `PUT` | `/admin/legal/:type` | Update Terms of Service or Privacy Policy |
#   R o t a v e r s e  
 